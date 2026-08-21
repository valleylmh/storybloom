import { promises as fs } from "fs";
import crypto from "node:crypto";
import os from "os";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  TEXT_GENERATION_TASK_TTL_SECONDS,
  type TextGenerationTask,
} from "@/lib/text-generation-task";
import { logGenerationEvent } from "@/lib/generation-observability";
import type { GeneratedStory } from "@/types";

type CachedStoryEntry = {
  story: GeneratedStory;
  expiresAt: number;
};

const storyCache = new Map<string, CachedStoryEntry>();
const textGenerationTaskCache = new Map<string, TextGenerationTask>();
const characterReferenceCache = new Map<string, CachedCharacterReference>();
const localRateWindow = new Map<string, { count: number; resetAt: number }>();
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const CHARACTER_REFERENCE_TTL_SECONDS = 24 * 60 * 60;
const STORY_CACHE_TTL_SECONDS = 24 * 60 * 60;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
// Keep the lower bound permissive for legacy/local story IDs; the allowlist is
// the security boundary, while newly generated IDs remain opaque nanoids.
const STORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_STORY_MUTATION_ATTEMPTS = 8;
const MAX_TEXT_TASK_MUTATION_ATTEMPTS = 8;
const SHARED_REDIS_PAYLOAD_WARN_BYTES = 4 * 1024 * 1024;
const SHARED_REDIS_PAYLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const localCacheDir =
  process.env.STORYBLOOM_CACHE_DIR ||
  path.join(process.env.VERCEL ? os.tmpdir() : process.cwd(), ".storybloom-cache");

let redisClient: Redis | null | undefined;
const localStoryMutationQueues = new Map<string, Promise<unknown>>();
const localTextGenerationTaskMutationQueues = new Map<
  string,
  Promise<unknown>
>();

type RateLimitReservation = {
  success: boolean;
  remaining: number;
  release: () => Promise<void>;
};

type CachedCharacterReference = {
  contentType: string;
  base64: string;
  createdAt: string;
  expiresAt: number;
};

export type StorageDurability = "shared" | "local-file" | "memory";

export type StorageCapabilities = {
  durability: StorageDurability;
  redisConfigured: boolean;
  shared: boolean;
  localFile: boolean;
  memory: boolean;
  reason?: string;
};

export type StoryMutationDecision<T> = {
  /** Omit to return a result from the atomic read without writing. */
  nextStory?: GeneratedStory;
  value: T;
};

export type StoryMutationOutcome<T> = {
  story: GeneratedStory;
  value: T;
  updated: boolean;
};

export type TextGenerationTaskMutationDecision<T> = {
  /** Omit to return a result from the atomic read without writing. */
  nextTask?: TextGenerationTask;
  value: T;
};

export type TextGenerationTaskMutationOutcome<T> = {
  task: TextGenerationTask;
  value: T;
  updated: boolean;
};

export type TextGenerationTaskMutationOptions = {
  /**
   * Requires the currently published Story and task to belong to the same
   * durable attempt before committing the task transition.
   */
  publishStoryFence?: {
    storyId: string;
    durableJobId: string;
    durableJobAttempt: number;
  };
};

type RedisConfiguration =
  | { status: "ready"; url: string; token: string }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

export class DurableStorageUnavailableError extends Error {
  readonly code = "STORAGE_NOT_DURABLE";

  constructor(reason?: string) {
    super(
      reason === "redis_configuration_incomplete"
        ? "Shared Redis configuration is incomplete. Configure one complete Upstash or KV credential pair."
        : "Shared durable storage is not configured.",
    );
    this.name = "DurableStorageUnavailableError";
  }
}

export class SharedRedisPayloadTooLargeError extends Error {
  readonly code = "REDIS_PAYLOAD_TOO_LARGE";
  readonly errorClass = "storage_unavailable" as const;

  constructor(kind: "story" | "character_reference") {
    super(`Shared Redis ${kind} payload exceeds the safe size limit.`);
    this.name = "SharedRedisPayloadTooLargeError";
  }
}

function serializeSharedRedisPayload(input: {
  kind: "story" | "character_reference";
  operation: string;
  value: object;
  storyId?: string;
}) {
  const serialized = JSON.stringify(input.value);
  const payloadBytes = Buffer.byteLength(serialized, "utf8");
  if (payloadBytes >= SHARED_REDIS_PAYLOAD_WARN_BYTES) {
    const rejected = payloadBytes > SHARED_REDIS_PAYLOAD_LIMIT_BYTES;
    logGenerationEvent(
      {
        operation: input.operation,
        ...(input.storyId ? { story: input.storyId } : {}),
        status: rejected ? "rejected_too_large" : "large_payload",
        payloadBytes,
        payloadLimitBytes: SHARED_REDIS_PAYLOAD_LIMIT_BYTES,
        ...(rejected ? { errorClass: "storage_unavailable" as const } : {}),
      },
      "warn",
    );
    if (rejected) {
      throw new SharedRedisPayloadTooLargeError(input.kind);
    }
  }
  return serialized;
}

function readConfiguredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function resolveRedisConfiguration(): RedisConfiguration {
  const upstashUrl = readConfiguredValue(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = readConfiguredValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  const kvUrl = readConfiguredValue(process.env.KV_REST_API_URL);
  const kvToken = readConfiguredValue(process.env.KV_REST_API_TOKEN);

  const upstashPartial = Boolean(upstashUrl) !== Boolean(upstashToken);
  const kvPartial = Boolean(kvUrl) !== Boolean(kvToken);
  const bothFamiliesConfigured = Boolean(
    upstashUrl && upstashToken && kvUrl && kvToken,
  );
  if (upstashPartial || kvPartial || bothFamiliesConfigured) {
    return { status: "invalid", reason: "redis_configuration_incomplete" };
  }

  if (upstashUrl && upstashToken) {
    return { status: "ready", url: upstashUrl, token: upstashToken };
  }
  if (kvUrl && kvToken) {
    return { status: "ready", url: kvUrl, token: kvToken };
  }
  return { status: "missing" };
}

export function getStorageCapabilities(): StorageCapabilities {
  const redis = resolveRedisConfiguration();
  if (redis.status === "ready") {
    return {
      durability: "shared",
      redisConfigured: true,
      shared: true,
      localFile: false,
      memory: true,
    };
  }

  return {
    durability: "local-file",
    redisConfigured: false,
    shared: false,
    localFile: true,
    memory: true,
    ...(redis.status === "invalid" ? { reason: redis.reason } : {}),
  };
}

export function isDurableStorageReady() {
  return getStorageCapabilities().shared;
}

export function requireDurableStorage() {
  const capabilities = getStorageCapabilities();
  if (!capabilities.shared) {
    throw new DurableStorageUnavailableError(capabilities.reason);
  }
}

export const assertDurableStorage = requireDurableStorage;

export function getDailyFreeGenerationLimit() {
  const rawLimit = process.env.FREE_GENERATION_DAILY_LIMIT;
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 3;

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return 3;
  }

  return parsedLimit;
}

function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const configuration = resolveRedisConfiguration();
  if (configuration.status !== "ready") {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: configuration.url,
    token: configuration.token,
  });

  return redisClient;
}

export function validateStoryId(storyId: string) {
  const normalized = storyId.trim();
  if (!STORY_ID_PATTERN.test(normalized)) {
    throw new Error("Invalid story id.");
  }
  return normalized;
}

function getStoryKey(storyId: string) {
  return `story:${validateStoryId(storyId)}`;
}

function getStoryRevision(story: GeneratedStory | null) {
  return story && Number.isInteger(story.revision) && (story.revision ?? 0) >= 0
    ? story.revision!
    : 0;
}

function createRevisedStory(story: GeneratedStory, currentRevision: number) {
  return {
    ...story,
    revision: currentRevision + 1,
    updatedAt: new Date().toISOString(),
  };
}

const MUTATE_STORY_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then
  return 0
end
local decoded = cjson.decode(current)
local revision = tonumber(decoded["revision"] or 0)
if revision ~= tonumber(ARGV[1]) then
  return -1
end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

function getStoryFilePath(storyId: string) {
  return path.join(localCacheDir, `${validateStoryId(storyId)}.json`);
}

function getTextGenerationTaskDir() {
  return path.join(localCacheDir, "text-generation-tasks");
}

function validateTextGenerationTaskId(taskId: string) {
  const normalized = taskId.trim();
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(normalized)) {
    throw new Error("Invalid text generation task id.");
  }
  return normalized;
}

function getTextGenerationTaskKey(taskId: string) {
  return `storybloom:text-generation-task:v1:${validateTextGenerationTaskId(taskId)}`;
}

function getTextGenerationTaskRevision(task: TextGenerationTask | null) {
  return task &&
    Number.isInteger(task.revision) &&
    (task.revision ?? 0) >= 0
    ? task.revision!
    : 0;
}

function createRevisedTextGenerationTask(
  task: TextGenerationTask,
  currentRevision: number,
) {
  return {
    ...task,
    revision: currentRevision + 1,
  };
}

const MUTATE_TEXT_GENERATION_TASK_SCRIPT = `
-- storage:text-generation-task-mutate
local current = redis.call("GET", KEYS[1])
if not current then
  return 0
end
local decoded = cjson.decode(current)
local revision = tonumber(decoded["revision"] or 0)
if revision ~= tonumber(ARGV[1]) then
  return -1
end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

const MUTATE_TEXT_GENERATION_TASK_WITH_STORY_FENCE_SCRIPT = `
-- storage:text-generation-task-story-fenced-mutate
local current = redis.call("GET", KEYS[1])
local storyRaw = redis.call("GET", KEYS[2])
if not current or not storyRaw then
  return 0
