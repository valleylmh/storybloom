import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { GeneratedStory, StoryPage } from "@/types";

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
  cacheStory: vi.fn(),
  cacheTextGenerationTask: vi.fn(),
  createTextGenerationTaskIfAbsent: vi.fn(),
  getCachedCharacterReference: vi.fn(),
  getCachedStory: vi.fn(),
  getCachedTextGenerationTask: vi.fn(),
  getDailyFreeGenerationLimit: vi.fn(() => 3),
  mutateCachedStory: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  generateStoryText: vi.fn(),
  putGenerationJobPayload: vi.fn(),
  deleteGenerationJobPayload: vi.fn(),
  enqueueGenerationJob: vi.fn(),
  getGenerationJobByIdempotencyKey: vi.fn(),
  reserveGenerationQuota: vi.fn(),
  refundGenerationQuotaReservation: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  listFamilyCharacters: vi.fn(),
  resolveStoryAssetRequestPrincipal: vi.fn(),
  attachStoryAssetSessionCookie: vi.fn((response) => response),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => mocks.afterCallbacks.push(callback),
}));

vi.mock("@/lib/request-rate-limit", () => ({
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/storage", () => ({
  cacheStory: mocks.cacheStory,
  cacheTextGenerationTask: mocks.cacheTextGenerationTask,
  createTextGenerationTaskIfAbsent: mocks.createTextGenerationTaskIfAbsent,
  getCachedCharacterReference: mocks.getCachedCharacterReference,
  getCachedStory: mocks.getCachedStory,
  getCachedTextGenerationTask: mocks.getCachedTextGenerationTask,
  getDailyFreeGenerationLimit: mocks.getDailyFreeGenerationLimit,
  mutateCachedStory: mocks.mutateCachedStory,
  rateLimiter: { reserve: mocks.reserve },
}));

vi.mock("@/lib/story-generator", () => ({
  generateStoryText: mocks.generateStoryText,
}));

vi.mock("@/lib/supabase/server-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server-auth")>()),
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: mocks.listFamilyCharacters,
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/story-visual-bible", () => ({
  buildStoryVisualBible: () => ({
    version: 1,
    seriesStyleLock: "same style",
    paletteLock: "same palette",
    continuityPolicy: "same child",
    characters: [],
  }),
}));

vi.mock("@/lib/story-character-anchor", () => ({
  createStoryCharacterAnchorToken: vi.fn(),
}));

vi.mock("@/lib/image-generator", () => ({
  createDemoPages: (pages: StoryPage[]) =>
    pages.map((page) => ({
      ...page,
      imageUrl: `demo:${page.illustrationPrompt}`,
      imageStatus: "demo" as const,
      imageAttempts: [],
    })),
  getImageToImageProviderForPage: () => "cpa",
}));

vi.mock("@/lib/generation-job-payloads", () => ({
  putGenerationJobPayload: mocks.putGenerationJobPayload,
  deleteGenerationJobPayload: mocks.deleteGenerationJobPayload,
}));

vi.mock("@/lib/generation-jobs", () => ({
  enqueueGenerationJob: mocks.enqueueGenerationJob,
  getGenerationJobByIdempotencyKey: mocks.getGenerationJobByIdempotencyKey,
}));

vi.mock("@/lib/generation-quota-reservations", () => ({
  createGenerationQuotaReservationId: () => "quota_123456789012",
  reserveGenerationQuota: mocks.reserveGenerationQuota,
  refundGenerationQuotaReservation: mocks.refundGenerationQuotaReservation,
}));

vi.mock("@/lib/story-asset-principal", () => ({
  resolveStoryAssetRequestPrincipal: mocks.resolveStoryAssetRequestPrincipal,
  attachStoryAssetSessionCookie: mocks.attachStoryAssetSessionCookie,
}));

import { GET, PATCH, POST } from "@/app/api/generate/route";

