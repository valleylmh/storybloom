import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const redisState = vi.hoisted(() => ({
  values: new Map<string, { value: unknown; options?: { ex?: number } }>(),
  sortedSets: new Map<string, Map<string, number>>(),
  evalFailure: false,
  advanceRevisionBeforeNextMetadataCas: false,
}));

function sortedSet(key: string) {
  let value = redisState.sortedSets.get(key);
  if (!value) {
    value = new Map<string, number>();
    redisState.sortedSets.set(key, value);
  }
  return value;
}

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    constructor(_options: unknown) {}

    async set(
      key: string,
      value: unknown,
      options?: { ex?: number },
    ) {
      redisState.values.set(key, { value: structuredClone(value), options });
      return "OK";
    }

    async get<T>(key: string) {
      const item = redisState.values.get(key);
      return item ? (structuredClone(item.value) as T) : null;
    }

    async del(key: string) {
      return redisState.values.delete(key) ? 1 : 0;
    }

    async zrange(
      key: string,
      min: number,
      max: number,
      options?: { byScore?: boolean; offset?: number; count?: number },
    ) {
      const entries = [...sortedSet(key).entries()].sort(
        (left, right) => left[1] - right[1] || left[0].localeCompare(right[0]),
      );
      if (options?.byScore) {
        const filtered = entries
          .filter(([, score]) => score >= min && score <= max)
          .map(([member]) => member);
        const offset = options.offset || 0;
        return options.count === undefined
          ? filtered.slice(offset)
          : filtered.slice(offset, offset + options.count);
      }
      const normalizedMax = max < 0 ? entries.length + max : max;
      return entries.slice(min, normalizedMax + 1).map(([member]) => member);
    }

    async zrem(key: string, member: string) {
      return sortedSet(key).delete(member) ? 1 : 0;
    }

    async eval(_script: string, keys: string[], args: unknown[]) {
      if (redisState.evalFailure) throw new Error("redis-eval-failed");
      if (keys.length === 3 && args.length === 7) {
        const current = redisState.values.get(keys[0]);
        const mode = String(args[5]);
        if (mode === "create" && current) return 0;
        if (mode === "cas") {
          if (redisState.advanceRevisionBeforeNextMetadataCas && current) {
            redisState.advanceRevisionBeforeNextMetadataCas = false;
            const newerValue = structuredClone(current.value) as {
              revision?: number;
            };
            newerValue.revision = Number(newerValue.revision ?? 1) + 1;
            redisState.values.set(keys[0], {
              value: newerValue,
              options: current.options,
            });
          }
          const latest = redisState.values.get(keys[0]);
          if (!latest) return 0;
          const currentValue = latest.value as { revision?: number };
          if (Number(currentValue.revision ?? 1) !== Number(args[6])) return 0;
        }
        redisState.values.set(keys[0], {
          value: JSON.parse(String(args[0])),
          options: { ex: Number(args[1]) },
        });
        if (String(args[4]) === "expiry") {
          sortedSet(keys[1]).set(String(args[3]), Number(args[2]));
          sortedSet(keys[2]).delete(String(args[3]));
        } else {
          sortedSet(keys[1]).delete(String(args[3]));
          sortedSet(keys[2]).set(String(args[3]), Number(args[2]));
        }
        return 1;
      }
      if (keys.length === 3 && args.length === 2) {
        const current = redisState.values.get(keys[0]);
        if (String(args[1])) {
          if (!current) return 0;
          const currentValue = current.value as { revision?: number };
          if (Number(currentValue.revision ?? 1) !== Number(args[1])) return 0;
        }
        redisState.values.delete(keys[0]);
        sortedSet(keys[1]).delete(String(args[0]));
        sortedSet(keys[2]).delete(String(args[0]));
        return 1;
      }
      if (keys.length === 2 && args.length === 2) {
        sortedSet(keys[0]).delete(String(args[0]));
        sortedSet(keys[1]).set(String(args[0]), Number(args[1]));
        return 1;
      }
      throw new Error("unsupported-fake-redis-eval");
    }
  },
}));

