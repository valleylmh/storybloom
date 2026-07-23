import crypto from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LocalAttempt = { count: number; resetAt: number };

type RateLimitOptions = {
  limit: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  windowMs: number;
  prefix: string;
};

const localAttempts = new Map<string, LocalAttempt>();
const remoteLimiters = new Map<string, Ratelimit | null>();
const MAX_LOCAL_IDENTIFIERS = 10_000;

function getRemoteLimiter(options: RateLimitOptions) {
  const key = `${options.prefix}:${options.limit}:${options.window}`;
  if (remoteLimiters.has(key)) {
    return remoteLimiters.get(key) ?? null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const limiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(options.limit, options.window),
          prefix: `storybloom:${options.prefix}`,
        })
      : null;

  remoteLimiters.set(key, limiter);
  return limiter;
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

export async function allowIpRequest(request: Request, options: RateLimitOptions) {
  const ip = getClientIp(request);
  const identifier = crypto.createHash("sha256").update(ip).digest("hex");
  const remoteLimiter = getRemoteLimiter(options);

  if (remoteLimiter) {
    return (await remoteLimiter.limit(identifier)).success;
  }

  const key = `${options.prefix}:${identifier}`;
  const now = Date.now();
  if (localAttempts.size >= MAX_LOCAL_IDENTIFIERS) {
    for (const [attemptKey, attempt] of localAttempts) {
      if (attempt.resetAt <= now) localAttempts.delete(attemptKey);
    }
  }
  const current = localAttempts.get(key);
  if (!current || current.resetAt <= now) {
    localAttempts.set(key, { count: 1, resetAt: now + options.windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= options.limit;
}