function createPages(): StoryPage[] {
  return Array.from({ length: 8 }, (_, index) => ({
    page: index + 1,
    zhText: `第 ${index + 1} 页旧文字`,
    enText: `Old page ${index + 1}`,
    illustrationPrompt: `old-scene-${index + 1}`,
    imageStatus: "pending" as const,
  }));
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      childName: "童童",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "第一次整理书包",
      style: "watercolor",
      language: "zh-en",
      ...overrides,
    }),
  });
}

function createCachedStory(
  status: GeneratedStory["status"] = "reviewing_outline",
): GeneratedStory {
  return {
    id: "story-1",
    input: {
      childName: "童童",
      ageGroup: "4-5" as const,
      theme: "custom" as const,
      customTheme: "第一次整理书包",
      style: "watercolor" as const,
      language: "zh-en" as const,
      visualBible: {
        version: 1 as const,
        seriesStyleLock: "same style",
        paletteLock: "same palette",
        continuityPolicy: "same child",
        characters: [],
      },
    },
    pages: createPages().map((page) => ({
      ...page,
      imageStatus: "demo" as const,
      imageUrl: `demo:${page.illustrationPrompt}`,
    })),
    coverTitle: "童童的书包故事",
    createdAt: "2026-08-13T02:00:00.000Z",
    status,
    generationMode: "live" as const,
  };
}

