import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let cacheDir = "";
const originalCacheDir = process.env.STORYBLOOM_CACHE_DIR;
const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(os.tmpdir(), "storybloom-reference-test-"));
  process.env.STORYBLOOM_CACHE_DIR = cacheDir;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  vi.resetModules();
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
  if (originalCacheDir === undefined) delete process.env.STORYBLOOM_CACHE_DIR;
  else process.env.STORYBLOOM_CACHE_DIR = originalCacheDir;
  if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
  if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
  if (originalKvUrl === undefined) delete process.env.KV_REST_API_URL;
  else process.env.KV_REST_API_URL = originalKvUrl;
  if (originalKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
  else process.env.KV_REST_API_TOKEN = originalKvToken;
});

describe("temporary character reference cache", () => {
  it("stores an opaque token and restores the image as a data URI", async () => {
    const { cacheCharacterReference, getCachedCharacterReferenceDataUri } = await import(
      "@/lib/storage"
    );

    const token = await cacheCharacterReference({
      bytes: Buffer.from("reference-image"),
      contentType: "image/webp",
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]{32,96}$/);
    await expect(getCachedCharacterReferenceDataUri(token)).resolves.toBe(
      "data:image/webp;base64,cmVmZXJlbmNlLWltYWdl"
    );
  });
});
