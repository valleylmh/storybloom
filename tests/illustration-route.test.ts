import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { GeneratedStory, StoryPage } from "@/types";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  allowIpRequest: vi.fn(),
  cacheStory: vi.fn(),
  getCachedStory: vi.fn(),
  mutateCachedStory: vi.fn(),
  getProviderForPage: vi.fn(() => "pollinations"),
  getImageToImageProviderForPage: vi.fn(() => "pollinations"),
  regeneratePage: vi.fn(),
  executeIllustrationGeneration: vi.fn(),
  getIllustrationAssetMode: vi.fn<() =>
    | { enabled: false; reason: "flag_disabled" | "storage_not_ready" }
    | { enabled: true; reason: null }
  >(() => ({
    enabled: false,
    reason: "flag_disabled",
  })),
  resolveStoryAssetRequestPrincipal: vi.fn(),
  attachStoryAssetSessionCookie: vi.fn((response) => response),
  putPayload: vi.fn(),
  deletePayload: vi.fn(),
  enqueueJob: vi.fn(),
  getJob: vi.fn(),
  getJobByIdempotencyKey: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

vi.mock("@/lib/request-rate-limit", () => ({
  allowIpRequest: mocks.allowIpRequest,
}));

vi.mock("@/lib/storage", () => ({
  cacheStory: mocks.cacheStory,
  getCachedStory: mocks.getCachedStory,
  mutateCachedStory: mocks.mutateCachedStory,
}));

vi.mock("@/lib/image-generator", () => ({
  getProviderForPage: mocks.getProviderForPage,
  getImageToImageProviderForPage: mocks.getImageToImageProviderForPage,
  regeneratePage: mocks.regeneratePage,
}));

vi.mock("@/lib/illustration-generation-executor", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/illustration-generation-executor")
  >();
  return {
    ...original,
    getIllustrationAssetMode: mocks.getIllustrationAssetMode,
    executeIllustrationGeneration: async (
      input: Parameters<typeof original.executeIllustrationGeneration>[0],
    ) => {
      mocks.executeIllustrationGeneration(input);
      return original.executeIllustrationGeneration(input);
    },
  };
});

vi.mock("@/lib/story-asset-principal", () => ({
  resolveStoryAssetRequestPrincipal: mocks.resolveStoryAssetRequestPrincipal,
  attachStoryAssetSessionCookie: mocks.attachStoryAssetSessionCookie,
}));
vi.mock("@/lib/generation-job-payloads", () => ({
  putGenerationJobPayload: mocks.putPayload,
  deleteGenerationJobPayload: mocks.deletePayload,
}));
vi.mock("@/lib/generation-jobs", () => ({
  enqueueGenerationJob: mocks.enqueueJob,
  getGenerationJob: mocks.getJob,
  getGenerationJobByIdempotencyKey: mocks.getJobByIdempotencyKey,
}));

import { GET, POST } from "@/app/api/illustration/route";

function createStory(page: StoryPage): GeneratedStory {
  return {
    id: "story-12345678",
    input: {
      childName: "童童",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "整理玩具",
      style: "fairytale",
      language: "zh-en",
    },
    coverTitle: "童童的整理冒险",
    pages: [page],
    createdAt: "2026-08-08T03:00:00.000Z",
    status: "generating_images",
    generationMode: "live",
  };
}

function createPage(overrides: Partial<StoryPage> = {}): StoryPage {
  return {
    page: 1,
    zhText: "童童开始整理玩具。",
    enText: "Tongtong started tidying toys.",
    illustrationPrompt: "A child tidying toys",
    imageStatus: "demo",
    ...overrides,
  };
}

function createRequest(regenerationMode?: "free-fallback") {
  return new NextRequest("http://localhost/api/illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storyId: "story-12345678",
      page: 1,
      ...(regenerationMode ? { regenerationMode } : {}),
    }),
  });
}

function createPageRequest(page: number) {
  return new NextRequest("http://localhost/api/illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId: "story-12345678", page }),
  });
}

function createMultiPageStory(pages: StoryPage[]): GeneratedStory {
  return {
    ...createStory(pages[0]),
    pages,
  };
}

