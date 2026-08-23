import "server-only";

import { createDemoPages, getImageToImageProviderForPage } from "@/lib/image-generator";
import {
  attachStoryReferenceToken,
  createPublicStoryInput,
  hasFamilyCharacterReference,
} from "@/lib/family-story-characters";
import { createStoryCharacterAnchorToken } from "@/lib/story-character-anchor";
import { generateStoryText } from "@/lib/story-generator";
import {
  cacheStory,
  cacheTextGenerationTask,
  getCachedStory,
  mutateCachedTextGenerationTask,
  publishTextGenerationStory,
} from "@/lib/storage";
import {
  classifyGenerationError,
  logGenerationEvent,
} from "@/lib/generation-observability";
import type { TextGenerationTask } from "@/lib/text-generation-task";
import type {
  FamilyCharacterInput,
  GenerateResponse,
  GeneratedStory,
  StoryInput,
  StoryPage,
} from "@/types";

export const SAFE_TEXT_GENERATION_ERROR = "故事生成失败，请稍后再试。";

export class StaleTextGenerationLeaseError extends Error {
  readonly errorClass = "stale_result" as const;

  constructor() {
    super("Text generation lease is no longer current.");
    this.name = "StaleTextGenerationLeaseError";
  }
}

export type TextGenerationPublishFence = () => Promise<boolean>;
export type TextGenerationPublishIdentity = {
  durableJobId: string;
  durableJobAttempt: number;
};

export type ExecuteTextGenerationInput = {
  task: TextGenerationTask;
  storyInput: StoryInput;
  protagonistCharacter?: FamilyCharacterInput;
  familyCharacters: FamilyCharacterInput[];
  dailyLimit: number;
  freeGenerationsRemaining?: number;
  generationPrincipalIds?: string[];
  /** Must atomically confirm or renew the current lease immediately before publish. */
  publishFence?: TextGenerationPublishFence;
  /** Durable task attempt that must still own both Story and task publication. */
  publishIdentity?: TextGenerationPublishIdentity;
  onSuccess?: () => Promise<void>;
  onFailure?: (error: unknown) => Promise<void>;
  /** Durable workers leave retry state to the job state machine. */
  persistTerminalFailure?: boolean;
};

function pageUsesFamilyPhoto(
  page: StoryPage,
  familyCharacters: FamilyCharacterInput[],
) {
  const castIds = new Set(page.castIds || []);
  return familyCharacters.some(
    (character) =>
      castIds.has(character.id) && hasFamilyCharacterReference(character),
  );
}

function createGenerateResponse(input: {
  storyId: string;
  storyInput: StoryInput;
  coverTitle: string;
  pages: StoryPage[];
  dailyLimit: number;
  freeGenerationsRemaining?: number;
}): GenerateResponse {
  const hasRemaining = input.freeGenerationsRemaining !== undefined;
  return {
    storyId: input.storyId,
    input: createPublicStoryInput(input.storyInput),
    coverTitle: input.coverTitle,
    pages: input.pages,
    totalPages: input.pages.length,
    generationMode: "live",
    freeChanceLabel: hasRemaining
      ? `今日剩余 ${input.freeGenerationsRemaining} / ${input.dailyLimit} 次`
      : `今日免费生成 ${input.dailyLimit} 次`,
    ...(hasRemaining
      ? {
          freeGenerationsRemaining: input.freeGenerationsRemaining,
          freeGenerationsLimit: input.dailyLimit,
        }
      : {}),
    imagesPending: true,
  };
}

export async function computeTextGeneration(input: {
  storyId: string;
  storyInput: StoryInput;
  protagonistCharacter?: FamilyCharacterInput;
  familyCharacters: FamilyCharacterInput[];
  dailyLimit: number;
  freeGenerationsRemaining?: number;
  reviewBeforeIllustrations: boolean;
  generationPrincipalIds?: string[];
}) {
  let storyInput = input.storyInput;
  const shouldCreateStoryAnchor = Boolean(
    input.protagonistCharacter &&
      !input.protagonistCharacter.storyReferenceToken &&
      storyInput.visualBible &&
      process.env.CPA_API_KEY?.trim() &&
      process.env.CPA_BASE_URL?.trim() &&
      (input.protagonistCharacter.sourceReferenceAssetPath ||
        input.protagonistCharacter.canonicalReferenceAssetPath ||
        input.protagonistCharacter.referenceAssetPath),
  );
  const storyAnchorPromise = shouldCreateStoryAnchor
    ? createStoryCharacterAnchorToken({
        character: input.protagonistCharacter!,
        visualBible: storyInput.visualBible!,
        referenceCacheKey: input.storyId,
      }).catch((error) => {
        logGenerationEvent(
          {
            operation: "illustration.story_anchor",
            story: input.storyId,
            provider: "cpa",
            model: process.env.CPA_IMAGE_MODEL || "gemini-3.1-flash-image",
            status: "unavailable",
            errorClass: classifyGenerationError(error),
          },
          "warn",
        );
        return null;
      })
    : Promise.resolve(null);
  const [{ pages, coverTitle }, storyReferenceToken] = await Promise.all([
    generateStoryText(storyInput),
    storyAnchorPromise,
  ]);
  if (storyReferenceToken && input.protagonistCharacter) {
    storyInput = attachStoryReferenceToken(
      storyInput,
      input.protagonistCharacter.id,
      storyReferenceToken,
    );
  }
  const previewPages = createDemoPages(pages, storyInput.style).map((page) =>
    pageUsesFamilyPhoto(page, input.familyCharacters)
      ? { ...page, imagePlannedProvider: "cpa" as const }
      : storyInput.customCharacterReferenceToken
        ? {
            ...page,
            imagePlannedProvider: getImageToImageProviderForPage(
              page.page,
              pages.length,
            ),
          }
        : page,
  );
  const status = input.reviewBeforeIllustrations
    ? ("reviewing_outline" as const)
    : ("generating_images" as const);
  const story: GeneratedStory = {
    id: input.storyId,
    ...(input.generationPrincipalIds?.length
      ? { generationPrincipalIds: input.generationPrincipalIds }
      : {}),
    input: storyInput,
    pages: previewPages,
    coverTitle,
    createdAt: new Date().toISOString(),
    status,
    generationMode: "live",
  };
  const response = createGenerateResponse({
    storyId: input.storyId,
    storyInput,
    coverTitle,
    pages: previewPages,
    dailyLimit: input.dailyLimit,
    freeGenerationsRemaining: input.freeGenerationsRemaining,
  });
  return { story, response, status };
}

