import { promises as fs } from "fs";
import crypto from "node:crypto";
import os from "os";
import path from "path";
import { Redis } from "@upstash/redis";
import type { GeneratedStory } from "@/types";

const storyCache = new Map<string, GeneratedStory>();
const characterReferenceCache = new Map<string, CachedCharacterReference>();
const localRateWindow = new Map<string, { count: number; resetAt: number }>();
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const CHARACTER_REFERENCE_TTL_SECONDS = 24 * 60 * 60;
const localCacheDir =
  process.env.STORYBLOOM_CACHE_DIR ||
  path.join(process.env.VERCEL ? os.tmpdir() : process.cwd(), ".storybloom-cache");

let redisClient: Redis | null | undefined;

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

  const redisRestUrl =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisRestToken =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!redisRestUrl || !redisRestToken) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: redisRestUrl,
    token: redisRestToken,
  });

  return redisClient;
}

function getStoryFilePath(storyId: string) {
  return path.join(localCacheDir, `${storyId}.json`);
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
  await fs.mkdir(localCacheDir, { recursive: true });
}

async function ensureCharacterReferenceDir() {
  await fs.mkdir(getCharacterReferenceDir(), { recursive: true });
}

async function writeStoryToDisk(storyId: string, data: GeneratedStory) {
  await ensureLocalCacheDir();
  await fs.writeFile(getStoryFilePath(storyId), JSON.stringify(data, null, 2), "utf8");
}

async function readStoryFromDisk(storyId: string) {
  try {
    const raw = await fs.readFile(getStoryFilePath(storyId), "utf8");
    return JSON.parse(raw) as GeneratedStory;
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

function isLiveCharacterReference(value: CachedCharacterReference | null | undefined) {
  return Boolean(value && value.expiresAt > Date.now());
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
  characterReferenceCache.set(token, reference);

  const redis = getRedis();
  if (redis) {
    await redis.set(getCharacterReferenceKey(token), reference, {
      ex: CHARACTER_REFERENCE_TTL_SECONDS,
    });
    return token;
  }

  await ensureCharacterReferenceDir();
  await sweepExpiredLocalCharacterReferences();
  await fs.writeFile(
    getCharacterReferenceFilePath(token),
    JSON.stringify(reference),
    "utf8"
  );
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
    const reference = await redis.get<CachedCharacterReference>(
      getCharacterReferenceKey(normalized)
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
  storyCache.set(storyId, data);

  const redis = getRedis();
  if (redis) {
    await redis.set(`story:${storyId}`, data, { ex: 86400 });
    return;
  }

  try {
    await writeStoryToDisk(storyId, data);
  } catch (error) {
    console.warn("[storage] disk cache unavailable, using memory cache only", {
      storyId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getCachedStory(storyId: string) {
  const local = storyCache.get(storyId);
  if (local) {
    return local;
  }

  const redis = getRedis();
  if (!redis) {
    const storyFromDisk = await readStoryFromDisk(storyId);
    if (storyFromDisk) {
      storyCache.set(storyId, storyFromDisk);
    }
    return storyFromDisk;
  }

  const raw = await redis.get<GeneratedStory | string>(`story:${storyId}`);
  const parsed = parseCachedStory(raw);
  if (!parsed) {
    return null;
  }

  storyCache.set(storyId, parsed);
  return parsed;
}