function installAtomicStoryStore(initialStory: GeneratedStory) {
  let latestStory = initialStory;
  let mutationQueue = Promise.resolve();

  mocks.getCachedStory.mockImplementation(async () => latestStory);
  mocks.cacheStory.mockImplementation(async (_storyId, story) => {
    latestStory = story;
  });
  mocks.mutateCachedStory.mockImplementation(async (_storyId, mutator) => {
    const run = mutationQueue.then(async () => {
      const current = latestStory;
      const decision = await mutator(current);
      if (!decision) return null;
      if (!decision.nextStory) {
        return { story: current, value: decision.value, updated: false };
      }
      latestStory = {
        ...decision.nextStory,
        revision: (current.revision || 0) + 1,
      };
      return { story: latestStory, value: decision.value, updated: true };
    });
    mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  });

  return {
    get latestStory() {
      return latestStory;
    },
    setLatestStory(story: GeneratedStory) {
      latestStory = story;
    },
  };
}

describe("illustration route request control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ILLUSTRATION_RATE_LIMIT_PER_STORY", "");
    mocks.allowIpRequest.mockResolvedValue(true);
    mocks.getIllustrationAssetMode.mockReturnValue({
      enabled: false,
      reason: "flag_disabled",
    });
    mocks.cacheStory.mockResolvedValue(undefined);
    mocks.putPayload.mockResolvedValue(`payload_${"p".repeat(32)}`);
    mocks.deletePayload.mockResolvedValue(true);
    mocks.enqueueJob.mockResolvedValue({
      created: true,
      job: { jobId: "job_illustration_1234" },
    });
    mocks.getJob.mockResolvedValue(null);
    mocks.getJobByIdempotencyKey.mockResolvedValue(null);
    mocks.mutateCachedStory.mockImplementation(async (_storyId, mutator) => {
      const current = await mocks.getCachedStory();
      if (!current) return null;
      const decision = await mutator(current);
      if (!decision) return null;
      if (!decision.nextStory) {
        return { story: current, value: decision.value, updated: false };
      }
      const nextStory = {
        ...decision.nextStory,
        revision: (current.revision || 0) + 1,
      };
      await mocks.cacheStory(nextStory.id, nextStory);
      return { story: nextStory, value: decision.value, updated: true };
    });
    mocks.after.mockImplementation((callback: () => unknown) => callback());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reuses a recent pending job without spending rate-limit capacity", async () => {
    mocks.getCachedStory.mockResolvedValue(
      createStory(
        createPage({
          imageStatus: "pending",
          imageStartedAt: new Date(Date.now() - 30_000).toISOString(),
        }),
      ),
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: "accepted", reused: true });
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("reuses a durable running job even when the page is older than three minutes", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      imageAttemptId: "attempt_running_1234",
      imageDurableJob: true,
      imageJobId: "job_running_1234",
    });
    mocks.getCachedStory.mockResolvedValue(createStory(page));
    mocks.getJob.mockResolvedValue({
      kind: "illustration",
      jobId: "job_running_1234",
      storyId: "story-12345678",
      page: 1,
      generationAttemptId: "attempt_running_1234",
      status: "running",
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      status: "accepted",
      reused: true,
      page: { imageJobId: "job_running_1234", imageStatus: "pending" },
    });
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("returns 202 from GET while a durable queued job is active", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      imageAttemptId: "attempt_queued_1234",
      imageDurableJob: true,
      imageJobId: "job_queued_1234",
    });
    mocks.getCachedStory.mockResolvedValue(createStory(page));
    mocks.getJob.mockResolvedValue({
      kind: "illustration",
      jobId: "job_queued_1234",
      storyId: "story-12345678",
      page: 1,
      generationAttemptId: "attempt_queued_1234",
      status: "queued",
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/illustration?storyId=story-12345678&page=1",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: "accepted", reused: true, page });
  });

  it("keeps a missing durable job conservative inside the recovery window", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      imageAttemptId: "attempt_missing_recent",
      imageDurableJob: true,
      imageJobId: "job_missing_recent",
    });
    mocks.getCachedStory.mockResolvedValue(createStory(page));

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: "accepted", reused: true });
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("marks a missing durable job retryable only after the recovery window", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    const store = installAtomicStoryStore(
      createStory(
        createPage({
          imageStatus: "pending",
          imageStartedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
          imageAttemptId: "attempt_missing_stale",
          imageDurableJob: true,
          imageJobId: "job_missing_stale",
        }),
      ),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.allowIpRequest).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueJob).toHaveBeenCalledTimes(1);
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "pending",
      imageAttemptId: expect.not.stringMatching("attempt_missing_stale"),
      imageDurableJob: true,
      imageJobId: "job_illustration_1234",
    });
  });

  it("turns a dead durable job into an explicit retry", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    const store = installAtomicStoryStore(
      createStory(
        createPage({
          imageStatus: "pending",
          imageStartedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
          imageAttemptId: "attempt_dead_1234",
          imageDurableJob: true,
          imageJobId: "job_dead_1234",
        }),
      ),
    );
    mocks.getJob.mockResolvedValue({
      kind: "illustration",
      jobId: "job_dead_1234",
      storyId: "story-12345678",
      page: 1,
      generationAttemptId: "attempt_dead_1234",
      status: "dead",
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.allowIpRequest).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueJob).toHaveBeenCalledTimes(1);
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "pending",
      imageDurableJob: true,
      imageJobId: "job_illustration_1234",
    });
    expect(store.latestStory.pages[0].imageAttemptId).not.toBe(
      "attempt_dead_1234",
    );
  });

  it("does not race a recent dead job cleanup with a replacement attempt", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      imageAttemptId: "attempt_dead_recent",
      imageDurableJob: true,
      imageJobId: "job_dead_recent",
    });
    mocks.getCachedStory.mockResolvedValue(createStory(page));
    mocks.getJob.mockResolvedValue({
      kind: "illustration",
      jobId: "job_dead_recent",
      storyId: "story-12345678",
      page: 1,
      generationAttemptId: "attempt_dead_recent",
      status: "dead",
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: "accepted", reused: true });
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
  });

  it("fails closed before changing state when production assets are not ready", async () => {
    mocks.getIllustrationAssetMode.mockReturnValue({
      enabled: false,
      reason: "storage_not_ready",
    });
    mocks.getCachedStory.mockResolvedValue(createStory(createPage()));

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.getCachedStory).not.toHaveBeenCalled();
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("creates and attaches the anonymous asset session before starting a page", async () => {
    const resolved = {
      principal: { type: "user", id: `v1_${"b".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      userPrincipal: { type: "user", id: `v1_${"b".repeat(64)}` },
      createdAnonymousSession: true,
      anonymousSessionToken: "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    mocks.getCachedStory.mockResolvedValue(createStory(createPage()));

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.resolveStoryAssetRequestPrincipal).toHaveBeenCalledWith(
      expect.any(NextRequest),
    );
    expect(mocks.attachStoryAssetSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      resolved,
    );
    await vi.waitFor(() => {
      expect(mocks.executeIllustrationGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          assetPrincipals: {
            ownerPrincipal: resolved.anonymousPrincipal,
            grantedPrincipal: resolved.userPrincipal,
          },
        }),
      );
    });
  });

  it("attaches the same anonymous asset session during GET polling", async () => {
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: true,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    mocks.getCachedStory.mockResolvedValue(
      createStory(
        createPage({
          imageStatus: "pending",
          imageStartedAt: new Date().toISOString(),
        }),
      ),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/illustration?storyId=story-12345678&page=1",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.attachStoryAssetSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      resolved,
    );
  });

  it("persists the authorization session for an owned story when asset mode is disabled", async () => {
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: true,
      anonymousSessionToken: "A".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({
      enabled: false,
      reason: "flag_disabled",
    });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    mocks.getCachedStory.mockResolvedValue({
      ...createStory(
        createPage({
          imageStatus: "pending",
          imageStartedAt: new Date().toISOString(),
        }),
      ),
      generationPrincipalIds: [resolved.anonymousPrincipal.id],
    });

    const getResponse = await GET(
      new NextRequest(
        "http://localhost/api/illustration?storyId=story-12345678&page=1",
      ),
    );
    const postResponse = await POST(createRequest());

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(202);
    expect(mocks.attachStoryAssetSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      resolved,
    );
    expect(mocks.attachStoryAssetSessionCookie).toHaveBeenCalledTimes(2);
  });

  it("returns 404 for an unowned protected story while preserving the new session cookie", async () => {
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: true,
      anonymousSessionToken: "A".repeat(32),
    } as const;
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    mocks.getCachedStory.mockResolvedValue({
      ...createStory(createPage()),
      generationPrincipalIds: [`v1_${"b".repeat(64)}`],
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/illustration?storyId=story-12345678&page=1",
      ),
    );

    expect(response.status).toBe(404);
    expect(mocks.attachStoryAssetSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      resolved,
    );
  });

  it("restores a pending page through GET polling without submitting a job", async () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(Date.now() - 30_000).toISOString(),
    });
    mocks.getCachedStory.mockResolvedValue(createStory(page));

    const response = await GET(
      new NextRequest("http://localhost/api/illustration?storyId=story-12345678&page=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ page, allComplete: false });
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.cacheStory).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("normalizes a legacy cached provider error before returning a page", async () => {
    const page = createPage({
      imageStatus: "failed",
      imageError:
        "Bearer known-auth-secret provider prompt for 童童 https://example.test?token=private",
      imageAttempts: [
        {
          provider: "cpa",
          status: "failed",
          requestAttempt: 2,
          retry: true,
          qualityStatus: "warning",
          durationMs: 100,
          startedAt: "2026-08-13T02:00:00.000Z",
          completedAt: "2026-08-13T02:00:00.100Z",
          error: "private upstream response",
        },
      ],
    });
    mocks.getCachedStory.mockResolvedValue(createStory(page));

    const response = await GET(
      new NextRequest(
        "http://localhost/api/illustration?storyId=story-12345678&page=1",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page).toMatchObject({
      imageStatus: "failed",
      imageError: "插图生成失败，请稍后重试。",
      imageAttempts: [
        expect.objectContaining({
          requestAttempt: 2,
          retry: true,
          qualityStatus: "warning",
          error: "插图生成失败，请稍后重试。",
          errorClass: "unknown",
        }),
      ],
    });
    expect(JSON.stringify(body)).not.toContain("known-auth-secret");
    expect(JSON.stringify(body)).not.toContain("example.test");
    expect(JSON.stringify(body)).not.toContain("private upstream response");
  });

  it("does not start illustrations before the outline is confirmed", async () => {
    mocks.getCachedStory.mockResolvedValue({
      ...createStory(createPage()),
      status: "reviewing_outline",
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("确认故事大纲");
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.cacheStory).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("uses a larger quota scoped to the current story for new jobs", async () => {
    mocks.getCachedStory.mockResolvedValue(createStory(createPage()));

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.page).toMatchObject({
      imageRequestCount: 1,
      imageRetryCount: 0,
    });
    expect(body.page.imageQuality).toBeUndefined();
    expect(mocks.allowIpRequest).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({
        limit: 64,
        prefix: "illustration",
        identifier: "story-12345678",
      }),
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("routes free fallback regeneration through Agnes", async () => {
    mocks.getCachedStory.mockResolvedValue(
      createStory(
        createPage({
          imageStatus: "failed",
          imageRequestCount: 2,
          imageRetryCount: 1,
          imageQuality: {
            version: 1,
            status: "warning",
            width: 768,
            height: 768,
            format: "png",
            bytes: 1024,
          },
        }),
      ),
    );

    const response = await POST(createRequest("free-fallback"));

    expect(response.status).toBe(202);
    await vi.waitFor(() => {
      expect(mocks.executeIllustrationGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackProviders: ["agnes"],
          story: expect.objectContaining({
            pages: [
              expect.objectContaining({
                imageRequestCount: 3,
                imageRetryCount: 2,
                imageQuality: undefined,
              }),
            ],
          }),
        }),
      );
    });
  });

  it("enqueues a durable illustration job without using after", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    mocks.getCachedStory.mockResolvedValue(createStory(createPage()));

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.putPayload).toHaveBeenCalledWith({
      kind: "illustration",
      assetPrincipals: { ownerPrincipal: resolved.anonymousPrincipal },
    });
    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "illustration",
        storyId: "story-12345678",
        page: 1,
        generationAttemptId: expect.any(String),
        payloadRef: `payload_${"p".repeat(32)}`,
      }),
    );
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("rolls back the matching pending attempt when durable enqueue fails", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    const store = installAtomicStoryStore(createStory(createPage()));
    mocks.enqueueJob.mockRejectedValue(new Error("queue unavailable"));

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.deletePayload).toHaveBeenCalledWith(`payload_${"p".repeat(32)}`);
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "failed",
      imageAttemptId: undefined,
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("reconciles an illustration enqueue committed before the network error", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    const store = installAtomicStoryStore(createStory(createPage()));
    mocks.enqueueJob.mockRejectedValue(new Error("response lost"));
    mocks.getJobByIdempotencyKey.mockImplementationOnce(async () => {
      const enqueueInput = mocks.enqueueJob.mock.calls[0][0];
      return {
        kind: "illustration",
        jobId: "job_reconciled_1234",
        storyId: enqueueInput.storyId,
        page: enqueueInput.page,
        generationAttemptId: enqueueInput.generationAttemptId,
        payloadRef: enqueueInput.payloadRef,
      };
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.deletePayload).not.toHaveBeenCalled();
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "pending",
      imageAttemptId: expect.any(String),
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("keeps illustration resources when enqueue reconciliation is unavailable", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    const store = installAtomicStoryStore(createStory(createPage()));
    mocks.enqueueJob.mockRejectedValue(new Error("response lost"));
    mocks.getJobByIdempotencyKey.mockRejectedValue(new Error("lookup unavailable"));

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.deletePayload).not.toHaveBeenCalled();
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "pending",
      imageAttemptId: expect.any(String),
    });
  });

  it("compensates when illustration reconciliation finds a mismatched job", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const resolved = {
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: {
        type: "anonymous",
        id: `v1_${"a".repeat(64)}`,
      },
      createdAnonymousSession: false,
      anonymousSessionToken: "S".repeat(32),
    } as const;
    mocks.getIllustrationAssetMode.mockReturnValue({ enabled: true, reason: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue(resolved);
    const store = installAtomicStoryStore(createStory(createPage()));
    mocks.enqueueJob.mockRejectedValue(new Error("response lost"));
    mocks.getJobByIdempotencyKey.mockResolvedValue({
      kind: "illustration",
      jobId: "job_mismatch_1234",
      storyId: "different-story",
      page: 1,
      generationAttemptId: "different-attempt",
      payloadRef: `payload_${"p".repeat(32)}`,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.deletePayload).toHaveBeenCalled();
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "failed",
      imageAttemptId: undefined,
    });
  });

  it("persists partially_failed when an explicit page attempt fails and no work remains", async () => {
    const initialStory = createStory(createPage({ imageStatus: "failed" }));
    let latestStory = initialStory;
    mocks.getCachedStory.mockImplementation(async () => latestStory);
    mocks.cacheStory.mockImplementation(async (_storyId, story) => {
      latestStory = story;
    });
    mocks.regeneratePage.mockRejectedValue(new Error("provider failed"));

    const response = await POST(createRequest());
    expect(response.status).toBe(202);

    await vi.waitFor(() => {
      expect(latestStory.status).toBe("partially_failed");
    });
    expect(latestStory.pages[0]).toMatchObject({
      imageStatus: "failed",
      imageError: "插图生成失败，请稍后重试。",
    });
  });

  it("persists complete when the final illustration succeeds", async () => {
    let latestStory = createStory(createPage());
    mocks.getCachedStory.mockImplementation(async () => latestStory);
    mocks.cacheStory.mockImplementation(async (_storyId, story) => {
      latestStory = story;
    });
    mocks.regeneratePage.mockImplementation(async (page: StoryPage) => ({
      ...page,
      imageStatus: "complete" as const,
      imageUrl: "/generated/page-1.webp",
      imageCompletedAt: new Date().toISOString(),
    }));

    const response = await POST(createRequest());
    expect(response.status).toBe(202);

    await vi.waitFor(() => {
      expect(latestStory.status).toBe("complete");
    });
    expect(latestStory.pages[0]).toMatchObject({
      imageStatus: "complete",
      imageUrl: "/generated/page-1.webp",
    });
  });

  it("keeps generating_images while another page is still pending", async () => {
    const pageOne = createPage({ imageStatus: "failed" });
    const pageTwo = createPage({
      page: 2,
      imageStatus: "pending",
      imageStartedAt: new Date().toISOString(),
    });
    let latestStory = {
      ...createStory(pageOne),
      pages: [pageOne, pageTwo],
    };
    mocks.getCachedStory.mockImplementation(async () => latestStory);
    mocks.cacheStory.mockImplementation(async (_storyId, story) => {
      latestStory = story;
    });
    mocks.regeneratePage.mockRejectedValue(new Error("provider failed"));

    const response = await POST(createRequest());
    expect(response.status).toBe(202);

    await vi.waitFor(() => {
      expect(latestStory.pages[0].imageStatus).toBe("failed");
    });
    expect(latestStory.status).toBe("generating_images");
    expect(latestStory.pages[1].imageStatus).toBe("pending");
  });

  it("starts only one background job for two simultaneous POSTs of the same page", async () => {
    const store = installAtomicStoryStore(createStory(createPage()));
    const backgroundJobs: Array<() => unknown> = [];
    mocks.after.mockImplementation((callback: () => unknown) => {
      backgroundJobs.push(callback);
    });

    const [first, second] = await Promise.all([
      POST(createRequest()),
      POST(createRequest()),
    ]);

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(backgroundJobs).toHaveLength(1);
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "pending",
    });
    expect(store.latestStory.pages[0].imageAttemptId).toBeTruthy();
  });

  it("keeps both pages complete when two page workers finish concurrently", async () => {
    const pageOne = createPage({ page: 1 });
    const pageTwo = createPage({ page: 2 });
    const store = installAtomicStoryStore(
      createMultiPageStory([pageOne, pageTwo]),
    );
    const backgroundJobs: Array<() => Promise<unknown>> = [];
    mocks.after.mockImplementation((callback: () => Promise<unknown>) => {
      backgroundJobs.push(callback);
    });
    mocks.regeneratePage.mockImplementation(async (page: StoryPage) => ({
      ...page,
      imageStatus: "complete" as const,
      imageUrl: `/generated/page-${page.page}.webp`,
      imageCompletedAt: new Date().toISOString(),
    }));

    const [first, second] = await Promise.all([
      POST(createPageRequest(1)),
      POST(createPageRequest(2)),
    ]);
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(mocks.after).toHaveBeenCalledTimes(2);

    await Promise.all(backgroundJobs.map((job) => job()));

    expect(store.latestStory.status).toBe("complete");
    expect(store.latestStory.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          page: 1,
          imageStatus: "complete",
          imageUrl: "/generated/page-1.webp",
        }),
        expect.objectContaining({
          page: 2,
          imageStatus: "complete",
          imageUrl: "/generated/page-2.webp",
        }),
      ]),
    );
  });

  it("ignores a late result from an older attempt", async () => {
    const store = installAtomicStoryStore(
      createStory(createPage({ imageStatus: "failed" })),
    );
    const backgroundJobs: Array<() => Promise<unknown>> = [];
    mocks.after.mockImplementation((callback: () => Promise<unknown>) => {
      backgroundJobs.push(callback);
    });

    let resolveOld!: (page: StoryPage) => void;
    let resolveNew!: (page: StoryPage) => void;
    const oldResult = new Promise<StoryPage>((resolve) => {
      resolveOld = resolve;
    });
    const newResult = new Promise<StoryPage>((resolve) => {
      resolveNew = resolve;
    });
    mocks.regeneratePage
      .mockImplementationOnce(() => oldResult)
      .mockImplementationOnce(() => newResult);

    const first = await POST(createRequest());
    expect(first.status).toBe(202);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    const oldAttemptId = store.latestStory.pages[0].imageAttemptId;
    expect(oldAttemptId).toBeTruthy();

    store.setLatestStory({
      ...store.latestStory,
      pages: store.latestStory.pages.map((page) =>
        page.page === 1
          ? {
              ...page,
              imageStartedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            }
          : page,
      ),
    });

    const oldWorker = backgroundJobs[0]();
    await vi.waitFor(() => {
      expect(mocks.regeneratePage).toHaveBeenCalledTimes(1);
    });

    const second = await POST(createRequest());
    expect(second.status).toBe(202);
    expect(mocks.after).toHaveBeenCalledTimes(2);
    const newAttemptId = store.latestStory.pages[0].imageAttemptId;
    expect(newAttemptId).toBeTruthy();
    expect(newAttemptId).not.toBe(oldAttemptId);

    const newWorker = backgroundJobs[1]();
    await vi.waitFor(() => {
      expect(mocks.regeneratePage).toHaveBeenCalledTimes(2);
    });
    resolveNew({
      ...store.latestStory.pages[0],
      imageStatus: "complete",
      imageUrl: "/generated/new.webp",
    });
    await newWorker;
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "complete",
      imageUrl: "/generated/new.webp",
    });

    resolveOld({
      ...store.latestStory.pages[0],
      imageStatus: "complete",
      imageUrl: "/generated/old.webp",
    });
    await oldWorker;
    expect(store.latestStory.pages[0]).toMatchObject({
      imageStatus: "complete",
      imageUrl: "/generated/new.webp",
    });
  });
});