export async function generateAndPersistStory(input: {
  taskId?: string;
  storyId: string;
  storyInput: StoryInput;
  protagonistCharacter?: FamilyCharacterInput;
  familyCharacters: FamilyCharacterInput[];
  dailyLimit: number;
  freeGenerationsRemaining?: number;
  reviewBeforeIllustrations: boolean;
  generationPrincipalIds?: string[];
  publishFence?: TextGenerationPublishFence;
  publishIdentity?: TextGenerationPublishIdentity;
}) {
  const generated = await computeTextGeneration(input);
  if (input.publishFence && !(await input.publishFence())) {
    throw new StaleTextGenerationLeaseError();
  }
  if (input.publishIdentity) {
    if (!input.taskId) {
      throw new Error("Durable text publication requires a task id.");
    }
    const publishedStory = await publishTextGenerationStory({
      taskId: input.taskId,
      storyId: input.storyId,
      durableJobId: input.publishIdentity.durableJobId,
      durableJobAttempt: input.publishIdentity.durableJobAttempt,
      story: generated.story,
    });
    if (!publishedStory) throw new StaleTextGenerationLeaseError();
    return { ...generated, story: publishedStory };
  }
  await cacheStory(input.storyId, generated.story);
  return generated;
}

export async function executeTextGeneration(input: ExecuteTextGenerationInput) {
  const startedAt = Date.now();
  try {
    const generated = await generateAndPersistStory({
      taskId: input.task.taskId,
      storyId: input.task.storyId,
      storyInput: input.storyInput,
      protagonistCharacter: input.protagonistCharacter,
      familyCharacters: input.familyCharacters,
      dailyLimit: input.dailyLimit,
      freeGenerationsRemaining:
        input.freeGenerationsRemaining ?? input.task.freeGenerationsRemaining,
      reviewBeforeIllustrations: input.task.reviewBeforeIllustrations,
      generationPrincipalIds:
        input.generationPrincipalIds || input.task.generationPrincipalIds,
      publishFence: input.publishFence,
      publishIdentity: input.publishIdentity,
    });
    const completedTask: TextGenerationTask = {
      ...input.task,
      status: generated.status,
      result: generated.response,
      error: undefined,
      retryable: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (input.publishIdentity) {
      if (input.publishFence && !(await input.publishFence())) {
        throw new StaleTextGenerationLeaseError();
      }
      const published = await mutateCachedTextGenerationTask(
        input.task.taskId,
        (latestTask) => {
          if (
            latestTask.storyId !== input.task.storyId ||
            latestTask.status !== "generating_text" ||
            latestTask.durableJobId !== input.publishIdentity!.durableJobId ||
            latestTask.durableJobAttempt !==
              input.publishIdentity!.durableJobAttempt
          ) {
            return null;
          }
          return {
            nextTask: {
              ...completedTask,
              revision: latestTask.revision,
            },
            value: true,
          };
        },
        {
          publishStoryFence: {
            storyId: input.task.storyId,
            durableJobId: input.publishIdentity.durableJobId,
            durableJobAttempt: input.publishIdentity.durableJobAttempt,
          },
        },
      );
      if (!published) throw new StaleTextGenerationLeaseError();
    } else {
      await cacheTextGenerationTask(completedTask);
    }
    await input.onSuccess?.();
    logGenerationEvent({
      operation: "text.task",
      task: input.task.taskId,
      story: input.task.storyId,
      provider: "cpa",
      model: process.env.STORY_TEXT_MODEL?.trim() || "gemini-3-flash",
      status: generated.status,
      duration: Date.now() - startedAt,
    });
    return { outcome: "succeeded" as const, generated };
  } catch (error) {
    logGenerationEvent(
      {
        operation: "text.task",
        task: input.task.taskId,
        story: input.task.storyId,
        provider: "cpa",
        model: process.env.STORY_TEXT_MODEL?.trim() || "gemini-3-flash",
        status: error instanceof StaleTextGenerationLeaseError
          ? "stale_ignored"
          : "failed",
        duration: Date.now() - startedAt,
        errorClass: classifyGenerationError(error),
      },
      error instanceof StaleTextGenerationLeaseError ? "warn" : "error",
    );
    await input.onFailure?.(error);
    const completedStory = await getCachedStory(input.task.storyId).catch(
      () => null,
    );
    if (
      input.persistTerminalFailure !== false &&
      !completedStory &&
      !(error instanceof StaleTextGenerationLeaseError)
    ) {
      await cacheTextGenerationTask({
        ...input.task,
        status: "failed",
        error: SAFE_TEXT_GENERATION_ERROR,
        retryable: true,
        updatedAt: new Date().toISOString(),
      });
    }
    return { outcome: "failed" as const, error };
  }
}