end
local decoded = cjson.decode(current)
local story = cjson.decode(storyRaw)
local revision = tonumber(decoded["revision"] or 0)
if revision ~= tonumber(ARGV[1]) then
  return -1
end
if decoded["taskId"] ~= ARGV[4]
  or decoded["storyId"] ~= ARGV[5]
  or decoded["status"] ~= "generating_text"
  or decoded["durableJobId"] ~= ARGV[6]
  or tonumber(decoded["durableJobAttempt"] or -1) ~= tonumber(ARGV[7])
  or story["id"] ~= ARGV[5]
  or story["textGenerationJobId"] ~= ARGV[6]
  or tonumber(story["textGenerationJobAttempt"] or -1) ~= tonumber(ARGV[7]) then
  return 0
end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

const PUBLISH_TEXT_GENERATION_STORY_SCRIPT = `
-- storage:text-generation-story-publish
local taskRaw = redis.call("GET", KEYS[1])
if not taskRaw then
  return nil
end
local task = cjson.decode(taskRaw)
if task["taskId"] ~= ARGV[1]
  or task["storyId"] ~= ARGV[2]
  or task["status"] ~= "generating_text"
  or task["durableJobId"] ~= ARGV[3]
  or tonumber(task["durableJobAttempt"] or -1) ~= tonumber(ARGV[4]) then
  return nil
end

local nextStory = cjson.decode(ARGV[5])
nextStory["textGenerationJobId"] = ARGV[3]
nextStory["textGenerationJobAttempt"] = tonumber(ARGV[4])
local currentStoryRaw = redis.call("GET", KEYS[2])
local currentRevision = 0
if currentStoryRaw then
  local currentStory = cjson.decode(currentStoryRaw)
  if currentStory["textGenerationJobId"] == ARGV[3]
    and tonumber(currentStory["textGenerationJobAttempt"] or -1) > tonumber(ARGV[4]) then
    return nil
  end
  currentRevision = tonumber(currentStory["revision"] or 0)
end
nextStory["revision"] = currentRevision + 1
nextStory["updatedAt"] = ARGV[7]
local encoded = cjson.encode(nextStory)
redis.call("SET", KEYS[2], encoded, "EX", ARGV[6])
return encoded
`;

function getTextGenerationTaskFilePath(taskId: string) {
  return path.join(
    getTextGenerationTaskDir(),
    `${validateTextGenerationTaskId(taskId)}.json`,
  );
}

function getCharacterReferenceDir() {
  return path.join(localCacheDir, "character-references");
}

function validateCharacterReferenceToken(token: string) {
  const normalized = token.trim();
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(normalized)) {
    throw new Error("Invalid character reference token.");
  }
  return normalized;
}

function getCharacterReferenceKey(token: string) {
  return `storybloom:character-reference:v1:${validateCharacterReferenceToken(token)}`;
}

function getCharacterReferenceFilePath(token: string) {
  return path.join(getCharacterReferenceDir(), `${validateCharacterReferenceToken(token)}.json`);
}

function getDailyRateLimitWindow() {
  const shiftedNow = new Date(Date.now() + CHINA_TIME_OFFSET_MS);
  const day = shiftedNow.toISOString().slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  const resetAt = Date.UTC(year, month - 1, date + 1) - CHINA_TIME_OFFSET_MS;
  const ttlSeconds = Math.max(60, Math.ceil((resetAt - Date.now()) / 1000));

  return { day, resetAt, ttlSeconds };
}

function getRateLimitKey(identifier: string, day: string) {
  return `storybloom:ratelimit:v2:${day}:${identifier}`;
}

function noopRelease() {
  return Promise.resolve();
}

async function ensureLocalCacheDir() {
  await fs.mkdir(localCacheDir, {
    recursive: true,
    mode: PRIVATE_DIRECTORY_MODE,
  });
  await fs.chmod(localCacheDir, PRIVATE_DIRECTORY_MODE);
}

async function ensureTextGenerationTaskDir() {
  await ensureLocalCacheDir();
  const directory = getTextGenerationTaskDir();
  await fs.mkdir(directory, {
    recursive: true,
    mode: PRIVATE_DIRECTORY_MODE,
  });
  await fs.chmod(directory, PRIVATE_DIRECTORY_MODE);
}

async function ensureCharacterReferenceDir() {
  await ensureLocalCacheDir();
  const directory = getCharacterReferenceDir();
  await fs.mkdir(directory, {
    recursive: true,
    mode: PRIVATE_DIRECTORY_MODE,
  });
  await fs.chmod(directory, PRIVATE_DIRECTORY_MODE);
}

async function writeJsonAtomically(filePath: string, data: unknown) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE,
      flag: "wx",
    });
    await fs.chmod(tempPath, PRIVATE_FILE_MODE);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function createJsonFileIfAbsentAtomically(filePath: string, data: unknown) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), {
      encoding: "utf8",
      mode: PRIVATE_FILE_MODE,
      flag: "wx",
    });
    await fs.chmod(tempPath, PRIVATE_FILE_MODE);
    await fs.link(tempPath, filePath);
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "EEXIST") return false;
    throw error;
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function isExpiredStoryEntry(entry: CachedStoryEntry) {
  return !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now();
}