const supabaseState = vi.hoisted(() => ({
  buckets: new Map<string, Map<string, { bytes: Buffer; contentType: string }>>(),
  uploadFailure: false,
  downloadFailure: false,
  removeFailure: false,
  failNextRemove: false,
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: (bucket: string) => {
        let objects = supabaseState.buckets.get(bucket);
        if (!objects) {
          objects = new Map();
          supabaseState.buckets.set(bucket, objects);
        }
        return {
          upload: async (
            storagePath: string,
            bytes: Buffer,
            options: { contentType: string; upsert: boolean },
          ) => {
            if (supabaseState.uploadFailure) {
              return { data: null, error: new Error("upload-failed") };
            }
            if (!options.upsert && objects!.has(storagePath)) {
              return { data: null, error: new Error("duplicate") };
            }
            objects!.set(storagePath, {
              bytes: Buffer.from(bytes),
              contentType: options.contentType,
            });
            return { data: { path: storagePath }, error: null };
          },
          download: async (storagePath: string) => {
            if (supabaseState.downloadFailure) {
              return { data: null, error: new Error("download-failed") };
            }
            const object = objects!.get(storagePath);
            return object
              ? {
                  data: new Blob([Uint8Array.from(object.bytes)], {
                    type: object.contentType,
                  }),
                  error: null,
                }
              : { data: null, error: new Error("not-found") };
          },
          remove: async (paths: string[]) => {
            if (supabaseState.removeFailure || supabaseState.failNextRemove) {
              supabaseState.failNextRemove = false;
              return { data: null, error: new Error("remove-failed") };
            }
            for (const storagePath of paths) objects!.delete(storagePath);
            return { data: [], error: null };
          },
        };
      },
    },
  }),
}));

const originalEnvironment = {
  cacheDir: process.env.STORYBLOOM_CACHE_DIR,
  assetDir: process.env.STORYBLOOM_TEMP_ASSET_DIR,
  ttl: process.env.STORYBLOOM_TEMP_ASSET_TTL_SECONDS,
  maxBytes: process.env.STORYBLOOM_TEMP_ASSET_MAX_BYTES,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  kvUrl: process.env.KV_REST_API_URL,
  kvToken: process.env.KV_REST_API_TOKEN,
  backend: process.env.STORYBLOOM_TEMP_ASSET_BACKEND,
  bucket: process.env.STORYBLOOM_TEMP_ASSET_BUCKET,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
  orphanGrace: process.env.STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS,
  sweepLimit: process.env.STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT,
};

let assetDir = "";

