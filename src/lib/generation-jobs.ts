import "server-only";

import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  GENERATION_ERROR_CLASSES,
  type GenerationErrorClass,
} from "@/lib/generation-error";
import {
  DurableStorageUnavailableError,
  getStorageCapabilities,
  validateStoryId,
} from "@/lib/storage";

export type GenerationJobKind = "text" | "illustration";
export type GenerationJobStatus = "queued" | "running" | "succeeded" | "dead";

export type GenerationJobLease = {
  owner: string;
  token: string;
  expiresAt: number;
};

export type GenerationJobFailure = {
  message: string;
  errorClass: GenerationErrorClass;
  at: number;
};

export interface GenerationJob {
  version: 1;
  jobId: string;
  kind: GenerationJobKind;
  storyId: string;
  taskId?: string;
  page?: number;
  generationAttemptId?: string;
  payloadRef?: string;
  quotaReservationId?: string;
  idempotencyKeyHash: string;
  status: GenerationJobStatus;
  attempt: number;
  maxAttempts: number;
  availableAt: number;
  createdAt: number;
  updatedAt: number;
  lease?: GenerationJobLease;
  completedAt?: number;
  resultRef?: string;
  lastError?: GenerationJobFailure;
}

export type ClaimedGenerationJob = GenerationJob & {
  status: "running";
  lease: GenerationJobLease;
};

export type EnqueueGenerationJobInput = {
  kind: GenerationJobKind;
  storyId: string;
  idempotencyKey: string;
  taskId?: string;
  page?: number;
  generationAttemptId?: string;
  payloadRef?: string;
  quotaReservationId?: string;
  maxAttempts?: number;
  availableAt?: Date | number;
  now?: Date | number;
};

export type EnqueueGenerationJobResult = {
  job: GenerationJob;
  created: boolean;
};

export type ClaimGenerationJobsInput = {
  workerId: string;
  kind?: GenerationJobKind;
  limit?: number;
  leaseMs: number;
  now?: Date | number;
};

export type RenewGenerationJobLeaseInput = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  leaseMs: number;
  now?: Date | number;
};

export type CompleteGenerationJobInput = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  resultRef?: string;
  now?: Date | number;
};

export type FailGenerationJobInput = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  retryable: boolean;
  errorClass: GenerationErrorClass;
  retryDelayMs?: number;
  now?: Date | number;
};

export type GenerationJobCompletionResult = "completed" | "ignored";
export type GenerationJobFailureResult = "requeued" | "dead" | "ignored";

export type ReclaimExpiredGenerationJobsInput = {
  limit?: number;
  now?: Date | number;
};

export type ReclaimExpiredGenerationJobsResult = {
  requeued: number;
  dead: number;
  removed: number;
  transitions: Record<string, ReclaimedGenerationJob>;
};

export type ReclaimedGenerationJob = Pick<
  GenerationJob,
  | "jobId"
  | "kind"
  | "storyId"
  | "taskId"
  | "page"
  | "payloadRef"
  | "quotaReservationId"
  | "attempt"
  | "maxAttempts"
> & { status: "queued" | "dead" };

export type GenerationJobCapabilities = {
  shared: boolean;
  adapter: "redis" | "local" | "unavailable";
};

const JOB_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_MAX_ATTEMPTS: Record<GenerationJobKind, number> = {
  text: 2,
  illustration: 3,
};
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_CLAIM_LIMIT = 20;
const MAX_CLAIM_CLEANUP_PASSES = 100;
const MAX_RECLAIM_LIMIT = 100;
const CLAIM_RETRY_SENTINEL = "__generation_job_retry__";
const GENERATION_JOB_FAILURE_MESSAGE = "Generation job failed.";
const GENERATION_JOB_LEASE_EXPIRED_MESSAGE = "Generation job lease expired.";
const JOB_KEY_PREFIX = "storybloom:generation-job:v1:";
const IDEMPOTENCY_KEY_PREFIX = "storybloom:generation-job-idempotency:v1:";
const LEGACY_READY_KEY = "storybloom:generation-job-ready:v1";
const READY_KEYS: Record<GenerationJobKind, string> = {
  text: "storybloom:generation-job-ready:v2:text",
  illustration: "storybloom:generation-job-ready:v2:illustration",
};
const LEASE_KEY = "storybloom:generation-job-leases:v1";
const CLEANUP_KEY = "storybloom:generation-job-cleanup:v1";
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{12,80}$/;
const WORKER_ID_PATTERN = /^[A-Za-z0-9_.:@/-]{1,120}$/;
const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;
const generationErrorClasses = new Set<string>(GENERATION_ERROR_CLASSES);

const localJobs = new Map<string, GenerationJob>();
const localIdempotencyKeys = new Map<string, string>();
let redisClient: Redis | null | undefined;