function rememberStory(
  storyId: string,
  story: GeneratedStory,
  expiresAt = Date.now() + STORY_CACHE_TTL_SECONDS * 1000,
) {
  storyCache.set(storyId, {
    story,
    expiresAt,
  });
}

async function removeLocalStory(storyId: string) {
  storyCache.delete(storyId);
  await fs.rm(getStoryFilePath(storyId), { force: true }).catch(() => undefined);
}

async function sweepExpiredLocalStories() {
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(localCacheDir);
  } catch {
    return;
  }

  await Promise.all(
    fileNames
      .filter((fileName) => /^[A-Za-z0-9_-]{1,80}\.json$/.test(fileName))
      .map(async (fileName) => {
        const storyId = fileName.slice(0, -5);
        try {
          const stats = await fs.stat(getStoryFilePath(storyId));
          if (Date.now() - stats.mtimeMs > STORY_CACHE_TTL_SECONDS * 1000) {
            await removeLocalStory(storyId);
          }
        } catch {
          await removeLocalStory(storyId);
        }
      }),
  );
}

function isFileExpired(mtimeMs: number) {
  return Date.now() - mtimeMs > TEXT_GENERATION_TASK_TTL_SECONDS * 1000;
}

async function sweepExpiredLocalTextGenerationTasks() {
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(getTextGenerationTaskDir());
  } catch {
    return;
  }

  await Promise.all(
    fileNames
      .filter((fileName) => /^[A-Za-z0-9_-]{12,80}\.json$/.test(fileName))
      .map(async (fileName) => {
        const taskId = fileName.slice(0, -5);
        try {
          const filePath = getTextGenerationTaskFilePath(taskId);
          const [raw, stats] = await Promise.all([
            fs.readFile(filePath, "utf8"),
            fs.stat(filePath),
          ]);
          const task = JSON.parse(raw) as TextGenerationTask;
          if (isExpiredTextGenerationTask(task) || isFileExpired(stats.mtimeMs)) {
            textGenerationTaskCache.delete(taskId);
            await fs.rm(filePath, { force: true });
          }
        } catch {
          textGenerationTaskCache.delete(taskId);
          await fs.rm(getTextGenerationTaskFilePath(taskId), { force: true });
        }
      }),
  );
}

async function writeStoryToDisk(storyId: string, data: GeneratedStory) {
  await ensureLocalCacheDir();
  await sweepExpiredLocalStories();
  await writeJsonAtomically(getStoryFilePath(storyId), data);
}

async function readStoryFromDisk(storyId: string) {
  try {
    const filePath = getStoryFilePath(storyId);
    const [raw, stats] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      fs.stat(filePath),
    ]);
    const story = JSON.parse(raw) as GeneratedStory;
    const expiresAt = stats.mtimeMs + STORY_CACHE_TTL_SECONDS * 1000;
    if (expiresAt <= Date.now()) {
      await removeLocalStory(storyId);
      return null;
    }
    return { story, expiresAt };
  } catch {
    return null;
  }
}

function parseCachedStory(raw: unknown) {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    return JSON.parse(raw) as GeneratedStory;
  }

  return raw as GeneratedStory;
}

function parseTextGenerationTask(raw: unknown) {
  if (!raw) return null;
  if (typeof raw === "string") {
    return JSON.parse(raw) as TextGenerationTask;
  }
  return raw as TextGenerationTask;
}

function isExpiredTextGenerationTask(task: TextGenerationTask) {
  const updatedAt = new Date(task.updatedAt).getTime();
  return (
    !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt > TEXT_GENERATION_TASK_TTL_SECONDS * 1000
  );
}

function isLiveCharacterReference(value: CachedCharacterReference | null | undefined) {
  return Boolean(value && value.expiresAt > Date.now());
}

function parseCachedCharacterReference(raw: unknown) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as CachedCharacterReference;
    } catch {
      return null;
    }
  }
  return raw as CachedCharacterReference;
}

async function removeLocalCharacterReference(token: string) {
  characterReferenceCache.delete(token);
  await fs.rm(getCharacterReferenceFilePath(token), { force: true }).catch(() => undefined);
}

function scheduleLocalCharacterReferenceExpiry(token: string, expiresAt: number) {
  const timer = setTimeout(() => {
    void removeLocalCharacterReference(token);
  }, Math.max(0, expiresAt - Date.now()));
  timer.unref();
}

