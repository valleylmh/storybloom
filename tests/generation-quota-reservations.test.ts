import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationQuotaReservation } from "@/lib/generation-quota-reservations";

const redisState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  expirations: new Map<string, number>(),
  now: 0,
}));

const USAGE_KEY_PREFIX = "storybloom:generation-quota-usage:v1:";
const RESERVATION_KEY_PREFIX =
  "storybloom:generation-quota-reservation:v1:";
const IDEMPOTENCY_KEY_PREFIX =
  "storybloom:generation-quota-idempotency:v1:";

function expireValue(key: string) {
  const expiresAt = redisState.expirations.get(key);
  if (expiresAt === undefined || expiresAt > redisState.now) return;
  redisState.values.delete(key);
  redisState.expirations.delete(key);
}

function getValue(key: string) {
  expireValue(key);
  return redisState.values.get(key);
}

function setValue(key: string, value: unknown, expiresAt?: number) {
  redisState.values.set(key, structuredClone(value));
  if (expiresAt === undefined) redisState.expirations.delete(key);
  else redisState.expirations.set(key, expiresAt);
}

function deleteValue(key: string) {
  redisState.values.delete(key);
  redisState.expirations.delete(key);
}

function parseReservation(value: unknown) {
  if (value === undefined) return null;
  return structuredClone(
    (typeof value === "string" ? JSON.parse(value) : value) as GenerationQuotaReservation,
  );
}

function remaining(usageKey: string, limit: number) {
  return Math.max(0, limit - Number(getValue(usageKey) || 0));
}