const ENQUEUE_SCRIPT = `
-- generation-jobs:enqueue
local function removeFromReadyIndexes(jobId)
  redis.call("ZREM", KEYS[3], jobId)
  redis.call("ZREM", KEYS[4], jobId)
  redis.call("ZREM", KEYS[5], jobId)
end

local function indexQueuedJob(job)
  local readyKey = nil
  if job["kind"] == "text" then readyKey = KEYS[3] end
  if job["kind"] == "illustration" then readyKey = KEYS[4] end
  local availableAt = tonumber(job["availableAt"] or 0)
  if not readyKey or not availableAt then return false end
  removeFromReadyIndexes(job["jobId"])
  redis.call("ZADD", readyKey, availableAt, job["jobId"])
  return true
end

local existingId = redis.call("GET", KEYS[2])
if existingId then
  local existingRaw = redis.call("GET", ARGV[5] .. existingId)
  if existingRaw then
    local decoded, existingJob = pcall(cjson.decode, existingRaw)
    if decoded and type(existingJob) == "table" and existingJob["jobId"] == existingId then
      if existingJob["status"] == "queued" then
        indexQueuedJob(existingJob)
      else
        removeFromReadyIndexes(existingId)
      end
      return cjson.encode({ created = false, job = existingJob })
    end
  end
  redis.call("DEL", KEYS[2])
end
local job = cjson.decode(ARGV[1])
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[4])
redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[4])
indexQueuedJob(job)
return cjson.encode({ created = true, job = job })
`;

const CLAIM_SCRIPT = `
-- generation-jobs:claim
local function readyKeyForKind(kind)
  if kind == "text" then return KEYS[1] end
  if kind == "illustration" then return KEYS[2] end
  return nil
end

local function removeFromReadyIndexes(jobId)
  redis.call("ZREM", KEYS[1], jobId)
  redis.call("ZREM", KEYS[2], jobId)
  redis.call("ZREM", KEYS[3], jobId)
end

local function validQueuedJob(job, jobId)
  if type(job) ~= "table" or job["status"] ~= "queued" or job["jobId"] ~= jobId or tonumber(job["version"] or 0) ~= 1 then
    return false
  end
  local attempt = tonumber(job["attempt"] or -1)
  local availableAt = tonumber(job["availableAt"] or -1)
  local idempotencyHash = job["idempotencyKeyHash"]
  return attempt and attempt >= 0 and availableAt and availableAt >= 0 and type(idempotencyHash) == "string" and idempotencyHash ~= "" and readyKeyForKind(job["kind"]) ~= nil
end

local function claimFromReadyIndex(readyKey)
  local candidates = redis.call("ZRANGEBYSCORE", readyKey, "-inf", ARGV[2], "LIMIT", 0, ARGV[8])
  local repaired = false
  for _, jobId in ipairs(candidates) do
    local jobKey = ARGV[1] .. jobId
    local raw = redis.call("GET", jobKey)
    if not raw then
      removeFromReadyIndexes(jobId)
      repaired = true
    else
      local decoded, job = pcall(cjson.decode, raw)
      if not decoded or not validQueuedJob(job, jobId) then
        removeFromReadyIndexes(jobId)
        repaired = true
      else
        local correctReadyKey = readyKeyForKind(job["kind"])
        if correctReadyKey ~= readyKey or (ARGV[10] ~= "" and job["kind"] ~= ARGV[10]) then
          removeFromReadyIndexes(jobId)
          redis.call("ZADD", correctReadyKey, tonumber(job["availableAt"]), jobId)
          repaired = true
        else
          job["status"] = "running"
          job["attempt"] = tonumber(job["attempt"]) + 1
          job["updatedAt"] = tonumber(ARGV[2])
          job["lease"] = {
            owner = ARGV[3],
            token = ARGV[4],
            expiresAt = tonumber(ARGV[5])
          }
          local nextRaw = cjson.encode(job)
          redis.call("SET", jobKey, nextRaw, "EX", ARGV[6])
          local idempotencyKey = ARGV[7] .. job["idempotencyKeyHash"]
          local mappedJobId = redis.call("GET", idempotencyKey)
          if not mappedJobId or mappedJobId == jobId then
            redis.call("SET", idempotencyKey, jobId, "EX", ARGV[6])
          end
          removeFromReadyIndexes(jobId)
          redis.call("ZADD", KEYS[4], ARGV[5], jobId)
          return nextRaw
        end
      end
    end
  end
  if repaired then return ARGV[9] end
  return nil
end

local requestedKind = ARGV[10]
local selectedReadyKey = nil
if requestedKind ~= "" then
  selectedReadyKey = readyKeyForKind(requestedKind)
else
  local textIds = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", ARGV[2], "LIMIT", 0, 1)
  local illustrationIds = redis.call("ZRANGEBYSCORE", KEYS[2], "-inf", ARGV[2], "LIMIT", 0, 1)
  if #textIds > 0 and #illustrationIds > 0 then
    local textScore = tonumber(redis.call("ZSCORE", KEYS[1], textIds[1]))
    local illustrationScore = tonumber(redis.call("ZSCORE", KEYS[2], illustrationIds[1]))
    if textScore <= illustrationScore then selectedReadyKey = KEYS[1] else selectedReadyKey = KEYS[2] end
  elseif #textIds > 0 then
    selectedReadyKey = KEYS[1]
  elseif #illustrationIds > 0 then
    selectedReadyKey = KEYS[2]
  end
end

if selectedReadyKey then
  local claimed = claimFromReadyIndex(selectedReadyKey)
  if claimed then return claimed end
end

-- Move due jobs from the v1 shared index into the per-kind v2 indexes. This
-- lets a rolling deployment drain existing jobs without allowing one kind to
-- hide another behind the bounded claim window.
local legacyCandidates = redis.call("ZRANGEBYSCORE", KEYS[3], "-inf", ARGV[2], "LIMIT", 0, ARGV[8])
local migrated = false
for _, jobId in ipairs(legacyCandidates) do
  local raw = redis.call("GET", ARGV[1] .. jobId)
  if not raw then
    removeFromReadyIndexes(jobId)
    migrated = true
  else
    local decoded, job = pcall(cjson.decode, raw)
    if decoded and validQueuedJob(job, jobId) then
      local correctReadyKey = readyKeyForKind(job["kind"])
      removeFromReadyIndexes(jobId)
      redis.call("ZADD", correctReadyKey, tonumber(job["availableAt"]), jobId)
      migrated = true
    else
      removeFromReadyIndexes(jobId)
      migrated = true
    end
  end
end
if migrated then return ARGV[9] end
return nil
`;

