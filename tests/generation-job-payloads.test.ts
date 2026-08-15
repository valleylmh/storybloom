import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextGenerationJobPayload } from "@/lib/generation-job-payloads";

const redisState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  expiries: new Map<string, number>(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    constructor(_options: unknown) {}

    async set(key: string, value: unknown, options?: { ex?: number }) {
      redisState.values.set(key, structuredClone(value));
      if (options?.ex) redisState.expiries.set(key, options.ex);
      return "OK";
    }

    async get<T>(key: string) {
      const value = redisState.values.get(key);
      return value === undefined ? null : (structuredClone(value) as T);
    }

    async del(key: string) {
      const deleted = redisState.values.delete(key);
      redisState.expiries.delete(key);
      return deleted ? 1 : 0;
    }
  },
}));

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  kvUrl: process.env.KV_REST_API_URL,
  kvToken: process.env.KV_REST_API_TOKEN,
};

const payload: TextGenerationJobPayload = {
  version: 1,
  kind: "text",
  storyInput: {
    childName: "童童",
    ageGroup: "4-5",
    theme: "custom",
    customTheme: "整理玩具",
    style: "watercolor",
    language: "zh-en",
  },
  familyCharacters: [],
  dailyLimit: 3,
  reviewBeforeIllustrations: true,
  quotaReservationId: "quota_123456789012",
  generationPrincipalIds: [`v1_${"a".repeat(64)}`],
};

function restore(name: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  redisState.values.clear();
  redisState.expiries.clear();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  vi.stubEnv("NODE_ENV", "test");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  restore("NODE_ENV", originalEnvironment.nodeEnv);
  restore("UPSTASH_REDIS_REST_URL", originalEnvironment.upstashUrl);
  restore("UPSTASH_REDIS_REST_TOKEN", originalEnvironment.upstashToken);
  restore("KV_REST_API_URL", originalEnvironment.kvUrl);
  restore("KV_REST_API_TOKEN", originalEnvironment.kvToken);
});

