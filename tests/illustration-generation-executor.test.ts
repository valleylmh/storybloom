import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedStory, StoryPage } from "@/types";

const mocks = vi.hoisted(() => ({
  regeneratePage: vi.fn(),
  mutateCachedStory: vi.fn(),
  getStorageCapabilities: vi.fn(),
  getTemporaryStoryAssetCapabilities: vi.fn(),
  putTemporaryStoryAsset: vi.fn(),
  grantTemporaryStoryAssetPrincipal: vi.fn(),
  commitTemporaryStoryAsset: vi.fn(),
  discardTemporaryStoryAsset: vi.fn(),
  deleteTemporaryStoryAsset: vi.fn(),
  logGenerationEvent: vi.fn(),
}));

vi.mock("@/lib/image-generator", () => ({
  regeneratePage: mocks.regeneratePage,
}));

vi.mock("@/lib/storage", () => ({
  mutateCachedStory: mocks.mutateCachedStory,
  getStorageCapabilities: mocks.getStorageCapabilities,
}));

vi.mock("@/lib/temporary-story-asset-store", () => ({
  getTemporaryStoryAssetCapabilities: mocks.getTemporaryStoryAssetCapabilities,
  putTemporaryStoryAsset: mocks.putTemporaryStoryAsset,
  grantTemporaryStoryAssetPrincipal: mocks.grantTemporaryStoryAssetPrincipal,
  commitTemporaryStoryAsset: mocks.commitTemporaryStoryAsset,
  discardTemporaryStoryAsset: mocks.discardTemporaryStoryAsset,
  deleteTemporaryStoryAsset: mocks.deleteTemporaryStoryAsset,
}));

vi.mock("@/lib/generation-observability", () => ({
  classifyGenerationError: () => "storage_unavailable",
  logGenerationEvent: mocks.logGenerationEvent,
}));

import {
  executeIllustrationGeneration,
  getIllustrationAssetMode,
} from "@/lib/illustration-generation-executor";

const ATTEMPT_ID = "attempt-12345678";
const ASSET_ID = "A".repeat(32);
const LEASE = "L".repeat(32);
const ASSET_URL = `/api/story-assets/${ASSET_ID}`;
const anonymousPrincipal = {
  type: "anonymous" as const,
  id: `v1_${"a".repeat(64)}`,
};
const userPrincipal = {
  type: "user" as const,
  id: `v1_${"b".repeat(64)}`,
};

function createPage(overrides: Partial<StoryPage> = {}): StoryPage {
  return {
    page: 1,
    zhText: "第一页",
    enText: "Page one",
    illustrationPrompt: "A storybook scene",
    imageStatus: "pending",
    imageStartedAt: "2026-08-13T01:00:00.000Z",
    imageAttemptId: ATTEMPT_ID,
    ...overrides,
  };
}

function createStory(page = createPage()): GeneratedStory {
  return {
    id: "story-asset-executor",
    input: {
      childName: "童童",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "收拾玩具",
      style: "fairytale",
      language: "zh-en",
    },
    coverTitle: "童童的故事",
    pages: [page],
    createdAt: "2026-08-13T00:00:00.000Z",
    status: "generating_images",
    generationMode: "live",
  };
}

function installStoryStore(initialStory = createStory()) {
  let latestStory = initialStory;
  mocks.mutateCachedStory.mockImplementation(async (_storyId, mutator) => {
    const decision = await mutator(latestStory);
    if (!decision) return null;
    if (decision.nextStory) {
      latestStory = {
        ...decision.nextStory,
        revision: (latestStory.revision || 0) + 1,
      };
    }
    return {
      story: latestStory,
      value: decision.value,
      updated: Boolean(decision.nextStory),
    };
  });
  return {
    get story() {
      return latestStory;
    },
    replace(story: GeneratedStory) {
      latestStory = story;
    },
  };
}

