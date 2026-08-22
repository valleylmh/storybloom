import "server-only";

import { regeneratePage } from "@/lib/image-generator";
import { areProductionGenerationJobsEnabled } from "@/lib/generation-job-config";
import { SAFE_ILLUSTRATION_ERROR } from "@/lib/illustration-request-policy";
import { getStorageCapabilities, mutateCachedStory } from "@/lib/storage";
import {
  commitTemporaryStoryAsset,
  deleteTemporaryStoryAsset,
  discardTemporaryStoryAsset,
  getTemporaryStoryAssetCapabilities,
  grantTemporaryStoryAssetPrincipal,
  putTemporaryStoryAsset,
  type TemporaryStoryAssetPrincipal,
} from "@/lib/temporary-story-asset-store";
import {
  classifyGenerationError,
  logGenerationEvent,
} from "@/lib/generation-observability";
import type { GeneratedStory, ImageProvider, StoryPage } from "@/types";

export type IllustrationAssetPrincipals = {
  /**
   * Assets are owned by the same-device anonymous principal because ordinary
   * <img> requests cannot attach an authenticated Bearer token.
   */
  ownerPrincipal: TemporaryStoryAssetPrincipal;
  /** An authenticated user may receive an additional read grant. */
  grantedPrincipal?: TemporaryStoryAssetPrincipal;
};

export type ExecuteIllustrationGenerationInput = {
  story: GeneratedStory;
  pageNumber: number;
  attemptId: string;
  fallbackProviders?: ImageProvider[];
  assetPrincipals?: IllustrationAssetPrincipals;
  /** Durable workers own retry/dead state and must keep the page pending. */
  persistTerminalFailure?: boolean;
  /** Must atomically renew the current durable lease immediately before publish. */
  publishFence?: () => Promise<boolean>;
};

export type IllustrationGenerationOutcome =
  | { outcome: "succeeded" }
  | { outcome: "failed"; error: unknown }
  | { outcome: "stale" };

export type IllustrationAssetMode =
  | { enabled: false; reason: "flag_disabled" }
  | { enabled: false; reason: "storage_not_ready" }
  | { enabled: true; reason: null };

type PendingStoredAsset = {
  assetId: string;
  lease: string;
  imageUrl: string;
};

export function getIllustrationAssetMode(): IllustrationAssetMode {
  if (getTemporaryStoryAssetCapabilities().configurationReady) {
    return { enabled: true, reason: null };
  }
  return areProductionGenerationJobsEnabled() || getStorageCapabilities().shared
    ? { enabled: false, reason: "storage_not_ready" }
    : { enabled: false, reason: "flag_disabled" };
}

function getStoryIllustrationStatus(pages: GeneratedStory["pages"]) {
  if (pages.length > 0 && pages.every((page) => page.imageStatus === "complete")) {
    return "complete" as const;
  }

  if (
    pages.some(
      (page) => page.imageStatus === "pending" || page.imageStatus === "demo",
    )
  ) {
    return "generating_images" as const;
  }

  return pages.some((page) => page.imageStatus === "failed")
    ? ("partially_failed" as const)
    : ("generating_images" as const);
}

function principalsDiffer(
  left: TemporaryStoryAssetPrincipal,
  right: TemporaryStoryAssetPrincipal,
) {
  return left.type !== right.type || left.id !== right.id;
}

async function prepareTemporaryAsset(input: {
  source: string;
  storyId: string;
  page: number;
  attemptId: string;
  principals: IllustrationAssetPrincipals;
}) {
  const stored = await putTemporaryStoryAsset(
    {
      source: input.source,
      storyId: input.storyId,
      page: input.page,
      attemptId: input.attemptId,
      principal: input.principals.ownerPrincipal,
    },
    { requireDurable: true },
  );

  if (stored.kind === "passthrough") {
    return { imageUrl: stored.imageUrl, pendingAsset: null };
  }

  const pendingAsset: PendingStoredAsset = {
    assetId: stored.assetId,
    lease: stored.lease,
    imageUrl: stored.imageUrl,
  };

  try {
    if (
      input.principals.grantedPrincipal &&
      principalsDiffer(
        input.principals.ownerPrincipal,
        input.principals.grantedPrincipal,
      )
    ) {
      const granted = await grantTemporaryStoryAssetPrincipal({
        assetId: stored.assetId,
        lease: stored.lease,
        ownerPrincipal: input.principals.ownerPrincipal,
        grantedPrincipal: input.principals.grantedPrincipal,
      });
      if (!granted) {
        throw new Error("Temporary story asset principal grant was rejected.");
      }
    }
    return { imageUrl: stored.imageUrl, pendingAsset };
  } catch (error) {
    await discardTemporaryStoryAsset({
      assetId: stored.assetId,
      lease: stored.lease,
      principal: input.principals.ownerPrincipal,
    }).catch(() => false);
    throw error;
  }
}