async function sweepExpiredLocalCharacterReferences() {
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(getCharacterReferenceDir());
  } catch {
    return;
  }

  await Promise.all(
    fileNames
      .filter((fileName) => /^[A-Za-z0-9_-]{32,96}\.json$/.test(fileName))
      .map(async (fileName) => {
        const token = fileName.slice(0, -5);
        try {
          const raw = await fs.readFile(getCharacterReferenceFilePath(token), "utf8");
          const reference = JSON.parse(raw) as CachedCharacterReference;
          if (!isLiveCharacterReference(reference)) {
            await removeLocalCharacterReference(token);
          }
        } catch {
          await removeLocalCharacterReference(token);
        }
      })
  );
}

export async function cacheCharacterReference(input: {
  bytes: Buffer;
  contentType: string;
}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const reference: CachedCharacterReference = {
    contentType: input.contentType,
    base64: input.bytes.toString("base64"),
    createdAt: new Date(now).toISOString(),
    expiresAt: now + CHARACTER_REFERENCE_TTL_SECONDS * 1000,
  };

  const redis = getRedis();
  if (redis) {
    const serialized = serializeSharedRedisPayload({
      kind: "character_reference",
      operation: "storage.character_reference_payload",
      value: reference,
    });
    await redis.set(getCharacterReferenceKey(token), serialized, {
      ex: CHARACTER_REFERENCE_TTL_SECONDS,
    });
    characterReferenceCache.set(token, reference);
    return token;
  }

  await ensureCharacterReferenceDir();
  await sweepExpiredLocalCharacterReferences();
  await writeJsonAtomically(getCharacterReferenceFilePath(token), reference);
  characterReferenceCache.set(token, reference);
  scheduleLocalCharacterReferenceExpiry(token, reference.expiresAt);
  return token;
}

export async function getCachedCharacterReference(token: string) {
  const normalized = validateCharacterReferenceToken(token);
  const local = characterReferenceCache.get(normalized);
  if (isLiveCharacterReference(local)) {
    return local!;
  }
  if (local) {
    await removeLocalCharacterReference(normalized);
  }

  const redis = getRedis();
  if (redis) {
    const reference = parseCachedCharacterReference(
      await redis.get<CachedCharacterReference | string>(
        getCharacterReferenceKey(normalized),
      ),
    );
    if (!isLiveCharacterReference(reference)) {
      if (reference) await redis.del(getCharacterReferenceKey(normalized));
      return null;
    }
    characterReferenceCache.set(normalized, reference!);
    return reference!;
  }

  try {
    const raw = await fs.readFile(getCharacterReferenceFilePath(normalized), "utf8");
    const reference = JSON.parse(raw) as CachedCharacterReference;
    if (!isLiveCharacterReference(reference)) {
      await removeLocalCharacterReference(normalized);
      return null;
    }
    characterReferenceCache.set(normalized, reference);
    scheduleLocalCharacterReferenceExpiry(normalized, reference.expiresAt);
    return reference;
  } catch {
    return null;
  }
}

export async function getCachedCharacterReferenceDataUri(token: string) {
  const reference = await getCachedCharacterReference(token);
  return reference
    ? `data:${reference.contentType};base64,${reference.base64}`
    : null;
}

export const rateLimiter = {
  async reserve(identifier: string): Promise<RateLimitReservation> {
    const limit = getDailyFreeGenerationLimit();
    const redis = getRedis();
    const { day, resetAt, ttlSeconds } = getDailyRateLimitWindow();

    if (redis) {
      const key = getRateLimitKey(identifier, day);
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }

      if (count > limit) {
        await redis.decr(key).catch(() => undefined);
        return { success: false, remaining: 0, release: noopRelease };
      }

      let released = false;
      return {
        success: true,
        remaining: Math.max(0, limit - count),
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          const nextCount = await redis.decr(key);
          if (nextCount <= 0) {
            await redis.del(key);
          }
        },
      };
    }

    const now = Date.now();
    const current = localRateWindow.get(identifier);

    if (!current || current.resetAt < now) {
      const next = { count: 1, resetAt };
      localRateWindow.set(identifier, next);
      return {
        success: true,
        remaining: limit - 1,
        release: async () => {
          next.count = Math.max(0, next.count - 1);
          localRateWindow.set(identifier, next);
        },
      };
    }

    if (current.count >= limit) {
      return { success: false, remaining: 0, release: noopRelease };
    }

    current.count += 1;
    localRateWindow.set(identifier, current);
    return {
      success: true,
      remaining: Math.max(0, limit - current.count),
      release: async () => {
        current.count = Math.max(0, current.count - 1);
        localRateWindow.set(identifier, current);
      },
    };
  },

  async limit(identifier: string) {
    const { success, remaining } = await this.reserve(identifier);
    return { success, remaining };
  },
};