describe("generate route reliable task contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.length = 0;
    mocks.getCachedTextGenerationTask.mockResolvedValue(null);
    mocks.getCachedStory.mockResolvedValue(null);
    mocks.release.mockResolvedValue(undefined);
    mocks.reserve.mockResolvedValue({
      success: true,
      remaining: 2,
      release: mocks.release,
    });
    mocks.generateStoryText.mockResolvedValue({
      coverTitle: "童童的书包故事",
      pages: createPages(),
    });
    mocks.cacheStory.mockResolvedValue(undefined);
    mocks.cacheTextGenerationTask.mockResolvedValue(undefined);
    mocks.putGenerationJobPayload.mockResolvedValue(`payload_${"p".repeat(32)}`);
    mocks.deleteGenerationJobPayload.mockResolvedValue(true);
    mocks.enqueueGenerationJob.mockResolvedValue({
      created: true,
      job: { jobId: "job_123456789012" },
    });
    mocks.getGenerationJobByIdempotencyKey.mockResolvedValue(null);
    mocks.reserveGenerationQuota.mockResolvedValue({
      outcome: "reserved",
      created: true,
      remaining: 2,
      reservation: { reservationId: "quota_123456789012" },
    });
    mocks.refundGenerationQuotaReservation.mockResolvedValue({
      outcome: "refunded",
      changed: true,
    });
    mocks.requireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mocks.listFamilyCharacters.mockResolvedValue({ data: [], error: null });
    mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue({
      principal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      anonymousPrincipal: { type: "anonymous", id: `v1_${"a".repeat(64)}` },
      createdAnonymousSession: true,
      anonymousSessionToken: "S".repeat(32),
    });
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
    mocks.createTextGenerationTaskIfAbsent.mockImplementation(async (task) => ({
      task,
      created: true,
    }));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the existing POST response synchronous by default", async () => {
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      storyId: expect.any(String),
      coverTitle: "童童的书包故事",
      totalPages: 8,
      imagesPending: true,
    });
    expect(body.taskId).toBeUndefined();
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.cacheStory).toHaveBeenCalledWith(
      body.storyId,
      expect.objectContaining({ status: "generating_images" }),
    );
  });

  it("allows an ordinary family protagonist without a personalization Anchor", async () => {
    const protagonistId = "11111111-1111-4111-8111-111111111111";
    mocks.listFamilyCharacters.mockResolvedValueOnce({
      data: [
        {
          id: protagonistId,
          display_name: "童童",
          relationship: "孩子",
          description: "短发、蓝色外套",
          canonical_photo_path: null,
          source_photo_path: null,
          cartoonize: true,
        },
      ],
      error: null,
    });

    const response = await POST(
      createRequest({
        protagonistFamilyCharacterId: protagonistId,
        familyCharacterIds: [protagonistId],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.generateStoryText).toHaveBeenCalledWith(
      expect.objectContaining({
        protagonistFamilyCharacterId: protagonistId,
        familyCharacters: [
          expect.objectContaining({
            id: protagonistId,
            isProtagonist: true,
          }),
        ],
      }),
    );
    expect(
      mocks.generateStoryText.mock.calls[0][0].personalizationAnchor,
    ).toBeUndefined();
  });

  it("still rejects a personalized Anchor bound to a different protagonist", async () => {
    const protagonistId = "11111111-1111-4111-8111-111111111111";
    const anchorCharacterId = "22222222-2222-4222-8222-222222222222";

    const response = await POST(
      createRequest({
        protagonistFamilyCharacterId: protagonistId,
        familyCharacterIds: [protagonistId],
        sourceLibraryBookId: "xiyouji/shi-hou-chu-shi",
        personalizationDraftId: "33333333-3333-4333-8333-333333333333",
        personalizationAnchor: {
          version: 1,
          displayName: "童童",
          relationship: "孩子",
          appearance: "短发、蓝色外套",
          referenceType: "canonical",
          characterId: anchorCharacterId,
          confirmedAt: "2026-08-25T01:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "确认的角色 Anchor 与故事主角不一致。",
    });
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("returns a persistent task before text generation and completes it in the background", async () => {
    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
        reviewBeforeIllustrations: true,
      }),
    );
    const pending = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("location")).toContain(pending.taskId);
    expect(pending).toEqual({
      taskId: "task_123456789012",
      storyId: expect.any(String),
      status: "generating_text",
      pollAfterMs: 1200,
    });
    expect(mocks.generateStoryText).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);

    await mocks.afterCallbacks[0]();

    expect(mocks.generateStoryText).toHaveBeenCalledWith(
      expect.not.objectContaining({
        generationRequestMode: expect.anything(),
        generationTaskId: expect.anything(),
        reviewBeforeIllustrations: expect.anything(),
      }),
    );
    expect(mocks.cacheStory).toHaveBeenCalledWith(
      pending.storyId,
      expect.objectContaining({ status: "reviewing_outline" }),
    );
    expect(mocks.cacheTextGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: pending.taskId,
        storyId: pending.storyId,
        status: "reviewing_outline",
        result: expect.objectContaining({ totalPages: 8 }),
      }),
    );
  });

  it("enqueues a durable text job instead of relying on after when the feature is enabled", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
        reviewBeforeIllustrations: true,
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.reserveGenerationQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "quota_123456789012",
        idempotencyKey: "text:task_123456789012",
      }),
    );
    expect(mocks.putGenerationJobPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        quotaReservationId: "quota_123456789012",
        generationPrincipalIds: [expect.stringMatching(/^v1_[a-f0-9]{64}$/)],
      }),
    );
    expect(mocks.enqueueGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "text",
        taskId: "task_123456789012",
        quotaReservationId: "quota_123456789012",
      }),
    );
    expect(mocks.cacheTextGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({ durableJobId: "job_123456789012" }),
    );
  });

  it("rolls back durable quota and payload when enqueue fails", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    mocks.enqueueGenerationJob.mockRejectedValueOnce(new Error("redis unavailable"));

    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.deleteGenerationJobPayload).toHaveBeenCalledWith(
      `payload_${"p".repeat(32)}`,
    );
    expect(mocks.refundGenerationQuotaReservation).toHaveBeenCalledWith({
      reservationId: "quota_123456789012",
    });
    expect(mocks.cacheTextGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", retryable: true }),
    );
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  it("reconciles a text enqueue committed before the network error", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    mocks.enqueueGenerationJob.mockRejectedValueOnce(new Error("response lost"));
    mocks.getGenerationJobByIdempotencyKey.mockImplementationOnce(async () => {
      const pendingTask = mocks.createTextGenerationTaskIfAbsent.mock.calls[0][0];
      return {
        kind: "text",
        jobId: "job_reconciled_1234",
        storyId: pendingTask.storyId,
        taskId: pendingTask.taskId,
        payloadRef: `payload_${"p".repeat(32)}`,
        quotaReservationId: "quota_123456789012",
      };
    });

    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.getGenerationJobByIdempotencyKey).toHaveBeenCalledWith(
      "text:task_123456789012",
    );
    expect(mocks.deleteGenerationJobPayload).not.toHaveBeenCalled();
    expect(mocks.refundGenerationQuotaReservation).not.toHaveBeenCalled();
    expect(mocks.cacheTextGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({ durableJobId: "job_reconciled_1234" }),
    );
  });

  it("keeps text resources when enqueue reconciliation is unavailable", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    mocks.enqueueGenerationJob.mockRejectedValueOnce(new Error("response lost"));
    mocks.getGenerationJobByIdempotencyKey.mockRejectedValueOnce(
      new Error("lookup unavailable"),
    );

    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.deleteGenerationJobPayload).not.toHaveBeenCalled();
    expect(mocks.refundGenerationQuotaReservation).not.toHaveBeenCalled();
    expect(mocks.cacheTextGenerationTask).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("compensates when text reconciliation finds a mismatched job", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    mocks.enqueueGenerationJob.mockRejectedValueOnce(new Error("response lost"));
    mocks.getGenerationJobByIdempotencyKey.mockResolvedValueOnce({
      kind: "text",
      jobId: "job_mismatch_1234",
      storyId: "different-story",
      taskId: "task_123456789012",
      payloadRef: `payload_${"p".repeat(32)}`,
      quotaReservationId: "quota_123456789012",
    });

    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.deleteGenerationJobPayload).toHaveBeenCalled();
    expect(mocks.refundGenerationQuotaReservation).toHaveBeenCalled();
  });

  it("reuses a client-preallocated task id without generating or charging twice", async () => {
    mocks.getCachedTextGenerationTask.mockResolvedValue({
      taskId: "task_123456789012",
      storyId: "story-existing",
      status: "generating_text",
      reviewBeforeIllustrations: true,
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:00:00.000Z",
    });

    const response = await POST(
      createRequest({
        generationRequestMode: "async",
        generationTaskId: "task_123456789012",
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ storyId: "story-existing" });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.generateStoryText).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  it("returns an explicit unrecoverable status for a missing task", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/generate?taskId=task_123456789012",
      ),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      taskId: "task_123456789012",
      status: "unrecoverable",
      retryable: true,
    });
  });

  it("does not pretend a completed text task is recoverable when its story snapshot is missing", async () => {
    mocks.getCachedTextGenerationTask.mockResolvedValue({
      taskId: "task_123456789012",
      storyId: "story-missing",
      status: "generating_images",
      reviewBeforeIllustrations: false,
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:01:00.000Z",
      result: {
        storyId: "story-missing",
        input: createCachedStory().input,
        coverTitle: "旧静态结果",
        pages: createPages(),
        totalPages: 8,
        generationMode: "live",
        freeChanceLabel: "今日免费生成 3 次",
      },
    });
    mocks.getCachedStory.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/generate?taskId=task_123456789012",
      ),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      status: "unrecoverable",
      storyId: "story-missing",
    });
  });

  it("restores the latest persisted illustration state instead of the stale text result", async () => {
    const task = {
      taskId: "task_123456789012",
      storyId: "story-1",
      status: "generating_images" as const,
      reviewBeforeIllustrations: false,
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:01:00.000Z",
      result: {
        storyId: "story-1",
        input: createCachedStory().input,
        coverTitle: "童童的书包故事",
        pages: createPages().map((page) => ({ ...page, imageStatus: "demo" as const })),
        totalPages: 8,
        generationMode: "live" as const,
        freeChanceLabel: "今日免费生成 3 次",
        imagesPending: true,
      },
    };
    const story = createCachedStory("partially_failed");
    story.pages[0] = {
      ...story.pages[0],
      imageStatus: "complete",
      imageUrl: "/generated/page-1.webp",
    };
    story.pages[1] = {
      ...story.pages[1],
      imageStatus: "failed",
      imageError:
        "Bearer known-auth-secret provider failed for 童童 https://example.test?token=private",
      imageAttempts: [
        {
          provider: "cpa",
          model: "gemini-3.1-flash-image",
          status: "failed",
          durationMs: 100,
          startedAt: "2026-08-13T02:00:00.000Z",
          completedAt: "2026-08-13T02:00:00.100Z",
          error: "private prompt and token",
        },
      ],
    };
    mocks.getCachedTextGenerationTask.mockResolvedValue(task);
    mocks.getCachedStory.mockResolvedValue(story);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/generate?taskId=task_123456789012",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("partially_failed");
    expect(body.result.pages[0]).toMatchObject({
      imageStatus: "complete",
      imageUrl: "/generated/page-1.webp",
    });
    expect(body.result.pages[1]).toMatchObject({
      imageStatus: "failed",
      imageError: "插图生成失败，请稍后重试。",
      imageAttempts: [
        expect.objectContaining({
          error: "插图生成失败，请稍后重试。",
          errorClass: "unknown",
        }),
      ],
    });
    expect(JSON.stringify(body)).not.toContain("known-auth-secret");
    expect(JSON.stringify(body)).not.toContain("private prompt");
    expect(JSON.stringify(body)).not.toContain("example.test");
  });

  it("reports failed pages as partially failed even when an older story status was not updated", async () => {
    const task = {
      taskId: "task_123456789012",
      storyId: "story-1",
      status: "generating_images" as const,
      reviewBeforeIllustrations: false,
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:01:00.000Z",
    };
    const story = createCachedStory("generating_images");
    story.pages[0] = {
      ...story.pages[0],
      imageStatus: "failed",
      imageError: "provider failed",
    };
    mocks.getCachedTextGenerationTask.mockResolvedValue(task);
    mocks.getCachedStory.mockResolvedValue(story);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/generate?taskId=task_123456789012",
      ),
    );

    expect((await response.json()).status).toBe("partially_failed");
  });

  it("writes all eight edited pages back and rebuilds illustration prompts before images start", async () => {
    const story = createCachedStory();
    const task = {
      taskId: "task_123456789012",
      storyId: story.id,
      status: "reviewing_outline" as const,
      reviewBeforeIllustrations: true,
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:01:00.000Z",
    };
    mocks.getCachedTextGenerationTask.mockResolvedValue(task);
    mocks.getCachedStory.mockResolvedValue(story);
    const pages = createPages().map((page) => ({
      page: page.page,
      zhText: `第 ${page.page} 页家长确认的新文字`,
      enText: `Parent-approved page ${page.page}`,
    }));

    const response = await PATCH(
      new NextRequest("http://localhost/api/generate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.taskId, storyId: story.id, pages }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      taskId: task.taskId,
      storyId: story.id,
      status: "generating_images",
      result: { pages: expect.any(Array) },
    });
    expect(body.result.pages[0]).toMatchObject({
      zhText: "第 1 页家长确认的新文字",
      enText: "Parent-approved page 1",
      imageStatus: "demo",
    });
    expect(body.result.pages[0].illustrationPrompt).toContain(
      "第 1 页家长确认的新文字",
    );
    expect(body.result.pages[0].illustrationPrompt).not.toContain("old-scene-1");
    expect(body.result.pages[0].imageUrl).toContain("家长确认的新文字");
    expect(mocks.cacheStory).toHaveBeenCalledWith(
      story.id,
      expect.objectContaining({ status: "generating_images" }),
    );
    expect(mocks.cacheTextGenerationTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "generating_images" }),
    );
  });
});