async function discardPendingAsset(
  asset: PendingStoredAsset | null,
  principals: IllustrationAssetPrincipals | undefined,
) {
  if (!asset || !principals) return;
  await discardTemporaryStoryAsset({
    assetId: asset.assetId,
    lease: asset.lease,
    principal: principals.ownerPrincipal,
  }).catch(() => false);
}

async function deleteStoredAsset(
  asset: PendingStoredAsset,
  principals: IllustrationAssetPrincipals,
) {
  const discarded = await discardTemporaryStoryAsset({
    assetId: asset.assetId,
    lease: asset.lease,
    principal: principals.ownerPrincipal,
  }).catch(() => false);
  if (discarded) return;
  await deleteTemporaryStoryAsset({
    assetId: asset.assetId,
    principal: principals.ownerPrincipal,
  }).catch(() => false);
}

function getIllustrationDurationMs(page: StoryPage) {
  if (!page.imageStartedAt) return page.imageDurationMs;
  const startedAtMs = new Date(page.imageStartedAt).getTime();
  return Number.isFinite(startedAtMs)
    ? Math.max(0, Date.now() - startedAtMs)
    : page.imageDurationMs;
}

function isIllustrationRetry(page: StoryPage) {
  return (page.imageRetryCount || 0) > 0;
}

function getIllustrationMetricFields(
  targetPage: StoryPage,
  completedPage?: StoryPage,
) {
  return {
    duration: getIllustrationDurationMs(targetPage),
    attempt: targetPage.imageRequestCount,
    retry: isIllustrationRetry(targetPage),
    width: completedPage?.imageQuality?.width,
    height: completedPage?.imageQuality?.height,
    qualityChecked: Boolean(completedPage?.imageQuality),
    qualityWarnings: completedPage?.imageQuality?.warnings?.length || 0,
  };
}

function logIllustrationSuccess(input: {
  storyId: string;
  pageNumber: number;
  targetPage: StoryPage;
  completedPage: StoryPage;
  pages: StoryPage[];
}) {
  const metricFields = getIllustrationMetricFields(
    input.targetPage,
    input.completedPage,
  );
  logGenerationEvent({
    operation: "illustration.commit",
    story: input.storyId,
    page: input.pageNumber,
    status: "succeeded",
    ...metricFields,
  });

  if (metricFields.retry) {
    logGenerationEvent({
      operation: "illustration.retry_outcome",
      story: input.storyId,
      page: input.pageNumber,
      status: "succeeded",
      ...metricFields,
    });
  }

  if (input.pages.length > 0 && input.pages.every((page) => page.imageStatus === "complete")) {
    const qualityCheckedPages = input.pages.filter(
      (page) => page.imageQuality && page.imageQuality.status !== "demo",
    ).length;
    const qualityWarningPages = input.pages.filter(
      (page) => page.imageQuality?.status === "warning",
    ).length;
    logGenerationEvent({
      operation: "illustration.quality_summary",
      story: input.storyId,
      status:
        qualityCheckedPages < input.pages.length
          ? "partial"
          : qualityWarningPages > 0
            ? "warning"
            : "passed",
      qualityChecked: qualityCheckedPages === input.pages.length,
      qualityWarnings: qualityWarningPages,
    });
  }
}

function completedPageWithImage(
  updatedPage: StoryPage,
  imageUrl: string,
  durationMs: number | undefined,
) {
  return {
    ...updatedPage,
    imageUrl,
    imageDurationMs: durationMs,
    imageAttemptId: undefined,
    imageDurableJob: undefined,
    imageJobId: undefined,
  };
}