export async function cacheStory(storyId: string, data: GeneratedStory) {
  const normalized = validateStoryId(storyId);

  const redis = getRedis();
  if (redis) {
    const serialized = serializeSharedRedisPayload({
      kind: "story",
      operation: "storage.story_payload",
      value: data,
      storyId: normalized,
    });
    await redis.set(getStoryKey(normalized), serialized, {
      ex: STORY_CACHE_TTL_SECONDS,
    });
    rememberStory(normalized, data);
    return;
  }

  try {
    await writeStoryToDisk(normalized, data);
    rememberStory(normalized, data);
  } catch {
    rememberStory(normalized, data);
    logGenerationEvent(
      {
        operation: "storage.story_write",
        story: normalized,
        status: "memory_fallback",
        errorClass: "storage_unavailable",
      },
      "warn",
    );
  }
}

/**
 * Applies a whole-story transition with an optimistic revision check. Redis
 * uses a Lua CAS so concurrent page workers cannot overwrite one another;
 * local development serializes transitions per story. Returning null from
 * the mutator means that the current state is no longer eligible for change.
 */
export async function mutateCachedStory<T>(
  storyId: string,
  mutator: (
    story: GeneratedStory,
  ) => StoryMutationDecision<T> | null | Promise<StoryMutationDecision<T> | null>,
): Promise<StoryMutationOutcome<T> | null> {
  const normalized = validateStoryId(storyId);
  const redis = getRedis();

  if (redis) {
    for (let attempt = 0; attempt < MAX_STORY_MUTATION_ATTEMPTS; attempt += 1) {
      const current = await getCachedStory(normalized);
      if (!current) return null;
      const decision = await mutator(current);
      if (!decision) return null;
      if (!decision.nextStory) {
        return { story: current, value: decision.value, updated: false };
      }
      const currentRevision = getStoryRevision(current);
      const revised = createRevisedStory(decision.nextStory, currentRevision);
      const serialized = serializeSharedRedisPayload({
        kind: "story",
        operation: "storage.story_payload",
        value: revised,
        storyId: normalized,
      });
      const result = await redis.eval<string[], number>(
        MUTATE_STORY_SCRIPT,
        [getStoryKey(normalized)],
        [
          String(currentRevision),
          serialized,
          String(STORY_CACHE_TTL_SECONDS),
        ],
      );
      if (result === 1) {
        rememberStory(normalized, revised);
        return { story: revised, value: decision.value, updated: true };
      }
      if (result === 0) return null;
    }
    throw new Error("Story update conflicted repeatedly.");
  }

  const previous = localStoryMutationQueues.get(normalized) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const current = await getCachedStory(normalized);
      if (!current) return null;
      const decision = await mutator(current);
      if (!decision) return null;
      if (!decision.nextStory) {
        return { story: current, value: decision.value, updated: false };
      }
      const revised = createRevisedStory(
        decision.nextStory,
        getStoryRevision(current),
      );
      await cacheStory(normalized, revised);
      return { story: revised, value: decision.value, updated: true };
    });
  localStoryMutationQueues.set(normalized, next);
  try {
    return await next;
  } finally {
    if (localStoryMutationQueues.get(normalized) === next) {
      localStoryMutationQueues.delete(normalized);
    }
  }
}

export async function getCachedStory(storyId: string) {
  const normalized = validateStoryId(storyId);

  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<GeneratedStory | string>(getStoryKey(normalized));
    const parsed = parseCachedStory(raw);
    if (!parsed) {
      storyCache.delete(normalized);
      return null;
    }
    rememberStory(normalized, parsed);
    return parsed;
  }

  const local = storyCache.get(normalized);
  if (local && !isExpiredStoryEntry(local)) {
    return local.story;
  }
  if (local) storyCache.delete(normalized);

  const storyFromDisk = await readStoryFromDisk(normalized);
  if (storyFromDisk) {
    rememberStory(normalized, storyFromDisk.story, storyFromDisk.expiresAt);
    return storyFromDisk.story;
  }
  return null;
}

export async function cacheTextGenerationTask(task: TextGenerationTask) {
  const taskId = validateTextGenerationTaskId(task.taskId);

  const redis = getRedis();
  if (redis) {
    await redis.set(getTextGenerationTaskKey(taskId), task, {
      ex: TEXT_GENERATION_TASK_TTL_SECONDS,
    });
    textGenerationTaskCache.set(taskId, task);
    return;
  }

  try {
    await ensureTextGenerationTaskDir();
    await sweepExpiredLocalTextGenerationTasks();
    await writeJsonAtomically(getTextGenerationTaskFilePath(taskId), task);
    textGenerationTaskCache.set(taskId, task);
  } catch {
    textGenerationTaskCache.set(taskId, task);
    logGenerationEvent(
      {
        operation: "storage.text_task_write",
        task: taskId,
        story: task.storyId,
        status: "memory_fallback",
        errorClass: "storage_unavailable",
      },
      "warn",
    );
  }
}

/**
 * Applies an atomic task transition. Redis uses an optimistic revision CAS;
 * local development serializes transitions by task id. Tasks written before
 * revisions existed are treated as revision zero.
 */
