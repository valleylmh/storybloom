import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const localAttempts = new Map<string, { count: number; resetAt: number }>();
let limiter: Ratelimit | null | undefined;

function getLimiter() {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  limiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(5, "1 h"),
          prefix: "storybloom:newsletter",
        })
      : null;
  return limiter;
}

export async function canRequestNewsletter(identifier: string) {
  const remoteLimiter = getLimiter();
  if (remoteLimiter) {
    return (await remoteLimiter.limit(identifier)).success;
  }

  const now = Date.now();
  const current = localAttempts.get(identifier);
  if (!current || current.resetAt <= now) {
    localAttempts.set(identifier, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= 5;
}