async function persistIllustrationFailure(input: {
  story: GeneratedStory;
  pageNumber: number;
  attemptId: string;
  targetPage: StoryPage;
  error: unknown;
  expectedImageUrl?: string;
}) {
  const durationMs = input.targetPage.imageStartedAt
    ? Math.max(
        0,
        Date.now() - new Date(input.targetPage.imageStartedAt).getTime(),
      )
    : undefined;
  const outcome = await mutateCachedStory(input.story.id, (latestStory) => {
    const latestPage = latestStory.pages.find(
      (page) => page.page === input.pageNumber,
    );
    if (
      !latestPage ||
      latestPage.imageStatus !== "pending" ||
      latestPage.imageAttemptId !== input.attemptId ||
      (input.expectedImageUrl !== undefined &&
        latestPage.imageUrl !== input.expectedImageUrl)
    ) {
      return null;
    }
    const failedPage = {
      ...latestPage,
      ...(input.expectedImageUrl !== undefined ? { imageUrl: undefined } : {}),
      imageStatus: "failed" as const,
      imageError: SAFE_ILLUSTRATION_ERROR,
      imageAttemptId: undefined,
      imageDurableJob: undefined,
      imageJobId: undefined,
      imageCompletedAt: new Date().toISOString(),
      imageDurationMs: durationMs,
    };
    const pages = latestStory.pages.map((page) =>
      page.page === failedPage.page ? failedPage : page,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: getStoryIllustrationStatus(pages),
        generationMode: "live" as const,
      },
      value: true,
    };
  });
  logGenerationEvent(
    {
      operation: "illustration.commit",
      story: input.story.id,
      page: input.pageNumber,
      status: outcome ? "failed" : "stale_ignored",
      duration: durationMs,
      errorClass: outcome
        ? classifyGenerationError(input.error)
        : "stale_result",
    },
    outcome ? "error" : "warn",
  );
  if (outcome && isIllustrationRetry(input.targetPage)) {
    logGenerationEvent(
      {
        operation: "illustration.retry_outcome",
        story: input.story.id,
        page: input.pageNumber,
        status: "failed",
        ...getIllustrationMetricFields(input.targetPage),
        errorClass: classifyGenerationError(input.error),
      },
      "warn",
    );
  }
  return outcome;
}

async function removeDeletedAssetReference(input: {
  storyId: string;
  pageNumber: number;
  attemptId: string;
  imageUrl: string;
}) {
  return mutateCachedStory(input.storyId, (latestStory) => {
    const latestPage = latestStory.pages.find(
      (page) => page.page === input.pageNumber,
    );
    if (!latestPage || latestPage.imageUrl !== input.imageUrl) return null;

    const isDifferentActiveAttempt =
      latestPage.imageStatus === "pending" &&
      latestPage.imageAttemptId !== input.attemptId;
    const replacement = isDifferentActiveAttempt
      ? latestPage
      : {
          ...latestPage,
          imageUrl: undefined,
          imageStatus: "failed" as const,
          imageError: SAFE_ILLUSTRATION_ERROR,
          imageAttemptId: undefined,
          imageDurableJob: undefined,
          imageJobId: undefined,
          imageCompletedAt: new Date().toISOString(),
        };
    if (isDifferentActiveAttempt) return null;
    const pages = latestStory.pages.map((page) =>
      page.page === input.pageNumber ? replacement : page,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: getStoryIllustrationStatus(pages),
        generationMode: "live" as const,
      },
      value: true,
    };
  });
}

async function removeStagedAssetReference(input: {
  storyId: string;
  pageNumber: number;
  attemptId: string;
  imageUrl: string;
}) {
  return mutateCachedStory(input.storyId, (latestStory) => {
    const latestPage = latestStory.pages.find(
      (page) => page.page === input.pageNumber,
    );
    if (
      !latestPage ||
      latestPage.imageStatus !== "pending" ||
      latestPage.imageAttemptId !== input.attemptId ||
      latestPage.imageUrl !== input.imageUrl
    ) {
      return null;
    }
    const pages = latestStory.pages.map((page) =>
      page.page === input.pageNumber
        ? { ...latestPage, imageUrl: undefined }
        : page,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: "generating_images" as const,
        generationMode: "live" as const,
      },
      value: true,
    };
  });
}

async function publishFenceIsCurrent(
  publishFence: ExecuteIllustrationGenerationInput["publishFence"],
) {
  return publishFence ? publishFence() : true;
}

