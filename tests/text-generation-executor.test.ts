import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoryPage } from "@/types";

const mocks = vi.hoisted(() => ({
  cacheStory: vi.fn(),
  cacheTask: vi.fn(),
  getStory: vi.fn(),
  mutateTask: vi.fn(),
  publishStory: vi.fn(),
  generateStoryText: vi.fn(),
  createAnchor: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  cacheStory: mocks.cacheStory,
  cacheTextGenerationTask: mocks.cacheTask,
  getCachedStory: mocks.getStory,
  mutateCachedTextGenerationTask: mocks.mutateTask,
  publishTextGenerationStory: mocks.publishStory,
}));
vi.mock("@/lib/story-generator", () => ({
  generateStoryText: mocks.generateStoryText,
}));
vi.mock("@/lib/story-character-anchor", () => ({
  createStoryCharacterAnchorToken: mocks.createAnchor,
}));
vi.mock("@/lib/image-generator", () => ({
  createDemoPages: (pages: StoryPage[]) =>
    pages.map((page) => ({
      ...page,
      imageStatus: "demo" as const,
      imageUrl: `demo:${page.illustrationPrompt}`,
    })),
  getImageToImageProviderForPage: () => "cpa",
}));
vi.mock("@/lib/generation-observability", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/generation-observability")
  >();
  return { ...original, logGenerationEvent: mocks.logEvent };
});

import { executeTextGeneration } from "@/lib/text-generation-executor";

const task = {
  taskId: "task_123456789012",
  storyId: "story-123456",
  status: "generating_text" as const,
  reviewBeforeIllustrations: true,
  durableJob: true,
  durableJobId: "job_123456789012",
  durableJobAttempt: 1,
  createdAt: "2026-08-13T02:00:00.000Z",
  updatedAt: "2026-08-13T02:00:00.000Z",
};
const publishIdentity = {
  durableJobId: task.durableJobId,
  durableJobAttempt: task.durableJobAttempt,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateStoryText.mockResolvedValue({
    coverTitle: "童童的故事",
    pages: [
      {
        page: 1,
        zhText: "第一页",
        enText: "Page one",
        illustrationPrompt: "scene one",
      },
    ],
  });
  mocks.publishStory.mockImplementation(async ({ story }) => ({
    ...story,
    textGenerationJobId: task.durableJobId,
    textGenerationJobAttempt: task.durableJobAttempt,
    revision: 1,
  }));
  mocks.mutateTask.mockImplementation(async (_taskId, mutator) => {
    const decision = await mutator(task);
    return decision
      ? {
          task: decision.nextTask || task,
          value: decision.value,
          updated: Boolean(decision.nextTask),
        }
      : null;
  });
  mocks.getStory.mockResolvedValue(null);
});

describe("durable text publication fencing", () => {
  it("returns the remaining free-generation count captured at reservation time", async () => {
    const result = await executeTextGeneration({
      task,
      storyInput: {
        childName: "童童",
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "整理书包",
        style: "watercolor",
        language: "zh",
      },
      familyCharacters: [],
      dailyLimit: 3,
      freeGenerationsRemaining: 2,
      persistTerminalFailure: false,
      publishIdentity,
      publishFence: vi.fn().mockResolvedValue(true),
    });

    expect(result.outcome).toBe("succeeded");
    if (result.outcome === "succeeded") {
      expect(result.generated.response.freeChanceLabel).toBe("今日剩余 2 / 3 次");
      expect(result.generated.response.freeGenerationsRemaining).toBe(2);
      expect(result.generated.response.freeGenerationsLimit).toBe(3);
    }
  });

  it("does not publish the task result when the lease is lost after Story publication", async () => {
    const publishFence = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const outcome = await executeTextGeneration({
      task,
      storyInput: {
        childName: "童童",
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "整理书包",
        style: "watercolor",
        language: "zh",
      },
      familyCharacters: [],
      dailyLimit: 3,
      persistTerminalFailure: false,
      publishIdentity,
      publishFence,
    });

    expect(outcome.outcome).toBe("failed");
    expect(mocks.publishStory).toHaveBeenCalledWith(
      expect.objectContaining(publishIdentity),
    );
    expect(mocks.mutateTask).not.toHaveBeenCalled();
    expect(mocks.cacheTask).not.toHaveBeenCalled();
  });

  it("rejects task publication when a newer attempt takes ownership after Story publication", async () => {
    const newerTask = { ...task, durableJobAttempt: 2 };
    mocks.mutateTask.mockImplementationOnce(async (_taskId, mutator) => {
      const decision = await mutator(newerTask);
      return decision ? { task: newerTask, value: decision.value, updated: false } : null;
    });

    const outcome = await executeTextGeneration({
      task,
      storyInput: {
        childName: "童童",
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "整理书包",
        style: "watercolor",
        language: "zh",
      },
      familyCharacters: [],
      dailyLimit: 3,
      persistTerminalFailure: false,
      publishIdentity,
      publishFence: vi.fn().mockResolvedValue(true),
    });

    expect(outcome.outcome).toBe("failed");
    expect(mocks.publishStory).toHaveBeenCalled();
    expect(mocks.mutateTask).toHaveBeenCalledWith(
      task.taskId,
      expect.any(Function),
      {
        publishStoryFence: {
          storyId: task.storyId,
          ...publishIdentity,
        },
      },
    );
    expect(mocks.cacheTask).not.toHaveBeenCalled();
  });

  it("reuses a parent-confirmed story Anchor instead of generating another one", async () => {
    const protagonist = {
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "童童",
      relation: "孩子",
      appearance: "齐耳短发、圆框眼镜、黄色外套",
      sourceReferenceAssetPath: "user/child/source.webp",
      canonicalReferenceAssetPath: "user/child/canonical.png",
      storyReferenceToken:
        "abcdefghijklmnopqrstuvwxyzABCDEF1234567890_-storyanchor",
      isProtagonist: true,
    };
    await executeTextGeneration({
      task,
      storyInput: {
        childName: "童童",
        protagonistFamilyCharacterId: protagonist.id,
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "家庭专属版石猴出世",
        style: "fairytale",
        language: "zh-en",
        familyCharacters: [protagonist],
        visualBible: {
          version: 1,
          seriesStyleLock: "style",
          paletteLock: "palette",
          continuityPolicy: "continuity",
          characters: [],
        },
      },
      protagonistCharacter: protagonist,
      familyCharacters: [protagonist],
      dailyLimit: 3,
      persistTerminalFailure: false,
      publishIdentity,
      publishFence: vi.fn().mockResolvedValue(true),
    });

    expect(mocks.createAnchor).not.toHaveBeenCalled();
    expect(mocks.generateStoryText).toHaveBeenCalledWith(
      expect.objectContaining({
        familyCharacters: [expect.objectContaining({ storyReferenceToken: protagonist.storyReferenceToken })],
      }),
    );
  });
});