const GET_BY_IDEMPOTENCY_SCRIPT = `
-- generation-jobs:get-by-idempotency
local jobId = redis.call("GET", KEYS[1])
if not jobId then return nil end
local raw = redis.call("GET", ARGV[1] .. jobId)
if not raw then
  redis.call("DEL", KEYS[1])
  return nil
end
local decoded, job = pcall(cjson.decode, raw)
if not decoded or type(job) ~= "table" or job["jobId"] ~= jobId or job["idempotencyKeyHash"] ~= ARGV[2] or tonumber(job["version"] or 0) ~= 1 then
  redis.call("DEL", KEYS[1])
  return nil
end
return raw
`;

const RENEW_SCRIPT = `
-- generation-jobs:renew
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local job = cjson.decode(raw)
local lease = job["lease"]
if job["status"] ~= "running" or not lease or lease["owner"] ~= ARGV[2] or lease["token"] ~= ARGV[3] or tonumber(lease["expiresAt"] or 0) <= tonumber(ARGV[5]) then
  return 0
end
lease["expiresAt"] = tonumber(ARGV[4])
job["updatedAt"] = tonumber(ARGV[5])
redis.call("SET", KEYS[1], cjson.encode(job), "EX", ARGV[6])
local idempotencyHash = job["idempotencyKeyHash"]
if type(idempotencyHash) == "string" and idempotencyHash ~= "" then
  local idempotencyKey = ARGV[7] .. idempotencyHash
  local mappedJobId = redis.call("GET", idempotencyKey)
  if not mappedJobId or mappedJobId == ARGV[1] then
    redis.call("SET", idempotencyKey, ARGV[1], "EX", ARGV[6])
  end
end
redis.call("ZADD", KEYS[2], ARGV[4], ARGV[1])
return 1
`;

const COMPLETE_SCRIPT = `
-- generation-jobs:complete
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local job = cjson.decode(raw)
local lease = job["lease"]
if job["status"] ~= "running" or not lease or lease["owner"] ~= ARGV[2] or lease["token"] ~= ARGV[3] or tonumber(lease["expiresAt"] or 0) <= tonumber(ARGV[4]) then
  return 0
end
job["status"] = "succeeded"
job["lease"] = nil
job["updatedAt"] = tonumber(ARGV[4])
job["completedAt"] = tonumber(ARGV[4])
if ARGV[5] ~= "" then job["resultRef"] = ARGV[5] end
redis.call("SET", KEYS[1], cjson.encode(job), "EX", ARGV[6])
local idempotencyHash = job["idempotencyKeyHash"]
if type(idempotencyHash) == "string" and idempotencyHash ~= "" then
  local idempotencyKey = ARGV[7] .. idempotencyHash
  local mappedJobId = redis.call("GET", idempotencyKey)
  if not mappedJobId or mappedJobId == ARGV[1] then
    redis.call("SET", idempotencyKey, ARGV[1], "EX", ARGV[6])
  end
end
redis.call("ZREM", KEYS[2], ARGV[1])
redis.call("ZREM", KEYS[3], ARGV[1])
redis.call("ZREM", KEYS[4], ARGV[1])
redis.call("ZREM", KEYS[5], ARGV[1])
redis.call("ZADD", KEYS[6], ARGV[4], ARGV[1])
return 1
`;

