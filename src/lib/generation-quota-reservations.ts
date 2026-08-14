import "server-only";

import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  DurableStorageUnavailableError,
  getDailyFreeGenerationLimit,
  getStorageCapabilities,
} from "@/lib/storage";

export type GenerationQuotaReservationState =
  | "reserved"
  | "committed"
  | "refunded";

export type GenerationQuotaReservation = {
  version: 1;
  reservationId: string;
  identifierHash: string;
  idempotencyKeyHash: string;
  dayKey: string;
  state: GenerationQuotaReservationState;
  limit: number;
  createdAt: number;
  updatedAt: number;
  resetAt: number;
  expiresAt: number;
};

export type ReserveGenerationQuotaInput = {
  /** Caller-provided SHA-256 hex digest. Raw IPs or fingerprints are rejected. */
  identifierHash: string;
  reservationId: string;
  idempotencyKey: string;
  now?: Date | number;
};

export type ReserveGenerationQuotaResult =
  | {
      outcome: GenerationQuotaReservationState;
      created: boolean;
      remaining: number;
      reservation: GenerationQuotaReservation;
    }
  | {
      outcome: "quota_exhausted" | "conflict";
      created: false;
      remaining: number;
      reservation?: undefined;
    };

export type FinalizeGenerationQuotaReservationInput = {
  reservationId: string;
  outcome: "commit" | "refund";
  now?: Date | number;
};

export type MutateGenerationQuotaReservationInput = Omit<
  FinalizeGenerationQuotaReservationInput,
  "outcome"
>;

export type MutateGenerationQuotaReservationResult = {
  outcome:
    | GenerationQuotaReservationState
    | "not_found"
    | "conflict";
  changed: boolean;
  reservation?: GenerationQuotaReservation;
};

export type GenerationQuotaReservationCapabilities = {
  shared: boolean;
  adapter: "redis" | "local" | "unavailable";
};

type LocalIdempotencyEntry = {
  reservationId: string;
  expiresAt: number;
};

type LocalUsageEntry = {
  count: number;
  resetAt: number;
};

const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const RESERVATION_GRACE_MS = 24 * 60 * 60 * 1000;
const IDENTIFIER_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const RESERVATION_ID_PATTERN = /^[A-Za-z0-9_-]{12,80}$/;
const MAX_IDEMPOTENCY_KEY_LENGTH = 500;
const USAGE_KEY_PREFIX = "storybloom:generation-quota-usage:v1:";
const RESERVATION_KEY_PREFIX =
  "storybloom:generation-quota-reservation:v1:";
const IDEMPOTENCY_KEY_PREFIX =
  "storybloom:generation-quota-idempotency:v1:";

const localUsage = new Map<string, LocalUsageEntry>();
const localReservations = new Map<string, GenerationQuotaReservation>();
const localIdempotency = new Map<string, LocalIdempotencyEntry>();
let redisClient: Redis | null | undefined;