export async function executeIllustrationGeneration(
  input: ExecuteIllustrationGenerationInput,
): Promise<IllustrationGenerationOutcome> {
  const targetPage = input.story.pages.find(
    (page) => page.page === input.pageNumber,
  );
  if (!targetPage) return { outcome: "stale" };

  let pendingAsset: PendingStoredAsset | null = null;
  let updatedPage: StoryPage;
  let persistedImageUrl: string | undefined;
  const durationMs = () => getIllustrationDurationMs(targetPage);

  try {
    updatedPage = await regeneratePage(
      targetPage,
      Math.floor(Math.random() * 999999),
      input.story.input.style,
      input.story.input.characterReferenceId,
      input.fallbackProviders,
      input.story.input.familyCharacters,
      input.story.input.customCharacterReferenceToken,
      input.story.input.visualBible,
      input.story.id,
      input.story.id,
    );

    persistedImageUrl = updatedPage.imageUrl;
    if (input.assetPrincipals && updatedPage.imageUrl) {
      const prepared = await prepareTemporaryAsset({
        source: updatedPage.imageUrl,
        storyId: input.story.id,
        page: input.pageNumber,
        attemptId: input.attemptId,
        principals: input.assetPrincipals,
      });
      persistedImageUrl = prepared.imageUrl;
      pendingAsset = prepared.pendingAsset;
    }
  } catch (error) {
    await discardPendingAsset(pendingAsset, input.assetPrincipals);
    if (input.persistTerminalFailure !== false) {
      await persistIllustrationFailure({
        story: input.story,
        pageNumber: input.pageNumber,
        attemptId: input.attemptId,
        targetPage,
        error,
      });
    }
    return { outcome: "failed", error };
  }

  if (!(await publishFenceIsCurrent(input.publishFence))) {
    if (pendingAsset && input.assetPrincipals) {
      await deleteStoredAsset(pendingAsset, input.assetPrincipals);
    }
    return { outcome: "stale" };
  }

  if (!pendingAsset || !input.assetPrincipals) {
    const outcome = await mutateCachedStory(input.story.id, (latestStory) => {
      const latestPage = latestStory.pages.find(
        (page) => page.page === input.pageNumber,
      );
      if (
        !latestPage ||
        latestPage.imageStatus !== "pending" ||
        latestPage.imageAttemptId !== input.attemptId
      ) {
        return null;
      }
      const pages = latestStory.pages.map((page) =>
        page.page === updatedPage.page
          ? completedPageWithImage(
              updatedPage,
              persistedImageUrl || "",
              durationMs(),
            )
          : page,
      );
      return {
        nextStory: {
          ...latestStory,
          pages,
          status: getStoryIllustrationStatus(pages),
          generationMode: "live" as const,
        },
        value: true,
      };
    });

    if (!outcome) {
      logGenerationEvent(
        {
          operation: "illustration.commit",
          story: input.story.id,
          page: input.pageNumber,
          status: "stale_ignored",
          errorClass: "stale_result",
        },
        "warn",
      );
      return { outcome: "stale" };
    }
    const completedPage = outcome.story.pages.find(
      (page) => page.page === input.pageNumber,
    );
    if (completedPage) {
      logIllustrationSuccess({
        storyId: input.story.id,
        pageNumber: input.pageNumber,
        targetPage,
        completedPage,
        pages: outcome.story.pages,
      });
    }
    return { outcome: "succeeded" };
  }

  if (!(await publishFenceIsCurrent(input.publishFence))) {
    await deleteStoredAsset(pendingAsset, input.assetPrincipals);
    return { outcome: "stale" };
  }

  // Stage the opaque URL while retaining the attempt fence and pending state.
  // The asset route refuses pending bytes, so a browser cannot observe the
  // image until both the Story CAS and asset commit have succeeded.
  const staged = await mutateCachedStory(input.story.id, (latestStory) => {
    const latestPage = latestStory.pages.find(
      (page) => page.page === input.pageNumber,
    );
    if (
      !latestPage ||
      latestPage.imageStatus !== "pending" ||
      latestPage.imageAttemptId !== input.attemptId
    ) {
      return null;
    }
    const stagedPage = {
      ...updatedPage,
      imageUrl: pendingAsset.imageUrl,
      imageStatus: "pending" as const,
      imageAttemptId: input.attemptId,
    };
    const pages = latestStory.pages.map((page) =>
      page.page === input.pageNumber ? stagedPage : page,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: "generating_images" as const,
        generationMode: "live" as const,
      },
      value: true,
    };
  });

  if (!staged) {
    await deleteStoredAsset(pendingAsset, input.assetPrincipals);
    logGenerationEvent(
      {
        operation: "illustration.commit",
        story: input.story.id,
        page: input.pageNumber,
        status: "stale_ignored",
        errorClass: "stale_result",
      },
      "warn",
    );
    return { outcome: "stale" };
  }

  try {
    const committed = await commitTemporaryStoryAsset({
      assetId: pendingAsset.assetId,
      lease: pendingAsset.lease,
      principal: input.assetPrincipals.ownerPrincipal,
    });
    if (!committed) {
      throw new Error("Temporary story asset commit was rejected.");
    }
  } catch (error) {
    await deleteStoredAsset(pendingAsset, input.assetPrincipals);
    if (input.persistTerminalFailure !== false) {
      await persistIllustrationFailure({
        story: input.story,
        pageNumber: input.pageNumber,
        attemptId: input.attemptId,
        targetPage,
        error,
        expectedImageUrl: pendingAsset.imageUrl,
      });
    } else {
      await removeStagedAssetReference({
        storyId: input.story.id,
        pageNumber: input.pageNumber,
        attemptId: input.attemptId,
        imageUrl: pendingAsset.imageUrl,
      }).catch(() => null);
    }
    return { outcome: "failed", error };
  }

  if (!(await publishFenceIsCurrent(input.publishFence))) {
    await deleteStoredAsset(pendingAsset, input.assetPrincipals);
    await removeStagedAssetReference({
      storyId: input.story.id,
      pageNumber: input.pageNumber,
      attemptId: input.attemptId,
      imageUrl: pendingAsset.imageUrl,
    }).catch(() => null);
    return { outcome: "stale" };
  }

  let finalizationError: unknown;
  try {
    const finalized = await mutateCachedStory(input.story.id, (latestStory) => {
      const latestPage = latestStory.pages.find(
        (page) => page.page === input.pageNumber,
      );
      if (
        !latestPage ||
        latestPage.imageStatus !== "pending" ||
        latestPage.imageAttemptId !== input.attemptId ||
        latestPage.imageUrl !== pendingAsset.imageUrl
      ) {
        return null;
      }
      const pages = latestStory.pages.map((page) =>
        page.page === input.pageNumber
          ? completedPageWithImage(
              updatedPage,
              pendingAsset.imageUrl,
              durationMs(),
            )
          : page,
      );
      return {
        nextStory: {
          ...latestStory,
          pages,
          status: getStoryIllustrationStatus(pages),
          generationMode: "live" as const,
        },
        value: true,
      };
    });
    if (finalized) {
      const completedPage = finalized.story.pages.find(
        (page) => page.page === input.pageNumber,
      );
      if (completedPage) {
        logIllustrationSuccess({
          storyId: input.story.id,
          pageNumber: input.pageNumber,
          targetPage,
          completedPage,
          pages: finalized.story.pages,
        });
      }
      return { outcome: "succeeded" };
    }
  } catch (error) {
    finalizationError = error;
    // The committed private asset must not survive without a matching Story
    // reference. Cleanup below is deliberately best effort and idempotent.
  }

  await deleteStoredAsset(pendingAsset, input.assetPrincipals);
  if (input.persistTerminalFailure === false) {
    await removeStagedAssetReference({
      storyId: input.story.id,
      pageNumber: input.pageNumber,
      attemptId: input.attemptId,
      imageUrl: pendingAsset.imageUrl,
    }).catch(() => null);
  } else {
    await removeDeletedAssetReference({
      storyId: input.story.id,
      pageNumber: input.pageNumber,
      attemptId: input.attemptId,
      imageUrl: pendingAsset.imageUrl,
    }).catch(() => null);
  }
  logGenerationEvent(
    {
      operation: "illustration.commit",
      story: input.story.id,
      page: input.pageNumber,
      status: "stale_ignored",
      errorClass: "stale_result",
    },
    "warn",
  );
  return finalizationError
    ? { outcome: "failed", error: finalizationError }
    : { outcome: "stale" };
}

export async function markIllustrationAttemptFailed(input: {
  storyId: string;
  pageNumber: number;
  attemptId: string;
  error?: unknown;
}) {
  const story = await mutateCachedStory(input.storyId, (latestStory) => {
    const targetPage = latestStory.pages.find(
      (page) => page.page === input.pageNumber,
    );
    if (
      !targetPage ||
      targetPage.imageStatus !== "pending" ||
      targetPage.imageAttemptId !== input.attemptId
    ) {
      return null;
    }
    return { value: { story: latestStory, targetPage } };
  });
  if (!story) return false;
  return Boolean(
    await persistIllustrationFailure({
      story: story.value.story,
      pageNumber: input.pageNumber,
      attemptId: input.attemptId,
      targetPage: story.value.targetPage,
      error: input.error || new Error("Illustration generation job exhausted retries."),
    }),
  );
}