const FAIL_SCRIPT = `
-- generation-jobs:fail
local raw = redis.call("GET", KEYS[1])
if not raw then return "ignored" end
local job = cjson.decode(raw)
local lease = job["lease"]
if job["status"] ~= "running" or not lease or lease["owner"] ~= ARGV[2] or lease["token"] ~= ARGV[3] or tonumber(lease["expiresAt"] or 0) <= tonumber(ARGV[4]) then
  return "ignored"
end
job["lease"] = nil
job["updatedAt"] = tonumber(ARGV[4])
job["lastError"] = { message = "Generation job failed.", errorClass = ARGV[7], at = tonumber(ARGV[4]) }
redis.call("ZREM", KEYS[2], ARGV[1])
redis.call("ZREM", KEYS[3], ARGV[1])
redis.call("ZREM", KEYS[4], ARGV[1])
redis.call("ZREM", KEYS[5], ARGV[1])
if ARGV[8] == "1" and tonumber(job["attempt"] or 0) < tonumber(job["maxAttempts"] or 1) then
  job["status"] = "queued"
  job["availableAt"] = tonumber(ARGV[5])
  redis.call("SET", KEYS[1], cjson.encode(job), "EX", ARGV[6])
  local idempotencyHash = job["idempotencyKeyHash"]
  if type(idempotencyHash) == "string" and idempotencyHash ~= "" then
    local idempotencyKey = ARGV[9] .. idempotencyHash
    local mappedJobId = redis.call("GET", idempotencyKey)
    if not mappedJobId or mappedJobId == ARGV[1] then
      redis.call("SET", idempotencyKey, ARGV[1], "EX", ARGV[6])
    end
  end
  local readyKey = nil
  if job["kind"] == "text" then readyKey = KEYS[2] end
  if job["kind"] == "illustration" then readyKey = KEYS[3] end
  if not readyKey then return "ignored" end
  redis.call("ZADD", readyKey, ARGV[5], ARGV[1])
  return "requeued"
end
job["status"] = "dead"
job["completedAt"] = tonumber(ARGV[4])
redis.call("SET", KEYS[1], cjson.encode(job), "EX", ARGV[6])
redis.call("ZADD", KEYS[6], ARGV[4], ARGV[1])
local idempotencyHash = job["idempotencyKeyHash"]
if type(idempotencyHash) == "string" and idempotencyHash ~= "" then
  local idempotencyKey = ARGV[9] .. idempotencyHash
  local mappedJobId = redis.call("GET", idempotencyKey)
  if not mappedJobId or mappedJobId == ARGV[1] then
    redis.call("SET", idempotencyKey, ARGV[1], "EX", ARGV[6])
  end
end
return "dead"
`;

const RECLAIM_SCRIPT = `
-- generation-jobs:reclaim
local expired = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", ARGV[1], "LIMIT", 0, ARGV[2])
local requeued = 0
local dead = 0
local removed = 0
local transitions = {}
for _, jobId in ipairs(expired) do
  local jobKey = ARGV[3] .. jobId
  local raw = redis.call("GET", jobKey)
  if not raw then
    redis.call("ZREM", KEYS[1], jobId)
    redis.call("ZREM", KEYS[2], jobId)
    redis.call("ZREM", KEYS[3], jobId)
    redis.call("ZREM", KEYS[4], jobId)
    removed = removed + 1
  else
    local job = cjson.decode(raw)
    local lease = job["lease"]
    if job["status"] == "running" and lease and tonumber(lease["expiresAt"] or 0) <= tonumber(ARGV[1]) then
      job["lease"] = nil
      job["updatedAt"] = tonumber(ARGV[1])
      job["lastError"] = { message = "Generation job lease expired.", errorClass = "stale_result", at = tonumber(ARGV[1]) }
      redis.call("ZREM", KEYS[1], jobId)
      redis.call("ZREM", KEYS[2], jobId)
      redis.call("ZREM", KEYS[3], jobId)
      redis.call("ZREM", KEYS[4], jobId)
      if tonumber(job["attempt"] or 0) < tonumber(job["maxAttempts"] or 1) then
        job["status"] = "queued"
        job["availableAt"] = tonumber(ARGV[1])
        local readyKey = nil
        if job["kind"] == "text" then readyKey = KEYS[2] end
        if job["kind"] == "illustration" then readyKey = KEYS[3] end
        if readyKey then redis.call("ZADD", readyKey, ARGV[1], jobId) end
        requeued = requeued + 1
        transitions[jobId] = {
          jobId = jobId, kind = job["kind"], storyId = job["storyId"],
          taskId = job["taskId"], page = job["page"], payloadRef = job["payloadRef"],
          quotaReservationId = job["quotaReservationId"], attempt = job["attempt"],
          maxAttempts = job["maxAttempts"], status = "queued"
        }
      else
        job["status"] = "dead"
        job["completedAt"] = tonumber(ARGV[1])
        redis.call("ZADD", KEYS[5], ARGV[1], jobId)
        dead = dead + 1
        transitions[jobId] = {
          jobId = jobId, kind = job["kind"], storyId = job["storyId"],
          taskId = job["taskId"], page = job["page"], payloadRef = job["payloadRef"],
          quotaReservationId = job["quotaReservationId"], attempt = job["attempt"],
          maxAttempts = job["maxAttempts"], status = "dead"
        }
      end
      redis.call("SET", jobKey, cjson.encode(job), "EX", ARGV[4])
      local idempotencyHash = job["idempotencyKeyHash"]
      if type(idempotencyHash) == "string" and idempotencyHash ~= "" then
        local idempotencyKey = ARGV[5] .. idempotencyHash
        local mappedJobId = redis.call("GET", idempotencyKey)
        if not mappedJobId or mappedJobId == jobId then
          redis.call("SET", idempotencyKey, jobId, "EX", ARGV[4])
        end
      end
    else
      redis.call("ZREM", KEYS[1], jobId)
      if job["status"] == "succeeded" or job["status"] == "dead" then
        redis.call("ZREM", KEYS[2], jobId)
        redis.call("ZREM", KEYS[3], jobId)
        redis.call("ZREM", KEYS[4], jobId)
      end
      removed = removed + 1
    end
  end
end
return cjson.encode({ requeued = requeued, dead = dead, removed = removed, transitions = transitions })
`;