describe("generation job payload references", () => {
  it("stores and clones a short-lived server-side payload without exposing it in the ref", async () => {
    const store = await import("@/lib/generation-job-payloads");
    const ref = await store.putGenerationJobPayload(payload);
    expect(ref).toMatch(/^payload_[A-Za-z0-9_-]{32}$/);
    expect(ref).not.toContain("童童");
    const loaded = await store.getGenerationJobPayload(ref);
    expect(loaded).toEqual(payload);
    if (store.isTextGenerationJobPayload(loaded)) {
      loaded.storyInput.childName = "改动不应回写";
    }
    await expect(store.getGenerationJobPayload(ref)).resolves.toEqual(payload);
    expect(redisState.expiries.size).toBe(0);
  });

  it("uses shared Redis in production and sets a bounded TTL", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const store = await import("@/lib/generation-job-payloads");
    const ref = await store.putGenerationJobPayload(payload);
    expect(store.getGenerationJobPayloadCapabilities()).toMatchObject({
      shared: true,
      productionReady: true,
      adapter: "redis",
    });
    expect(redisState.expiries.get(`storybloom:generation-job-payload:v1:${ref}`)).toBe(86400);
  });

  it("rejects embedded image/audio data and production without shared storage", async () => {
    const store = await import("@/lib/generation-job-payloads");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: {
          ...payload.storyInput,
          characterReferencePrompt: "data:image/png;base64,private",
        },
      }),
    ).rejects.toThrow("embedded private data");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: {
          ...payload.storyInput,
          characterReferencePrompt: "data:application/pdf;base64,private",
        },
      }),
    ).rejects.toThrow("embedded private data");

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const productionStore = await import("@/lib/generation-job-payloads");
    await expect(productionStore.putGenerationJobPayload(payload)).rejects.toMatchObject({
      code: "STORAGE_NOT_DURABLE",
    });
  });

  it("normalizes legacy payloads while every newly stored payload has an explicit kind and version", async () => {
    const store = await import("@/lib/generation-job-payloads");
    const { version: _version, kind: _kind, ...legacyPayload } = payload;
    const ref = await store.putGenerationJobPayload(legacyPayload);

    await expect(store.getGenerationJobPayload(ref)).resolves.toEqual(payload);
    await expect(
      store.putGenerationJobPayload({
        ...legacyPayload,
        version: 1,
      } as unknown as TextGenerationJobPayload),
    ).rejects.toThrow("kind");
  });

  it("validates the complete text payload instead of trusting TypeScript casts", async () => {
    const store = await import("@/lib/generation-job-payloads");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: { ...payload.storyInput, ageGroup: "9-12" },
      } as unknown as TextGenerationJobPayload),
    ).rejects.toThrow("ageGroup");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        dailyLimit: Number.NaN,
      }),
    ).rejects.toThrow("non-finite number");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        reviewBeforeIllustrations: "yes",
      } as unknown as TextGenerationJobPayload),
    ).rejects.toThrow("reviewBeforeIllustrations");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: { ...payload.storyInput, unexpected: true },
      } as unknown as TextGenerationJobPayload),
    ).rejects.toThrow("storyInput fields");
  });

  it("preserves validated library source and confirmed Anchor metadata", async () => {
    const store = await import("@/lib/generation-job-payloads");
    const personalizedPayload: TextGenerationJobPayload = {
      ...payload,
      storyInput: {
        ...payload.storyInput,
        sourceLibraryBookId: "xiyouji/shi-hou-chu-shi",
        personalizationDraftId: "123e4567-e89b-42d3-a456-426614174000",
        personalizationAnchor: {
          version: 1,
          displayName: "童童",
          relationship: "孩子",
          appearance: "齐耳短发、圆框眼镜、黄色外套",
          referenceType: "text",
          storyReferenceToken:
            "abcdefghijklmnopqrstuvwxyzABCDEF1234567890_-storyanchor",
          confirmedAt: "2026-08-16T05:00:00.000Z",
        },
      },
    };
    const ref = await store.putGenerationJobPayload(personalizedPayload);
    await expect(store.getGenerationJobPayload(ref)).resolves.toEqual(
      personalizedPayload,
    );
    await expect(
      store.putGenerationJobPayload({
        ...personalizedPayload,
        storyInput: {
          ...personalizedPayload.storyInput,
          personalizationAnchor: {
            ...personalizedPayload.storyInput.personalizationAnchor!,
            referenceType: "voice" as never,
          },
        },
      }),
    ).rejects.toThrow("referenceType");
  });

  it("rejects malformed family characters, executable values, credentials and excessive depth", async () => {
    const store = await import("@/lib/generation-job-payloads");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        familyCharacters: [
          {
            id: "child-1",
            name: "童童",
            relation: "孩子",
            appearance: "短发",
            sourceReferenceAssetPath: "https://example.invalid/private.jpg",
          },
        ],
      }),
    ).rejects.toThrow("sourceReferenceAssetPath");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: { ...payload.storyInput, apiKey: "sk-live-secret-value-1234567890" },
      } as unknown as TextGenerationJobPayload),
    ).rejects.toThrow("credentials");
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: { ...payload.storyInput, childName: (() => "童童") as never },
      }),
    ).rejects.toThrow("non-JSON value");

    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 20; index += 1) nested = { nested };
    await expect(
      store.putGenerationJobPayload({
        ...payload,
        storyInput: { ...payload.storyInput, visualBible: nested as never },
      }),
    ).rejects.toThrow("maximum depth exceeded");
  });

  it("revalidates Redis values and rejects a damaged payload before returning it", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    vi.resetModules();
    const store = await import("@/lib/generation-job-payloads");
    const ref = await store.putGenerationJobPayload(payload);
    redisState.values.set(`storybloom:generation-job-payload:v1:${ref}`, {
      ...payload,
      quotaReservationId: "wrong",
    });

    await expect(store.getGenerationJobPayload(ref)).rejects.toThrow(
      "quotaReservationId",
    );
    expect(
      store.isTextGenerationJobPayload({
        ...payload,
        reviewBeforeIllustrations: "yes",
      }),
    ).toBe(false);
  });

  it("deletes payloads idempotently", async () => {
    const store = await import("@/lib/generation-job-payloads");
    const ref = await store.putGenerationJobPayload(payload);
    await expect(store.deleteGenerationJobPayload(ref)).resolves.toBe(true);
    await expect(store.deleteGenerationJobPayload(ref)).resolves.toBe(false);
    await expect(store.getGenerationJobPayload(ref)).resolves.toBeNull();
  });

  it("stores only opaque principals and a fixed fallback mode for illustration jobs", async () => {
    const store = await import("@/lib/generation-job-payloads");
    const illustrationPayload = {
      version: 1 as const,
      kind: "illustration" as const,
      assetPrincipals: {
        ownerPrincipal: {
          type: "anonymous" as const,
          id: `v1_${"b".repeat(64)}`,
        },
        grantedPrincipal: {
          type: "user" as const,
          id: `v1_${"c".repeat(64)}`,
        },
      },
      fallbackMode: "free-fallback" as const,
    };
    const ref = await store.putGenerationJobPayload(illustrationPayload);

    await expect(store.getGenerationJobPayload(ref)).resolves.toEqual(
      illustrationPayload,
    );
    await expect(
      store.putGenerationJobPayload({
        ...illustrationPayload,
        assetPrincipals: {
          ownerPrincipal: {
            type: "anonymous" as const,
            id: "raw-session-token",
          },
        },
      }),
    ).rejects.toThrow("illustration fields");
  });
});
