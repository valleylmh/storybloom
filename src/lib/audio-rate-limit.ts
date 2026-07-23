import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const LOCAL_WINDOW_MS = 60 * 1000;
const LOCAL_MAX_REQUESTS = 30;

const localAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();
let remoteLimiter: Ratelimit | null | undefined;

function getRemoteLimiter() {
  if (remoteLimiter !== undefined) {
    return remoteLimiter;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  remoteLimiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(LOCAL_MAX_REQUESTS, "1 m"),
          prefix: "storybloom:audio",
          analytics: false,
        })
      : null;

  return remoteLimiter;
}

export async function checkAudioRateLimit(identifier: string) {
  const limiter = getRemoteLimiter();
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        success: result.success,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000),
        ),
      };
    } catch (error) {
      console.warn("[audio] remote rate limiter unavailable; using local window", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const now = Date.now();
  const current = localAttempts.get(identifier);
  if (!current || current.resetAt <= now) {
    localAttempts.set(identifier, {
      count: 1,
      resetAt: now + LOCAL_WINDOW_MS,
    });
    return { success: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (localAttempts.size > 5_000) {
    for (const [key, value] of localAttempts) {
      if (value.resetAt <= now) localAttempts.delete(key);
    }
  }

  return {
    success: current.count <= LOCAL_MAX_REQUESTS,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    ),
  };
}