const LIST_CLEANUP_SCRIPT = `
-- generation-jobs:list-cleanup
local ids = redis.call("ZRANGE", KEYS[1], 0, tonumber(ARGV[1]) - 1)
local jobs = {}
for _, jobId in ipairs(ids) do
  local raw = redis.call("GET", ARGV[2] .. jobId)
  if not raw then
    redis.call("ZREM", KEYS[1], jobId)
  else
    local job = cjson.decode(raw)
    if job["status"] == "succeeded" or job["status"] == "dead" then
      jobs[jobId] = job
    else
      redis.call("ZREM", KEYS[1], jobId)
    end
  end
end
return cjson.encode(jobs)
`;

const ACK_CLEANUP_SCRIPT = `
-- generation-jobs:ack-cleanup
return redis.call("ZREM", KEYS[1], ARGV[1])
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
  if (!configuration) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis(configuration);
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

export function getGenerationJobCapabilities(): GenerationJobCapabilities {
  if (getStorageCapabilities().shared) return { shared: true, adapter: "redis" };
  return process.env.NODE_ENV === "production"
    ? { shared: false, adapter: "unavailable" }
    : { shared: false, adapter: "local" };
}

function timeMs(value: Date | number | undefined, fallback = Date.now()) {
  const timestamp = value instanceof Date ? value.getTime() : value ?? fallback;
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error("Invalid generation job timestamp.");
  }
  return Math.floor(timestamp);
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
) {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < minimum || candidate > maximum) {
    throw new Error(`Invalid ${label}.`);
  }
  return candidate;
}

function normalizedString(
  value: string | undefined,
  maximum: number,
  label: string,
) {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f]/.test(normalized)) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function validateJobId(jobId: string) {
  const normalized = jobId.trim();
  if (!JOB_ID_PATTERN.test(normalized)) throw new Error("Invalid generation job id.");
  return normalized;
}

function validateWorkerId(workerId: string) {
  const normalized = workerId.trim();
  if (!WORKER_ID_PATTERN.test(normalized)) throw new Error("Invalid generation worker id.");
  return normalized;
}

function validateLeaseToken(token: string) {
  const normalized = token.trim();
  if (!ATTEMPT_ID_PATTERN.test(normalized)) throw new Error("Invalid generation job lease token.");
  return normalized;
}

function getJobKey(jobId: string) {
  return `${JOB_KEY_PREFIX}${validateJobId(jobId)}`;
}

function getIdempotencyHash(idempotencyKey: string) {
  const normalized = normalizedString(idempotencyKey, 500, "generation job idempotency key");
  return crypto.createHash("sha256").update(normalized!).digest("hex");
}

function normalizeGenerationErrorClass(value: unknown): GenerationErrorClass {
  return typeof value === "string" && generationErrorClasses.has(value)
    ? (value as GenerationErrorClass)
    : "unknown";
}

function parseJob(raw: unknown): GenerationJob | null {
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as GenerationJob;
}

function cloneJob<T extends GenerationJob>(job: T): T {
  return structuredClone(job);
}

function createJob(input: EnqueueGenerationJobInput): GenerationJob {
  const storyId = validateStoryId(input.storyId);
  const idempotencyKeyHash = getIdempotencyHash(input.idempotencyKey);
  const now = timeMs(input.now);
  const availableAt = timeMs(input.availableAt, now);
  const taskId = normalizedString(input.taskId, 80, "generation task id");
  if (taskId && !TASK_ID_PATTERN.test(taskId)) throw new Error("Invalid generation task id.");
  const generationAttemptId = normalizedString(
    input.generationAttemptId,
    120,
    "generation attempt id",
  );
  if (generationAttemptId && !ATTEMPT_ID_PATTERN.test(generationAttemptId)) {
    throw new Error("Invalid generation attempt id.");
  }
  const page = input.page;
  if (input.kind === "text" && !taskId) {
    throw new Error("Text generation jobs require a task id.");
  }
  if (
    input.kind === "illustration" &&
    (!Number.isInteger(page) || page! < 1 || page! > 8 || !generationAttemptId)
  ) {
    throw new Error("Illustration generation jobs require a page and attempt id.");
  }

  return {
    version: 1,
    jobId: crypto.randomUUID(),
    kind: input.kind,
    storyId,
    ...(taskId ? { taskId } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(generationAttemptId ? { generationAttemptId } : {}),
    ...(input.payloadRef
      ? { payloadRef: normalizedString(input.payloadRef, 500, "generation payload reference") }
      : {}),
    ...(input.quotaReservationId
      ? {
          quotaReservationId: normalizedString(
            input.quotaReservationId,
            80,
            "generation quota reservation id",
          ),
        }
      : {}),
    idempotencyKeyHash,
    status: "queued",
    attempt: 0,
    maxAttempts: boundedInteger(
      input.maxAttempts,
      DEFAULT_MAX_ATTEMPTS[input.kind],
      1,
      10,
      "generation job retry limit",
    ),
    availableAt,
    createdAt: now,
    updatedAt: now,
  };
}

export async function enqueueGenerationJob(
  input: EnqueueGenerationJobInput,
): Promise<EnqueueGenerationJobResult> {
  const job = createJob(input);
  const backend = getBackend();
  if (backend.kind === "redis") {
    const raw = await backend.redis.eval<string[], string>(
      ENQUEUE_SCRIPT,
      [
        getJobKey(job.jobId),
        `${IDEMPOTENCY_KEY_PREFIX}${job.idempotencyKeyHash}`,
        READY_KEYS.text,
        READY_KEYS.illustration,
        LEGACY_READY_KEY,
      ],
      [
        JSON.stringify(job),
        job.jobId,
        String(job.availableAt),
        String(JOB_TTL_SECONDS),
        JOB_KEY_PREFIX,
      ],
    );
    const result = JSON.parse(raw) as EnqueueGenerationJobResult;
    return { job: result.job, created: result.created };
  }

  const existingId = localIdempotencyKeys.get(job.idempotencyKeyHash);
  const existing = existingId ? localJobs.get(existingId) : undefined;
  if (existing) return { job: cloneJob(existing), created: false };
  localIdempotencyKeys.set(job.idempotencyKeyHash, job.jobId);
  localJobs.set(job.jobId, job);
  return { job: cloneJob(job), created: true };
}

export async function getGenerationJob(jobId: string) {
  const normalized = validateJobId(jobId);
  const backend = getBackend();
  if (backend.kind === "redis") {
    return parseJob(await backend.redis.get<GenerationJob | string>(getJobKey(normalized)));
  }
  const job = localJobs.get(normalized);
  return job ? cloneJob(job) : null;
}

/**
 * Reconciles an enqueue whose response may have been lost. The caller supplies
 * the same private idempotency key, but only its one-way hash is used for the
 * durable lookup and the original key is never returned or persisted.
 */
export async function getGenerationJobByIdempotencyKey(
  idempotencyKey: string,
): Promise<GenerationJob | null> {
  const idempotencyKeyHash = getIdempotencyHash(idempotencyKey);
  const backend = getBackend();
  if (backend.kind === "redis") {
    const raw = await backend.redis.eval<string[], string | null>(
      GET_BY_IDEMPOTENCY_SCRIPT,
      [`${IDEMPOTENCY_KEY_PREFIX}${idempotencyKeyHash}`],
      [JOB_KEY_PREFIX, idempotencyKeyHash],
    );
    return parseJob(raw);
  }

  const jobId = localIdempotencyKeys.get(idempotencyKeyHash);
  if (!jobId) return null;
  const job = localJobs.get(jobId);
  if (!job || job.idempotencyKeyHash !== idempotencyKeyHash) {
    localIdempotencyKeys.delete(idempotencyKeyHash);
    return null;
  }
  return cloneJob(job);
}

export async function claimGenerationJobs(
  input: ClaimGenerationJobsInput,
): Promise<ClaimedGenerationJob[]> {
  const workerId = validateWorkerId(input.workerId);
  const kind = input.kind;
  const limit = boundedInteger(input.limit, 1, 1, MAX_CLAIM_LIMIT, "generation job claim limit");
  const leaseMs = boundedInteger(input.leaseMs, input.leaseMs, 1_000, 15 * 60 * 1000, "generation job lease duration");
  const now = timeMs(input.now);
  const backend = getBackend();
  const claimed: ClaimedGenerationJob[] = [];

  if (backend.kind === "redis") {
    let cleanupPasses = 0;
    while (
      claimed.length < limit &&
      cleanupPasses < MAX_CLAIM_CLEANUP_PASSES
    ) {
      const leaseToken = crypto.randomUUID();
      const raw = await backend.redis.eval<string[], string | null>(
        CLAIM_SCRIPT,
        [
          READY_KEYS.text,
          READY_KEYS.illustration,
          LEGACY_READY_KEY,
          LEASE_KEY,
        ],
        [
          JOB_KEY_PREFIX,
          String(now),
          workerId,
          leaseToken,
          String(now + leaseMs),
          String(JOB_TTL_SECONDS),
          IDEMPOTENCY_KEY_PREFIX,
          "200",
          CLAIM_RETRY_SENTINEL,
          kind ?? "",
        ],
      );
      if (!raw) break;
      if (raw === CLAIM_RETRY_SENTINEL) {
        cleanupPasses += 1;
        continue;
      }
      claimed.push(JSON.parse(raw) as ClaimedGenerationJob);
    }
    return claimed;
  }

  const candidates = [...localJobs.values()]
    .filter(
      (job) =>
        job.status === "queued" &&
        job.availableAt <= now &&
        (!kind || job.kind === kind),
    )
    .sort((left, right) => left.availableAt - right.availableAt || left.createdAt - right.createdAt)
    .slice(0, limit);
  for (const job of candidates) {
    const next: ClaimedGenerationJob = {
      ...job,
      status: "running",
      attempt: job.attempt + 1,
      updatedAt: now,
      lease: {
        owner: workerId,
        token: crypto.randomUUID(),
        expiresAt: now + leaseMs,
      },
    };
    localJobs.set(job.jobId, next);
    claimed.push(cloneJob(next));
  }
  return claimed;
}

export async function renewGenerationJobLease(
  input: RenewGenerationJobLeaseInput,
) {
  const jobId = validateJobId(input.jobId);
  const workerId = validateWorkerId(input.workerId);
  const leaseToken = validateLeaseToken(input.leaseToken);
  const leaseMs = boundedInteger(input.leaseMs, input.leaseMs, 1_000, 15 * 60 * 1000, "generation job lease duration");
  const now = timeMs(input.now);
  const expiresAt = now + leaseMs;
  const backend = getBackend();
  if (backend.kind === "redis") {
    return (
      (await backend.redis.eval<string[], number>(
        RENEW_SCRIPT,
        [getJobKey(jobId), LEASE_KEY],
        [
          jobId,
          workerId,
          leaseToken,
          String(expiresAt),
          String(now),
          String(JOB_TTL_SECONDS),
          IDEMPOTENCY_KEY_PREFIX,
        ],
      )) === 1
    );
  }

  const job = localJobs.get(jobId);
  if (
    !job ||
    job.status !== "running" ||
    job.lease?.owner !== workerId ||
    job.lease.token !== leaseToken ||
    job.lease.expiresAt <= now
  ) {
    return false;
  }
  localJobs.set(jobId, {
    ...job,
    updatedAt: now,
    lease: { ...job.lease, expiresAt },
  });
  return true;
}

export async function completeGenerationJob(
  input: CompleteGenerationJobInput,
): Promise<GenerationJobCompletionResult> {
  const jobId = validateJobId(input.jobId);
  const workerId = validateWorkerId(input.workerId);
  const leaseToken = validateLeaseToken(input.leaseToken);
  const resultRef = normalizedString(input.resultRef, 500, "generation result reference");
  const now = timeMs(input.now);
  const backend = getBackend();
  if (backend.kind === "redis") {
    const completed = await backend.redis.eval<string[], number>(
      COMPLETE_SCRIPT,
      [
        getJobKey(jobId),
        READY_KEYS.text,
        READY_KEYS.illustration,
        LEGACY_READY_KEY,
        LEASE_KEY,
        CLEANUP_KEY,
      ],
      [
        jobId,
        workerId,
        leaseToken,
        String(now),
        resultRef ?? "",
        String(JOB_TTL_SECONDS),
        IDEMPOTENCY_KEY_PREFIX,
      ],
    );
    return completed === 1 ? "completed" : "ignored";
  }

  const job = localJobs.get(jobId);
  if (
    !job ||
    job.status !== "running" ||
    job.lease?.owner !== workerId ||
    job.lease.token !== leaseToken ||
    job.lease.expiresAt <= now
  ) {
    return "ignored";
  }
  const { lease: _lease, ...withoutLease } = job;
  localJobs.set(jobId, {
    ...withoutLease,
    status: "succeeded",
    updatedAt: now,
    completedAt: now,
    ...(resultRef ? { resultRef } : {}),
  });
  localPendingCleanup.add(jobId);
  return "completed";
}

export async function failGenerationJob(
  input: FailGenerationJobInput,
): Promise<GenerationJobFailureResult> {
  const jobId = validateJobId(input.jobId);
  const workerId = validateWorkerId(input.workerId);
  const leaseToken = validateLeaseToken(input.leaseToken);
  const errorClass = normalizeGenerationErrorClass(input.errorClass);
  const retryDelayMs = boundedInteger(
    input.retryDelayMs,
    DEFAULT_RETRY_DELAY_MS,
    0,
    60 * 60 * 1000,
    "generation job retry delay",
  );
  const now = timeMs(input.now);
  const nextAvailableAt = now + retryDelayMs;
  const backend = getBackend();
  if (backend.kind === "redis") {
    return backend.redis.eval<string[], GenerationJobFailureResult>(
      FAIL_SCRIPT,
      [
        getJobKey(jobId),
        READY_KEYS.text,
        READY_KEYS.illustration,
        LEGACY_READY_KEY,
        LEASE_KEY,
        CLEANUP_KEY,
      ],
      [
        jobId,
        workerId,
        leaseToken,
        String(now),
        String(nextAvailableAt),
        String(JOB_TTL_SECONDS),
        errorClass,
        input.retryable ? "1" : "0",
        IDEMPOTENCY_KEY_PREFIX,
      ],
    );
  }

  const job = localJobs.get(jobId);
  if (
    !job ||
    job.status !== "running" ||
    job.lease?.owner !== workerId ||
    job.lease.token !== leaseToken ||
    job.lease.expiresAt <= now
  ) {
    return "ignored";
  }
  const { lease: _lease, ...withoutLease } = job;
  const lastError: GenerationJobFailure = {
    message: GENERATION_JOB_FAILURE_MESSAGE,
    errorClass,
    at: now,
  };
  if (input.retryable && job.attempt < job.maxAttempts) {
    localJobs.set(jobId, {
      ...withoutLease,
      status: "queued",
      availableAt: nextAvailableAt,
      updatedAt: now,
      lastError,
    });
    return "requeued";
  }
  localJobs.set(jobId, {
    ...withoutLease,
    status: "dead",
    updatedAt: now,
    completedAt: now,
    lastError,
  });
  localPendingCleanup.add(jobId);
  return "dead";
}

export async function reclaimExpiredGenerationJobs(
  input: ReclaimExpiredGenerationJobsInput = {},
): Promise<ReclaimExpiredGenerationJobsResult> {
  const now = timeMs(input.now);
  const limit = boundedInteger(
    input.limit,
    20,
    1,
    MAX_RECLAIM_LIMIT,
    "generation job reclaim limit",
  );
  const backend = getBackend();
  if (backend.kind === "redis") {
    const raw = await backend.redis.eval<string[], string>(
      RECLAIM_SCRIPT,
      [
        LEASE_KEY,
        READY_KEYS.text,
        READY_KEYS.illustration,
        LEGACY_READY_KEY,
        CLEANUP_KEY,
      ],
      [
        String(now),
        String(limit),
        JOB_KEY_PREFIX,
        String(JOB_TTL_SECONDS),
        IDEMPOTENCY_KEY_PREFIX,
      ],
    );
    return JSON.parse(raw) as ReclaimExpiredGenerationJobsResult;
  }

  const result: ReclaimExpiredGenerationJobsResult = {
    requeued: 0,
    dead: 0,
    removed: 0,
    transitions: {},
  };
  const expired = [...localJobs.values()]
    .filter(
      (job) =>
        job.status === "running" &&
        job.lease !== undefined &&
        job.lease.expiresAt <= now,
    )
    .sort((left, right) => left.lease!.expiresAt - right.lease!.expiresAt)
    .slice(0, limit);
  for (const job of expired) {
    const { lease: _lease, ...withoutLease } = job;
    const lastError: GenerationJobFailure = {
      message: GENERATION_JOB_LEASE_EXPIRED_MESSAGE,
      errorClass: "stale_result",
      at: now,
    };
    if (job.attempt < job.maxAttempts) {
      localJobs.set(job.jobId, {
        ...withoutLease,
        status: "queued",
        availableAt: now,
        updatedAt: now,
        lastError,
      });
      result.requeued += 1;
      result.transitions[job.jobId] = summarizeReclaimedJob(
        localJobs.get(job.jobId)!,
        "queued",
      );
    } else {
      localJobs.set(job.jobId, {
        ...withoutLease,
        status: "dead",
        updatedAt: now,
        completedAt: now,
        lastError,
      });
      result.dead += 1;
      localPendingCleanup.add(job.jobId);
      result.transitions[job.jobId] = summarizeReclaimedJob(
        localJobs.get(job.jobId)!,
        "dead",
      );
    }
  }
  return result;
}

const localPendingCleanup = new Set<string>();

function summarizeReclaimedJob(
  job: GenerationJob,
  status: ReclaimedGenerationJob["status"],
): ReclaimedGenerationJob {
  return {
    jobId: job.jobId,
    kind: job.kind,
    storyId: job.storyId,
    ...(job.taskId ? { taskId: job.taskId } : {}),
    ...(job.page !== undefined ? { page: job.page } : {}),
    ...(job.payloadRef ? { payloadRef: job.payloadRef } : {}),
    ...(job.quotaReservationId
      ? { quotaReservationId: job.quotaReservationId }
      : {}),
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    status,
  };
}

export async function listGenerationJobsPendingCleanup(limit = 20) {
  const normalizedLimit = boundedInteger(
    limit,
    20,
    1,
    MAX_RECLAIM_LIMIT,
    "generation job cleanup limit",
  );
  const backend = getBackend();
  if (backend.kind === "redis") {
    const raw = await backend.redis.eval<string[], string>(
      LIST_CLEANUP_SCRIPT,
      [CLEANUP_KEY],
      [String(normalizedLimit), JOB_KEY_PREFIX],
    );
    const parsed = JSON.parse(raw) as Record<string, GenerationJob>;
    return Object.values(parsed);
  }
  return [...localPendingCleanup]
    .slice(0, normalizedLimit)
    .map((jobId) => localJobs.get(jobId))
    .filter((job): job is GenerationJob => Boolean(job))
    .map(cloneJob);
}

export async function acknowledgeGenerationJobCleanup(jobId: string) {
  const normalized = validateJobId(jobId);
  const backend = getBackend();
  if (backend.kind === "redis") {
    return (
      (await backend.redis.eval<string[], number>(
        ACK_CLEANUP_SCRIPT,
        [CLEANUP_KEY],
        [normalized],
      )) === 1
    );
  }
  return localPendingCleanup.delete(normalized);
}