function reservationMatches(
  reservation: GenerationQuotaReservation,
  input: {
    reservationId: string;
    identifierHash: string;
    idempotencyKeyHash: string;
    dayKey: string;
  },
) {
  return (
    reservation.version === 1 &&
    reservation.reservationId === input.reservationId &&
    reservation.identifierHash === input.identifierHash &&
    reservation.idempotencyKeyHash === input.idempotencyKeyHash &&
    reservation.dayKey === input.dayKey &&
    ["reserved", "committed", "refunded"].includes(reservation.state)
  );
}

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    constructor(_options: unknown) {}

    async get<T>(key: string) {
      const value = getValue(key);
      return value === undefined ? null : (structuredClone(value) as T);
    }

    async eval<TKeys extends string[], TResult>(
      script: string,
      keys: TKeys,
      args: string[],
    ): Promise<TResult> {
      if (script.includes("generation-quota:reserve")) {
        const [usageKey, reservationKey, idempotencyKey] = keys;
        const input = {
          reservationId: args[0],
          identifierHash: args[1],
          idempotencyKeyHash: args[2],
          dayKey: args[3],
        };
        redisState.now = Number(args[4]);
        const resetAt = Number(args[5]);
        const limit = Number(args[6]);
        const expiresAt = Number(args[7]);
        const candidate = JSON.parse(args[8]) as GenerationQuotaReservation;

        const existing = parseReservation(getValue(reservationKey));
        if (existing) {
          if (!reservationMatches(existing, input)) {
            return JSON.stringify({
              outcome: "conflict",
              created: false,
              remaining: remaining(usageKey, limit),
            }) as TResult;
          }
          const mappedId = getValue(idempotencyKey);
          if (mappedId !== undefined && mappedId !== input.reservationId) {
            return JSON.stringify({
              outcome: "conflict",
              created: false,
              remaining: remaining(usageKey, limit),
            }) as TResult;
          }
          setValue(reservationKey, existing, existing.expiresAt);
          setValue(idempotencyKey, input.reservationId, existing.expiresAt);
          return JSON.stringify({
            outcome: existing.state,
            created: false,
            remaining: remaining(usageKey, limit),
            reservation: existing,
          }) as TResult;
        }

        const mappedId = getValue(idempotencyKey);
        if (typeof mappedId === "string") {
          const mappedKey = `${args[9]}${mappedId}`;
          const mappedReservation = parseReservation(getValue(mappedKey));
          if (!mappedReservation || !reservationMatches(mappedReservation, {
            ...input,
            reservationId: mappedId,
          })) {
            return JSON.stringify({
              outcome: "conflict",
              created: false,
              remaining: remaining(usageKey, limit),
            }) as TResult;
          }
          setValue(mappedKey, mappedReservation, mappedReservation.expiresAt);
          setValue(idempotencyKey, mappedId, mappedReservation.expiresAt);
          return JSON.stringify({
            outcome: mappedReservation.state,
            created: false,
            remaining: remaining(usageKey, limit),
            reservation: mappedReservation,
          }) as TResult;
        }

        const count = Number(getValue(usageKey) || 0);
        if (count >= limit) {
          return JSON.stringify({
            outcome: "quota_exhausted",
            created: false,
            remaining: 0,
          }) as TResult;
        }
        setValue(usageKey, count + 1, resetAt);
        setValue(reservationKey, candidate, expiresAt);
        setValue(idempotencyKey, input.reservationId, expiresAt);
        return JSON.stringify({
          outcome: "reserved",
          created: true,
          remaining: limit - count - 1,
          reservation: candidate,
        }) as TResult;
      }

      if (
        script.includes("generation-quota:commit") ||
        script.includes("generation-quota:refund")
      ) {
        redisState.now = Number(args[1]);
        const reservation = parseReservation(getValue(keys[0]));
        if (!reservation) {
          return JSON.stringify({ outcome: "not_found", changed: false }) as TResult;
        }
        if (reservation.reservationId !== args[0]) {
          return JSON.stringify({ outcome: "conflict", changed: false }) as TResult;
        }

        let next = reservation;
        let changed = false;
        if (script.includes("generation-quota:commit")) {
          if (reservation.state === "reserved") {
            next = { ...reservation, state: "committed", updatedAt: Number(args[1]) };
            changed = true;
          }
        } else if (reservation.state === "reserved") {
          const usageKey = `${args[3]}${reservation.dayKey}:${reservation.identifierHash}`;
          const count = Number(getValue(usageKey) || 0);
          if (count > 1) setValue(usageKey, count - 1, reservation.resetAt);
          else if (count === 1) deleteValue(usageKey);
          next = { ...reservation, state: "refunded", updatedAt: Number(args[1]) };
          changed = true;
        }

        setValue(keys[0], next, next.expiresAt);
        const idempotencyKey = `${args[2]}${next.dayKey}:${next.identifierHash}:${next.idempotencyKeyHash}`;
        setValue(idempotencyKey, next.reservationId, next.expiresAt);
        return JSON.stringify({
          outcome: next.state,
          changed,
          reservation: next,
        }) as TResult;
      }

      throw new Error("Unknown generation quota script.");
    }
  },
}));

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  kvUrl: process.env.KV_REST_API_URL,
  kvToken: process.env.KV_REST_API_TOKEN,
  dailyLimit: process.env.FREE_GENERATION_DAILY_LIMIT,
};

const identifierHash = createHash("sha256")
  .update("caller-already-hashed-identifier")
  .digest("hex");