function storedAsset() {
  return {
    kind: "stored" as const,
    assetId: ASSET_ID,
    lease: LEASE,
    imageUrl: ASSET_URL,
    storyId: "story-asset-executor",
    page: 1,
    state: "pending" as const,
    contentType: "image/png" as const,
    byteSize: 128,
    sha256: "c".repeat(64),
    createdAt: 1,
    expiresAt: Date.now() + 60_000,
  };
}

function execute(story = createStory()) {
  return executeIllustrationGeneration({
    story,
    pageNumber: 1,
    attemptId: ATTEMPT_ID,
    assetPrincipals: {
      ownerPrincipal: anonymousPrincipal,
      grantedPrincipal: userPrincipal,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
  mocks.getTemporaryStoryAssetCapabilities.mockReturnValue({
    configurationReady: true,
    productionVerified: false,
    productionReady: true,
  });
  mocks.getStorageCapabilities.mockReturnValue({ shared: true });
  mocks.regeneratePage.mockImplementation(async (page: StoryPage) => ({
    ...page,
    imageStatus: "complete" as const,
    imageUrl: "data:image/png;base64,provider-bytes",
    imageCompletedAt: "2026-08-13T01:00:01.000Z",
  }));
  mocks.putTemporaryStoryAsset.mockResolvedValue(storedAsset());
  mocks.grantTemporaryStoryAssetPrincipal.mockResolvedValue(true);
  mocks.commitTemporaryStoryAsset.mockResolvedValue(true);
  mocks.discardTemporaryStoryAsset.mockResolvedValue(true);
  mocks.deleteTemporaryStoryAsset.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("illustration generation executor", () => {
  it("uses private assets whenever the durable backend is ready, independent of the jobs flag", () => {
    expect(getIllustrationAssetMode()).toEqual({ enabled: true, reason: null });

    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "0");
    expect(getIllustrationAssetMode()).toEqual({ enabled: true, reason: null });

    mocks.getTemporaryStoryAssetCapabilities.mockReturnValue({
      configurationReady: false,
      productionVerified: false,
      productionReady: false,
    });
    expect(getIllustrationAssetMode()).toEqual({
      enabled: false,
      reason: "storage_not_ready",
    });

    mocks.getStorageCapabilities.mockReturnValue({ shared: false });
    expect(getIllustrationAssetMode()).toEqual({
      enabled: false,
      reason: "flag_disabled",
    });

    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
    expect(getIllustrationAssetMode()).toEqual({
      enabled: false,
      reason: "storage_not_ready",
    });
  });

  it("stages an opaque URL, grants the user, commits bytes, then finalizes the page", async () => {
    const store = installStoryStore();

    await execute(store.story);

    expect(mocks.putTemporaryStoryAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "data:image/png;base64,provider-bytes",
        storyId: "story-asset-executor",
        page: 1,
        attemptId: ATTEMPT_ID,
        principal: anonymousPrincipal,
      }),
      { requireDurable: true },
    );
    expect(mocks.grantTemporaryStoryAssetPrincipal).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      lease: LEASE,
      ownerPrincipal: anonymousPrincipal,
      grantedPrincipal: userPrincipal,
    });
    expect(mocks.commitTemporaryStoryAsset).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      lease: LEASE,
      principal: anonymousPrincipal,
    });
    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "complete",
      imageUrl: ASSET_URL,
      imageAttemptId: undefined,
    });
    expect(store.story.status).toBe("complete");
    expect(mocks.discardTemporaryStoryAsset).not.toHaveBeenCalled();
  });

  it("keeps demo and static provider results as passthrough assets", async () => {
    const store = installStoryStore();
    mocks.regeneratePage.mockImplementation(async (page: StoryPage) => ({
      ...page,
      imageStatus: "complete" as const,
      imageUrl: "/generated/page-1.webp",
    }));
    mocks.putTemporaryStoryAsset.mockResolvedValue({
      kind: "passthrough",
      imageUrl: "/generated/page-1.webp",
      reason: "static-path",
    });

    await execute(store.story);

    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "complete",
      imageUrl: "/generated/page-1.webp",
    });
    expect(mocks.commitTemporaryStoryAsset).not.toHaveBeenCalled();
    expect(mocks.grantTemporaryStoryAssetPrincipal).not.toHaveBeenCalled();
  });

  it("keeps a durable attempt pending when provider generation fails", async () => {
    const store = installStoryStore();
    mocks.regeneratePage.mockRejectedValue(new Error("provider unavailable"));

    const outcome = await executeIllustrationGeneration({
      story: store.story,
      pageNumber: 1,
      attemptId: ATTEMPT_ID,
      assetPrincipals: {
        ownerPrincipal: anonymousPrincipal,
        grantedPrincipal: userPrincipal,
      },
      persistTerminalFailure: false,
    });

    expect(outcome.outcome).toBe("failed");
    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "pending",
      imageAttemptId: ATTEMPT_ID,
    });
  });

  it("discards pending bytes when a newer attempt wins before the Story CAS", async () => {
    const store = installStoryStore();
    mocks.mutateCachedStory.mockImplementationOnce(async () => null);

    await execute(store.story);

    expect(mocks.discardTemporaryStoryAsset).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      lease: LEASE,
      principal: anonymousPrincipal,
    });
    expect(mocks.commitTemporaryStoryAsset).not.toHaveBeenCalled();
  });

  it("discards the pending asset and marks the attempt failed when a user grant is rejected", async () => {
    const store = installStoryStore();
    mocks.grantTemporaryStoryAssetPrincipal.mockResolvedValue(false);

    await execute(store.story);

    expect(mocks.discardTemporaryStoryAsset).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      lease: LEASE,
      principal: anonymousPrincipal,
    });
    expect(mocks.commitTemporaryStoryAsset).not.toHaveBeenCalled();
    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "failed",
      imageAttemptId: undefined,
    });
    expect(store.story.pages[0].imageUrl).toBeUndefined();
  });

  it("removes the staged URL and fails the page when asset commit returns false", async () => {
    const store = installStoryStore();
    mocks.commitTemporaryStoryAsset.mockResolvedValue(false);

    await execute(store.story);

    expect(mocks.discardTemporaryStoryAsset).toHaveBeenCalled();
    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "failed",
      imageAttemptId: undefined,
    });
    expect(store.story.pages[0].imageUrl).toBeUndefined();
    expect(store.story.status).toBe("partially_failed");
  });

  it("deletes a possibly committed asset when commit throws and discard cannot remove it", async () => {
    const store = installStoryStore();
    mocks.commitTemporaryStoryAsset.mockRejectedValue(
      new Error("metadata write status unknown"),
    );
    mocks.discardTemporaryStoryAsset.mockResolvedValue(false);

    await execute(store.story);

    expect(mocks.deleteTemporaryStoryAsset).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      principal: anonymousPrincipal,
    });
    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "failed",
    });
    expect(store.story.pages[0].imageUrl).toBeUndefined();
  });

  it("deletes committed bytes if the final CAS becomes stale", async () => {
    const store = installStoryStore();
    let mutationCount = 0;
    mocks.mutateCachedStory.mockImplementation(async (_storyId, mutator) => {
      mutationCount += 1;
      if (mutationCount === 2) {
        store.replace({
          ...store.story,
          pages: [
            createPage({
              imageAttemptId: "newer-attempt-123",
              imageUrl: ASSET_URL,
            }),
          ],
        });
        return null;
      }
      const decision = await mutator(store.story);
      if (!decision) return null;
      if (decision.nextStory) store.replace(decision.nextStory);
      return { story: store.story, value: decision.value, updated: true };
    });
    mocks.discardTemporaryStoryAsset.mockResolvedValue(false);

    await execute(store.story);

    expect(mocks.deleteTemporaryStoryAsset).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      principal: anonymousPrincipal,
    });
    expect(store.story.pages[0]).toMatchObject({
      imageStatus: "pending",
      imageAttemptId: "newer-attempt-123",
      imageUrl: ASSET_URL,
    });
  });
});