export async function mutateCachedTextGenerationTask<T>(
  taskId: string,
  mutator: (
    task: TextGenerationTask,
  ) =>
    | TextGenerationTaskMutationDecision<T>
    | null
    | Promise<TextGenerationTaskMutationDecision<T> | null>,
  options: TextGenerationTaskMutationOptions = {},
): Promise<TextGenerationTaskMutationOutcome<T> | null> {
  const normalized = validateTextGenerationTaskId(taskId);
  const storyFence = options.publishStoryFence;
  if (storyFence) {
    validateStoryId(storyFence.storyId);
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(storyFence.durableJobId)) {
      throw new Error("Invalid durable generation job id.");
    }
    if (
      !Number.isInteger(storyFence.durableJobAttempt) ||
      storyFence.durableJobAttempt < 1
    ) {
      throw new Error("Invalid durable generation job attempt.");
    }
  }
  const redis = getRedis();

  if (redis) {
    for (
      let attempt = 0;
      attempt < MAX_TEXT_TASK_MUTATION_ATTEMPTS;
      attempt += 1
    ) {
      const current = await getCachedTextGenerationTask(normalized);
      if (!current) return null;
      const decision = await mutator(current);
      if (!decision) return null;
      if (!decision.nextTask) {
        return { task: current, value: decision.value, updated: false };
      }
      const currentRevision = getTextGenerationTaskRevision(current);
      const revised = createRevisedTextGenerationTask(
        decision.nextTask,
        currentRevision,
      );
      const result = storyFence
        ? await redis.eval<string[], number>(
            MUTATE_TEXT_GENERATION_TASK_WITH_STORY_FENCE_SCRIPT,
            [
              getTextGenerationTaskKey(normalized),
              getStoryKey(storyFence.storyId),
            ],
            [
              String(currentRevision),
              JSON.stringify(revised),
              String(TEXT_GENERATION_TASK_TTL_SECONDS),
              normalized,
              storyFence.storyId,
              storyFence.durableJobId,
              String(storyFence.durableJobAttempt),
            ],
          )
        : await redis.eval<string[], number>(
            MUTATE_TEXT_GENERATION_TASK_SCRIPT,
            [getTextGenerationTaskKey(normalized)],
            [
              String(currentRevision),
              JSON.stringify(revised),
              String(TEXT_GENERATION_TASK_TTL_SECONDS),
            ],
          );
      if (result === 1) {
        textGenerationTaskCache.set(normalized, revised);
        return { task: revised, value: decision.value, updated: true };
      }
      if (result === 0) return null;
    }
    throw new Error("Text generation task update conflicted repeatedly.");
  }

  const previous =
    localTextGenerationTaskMutationQueues.get(normalized) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const current = await getCachedTextGenerationTask(normalized);
      if (!current) return null;
      if (storyFence) {
        const story = await getCachedStory(storyFence.storyId);
        if (
          !story ||
          story.id !== storyFence.storyId ||
          story.textGenerationJobId !== storyFence.durableJobId ||
          story.textGenerationJobAttempt !== storyFence.durableJobAttempt
        ) {
          return null;
        }
      }
      const decision = await mutator(current);
      if (!decision) return null;
      if (!decision.nextTask) {
        return { task: current, value: decision.value, updated: false };
      }
      const revised = createRevisedTextGenerationTask(
        decision.nextTask,
        getTextGenerationTaskRevision(current),
      );
      await cacheTextGenerationTask(revised);
      return { task: revised, value: decision.value, updated: true };
    });
  localTextGenerationTaskMutationQueues.set(normalized, next);
  try {
    return await next;
  } finally {
    if (localTextGenerationTaskMutationQueues.get(normalized) === next) {
      localTextGenerationTaskMutationQueues.delete(normalized);
    }
  }
}

/**
 * Publishes a freshly computed Story only while the durable task still points
 * at the same job attempt. Redis checks the task fence and writes the Story in
 * one Lua operation, eliminating the gap between lease validation and SET.
 */