function restore(name: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function configureRedis() {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

function reserveInput(overrides: Record<string, unknown> = {}) {
  return {
    identifierHash,
    reservationId: "task_123456789012",
    idempotencyKey: "text:task_123456789012",
    now: Date.parse("2026-08-13T15:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  redisState.values.clear();
  redisState.expirations.clear();
  redisState.now = 0;
  configureRedis();
  process.env.FREE_GENERATION_DAILY_LIMIT = "2";
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  restore("NODE_ENV", originalEnvironment.nodeEnv);
  restore("UPSTASH_REDIS_REST_URL", originalEnvironment.upstashUrl);
  restore("UPSTASH_REDIS_REST_TOKEN", originalEnvironment.upstashToken);
  restore("KV_REST_API_URL", originalEnvironment.kvUrl);
  restore("KV_REST_API_TOKEN", originalEnvironment.kvToken);
  restore("FREE_GENERATION_DAILY_LIMIT", originalEnvironment.dailyLimit);
  vi.resetModules();
});

describe("durable generation quota reservations", () => {
  it("reserves once across module instances and deduplicates the idempotency key", async () => {
    let quota = await import("@/lib/generation-quota-reservations");
    const first = await quota.reserveGenerationQuota(reserveInput());
    vi.resetModules();
    quota = await import("@/lib/generation-quota-reservations");
    const duplicate = await quota.reserveGenerationQuota(reserveInput());
    const sameIdempotencyDifferentReservation = await quota.reserveGenerationQuota(
      reserveInput({ reservationId: "task_abcdefghijkl" }),
    );

    expect(first).toMatchObject({
      outcome: "reserved",
      created: true,
      remaining: 1,
    });
    expect(duplicate).toMatchObject({
      outcome: "reserved",
      created: false,
      remaining: 1,
      reservation: { reservationId: "task_123456789012" },
    });
    expect(sameIdempotencyDifferentReservation).toMatchObject({
      outcome: "reserved",
      created: false,
      remaining: 1,
      reservation: { reservationId: "task_123456789012" },
    });
    expect(
      [...redisState.values.entries()].filter(([key]) =>
        key.startsWith(USAGE_KEY_PREFIX),
      ),
    ).toEqual([[expect.any(String), 1]]);
  });

  it("counts concurrent retries of the same reservation only once", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        quota.reserveGenerationQuota(reserveInput()),
      ),
    );

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.every((result) => result.outcome === "reserved")).toBe(true);
    expect(
      [...redisState.values.entries()].filter(([key]) =>
        key.startsWith(USAGE_KEY_PREFIX),
      ),
    ).toEqual([[expect.any(String), 1]]);
  });

  it("enforces the Shanghai day limit and resets at midnight China time", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    const first = await quota.reserveGenerationQuota(reserveInput());
    await quota.reserveGenerationQuota(
      reserveInput({
        reservationId: "task_second_12345",
        idempotencyKey: "text:task_second_12345",
      }),
    );
    await expect(
      quota.reserveGenerationQuota(
        reserveInput({
          reservationId: "task_third_123456",
          idempotencyKey: "text:task_third_123456",
        }),
      ),
    ).resolves.toMatchObject({ outcome: "quota_exhausted", remaining: 0 });

    expect(first.outcome).toBe("reserved");
    if (first.outcome === "reserved") {
      expect(first.reservation.dayKey).toBe("2026-08-13");
      expect(first.reservation.resetAt).toBe(
        Date.parse("2026-08-13T16:00:00.000Z"),
      );
      expect(first.reservation.expiresAt).toBe(
        Date.parse("2026-08-14T16:00:00.000Z"),
      );
    }

    await expect(
      quota.reserveGenerationQuota(
        reserveInput({
          reservationId: "task_next_day_1234",
          idempotencyKey: "text:task_next_day_1234",
          now: Date.parse("2026-08-13T16:00:01.000Z"),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "reserved",
      created: true,
      remaining: 1,
      reservation: { dayKey: "2026-08-14" },
    });
  });

  it("refunds at most once and releases capacity", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    await quota.reserveGenerationQuota(reserveInput());

    await expect(
      quota.refundGenerationQuotaReservation({
        reservationId: "task_123456789012",
        now: Date.parse("2026-08-13T15:01:00.000Z"),
      }),
    ).resolves.toMatchObject({ outcome: "refunded", changed: true });
    await expect(
      quota.refundGenerationQuotaReservation({
        reservationId: "task_123456789012",
        now: Date.parse("2026-08-13T15:02:00.000Z"),
      }),
    ).resolves.toMatchObject({ outcome: "refunded", changed: false });
    await expect(
      quota.reserveGenerationQuota(
        reserveInput({
          reservationId: "task_after_refund12",
          idempotencyKey: "text:task_after_refund12",
        }),
      ),
    ).resolves.toMatchObject({ outcome: "reserved", remaining: 1 });
  });

  it("decrements usage only once for concurrent refunds", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    await quota.reserveGenerationQuota(reserveInput());

    const refunds = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        quota.refundGenerationQuotaReservation({
          reservationId: "task_123456789012",
          now: Date.parse("2026-08-13T15:01:00.000Z") + index,
        }),
      ),
    );

    expect(refunds.filter((result) => result.changed)).toHaveLength(1);
    expect(refunds.every((result) => result.outcome === "refunded")).toBe(true);
    expect(
      [...redisState.values.keys()].filter((key) =>
        key.startsWith(USAGE_KEY_PREFIX),
      ),
    ).toHaveLength(0);
  });

  it("commits idempotently and never refunds committed usage", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    await quota.reserveGenerationQuota(reserveInput());
    await expect(
      quota.finalizeGenerationQuotaReservation({
        reservationId: "task_123456789012",
        outcome: "commit",
        now: Date.parse("2026-08-13T15:01:00.000Z"),
      }),
    ).resolves.toMatchObject({ outcome: "committed", changed: true });
    await expect(
      quota.commitGenerationQuotaReservation({
        reservationId: "task_123456789012",
        now: Date.parse("2026-08-13T15:02:00.000Z"),
      }),
    ).resolves.toMatchObject({ outcome: "committed", changed: false });
    await expect(
      quota.refundGenerationQuotaReservation({
        reservationId: "task_123456789012",
        now: Date.parse("2026-08-13T15:03:00.000Z"),
      }),
    ).resolves.toMatchObject({ outcome: "committed", changed: false });

    await expect(
      quota.getGenerationQuotaReservation("task_123456789012"),
    ).resolves.toMatchObject({ state: "committed" });
  });

  it("rejects raw identifiers and does not persist idempotency input", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    await expect(
      quota.reserveGenerationQuota(
        reserveInput({ identifierHash: "203.0.113.7|browser-fingerprint" }),
      ),
    ).rejects.toThrow("hashed generation quota identifier");

    const secretIdempotency = "private-idempotency-secret";
    await quota.reserveGenerationQuota(
      reserveInput({ idempotencyKey: secretIdempotency }),
    );
    expect(JSON.stringify([...redisState.values])).not.toContain(secretIdempotency);
    expect(JSON.stringify([...redisState.values])).not.toContain("203.0.113.7");
  });

  it("uses local state outside production and fails closed in production", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    let quota = await import("@/lib/generation-quota-reservations");
    expect(quota.getGenerationQuotaReservationCapabilities()).toEqual({
      shared: false,
      adapter: "local",
    });
    await expect(quota.reserveGenerationQuota(reserveInput())).resolves.toMatchObject({
      outcome: "reserved",
      created: true,
    });

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    quota = await import("@/lib/generation-quota-reservations");
    expect(quota.getGenerationQuotaReservationCapabilities()).toEqual({
      shared: false,
      adapter: "unavailable",
    });
    await expect(quota.reserveGenerationQuota(reserveInput())).rejects.toMatchObject({
      code: "STORAGE_NOT_DURABLE",
    });
  });

  it("returns a conflict when a reservation id is reused for another request", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    await quota.reserveGenerationQuota(reserveInput());
    await expect(
      quota.reserveGenerationQuota(
        reserveInput({ idempotencyKey: "text:another-request" }),
      ),
    ).resolves.toMatchObject({
      outcome: "conflict",
      created: false,
      remaining: 1,
    });
  });

  it("stores only opaque hashes and keeps reservation TTL beyond the daily window", async () => {
    const quota = await import("@/lib/generation-quota-reservations");
    const result = await quota.reserveGenerationQuota(reserveInput());
    expect(result.outcome).toBe("reserved");
    const reservationKey = `${RESERVATION_KEY_PREFIX}task_123456789012`;
    const stored = parseReservation(getValue(reservationKey));
    expect(stored).toMatchObject({
      identifierHash,
      idempotencyKeyHash: createHash("sha256")
        .update("text:task_123456789012")
        .digest("hex"),
    });
    expect(redisState.expirations.get(reservationKey)).toBe(
      Date.parse("2026-08-14T16:00:00.000Z"),
    );
    expect(
      [...redisState.values.keys()].some((key) =>
        key.startsWith(IDEMPOTENCY_KEY_PREFIX),
      ),
    ).toBe(true);
  });
});