const RESERVE_SCRIPT = `
-- generation-quota:reserve
local function set_until(key, value, expiresAt)
  redis.call("SET", key, value)
  redis.call("PEXPIREAT", key, expiresAt)
end

local function current_remaining()
  local count = tonumber(redis.call("GET", KEYS[1]) or "0")
  return math.max(0, tonumber(ARGV[7]) - count)
end

local function valid_record(record, reservationId)
  if type(record) ~= "table" then return false end
  local state = record["state"]
  return tonumber(record["version"] or 0) == 1
    and record["reservationId"] == reservationId
    and record["identifierHash"] == ARGV[2]
    and record["idempotencyKeyHash"] == ARGV[3]
    and record["dayKey"] == ARGV[4]
    and (state == "reserved" or state == "committed" or state == "refunded")
end

local existingRaw = redis.call("GET", KEYS[2])
if existingRaw then
  local decoded, record = pcall(cjson.decode, existingRaw)
  if not decoded or not valid_record(record, ARGV[1]) then
    return cjson.encode({ outcome = "conflict", created = false, remaining = current_remaining() })
  end
  local mappedId = redis.call("GET", KEYS[3])
  if mappedId and mappedId ~= ARGV[1] then
    return cjson.encode({ outcome = "conflict", created = false, remaining = current_remaining() })
  end
  set_until(KEYS[2], existingRaw, tonumber(record["expiresAt"]))
  set_until(KEYS[3], ARGV[1], tonumber(record["expiresAt"]))
  return cjson.encode({
    outcome = record["state"],
    created = false,
    remaining = current_remaining(),
    reservation = record
  })
end

local mappedId = redis.call("GET", KEYS[3])
if mappedId then
  local mappedKey = ARGV[10] .. mappedId
  local mappedRaw = redis.call("GET", mappedKey)
  if mappedRaw then
    local decoded, record = pcall(cjson.decode, mappedRaw)
    if not decoded or not valid_record(record, mappedId) then
      return cjson.encode({ outcome = "conflict", created = false, remaining = current_remaining() })
    end
    set_until(mappedKey, mappedRaw, tonumber(record["expiresAt"]))
    set_until(KEYS[3], mappedId, tonumber(record["expiresAt"]))
    return cjson.encode({
      outcome = record["state"],
      created = false,
      remaining = current_remaining(),
      reservation = record
    })
  end
  redis.call("DEL", KEYS[3])
end

local count = tonumber(redis.call("GET", KEYS[1]) or "0")
if count >= tonumber(ARGV[7]) then
  return cjson.encode({ outcome = "quota_exhausted", created = false, remaining = 0 })
end

local nextCount = count + 1
set_until(KEYS[1], tostring(nextCount), tonumber(ARGV[6]))
set_until(KEYS[2], ARGV[9], tonumber(ARGV[8]))
set_until(KEYS[3], ARGV[1], tonumber(ARGV[8]))
return cjson.encode({
  outcome = "reserved",
  created = true,
  remaining = math.max(0, tonumber(ARGV[7]) - nextCount),
  reservation = cjson.decode(ARGV[9])
})
`;

const COMMIT_SCRIPT = `
-- generation-quota:commit
local raw = redis.call("GET", KEYS[1])
if not raw then
  return cjson.encode({ outcome = "not_found", changed = false })
end
local decoded, record = pcall(cjson.decode, raw)
if not decoded or type(record) ~= "table"
  or tonumber(record["version"] or 0) ~= 1
  or record["reservationId"] ~= ARGV[1] then
  return cjson.encode({ outcome = "conflict", changed = false })
end

local changed = false
if record["state"] == "reserved" then
  record["state"] = "committed"
  record["updatedAt"] = tonumber(ARGV[2])
  changed = true
elseif record["state"] ~= "committed" and record["state"] ~= "refunded" then
  return cjson.encode({ outcome = "conflict", changed = false })
end

local nextRaw = cjson.encode(record)
redis.call("SET", KEYS[1], nextRaw)
redis.call("PEXPIREAT", KEYS[1], tonumber(record["expiresAt"]))
local idempotencyKey = ARGV[3] .. record["dayKey"] .. ":" .. record["identifierHash"] .. ":" .. record["idempotencyKeyHash"]
redis.call("SET", idempotencyKey, ARGV[1])
redis.call("PEXPIREAT", idempotencyKey, tonumber(record["expiresAt"]))
return cjson.encode({ outcome = record["state"], changed = changed, reservation = record })
`;

const REFUND_SCRIPT = `
-- generation-quota:refund
local raw = redis.call("GET", KEYS[1])
if not raw then
  return cjson.encode({ outcome = "not_found", changed = false })
end
local decoded, record = pcall(cjson.decode, raw)
if not decoded or type(record) ~= "table"
  or tonumber(record["version"] or 0) ~= 1
  or record["reservationId"] ~= ARGV[1] then
  return cjson.encode({ outcome = "conflict", changed = false })
end

local changed = false
if record["state"] == "reserved" then
  local usageKey = ARGV[4] .. record["dayKey"] .. ":" .. record["identifierHash"]
  local count = tonumber(redis.call("GET", usageKey) or "0")
  if count > 1 then
    redis.call("DECR", usageKey)
  elseif count == 1 then
    redis.call("DEL", usageKey)
  end
  record["state"] = "refunded"
  record["updatedAt"] = tonumber(ARGV[2])
  changed = true
elseif record["state"] ~= "committed" and record["state"] ~= "refunded" then
  return cjson.encode({ outcome = "conflict", changed = false })
end

local nextRaw = cjson.encode(record)
redis.call("SET", KEYS[1], nextRaw)
redis.call("PEXPIREAT", KEYS[1], tonumber(record["expiresAt"]))
local idempotencyKey = ARGV[3] .. record["dayKey"] .. ":" .. record["identifierHash"] .. ":" .. record["idempotencyKeyHash"]
redis.call("SET", idempotencyKey, ARGV[1])
redis.call("PEXPIREAT", idempotencyKey, tonumber(record["expiresAt"]))
return cjson.encode({ outcome = record["state"], changed = changed, reservation = record })
`;

function configuredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function getRedis() {
  if (redisClient !== undefined) return redisClient;
  if (!getStorageCapabilities().shared) {
    redisClient = null;
    return redisClient;
  }

  const upstashUrl = configuredValue(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = configuredValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  const kvUrl = configuredValue(process.env.KV_REST_API_URL);
  const kvToken = configuredValue(process.env.KV_REST_API_TOKEN);
  const configuration = upstashUrl && upstashToken
    ? { url: upstashUrl, token: upstashToken }
    : kvUrl && kvToken
      ? { url: kvUrl, token: kvToken }
      : null;
  redisClient = configuration ? new Redis(configuration) : null;
  return redisClient;
}

function getBackend() {
  const redis = getRedis();
  if (redis) return { kind: "redis" as const, redis };
  if (process.env.NODE_ENV === "production") {
    throw new DurableStorageUnavailableError(getStorageCapabilities().reason);
  }
  return { kind: "local" as const };
}

function timestampMs(value: Date | number | undefined) {
  const timestamp = value instanceof Date ? value.getTime() : value ?? Date.now();
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error("Invalid generation quota timestamp.");
  }
  return Math.floor(timestamp);
}

function normalizeIdentifierHash(identifierHash: string) {
  const normalized = identifierHash.trim().toLowerCase();
  if (!IDENTIFIER_HASH_PATTERN.test(normalized)) {
    throw new Error("Invalid hashed generation quota identifier.");
  }
  return normalized;
}

function normalizeReservationId(reservationId: string) {
  const normalized = reservationId.trim();
  if (!RESERVATION_ID_PATTERN.test(normalized)) {
    throw new Error("Invalid generation quota reservation id.");
  }
  return normalized;
}