export async function publishTextGenerationStory(input: {
  taskId: string;
  storyId: string;
  durableJobId: string;
  durableJobAttempt: number;
  story: GeneratedStory;
}): Promise<GeneratedStory | null> {
  const taskId = validateTextGenerationTaskId(input.taskId);
  const storyId = validateStoryId(input.storyId);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.durableJobId)) {
    throw new Error("Invalid durable generation job id.");
  }
  if (
    !Number.isInteger(input.durableJobAttempt) ||
    input.durableJobAttempt < 1
  ) {
    throw new Error("Invalid durable generation job attempt.");
  }
  const redis = getRedis();

  if (redis) {
    const updatedAt = new Date().toISOString();
    const serialized = serializeSharedRedisPayload({
      kind: "story",
      operation: "storage.story_payload",
      value: input.story,
      storyId,
    });
    const raw = await redis.eval<string[], string | null>(
      PUBLISH_TEXT_GENERATION_STORY_SCRIPT,
      [getTextGenerationTaskKey(taskId), getStoryKey(storyId)],
      [
        taskId,
        storyId,
        input.durableJobId,
        String(input.durableJobAttempt),
        serialized,
        String(STORY_CACHE_TTL_SECONDS),
        updatedAt,
      ],
    );
    if (!raw) return null;
    const story = parseCachedStory(raw);
    if (!story) return null;
    rememberStory(storyId, story);
    return story;
  }

  const previous =
    localTextGenerationTaskMutationQueues.get(taskId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const task = await getCachedTextGenerationTask(taskId);
      if (
        !task ||
        task.storyId !== storyId ||
        task.status !== "generating_text" ||
        task.durableJobId !== input.durableJobId ||
        task.durableJobAttempt !== input.durableJobAttempt
      ) {
        return null;
      }
      const currentStory = await getCachedStory(storyId);
      const revised = createRevisedStory(
        {
          ...input.story,
          textGenerationJobId: input.durableJobId,
          textGenerationJobAttempt: input.durableJobAttempt,
        },
        getStoryRevision(currentStory),
      );
      await cacheStory(storyId, revised);
      return revised;
    });
  localTextGenerationTaskMutationQueues.set(taskId, next);
  try {
    return await next;
  } finally {
    if (localTextGenerationTaskMutationQueues.get(taskId) === next) {
      localTextGenerationTaskMutationQueues.delete(taskId);
    }
  }
}

export async function createTextGenerationTaskIfAbsent(
  task: TextGenerationTask,
  options: { requireDurable?: boolean } = {},
): Promise<{ task: TextGenerationTask; created: boolean }> {
  const taskId = validateTextGenerationTaskId(task.taskId);
  if (options.requireDurable) requireDurableStorage();

  const redis = getRedis();
  if (redis) {
    const created = await redis.set(getTextGenerationTaskKey(taskId), task, {
      ex: TEXT_GENERATION_TASK_TTL_SECONDS,
      nx: true,
    });
    if (created === "OK") {
      textGenerationTaskCache.set(taskId, task);
      return { task, created: true };
    }

    const existing = await getCachedTextGenerationTask(taskId);
    if (existing) return { task: existing, created: false };
    throw new Error("Unable to read the existing text generation task.");
  }

  const local = textGenerationTaskCache.get(taskId);
  if (local && !isExpiredTextGenerationTask(local)) {
    return { task: local, created: false };
  }
  if (local) textGenerationTaskCache.delete(taskId);

  try {
    await ensureTextGenerationTaskDir();
    await sweepExpiredLocalTextGenerationTasks();
    const created = await createJsonFileIfAbsentAtomically(
      getTextGenerationTaskFilePath(taskId),
      task,
    );
    if (created) {
      textGenerationTaskCache.set(taskId, task);
      return { task, created: true };
    }

    const existing = await getCachedTextGenerationTask(taskId);
    if (existing) return { task: existing, created: false };

    const retried = await createJsonFileIfAbsentAtomically(
      getTextGenerationTaskFilePath(taskId),
      task,
    );
    if (retried) {
      textGenerationTaskCache.set(taskId, task);
      return { task, created: true };
    }
    throw new Error("Unable to read the existing text generation task.");
  } catch {
    // Memory remains the last fallback when neither Redis nor the local
    // filesystem is available. It still prevents duplicates in this process.
    const raced = textGenerationTaskCache.get(taskId);
    if (raced) return { task: raced, created: false };
    textGenerationTaskCache.set(taskId, task);
    logGenerationEvent(
      {
        operation: "storage.text_task_create",
        task: taskId,
        story: task.storyId,
        status: "memory_fallback",
        errorClass: "storage_unavailable",
      },
      "warn",
    );
    return { task, created: true };
  }
}

export async function getCachedTextGenerationTask(taskId: string) {
  const normalized = validateTextGenerationTaskId(taskId);

  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<TextGenerationTask | string>(
      getTextGenerationTaskKey(normalized),
    );
    const parsed = parseTextGenerationTask(raw);
    if (parsed && isExpiredTextGenerationTask(parsed)) {
      await redis.del(getTextGenerationTaskKey(normalized));
      textGenerationTaskCache.delete(normalized);
      return null;
    }
    if (parsed) textGenerationTaskCache.set(normalized, parsed);
    else textGenerationTaskCache.delete(normalized);
    return parsed;
  }

  const local = textGenerationTaskCache.get(normalized);
  if (local && !isExpiredTextGenerationTask(local)) return local;
  if (local) textGenerationTaskCache.delete(normalized);

  try {
    const filePath = getTextGenerationTaskFilePath(normalized);
    const [raw, stats] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      fs.stat(filePath),
    ]);
    const parsed = JSON.parse(raw) as TextGenerationTask;
    if (isExpiredTextGenerationTask(parsed) || isFileExpired(stats.mtimeMs)) {
      await fs.rm(filePath, { force: true });
      return null;
    }
    textGenerationTaskCache.set(normalized, parsed);
    return parsed;
  } catch {
    return null;
  }
}