function setOrDelete(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function makePngBytes() {
  const bytes = Buffer.alloc(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  return bytes;
}

function makeJpegBytes() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
}

function makeWebpBytes() {
  const bytes = Buffer.alloc(20);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  return bytes;
}

function dataUri(contentType: string, bytes: Buffer) {
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

const principal = { type: "anonymous" as const, id: "anon-session-1" };
const otherPrincipal = { type: "anonymous" as const, id: "anon-session-2" };

function configureSharedBackend() {
  process.env.STORYBLOOM_TEMP_ASSET_BACKEND = "supabase";
  process.env.STORYBLOOM_TEMP_ASSET_BUCKET = "story-generation-assets";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
}

beforeEach(async () => {
  assetDir = await mkdtemp(path.join(os.tmpdir(), "storybloom-temp-assets-"));
  process.env.STORYBLOOM_TEMP_ASSET_DIR = assetDir;
  vi.stubEnv("NODE_ENV", "test");
  delete process.env.STORYBLOOM_CACHE_DIR;
  delete process.env.STORYBLOOM_TEMP_ASSET_TTL_SECONDS;
  delete process.env.STORYBLOOM_TEMP_ASSET_MAX_BYTES;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.STORYBLOOM_TEMP_ASSET_BACKEND;
  delete process.env.STORYBLOOM_TEMP_ASSET_BUCKET;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS;
  delete process.env.STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT;
  redisState.values.clear();
  redisState.sortedSets.clear();
  redisState.evalFailure = false;
  redisState.advanceRevisionBeforeNextMetadataCas = false;
  supabaseState.buckets.clear();
  supabaseState.uploadFailure = false;
  supabaseState.downloadFailure = false;
  supabaseState.removeFailure = false;
  supabaseState.failNextRemove = false;
  vi.resetModules();
});

afterEach(async () => {
  await rm(assetDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  setOrDelete("STORYBLOOM_CACHE_DIR", originalEnvironment.cacheDir);
  setOrDelete("STORYBLOOM_TEMP_ASSET_DIR", originalEnvironment.assetDir);
  setOrDelete("STORYBLOOM_TEMP_ASSET_TTL_SECONDS", originalEnvironment.ttl);
  setOrDelete("STORYBLOOM_TEMP_ASSET_MAX_BYTES", originalEnvironment.maxBytes);
  setOrDelete("UPSTASH_REDIS_REST_URL", originalEnvironment.upstashUrl);
  setOrDelete("UPSTASH_REDIS_REST_TOKEN", originalEnvironment.upstashToken);
  setOrDelete("KV_REST_API_URL", originalEnvironment.kvUrl);
  setOrDelete("KV_REST_API_TOKEN", originalEnvironment.kvToken);
  setOrDelete("STORYBLOOM_TEMP_ASSET_BACKEND", originalEnvironment.backend);
  setOrDelete("STORYBLOOM_TEMP_ASSET_BUCKET", originalEnvironment.bucket);
  setOrDelete("NEXT_PUBLIC_SUPABASE_URL", originalEnvironment.supabaseUrl);
  setOrDelete("SUPABASE_SERVICE_ROLE_KEY", originalEnvironment.serviceRole);
  setOrDelete(
    "STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS",
    originalEnvironment.orphanGrace,
  );
  setOrDelete("STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT", originalEnvironment.sweepLimit);
});

describe("temporary story asset store", () => {
  it("stores valid image bytes privately, keeps pending bytes unreadable, and commits by lease", async () => {
    const store = await import("@/lib/temporary-story-asset-store");
    const png = dataUri("image/png", makePngBytes());
    const result = await store.putTemporaryStoryAsset({
      source: png,
      storyId: "story-asset-1",
      page: 1,
      attemptId: "attempt-1",
      principal,
      now: 1_000,
    });

    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;
    expect(result.assetId).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(result.imageUrl).toBe(
      `/api/story-assets/${result.assetId}`,
    );
    expect(
      await store.readTemporaryStoryAsset({
        assetId: result.assetId,
        principal,
        now: 1_001,
      }),
    ).toBeNull();

    const names = await readdir(assetDir);
    expect(names).toContain(`${result.assetId}.json`);
    expect(names).toContain(`${result.assetId}.png`);
    const directoryStats = await stat(assetDir);
    const metadataStats = await stat(path.join(assetDir, `${result.assetId}.json`));
    const bytesStats = await stat(path.join(assetDir, `${result.assetId}.png`));
    expect(directoryStats.mode & 0o777).toBe(0o700);
    expect(metadataStats.mode & 0o777).toBe(0o600);
    expect(bytesStats.mode & 0o777).toBe(0o600);

    const metadataText = await readFile(
      path.join(assetDir, `${result.assetId}.json`),
      "utf8",
    );
    expect(metadataText).not.toContain("data:image");
    expect(metadataText).not.toContain(png.split(",")[1]);

    await expect(
      store.commitTemporaryStoryAsset({
        assetId: result.assetId,
        lease: "x".repeat(32),
        principal,
        now: 1_002,
      }),
    ).resolves.toBe(false);
    await expect(
      store.commitTemporaryStoryAsset({
        assetId: result.assetId,
        lease: result.lease,
        principal: otherPrincipal,
        now: 1_002,
      }),
    ).resolves.toBe(false);
    await expect(
      store.commitTemporaryStoryAsset({
        assetId: result.assetId,
        lease: result.lease,
        principal,
        now: 1_002,
      }),
    ).resolves.toBe(true);

    vi.resetModules();
    const restartedStore = await import("@/lib/temporary-story-asset-store");
    const loaded = await restartedStore.readTemporaryStoryAsset({
      assetId: result.assetId,
      principal,
      now: 1_003,
    });
    expect(loaded).toMatchObject({
      assetId: result.assetId,
      storyId: "story-asset-1",
      page: 1,
      attemptId: "attempt-1",
      state: "committed",
      contentType: "image/png",
      bytes: makePngBytes(),
    });
    expect(loaded?.etag).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it("accepts JPEG and WebP only when declared MIME matches magic bytes", async () => {
    const store = await import("@/lib/temporary-story-asset-store");
    for (const [contentType, bytes, extension] of [
      ["image/jpeg", makeJpegBytes(), "jpg"],
      ["image/webp", makeWebpBytes(), "webp"],
    ] as const) {
      const result = await store.putTemporaryStoryAsset({
        source: dataUri(contentType, bytes),
        storyId: `story-${extension}`,
        page: 2,
        principal,
      });
      expect(result.kind).toBe("stored");
      if (result.kind === "stored") {
        await store.commitTemporaryStoryAsset({
          assetId: result.assetId,
          lease: result.lease,
          principal,
        });
        await expect(
          stat(path.join(assetDir, `${result.assetId}.${extension}`)),
        ).resolves.toBeTruthy();
      }
    }

    await expect(
      store.putTemporaryStoryAsset({
        source: dataUri("image/png", makeJpegBytes()),
        storyId: "story-mismatch",
        page: 1,
        principal,
      }),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_INVALID_SOURCE" });
  });

  it("passes through demo SVG and safe static paths without ingesting them", async () => {
    const store = await import("@/lib/temporary-story-asset-store");
    await expect(
      store.putTemporaryStoryAsset({
        source:
          "data:image/svg+xml;charset=UTF-8,%3Csvg%3EStoryBloom%20Demo%3C%2Fsvg%3E",
        storyId: "story-demo",
        page: 1,
        principal,
      }),
    ).resolves.toEqual({
      kind: "passthrough",
      imageUrl:
        "data:image/svg+xml;charset=UTF-8,%3Csvg%3EStoryBloom%20Demo%3C%2Fsvg%3E",
      reason: "demo-svg",
    });
    await expect(
      store.putTemporaryStoryAsset({
        source: "/library/book/page-1.webp",
        storyId: "story-static",
        page: 1,
        principal,
      }),
    ).resolves.toEqual({
      kind: "passthrough",
      imageUrl: "/library/book/page-1.webp",
      reason: "static-path",
    });
    await expect(readdir(assetDir)).resolves.toEqual([]);
  });

  it("rejects invalid images, oversized bytes, and unsafe static sources", async () => {
    const store = await import("@/lib/temporary-story-asset-store");
    const cases = [
      "data:image/png;base64,not-base64!",
      dataUri("image/png", Buffer.from("not-an-image")),
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      "https://example.com/private.webp",
      "data:image/png;base64," + Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64"),
    ];
    for (const source of cases) {
      await expect(
        store.putTemporaryStoryAsset({
          source,
          storyId: "story-invalid",
          page: 1,
          principal,
        }),
      ).rejects.toMatchObject({ code: "TEMP_ASSET_INVALID_SOURCE" });
    }
  });

  it("refuses a configured asset directory whose path traverses a symbolic link", async () => {
    const realDirectory = await mkdtemp(
      path.join(os.tmpdir(), "storybloom-temp-assets-real-"),
    );
    const linkDirectory = `${realDirectory}-link`;
    await symlink(realDirectory, linkDirectory, "dir");
    process.env.STORYBLOOM_TEMP_ASSET_DIR = path.join(linkDirectory, "assets");
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");

    await expect(
      store.putTemporaryStoryAsset({
        source: dataUri("image/png", makePngBytes()),
        storyId: "story-symlink",
        page: 1,
        principal,
      }),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_UNAVAILABLE" });
    await rm(linkDirectory, { force: true });
    await rm(realDirectory, { recursive: true, force: true });
  });

  it("enforces expiry, touch, discard, delete, and principal isolation", async () => {
    const store = await import("@/lib/temporary-story-asset-store");
    const result = await store.putTemporaryStoryAsset({
      source: dataUri("image/png", makePngBytes()),
      storyId: "story-life-1",
      page: 1,
      principal,
      ttlSeconds: 2,
      now: 10_000,
    });
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;

    await expect(
      store.commitTemporaryStoryAsset({
        assetId: result.assetId,
        lease: result.lease,
        principal,
        now: 10_001,
      }),
    ).resolves.toBe(true);
    await expect(
      store.readTemporaryStoryAsset({
        assetId: result.assetId,
        principal: otherPrincipal,
        now: 10_001,
      }),
    ).resolves.toBeNull();
    await expect(
      store.touchTemporaryStoryAssets({
        storyId: "story-life-1",
        principal,
        ttlSeconds: 100,
        now: 10_001,
      }),
    ).resolves.toBe(1);
    await expect(
      store.readTemporaryStoryAsset({
        assetId: result.assetId,
        principal,
        now: 11_000,
      }),
    ).resolves.toMatchObject({ state: "committed" });
    await expect(
      store.deleteTemporaryStoryAssets({
        storyId: "story-life-1",
        principal: otherPrincipal,
      }),
    ).resolves.toBe(0);
    await expect(
      store.deleteTemporaryStoryAsset({
        assetId: result.assetId,
        principal,
      }),
    ).resolves.toBe(true);
    await expect(
      store.readTemporaryStoryAsset({
        assetId: result.assetId,
        principal,
      }),
    ).resolves.toBeNull();

    const discarded = await store.putTemporaryStoryAsset({
      source: dataUri("image/png", makePngBytes()),
      storyId: "story-discarded",
      page: 3,
      principal,
    });
    expect(discarded.kind).toBe("stored");
    if (discarded.kind === "stored") {
      await expect(
        store.discardTemporaryStoryAsset({
          assetId: discarded.assetId,
          lease: discarded.lease,
          principal: otherPrincipal,
        }),
      ).resolves.toBe(false);
      await expect(
        store.discardTemporaryStoryAsset({
          assetId: discarded.assetId,
          lease: discarded.lease,
          principal,
        }),
      ).resolves.toBe(true);
      await expect(
        stat(path.join(assetDir, `${discarded.assetId}.json`)),
      ).rejects.toThrow();
    }

    const expired = await store.putTemporaryStoryAsset({
      source: dataUri("image/png", makePngBytes()),
      storyId: "story-expired",
      page: 1,
      principal,
      ttlSeconds: 1,
      now: 20_000,
    });
    expect(expired.kind).toBe("stored");
    if (expired.kind === "stored") {
      await expect(
        store.sweepExpiredTemporaryStoryAssets(21_001),
      ).resolves.toMatchObject({ deletedExpiredAssets: 1 });
      await expect(
        stat(path.join(assetDir, `${expired.assetId}.json`)),
      ).rejects.toThrow();
    }
  });

  it("keeps Redis as metadata-only and reports shared bytes as unavailable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    expect(store.getTemporaryStoryAssetCapabilities()).toMatchObject({
      bytesBackend: "local-file",
      metadataBackend: "local-file+redis",
      redisMetadataConfigured: true,
      shared: false,
      configurationReady: false,
      productionVerified: false,
      productionReady: false,
    });
    await expect(
      store.putTemporaryStoryAsset(
        {
          source: dataUri("image/png", makePngBytes()),
          storyId: "story-redis",
          page: 1,
          principal,
        },
        { requireDurable: true },
      ),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_NOT_DURABLE" });

    const result = await store.putTemporaryStoryAsset({
      source: dataUri("image/png", makePngBytes()),
      storyId: "story-redis",
      page: 1,
      principal,
    });
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;
    const metadata = redisState.values.get(
      `storybloom:temporary-story-asset:v1:${result.assetId}`,
    );
    expect(metadata).toBeDefined();
    expect(JSON.stringify(metadata?.value)).not.toContain("data:image");
    expect(JSON.stringify(metadata?.value)).not.toContain(
      makePngBytes().toString("base64"),
    );
    expect(metadata?.options?.ex).toBeGreaterThan(0);
  });

  it("stores shared bytes in a private Supabase bucket while Redis holds metadata only", async () => {
    process.env.STORYBLOOM_TEMP_ASSET_BACKEND = "supabase";
    process.env.STORYBLOOM_TEMP_ASSET_BUCKET = "story-generation-assets";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");

    expect(store.getTemporaryStoryAssetCapabilities()).toEqual({
      bytesBackend: "supabase-private",
      metadataBackend: "redis",
      localFile: false,
      redisMetadataConfigured: true,
      shared: true,
      configurationReady: true,
      productionVerified: false,
      productionReady: true,
      reason: null,
    });
    const result = await store.putTemporaryStoryAsset(
      {
        source: dataUri("image/png", makePngBytes()),
        storyId: "story-shared",
        page: 1,
        attemptId: "attempt-shared",
        principal,
        ttlSeconds: 2,
        now: 10_000,
      },
      { requireDurable: true },
    );
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;

    expect(await readdir(assetDir)).toEqual([]);
    const bucket = supabaseState.buckets.get("story-generation-assets");
    expect(bucket?.get(`v1/${result.assetId}.png`)?.bytes).toEqual(
      makePngBytes(),
    );
    const mirrored = redisState.values.get(
      `storybloom:temporary-story-asset:v1:${result.assetId}`,
    );
    expect(mirrored?.value).toMatchObject({
      assetId: result.assetId,
      storyId: "story-shared",
      grantedPrincipalHashes: [],
    });
    expect(JSON.stringify(mirrored?.value)).not.toContain(
      makePngBytes().toString("base64"),
    );
    expect(mirrored?.options?.ex).toBe(3_602);

    await expect(
      store.commitTemporaryStoryAsset({
        assetId: result.assetId,
        lease: result.lease,
        principal,
        now: 10_001,
      }),
    ).resolves.toBe(true);
    await expect(
      store.readTemporaryStoryAsset({
        assetId: result.assetId,
        principal,
        now: 10_002,
      }),
    ).resolves.toMatchObject({ bytes: makePngBytes(), state: "committed" });
  });

  it("rolls back a shared object when authoritative Redis metadata cannot be written", async () => {
    process.env.STORYBLOOM_TEMP_ASSET_BACKEND = "supabase";
    process.env.STORYBLOOM_TEMP_ASSET_BUCKET = "story-generation-assets";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    redisState.evalFailure = true;
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");

    await expect(
      store.putTemporaryStoryAsset(
        {
          source: dataUri("image/png", makePngBytes()),
          storyId: "story-shared-redis-failure",
          page: 1,
          principal,
        },
        { requireDurable: true },
      ),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_UNAVAILABLE" });
    expect(
      supabaseState.buckets.get("story-generation-assets")?.size || 0,
    ).toBe(0);
  });

  it("does not delete a healthy shared object after a transient download failure", async () => {
    process.env.STORYBLOOM_TEMP_ASSET_BACKEND = "supabase";
    process.env.STORYBLOOM_TEMP_ASSET_BUCKET = "story-generation-assets";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    const result = await store.putTemporaryStoryAsset(
      {
        source: dataUri("image/png", makePngBytes()),
        storyId: "story-shared-download-retry",
        page: 1,
        principal,
      },
      { requireDurable: true },
    );
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;
    await store.commitTemporaryStoryAsset({
      assetId: result.assetId,
      lease: result.lease,
      principal,
    });

    supabaseState.downloadFailure = true;
    await expect(
      store.readTemporaryStoryAsset({ assetId: result.assetId, principal }),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_UNAVAILABLE" });
    expect(
      supabaseState.buckets
        .get("story-generation-assets")
        ?.has(`v1/${result.assetId}.png`),
    ).toBe(true);

    supabaseState.downloadFailure = false;
    await expect(
      store.readTemporaryStoryAsset({ assetId: result.assetId, principal }),
    ).resolves.toMatchObject({ state: "committed", bytes: makePngBytes() });
  });

  it("grants a second principal by hash without exposing either principal id", async () => {
    const store = await import("@/lib/temporary-story-asset-store");
    const userPrincipal = { type: "user" as const, id: "user-opaque-1" };
    const result = await store.putTemporaryStoryAsset({
      source: dataUri("image/png", makePngBytes()),
      storyId: "story-grant",
      page: 1,
      principal,
      now: 30_000,
    });
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;

    await expect(
      store.grantTemporaryStoryAssetPrincipal({
        assetId: result.assetId,
        lease: "x".repeat(32),
        ownerPrincipal: principal,
        grantedPrincipal: userPrincipal,
        now: 30_001,
      }),
    ).resolves.toBe(false);
    await expect(
      store.grantTemporaryStoryAssetPrincipal({
        assetId: result.assetId,
        lease: result.lease,
        ownerPrincipal: principal,
        grantedPrincipal: userPrincipal,
        now: 30_001,
      }),
    ).resolves.toBe(true);
    await store.commitTemporaryStoryAsset({
      assetId: result.assetId,
      lease: result.lease,
      principal,
      now: 30_002,
    });
    await expect(
      store.readTemporaryStoryAsset({
        assetId: result.assetId,
        principal: userPrincipal,
        now: 30_003,
      }),
    ).resolves.toMatchObject({ state: "committed" });
    const metadataText = await readFile(
      path.join(assetDir, `${result.assetId}.json`),
      "utf8",
    );
    expect(metadataText).not.toContain(principal.id);
    expect(metadataText).not.toContain(userPrincipal.id);
    expect(JSON.parse(metadataText).grantedPrincipalHashes).toHaveLength(1);
    await expect(
      store.touchTemporaryStoryAssets({
        storyId: "story-grant",
        principal: userPrincipal,
        ttlSeconds: 100_000,
        now: 30_004,
      }),
    ).resolves.toBe(0);
    await expect(
      store.deleteTemporaryStoryAsset({
        assetId: result.assetId,
        principal: userPrincipal,
      }),
    ).resolves.toBe(false);
    await expect(
      store.grantTemporaryStoryAssetPrincipal({
        assetId: result.assetId,
        lease: result.lease,
        ownerPrincipal: principal,
        grantedPrincipal: { type: "user", id: "late-grant" },
        now: 30_005,
      }),
    ).resolves.toBe(false);
    await expect(
      store.deleteTemporaryStoryAsset({
        assetId: result.assetId,
        principal,
      }),
    ).resolves.toBe(true);
  });

  it("keeps shared metadata through cleanup grace before deleting expired bytes", async () => {
    process.env.STORYBLOOM_TEMP_ASSET_BACKEND = "supabase";
    process.env.STORYBLOOM_TEMP_ASSET_BUCKET = "story-generation-assets";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    process.env.STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS = "60";
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    const result = await store.putTemporaryStoryAsset({
      source: dataUri("image/png", makePngBytes()),
      storyId: "story-cleanup-grace",
      page: 1,
      principal,
      ttlSeconds: 1,
      now: 40_000,
    });
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;

    await expect(store.sweepExpiredTemporaryStoryAssets(41_001)).resolves.toEqual({
      deletedExpiredAssets: 0,
      deletedOrphans: 0,
      deletedTemporaryFiles: 0,
      retainedForCleanupGrace: 1,
      cleanupFailures: 0,
    });
    expect(
      supabaseState.buckets
        .get("story-generation-assets")
        ?.has(`v1/${result.assetId}.png`),
    ).toBe(true);
    expect(
      redisState.values.has(
        `storybloom:temporary-story-asset:v1:${result.assetId}`,
      ),
    ).toBe(true);

    await expect(store.sweepExpiredTemporaryStoryAssets(101_001)).resolves.toEqual({
      deletedExpiredAssets: 1,
      deletedOrphans: 0,
      deletedTemporaryFiles: 0,
      retainedForCleanupGrace: 0,
      cleanupFailures: 0,
    });
    expect(
      supabaseState.buckets
        .get("story-generation-assets")
        ?.has(`v1/${result.assetId}.png`),
    ).toBe(false);
    expect(
      redisState.values.has(
        `storybloom:temporary-story-asset:v1:${result.assetId}`,
      ),
    ).toBe(false);
  });

  it("rejects a stale shared metadata CAS without overwriting the newer revision", async () => {
    configureSharedBackend();
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    const result = await store.putTemporaryStoryAsset(
      {
        source: dataUri("image/png", makePngBytes()),
        storyId: "story-stale-cas",
        page: 1,
        principal,
        now: 200_000,
      },
      { requireDurable: true },
    );
    expect(result.kind).toBe("stored");
    if (result.kind !== "stored") return;

    const key = `storybloom:temporary-story-asset:v1:${result.assetId}`;
    redisState.advanceRevisionBeforeNextMetadataCas = true;
    await expect(
      store.commitTemporaryStoryAsset({
        assetId: result.assetId,
        lease: result.lease,
        principal,
        now: 200_001,
      }),
    ).resolves.toBe(false);
    expect(redisState.values.get(key)?.value).toMatchObject({
      revision: 3,
      state: "pending",
    });
  });

  it("keeps an uploading cleanup intent discoverable when upload fails", async () => {
    configureSharedBackend();
    supabaseState.uploadFailure = true;
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");

    await expect(
      store.putTemporaryStoryAsset(
        {
          source: dataUri("image/png", makePngBytes()),
          storyId: "story-upload-intent",
          page: 1,
          principal,
          now: 300_000,
        },
        { requireDurable: true },
      ),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_UNAVAILABLE" });

    const cleanup = sortedSet(
      "storybloom:temporary-story-assets:v1:cleanup",
    );
    expect(cleanup.size).toBe(1);
    const [assetId] = [...cleanup.keys()];
    expect(
      redisState.values.get(
        `storybloom:temporary-story-asset:v1:${assetId}`,
      )?.value,
    ).toMatchObject({ state: "uploading", revision: 1 });
  });

  it("keeps the upload intent when pending metadata CAS and rollback removal fail", async () => {
    configureSharedBackend();
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    redisState.advanceRevisionBeforeNextMetadataCas = true;
    supabaseState.failNextRemove = true;

    await expect(
      store.putTemporaryStoryAsset(
        {
          source: dataUri("image/png", makePngBytes()),
          storyId: "story-upload-rollback",
          page: 1,
          principal,
          now: 350_000,
        },
        { requireDurable: true },
      ),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_UNAVAILABLE" });

    const cleanup = sortedSet(
      "storybloom:temporary-story-assets:v1:cleanup",
    );
    expect(cleanup.size).toBe(1);
    const [assetId] = [...cleanup.keys()];
    expect(
      redisState.values.get(
        `storybloom:temporary-story-asset:v1:${assetId}`,
      )?.value,
    ).toMatchObject({ state: "uploading", revision: 2 });
    expect(
      supabaseState.buckets
        .get("story-generation-assets")
        ?.has(`v1/${assetId}.png`),
    ).toBe(true);
  });

  it("deletes all candidate extensions when cleanup metadata has expired", async () => {
    configureSharedBackend();
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    const assetId = "a".repeat(32);
    const bucket = new Map([
      [`v1/${assetId}.jpg`, { bytes: makeJpegBytes(), contentType: "image/jpeg" }],
      [`v1/${assetId}.png`, { bytes: makePngBytes(), contentType: "image/png" }],
      [`v1/${assetId}.webp`, { bytes: makeWebpBytes(), contentType: "image/webp" }],
    ]);
    supabaseState.buckets.set("story-generation-assets", bucket);
    sortedSet("storybloom:temporary-story-assets:v1:cleanup").set(
      assetId,
      400_000,
    );

    await expect(store.sweepExpiredTemporaryStoryAssets(400_001)).resolves.toEqual({
      deletedExpiredAssets: 0,
      deletedOrphans: 1,
      deletedTemporaryFiles: 0,
      retainedForCleanupGrace: 0,
      cleanupFailures: 0,
    });
    expect(bucket.size).toBe(0);
  });

  it("deletes all candidate extensions for a due expiry member with missing metadata", async () => {
    configureSharedBackend();
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    const assetId = "c".repeat(32);
    const bucket = new Map([
      [`v1/${assetId}.jpg`, { bytes: makeJpegBytes(), contentType: "image/jpeg" }],
      [`v1/${assetId}.png`, { bytes: makePngBytes(), contentType: "image/png" }],
      [`v1/${assetId}.webp`, { bytes: makeWebpBytes(), contentType: "image/webp" }],
    ]);
    supabaseState.buckets.set("story-generation-assets", bucket);
    sortedSet("storybloom:temporary-story-assets:v1:expiry").set(
      assetId,
      450_000,
    );

    await expect(store.sweepExpiredTemporaryStoryAssets(450_001)).resolves.toEqual({
      deletedExpiredAssets: 0,
      deletedOrphans: 1,
      deletedTemporaryFiles: 0,
      retainedForCleanupGrace: 0,
      cleanupFailures: 0,
    });
    expect(bucket.size).toBe(0);
    expect(
      sortedSet("storybloom:temporary-story-assets:v1:expiry").has(assetId),
    ).toBe(false);
  });

  it("retains cleanup work and counts a failed shared object removal", async () => {
    configureSharedBackend();
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    const assetId = "b".repeat(32);
    sortedSet("storybloom:temporary-story-assets:v1:cleanup").set(
      assetId,
      500_000,
    );
    supabaseState.removeFailure = true;

    await expect(store.sweepExpiredTemporaryStoryAssets(500_001)).resolves.toEqual({
      deletedExpiredAssets: 0,
      deletedOrphans: 0,
      deletedTemporaryFiles: 0,
      retainedForCleanupGrace: 0,
      cleanupFailures: 1,
    });
    expect(
      sortedSet("storybloom:temporary-story-assets:v1:cleanup").has(assetId),
    ).toBe(true);
  });

  it("rejects real asset ingestion automatically in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");

    await expect(
      store.putTemporaryStoryAsset({
        source: dataUri("image/png", makePngBytes()),
        storyId: "story-production",
        page: 1,
        principal,
      }),
    ).rejects.toMatchObject({ code: "TEMP_ASSET_STORAGE_NOT_DURABLE" });
    await expect(readdir(assetDir)).resolves.toEqual([]);
  });

  it("accepts production ingestion only with both shared bytes and Redis metadata", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.STORYBLOOM_TEMP_ASSET_BACKEND = "supabase";
    process.env.STORYBLOOM_TEMP_ASSET_BUCKET = "story-generation-assets";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    vi.resetModules();
    const store = await import("@/lib/temporary-story-asset-store");
    await expect(
      store.putTemporaryStoryAsset({
        source: dataUri("image/png", makePngBytes()),
        storyId: "story-production-shared",
        page: 1,
        principal,
      }),
    ).resolves.toMatchObject({ kind: "stored" });
  });
});