function hashIdempotencyKey(idempotencyKey: string) {
  const normalized = idempotencyKey.trim();
  if (
    !normalized ||
    normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    throw new Error("Invalid generation quota idempotency key.");
  }
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function getChinaDailyWindow(now: number) {
  const shiftedNow = new Date(now + CHINA_TIME_OFFSET_MS);
  const dayKey = shiftedNow.toISOString().slice(0, 10);
  const [year, month, date] = dayKey.split("-").map(Number);
  const resetAt =
    Date.UTC(year, month - 1, date + 1) - CHINA_TIME_OFFSET_MS;
  return {
    dayKey,
    resetAt,
    expiresAt: resetAt + RESERVATION_GRACE_MS,
  };
}

function usageKey(dayKey: string, identifierHash: string) {
  return `${USAGE_KEY_PREFIX}${dayKey}:${identifierHash}`;
}

function reservationKey(reservationId: string) {
  return `${RESERVATION_KEY_PREFIX}${reservationId}`;
}

function idempotencyKey(
  dayKey: string,
  identifierHash: string,
  idempotencyKeyHash: string,
) {
  return `${IDEMPOTENCY_KEY_PREFIX}${dayKey}:${identifierHash}:${idempotencyKeyHash}`;
}

function cloneReservation(reservation: GenerationQuotaReservation) {
  return structuredClone(reservation);
}

function cleanupLocalState(now: number) {
  for (const [key, usage] of localUsage) {
    if (usage.resetAt <= now) localUsage.delete(key);
  }
  for (const [key, reservation] of localReservations) {
    if (reservation.expiresAt <= now) localReservations.delete(key);
  }
  for (const [key, entry] of localIdempotency) {
    if (entry.expiresAt <= now || !localReservations.has(entry.reservationId)) {
      localIdempotency.delete(key);
    }
  }
}

function localRemaining(key: string, limit: number) {
  return Math.max(0, limit - (localUsage.get(key)?.count ?? 0));
}

function matchesReservation(
  reservation: GenerationQuotaReservation,
  input: {
    reservationId?: string;
    identifierHash: string;
    idempotencyKeyHash: string;
    dayKey?: string;
  },
) {
  return (
    (input.reservationId === undefined ||
      reservation.reservationId === input.reservationId) &&
    reservation.identifierHash === input.identifierHash &&
    reservation.idempotencyKeyHash === input.idempotencyKeyHash &&
    (input.dayKey === undefined || reservation.dayKey === input.dayKey)
  );
}

function parseReserveResult(raw: string) {
  return JSON.parse(raw) as ReserveGenerationQuotaResult;
}

function parseMutationResult(raw: string) {
  return JSON.parse(raw) as MutateGenerationQuotaReservationResult;
}

function parseReservation(raw: unknown): GenerationQuotaReservation | null {
  if (!raw) return null;
  const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<
    GenerationQuotaReservation
  >;
  if (
    parsed.version !== 1 ||
    typeof parsed.reservationId !== "string" ||
    typeof parsed.identifierHash !== "string" ||
    typeof parsed.idempotencyKeyHash !== "string" ||
    typeof parsed.dayKey !== "string" ||
    !["reserved", "committed", "refunded"].includes(parsed.state || "") ||
    typeof parsed.limit !== "number" ||
    typeof parsed.createdAt !== "number" ||
    typeof parsed.updatedAt !== "number" ||
    typeof parsed.resetAt !== "number" ||
    typeof parsed.expiresAt !== "number"
  ) {
    return null;
  }
  return parsed as GenerationQuotaReservation;
}

export function createGenerationQuotaReservationId() {
  return `quota_${crypto.randomBytes(18).toString("base64url")}`;
}

export function getGenerationQuotaReservationCapabilities(): GenerationQuotaReservationCapabilities {
  if (getStorageCapabilities().shared) {
    return { shared: true, adapter: "redis" };
  }
  return process.env.NODE_ENV === "production"
    ? { shared: false, adapter: "unavailable" }
    : { shared: false, adapter: "local" };
}

export async function reserveGenerationQuota(
  input: ReserveGenerationQuotaInput,
): Promise<ReserveGenerationQuotaResult> {
  const identifierHash = normalizeIdentifierHash(input.identifierHash);
  const reservationId = normalizeReservationId(input.reservationId);
  const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
  const now = timestampMs(input.now);
  const { dayKey, resetAt, expiresAt } = getChinaDailyWindow(now);
  const limit = getDailyFreeGenerationLimit();
  const reservation: GenerationQuotaReservation = {
    version: 1,
    reservationId,
    identifierHash,
    idempotencyKeyHash,
    dayKey,
    state: "reserved",
    limit,
    createdAt: now,
    updatedAt: now,
    resetAt,
    expiresAt,
  };
  const backend = getBackend();

  if (backend.kind === "redis") {
    const raw = await backend.redis.eval<string[], string>(
      RESERVE_SCRIPT,
      [
        usageKey(dayKey, identifierHash),
        reservationKey(reservationId),
        idempotencyKey(dayKey, identifierHash, idempotencyKeyHash),
      ],
      [
        reservationId,
        identifierHash,
        idempotencyKeyHash,
        dayKey,
        String(now),
        String(resetAt),
        String(limit),
        String(expiresAt),
        JSON.stringify(reservation),
        RESERVATION_KEY_PREFIX,
      ],
    );
    return parseReserveResult(raw);
  }

  cleanupLocalState(now);
  const usageMapKey = usageKey(dayKey, identifierHash);
  const reservationMapKey = reservationKey(reservationId);
  const idempotencyMapKey = idempotencyKey(
    dayKey,
    identifierHash,
    idempotencyKeyHash,
  );
  const existing = localReservations.get(reservationMapKey);
  if (existing) {
    if (
      !matchesReservation(existing, {
        reservationId,
        identifierHash,
        idempotencyKeyHash,
        dayKey,
      })
    ) {
      return {
        outcome: "conflict",
        created: false,
        remaining: localRemaining(usageMapKey, limit),
      };
    }
    const mapped = localIdempotency.get(idempotencyMapKey);
    if (mapped && mapped.reservationId !== reservationId) {
      return {
        outcome: "conflict",
        created: false,
        remaining: localRemaining(usageMapKey, limit),
      };
    }
    localIdempotency.set(idempotencyMapKey, { reservationId, expiresAt });
    return {
      outcome: existing.state,
      created: false,
      remaining: localRemaining(usageMapKey, limit),
      reservation: cloneReservation(existing),
    };
  }

  const mapped = localIdempotency.get(idempotencyMapKey);
  if (mapped) {
    const mappedReservation = localReservations.get(
      reservationKey(mapped.reservationId),
    );
    if (
      !mappedReservation ||
      !matchesReservation(mappedReservation, {
        identifierHash,
        idempotencyKeyHash,
        dayKey,
      })
    ) {
      return {
        outcome: "conflict",
        created: false,
        remaining: localRemaining(usageMapKey, limit),
      };
    }
    return {
      outcome: mappedReservation.state,
      created: false,
      remaining: localRemaining(usageMapKey, limit),
      reservation: cloneReservation(mappedReservation),
    };
  }

  const usage = localUsage.get(usageMapKey);
  const count = usage?.count ?? 0;
  if (count >= limit) {
    return {
      outcome: "quota_exhausted",
      created: false,
      remaining: 0,
    };
  }

  localUsage.set(usageMapKey, { count: count + 1, resetAt });
  localReservations.set(reservationMapKey, reservation);
  localIdempotency.set(idempotencyMapKey, { reservationId, expiresAt });
  return {
    outcome: "reserved",
    created: true,
    remaining: Math.max(0, limit - count - 1),
    reservation: cloneReservation(reservation),
  };
}

export async function getGenerationQuotaReservation(
  reservationId: string,
): Promise<GenerationQuotaReservation | null> {
  const normalizedId = normalizeReservationId(reservationId);
  const backend = getBackend();
  if (backend.kind === "redis") {
    const parsed = parseReservation(
      await backend.redis.get<GenerationQuotaReservation | string>(
        reservationKey(normalizedId),
      ),
    );
    return parsed ? cloneReservation(parsed) : null;
  }
  cleanupLocalState(Date.now());
  const reservation = localReservations.get(reservationKey(normalizedId));
  return reservation ? cloneReservation(reservation) : null;
}

async function mutateReservation(
  input: MutateGenerationQuotaReservationInput,
  operation: "commit" | "refund",
): Promise<MutateGenerationQuotaReservationResult> {
  const reservationId = normalizeReservationId(input.reservationId);
  const now = timestampMs(input.now);
  const backend = getBackend();

  if (backend.kind === "redis") {
    const raw = await backend.redis.eval<string[], string>(
      operation === "commit" ? COMMIT_SCRIPT : REFUND_SCRIPT,
      [reservationKey(reservationId)],
      [
        reservationId,
        String(now),
        IDEMPOTENCY_KEY_PREFIX,
        USAGE_KEY_PREFIX,
      ],
    );
    return parseMutationResult(raw);
  }

  cleanupLocalState(now);
  const mapKey = reservationKey(reservationId);
  const existing = localReservations.get(mapKey);
  if (!existing) return { outcome: "not_found", changed: false };
  if (existing.reservationId !== reservationId) {
    return { outcome: "conflict", changed: false };
  }

  if (operation === "commit") {
    if (existing.state === "reserved") {
      const committed: GenerationQuotaReservation = {
        ...existing,
        state: "committed",
        updatedAt: now,
      };
      localReservations.set(mapKey, committed);
      return {
        outcome: "committed",
        changed: true,
        reservation: cloneReservation(committed),
      };
    }
    return {
      outcome: existing.state,
      changed: false,
      reservation: cloneReservation(existing),
    };
  }

  if (existing.state === "reserved") {
    const usageMapKey = usageKey(existing.dayKey, existing.identifierHash);
    const usage = localUsage.get(usageMapKey);
    if (usage && usage.count > 1) {
      localUsage.set(usageMapKey, { ...usage, count: usage.count - 1 });
    } else if (usage) {
      localUsage.delete(usageMapKey);
    }
    const refunded: GenerationQuotaReservation = {
      ...existing,
      state: "refunded",
      updatedAt: now,
    };
    localReservations.set(mapKey, refunded);
    return {
      outcome: "refunded",
      changed: true,
      reservation: cloneReservation(refunded),
    };
  }
  return {
    outcome: existing.state,
    changed: false,
    reservation: cloneReservation(existing),
  };
}

export function commitGenerationQuotaReservation(
  input: MutateGenerationQuotaReservationInput,
) {
  return mutateReservation(input, "commit");
}

export function refundGenerationQuotaReservation(
  input: MutateGenerationQuotaReservationInput,
) {
  return mutateReservation(input, "refund");
}

export function finalizeGenerationQuotaReservation(
  input: FinalizeGenerationQuotaReservationInput,
) {
  return mutateReservation(input, input.outcome);
}
