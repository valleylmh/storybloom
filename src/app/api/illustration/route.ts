import { after, NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  getImageToImageProviderForPage,
  getProviderForPage,
} from "@/lib/image-generator";
import {
  DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS,
  getImageStartedAtMs,
  isRecentPendingIllustration,
  normalizeIllustrationPageForClient,
  SAFE_ILLUSTRATION_ERROR,
} from "@/lib/illustration-request-policy";
import {
  getFreeRegenerationFallbackProviders,
} from "@/lib/illustration-regeneration-policy";
import { hasFamilyCharacterReference } from "@/lib/family-story-characters";
import { allowIpRequest } from "@/lib/request-rate-limit";
import { getCachedStory, mutateCachedStory } from "@/lib/storage";
import {
  executeIllustrationGeneration,
  getIllustrationAssetMode,
  type IllustrationAssetPrincipals,
} from "@/lib/illustration-generation-executor";
import {
  attachStoryAssetSessionCookie,
  resolveStoryAssetRequestPrincipal,
  type StoryAssetRequestPrincipal,
} from "@/lib/story-asset-principal";
import { canAccessGenerationResource } from "@/lib/generation-authorization";
import { areProductionGenerationJobsEnabled } from "@/lib/generation-job-config";
import {
  deleteGenerationJobPayload,
  putGenerationJobPayload,
} from "@/lib/generation-job-payloads";
import {
  enqueueGenerationJob,
  getGenerationJob,
  getGenerationJobByIdempotencyKey,
  type GenerationJob,
} from "@/lib/generation-jobs";
import {
  classifyGenerationError,
  logGenerationEvent,
} from "@/lib/generation-observability";
import type { GeneratedStory } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_ILLUSTRATION_RATE_LIMIT_PER_STORY = 64;

function matchesIllustrationGenerationJob(input: {
  job: GenerationJob | null;
  storyId: string;
  page: number;
  attemptId: string;
  payloadRef: string;
}) {
  return Boolean(
    input.job &&
      input.job.kind === "illustration" &&
      input.job.storyId === input.storyId &&
      input.job.page === input.page &&
      input.job.generationAttemptId === input.attemptId &&
      input.job.payloadRef === input.payloadRef,
  );
}

function getIllustrationRateLimitPerStory() {
  const configured = Number.parseInt(
    process.env.ILLUSTRATION_RATE_LIMIT_PER_STORY || "",
    10,
  );
  return Number.isFinite(configured) && configured >= 8
    ? configured
    : DEFAULT_ILLUSTRATION_RATE_LIMIT_PER_STORY;
}

const illustrationSchema = z.object({
  storyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  page: z.number().int().min(1).max(8),
  regenerationMode: z.enum(["free-fallback"]).optional(),
});

const illustrationQuerySchema = z.object({
  storyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  page: z.coerce.number().int().min(1).max(8),
});

function getPagePayload(story: GeneratedStory, pageNumber: number) {
  const page = story.pages.find((item) => item.page === pageNumber);
  if (!page) {
    return null;
  }

  return {
    page: normalizeIllustrationPageForClient(
      areProductionGenerationJobsEnabled()
        ? page
        : {
            ...page,
            imageDurableJob: undefined,
            imageJobId: undefined,
          },
    ),
    allComplete: story.pages.every((item) => item.imageStatus === "complete"),
  };
}

function pageUsesFamilyPhoto(
  story: GeneratedStory,
  page: GeneratedStory["pages"][number],
) {
  const castIds = new Set(page.castIds || []);
  return Boolean(
    story.input.familyCharacters?.some(
      (character) =>
        castIds.has(character.id) && hasFamilyCharacterReference(character),
    ),
  );
}

type PagePendingValue = {
  started: boolean;
  attemptId: string | null;
};

type PagePendingResult = PagePendingValue & {
  story: GeneratedStory;
};

async function markPagePending(
  story: GeneratedStory,
  pageNumber: number,
  durable: boolean,
): Promise<PagePendingResult | null> {
  const attemptId = crypto.randomUUID();
  const outcome = await mutateCachedStory<PagePendingValue>(
    story.id,
    (latestStory) => {
      const targetPage = latestStory.pages.find(
        (page) => page.page === pageNumber,
      );
      if (!targetPage) return null;
      if (
        isRecentPendingIllustration(
          durable
            ? targetPage
            : {
                ...targetPage,
                imageDurableJob: undefined,
                imageJobId: undefined,
              },
        )
      ) {
        return { value: { started: false, attemptId: null } };
      }

      const startedAt = new Date().toISOString();
      const plannedProvider = pageUsesFamilyPhoto(latestStory, targetPage)
        ? "cpa"
        : latestStory.input.customCharacterReferenceToken
          ? getImageToImageProviderForPage(pageNumber, latestStory.pages.length)
          : getProviderForPage(pageNumber, latestStory.pages.length);
      const pages = latestStory.pages.map((page) =>
        page.page === pageNumber
          ? {
              ...page,
              imageStatus: "pending" as const,
              imageError: undefined,
              imagePlannedProvider: plannedProvider,
              imageProvider: undefined,
              imageStartedAt: startedAt,
              imageAttemptId: attemptId,
              imageDurableJob: durable || undefined,
              imageJobId: undefined,
              imageCompletedAt: undefined,
              imageDurationMs: undefined,
              imageAttempts: [],
            }
          : page,
      );
      return {
        nextStory: {
          ...latestStory,
          pages,
          status: "generating_images",
          generationMode: "live",
        },
        value: { started: true, attemptId },
      };
    },
  );

  return outcome
    ? { story: outcome.story, ...outcome.value }
    : null;
}

async function rollbackPagePending(input: {
  storyId: string;
  pageNumber: number;
  attemptId: string;
}) {
  await mutateCachedStory(input.storyId, (latestStory) => {
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
      page.page === input.pageNumber
        ? {
            ...latestPage,
            imageStatus: "failed" as const,
            imageError: "插图任务暂时无法创建，请稍后重试。",
            imageAttemptId: undefined,
            imageDurableJob: undefined,
            imageJobId: undefined,
            imageCompletedAt: new Date().toISOString(),
          }
        : page,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: pages.some(
          (page) => page.imageStatus === "pending" || page.imageStatus === "demo",
        )
          ? ("generating_images" as const)
          : ("partially_failed" as const),
        generationMode: "live" as const,
      },
      value: true,
    };
  });
}

type DurablePageJobState =
  | { state: "active"; story: GeneratedStory }
  | { state: "completed"; story: GeneratedStory }
  | { state: "retryable"; story: GeneratedStory }
  | { state: "unknown"; story: GeneratedStory };

function isMatchingIllustrationPageJob(
  job: GenerationJob | null,
  story: GeneratedStory,
  pageNumber: number,
) {
  const page = story.pages.find((item) => item.page === pageNumber);
  return Boolean(
    job &&
      page &&
      job.kind === "illustration" &&
      job.storyId === story.id &&
      job.page === pageNumber &&
      job.generationAttemptId === page.imageAttemptId,
  );
}

function isPastDurableRecoveryThreshold(
  story: GeneratedStory,
  pageNumber: number,
) {
  const page = story.pages.find((item) => item.page === pageNumber);
  const startedAtMs = page ? getImageStartedAtMs(page) : null;
  return (
    startedAtMs !== null &&
    Date.now() - startedAtMs > DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS
  );
}

async function attachIllustrationJobToPage(input: {
  storyId: string;
  pageNumber: number;
  attemptId: string;
  jobId: string;
}) {
  return mutateCachedStory(input.storyId, (latestStory) => {
    const page = latestStory.pages.find(
      (item) => item.page === input.pageNumber,
    );
    if (
      !page ||
      page.imageStatus !== "pending" ||
      page.imageAttemptId !== input.attemptId
    ) {
      return null;
    }
    if (page.imageDurableJob && page.imageJobId === input.jobId) {
      return { value: true };
    }
    const pages = latestStory.pages.map((item) =>
      item.page === input.pageNumber
        ? {
            ...item,
            imageDurableJob: true,
            imageJobId: input.jobId,
          }
        : item,
    );
    return {
      nextStory: { ...latestStory, pages },
      value: true,
    };
  });
}

async function markMissingDurableIllustrationFailed(input: {
  storyId: string;
  pageNumber: number;
  attemptId: string;
}) {
  return mutateCachedStory(input.storyId, (latestStory) => {
    const page = latestStory.pages.find(
      (item) => item.page === input.pageNumber,
    );
    if (
      !page ||
      page.imageStatus !== "pending" ||
      page.imageAttemptId !== input.attemptId
    ) {
      return null;
    }
    const completedAt = new Date().toISOString();
    const startedAtMs = getImageStartedAtMs(page);
    const pages = latestStory.pages.map((item) =>
      item.page === input.pageNumber
        ? {
            ...item,
            imageStatus: "failed" as const,
            imageError: SAFE_ILLUSTRATION_ERROR,
            imageAttemptId: undefined,
            imageDurableJob: undefined,
            imageJobId: undefined,
            imageCompletedAt: completedAt,
            imageDurationMs:
              startedAtMs === null
                ? undefined
                : Math.max(0, Date.now() - startedAtMs),
          }
        : item,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: pages.some(
          (item) =>
            item.imageStatus === "pending" || item.imageStatus === "demo",
        )
          ? ("generating_images" as const)
          : ("partially_failed" as const),
      },
      value: true,
    };
  });
}

async function reconcileDurableFailure(input: {
  story: GeneratedStory;
  pageNumber: number;
  attemptId: string;
}): Promise<DurablePageJobState> {
  const failed = await markMissingDurableIllustrationFailed({
    storyId: input.story.id,
    pageNumber: input.pageNumber,
    attemptId: input.attemptId,
  });
  if (failed) return { state: "retryable", story: failed.story };

  // A worker may have published while the status request was reconciling.
  // Re-read instead of allowing the stale request snapshot to overwrite it.
  const refreshed = (await getCachedStory(input.story.id)) || input.story;
  const refreshedPage = refreshed.pages.find(
    (item) => item.page === input.pageNumber,
  );
  return refreshedPage?.imageStatus === "pending"
    ? { state: "unknown", story: refreshed }
    : { state: "completed", story: refreshed };
}

async function reconcileDurablePageJob(
  story: GeneratedStory,
  pageNumber: number,
): Promise<DurablePageJobState | null> {
  const page = story.pages.find((item) => item.page === pageNumber);
  if (
    !areProductionGenerationJobsEnabled() ||
    !page ||
    page.imageStatus !== "pending" ||
    (!page.imageDurableJob && !page.imageJobId)
  ) {
    return null;
  }

  if (!page.imageJobId) {
    return {
      state: isPastDurableRecoveryThreshold(story, pageNumber)
        ? "retryable"
        : "unknown",
      story,
    };
  }

  let job: GenerationJob | null;
  try {
    job = await getGenerationJob(page.imageJobId);
  } catch (error) {
    logGenerationEvent(
      {
        operation: "illustration.job_status",
        story: story.id,
        page: pageNumber,
        status: "unknown",
        errorClass: classifyGenerationError(error),
      },
      "warn",
    );
    return { state: "unknown", story };
  }

  if (!isMatchingIllustrationPageJob(job, story, pageNumber)) {
    if (!isPastDurableRecoveryThreshold(story, pageNumber)) {
      return { state: "unknown", story };
    }
    return reconcileDurableFailure({
      story,
      pageNumber,
      attemptId: page.imageAttemptId!,
    });
  }

  if (job!.status === "queued" || job!.status === "running") {
    return { state: "active", story };
  }

  const latestStory = (await getCachedStory(story.id)) || story;
  const latestPage = latestStory.pages.find((item) => item.page === pageNumber);
  if (latestPage?.imageStatus !== "pending") {
    return { state: "completed", story: latestStory };
  }
  if (job!.status === "succeeded") {
    // The worker may have completed the queue record immediately before the
    // Story read. Keep polling within the recovery window; after that, the
    // absent publish is an explicit failed attempt rather than live work.
    if (!isPastDurableRecoveryThreshold(latestStory, pageNumber)) {
      return { state: "unknown", story: latestStory };
    }
  }
  if (!isPastDurableRecoveryThreshold(latestStory, pageNumber)) {
    // A terminal queue record can become visible just before its cleanup CAS
    // reaches the Story. Preserve that bounded reconciliation window rather
    // than racing cleanup with a replacement attempt.
    return { state: "unknown", story: latestStory };
  }

  return reconcileDurableFailure({
    story: latestStory,
    pageNumber,
    attemptId: latestPage.imageAttemptId!,
  });
}

function illustrationAssetPrincipals(
  resolved: StoryAssetRequestPrincipal,
): IllustrationAssetPrincipals {
  return {
    ownerPrincipal: resolved.anonymousPrincipal,
    ...(resolved.userPrincipal
      ? { grantedPrincipal: resolved.userPrincipal }
      : {}),
  };
}

function withAssetSessionCookie<T extends NextResponse>(
  response: T,
  resolved?: StoryAssetRequestPrincipal,
) {
  return resolved
    ? attachStoryAssetSessionCookie(response, resolved)
    : response;
}

function responseWithAssetSession(
  response: NextResponse,
  resolved: StoryAssetRequestPrincipal | null,
) {
  return withAssetSessionCookie(response, resolved || undefined);
}

export async function GET(req: NextRequest) {
  const parsed = illustrationQuerySchema.safeParse({
    storyId: req.nextUrl.searchParams.get("storyId"),
    page: req.nextUrl.searchParams.get("page"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "插图查询参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const assetMode = getIllustrationAssetMode();
  if (assetMode.reason === "storage_not_ready") {
    return NextResponse.json(
      { error: "插图资产服务暂不可用，请稍后重试。" },
      { status: 503 },
    );
  }
  const resolvedPrincipal = assetMode.enabled
    ? await resolveStoryAssetRequestPrincipal(req).catch(() => null)
    : null;
  if (assetMode.enabled && !resolvedPrincipal) {
    return NextResponse.json(
      { error: "插图资产服务暂不可用，请稍后重试。" },
      { status: 503 },
    );
  }

  const story = await getCachedStory(parsed.data.storyId);
  if (!story) {
    return withAssetSessionCookie(
      NextResponse.json(
        { error: "没有找到对应故事，请重新生成。" },
        { status: 404 },
      ),
      resolvedPrincipal || undefined,
    );
  }
  const authorizationPrincipal = story.generationPrincipalIds?.length
    ? resolvedPrincipal ||
      (await resolveStoryAssetRequestPrincipal(req).catch(() => null))
    : resolvedPrincipal;
  if (
    story.generationPrincipalIds?.length &&
    (!authorizationPrincipal ||
      !canAccessGenerationResource(story, authorizationPrincipal))
  ) {
    return responseWithAssetSession(
      NextResponse.json(
        { error: "没有找到对应故事，请重新生成。" },
        { status: 404 },
      ),
      authorizationPrincipal,
    );
  }

  const durableState = await reconcileDurablePageJob(story, parsed.data.page);
  const responseStory = durableState?.story || story;
  const payload = getPagePayload(responseStory, parsed.data.page);
  if (!payload) {
    return responseWithAssetSession(
      NextResponse.json({ error: "没有找到对应页面。" }, { status: 404 }),
      authorizationPrincipal,
    );
  }

  if (durableState?.state === "active" || durableState?.state === "unknown") {
    return responseWithAssetSession(
      NextResponse.json(
        { status: "accepted", ...payload, reused: true },
        { status: 202 },
      ),
      authorizationPrincipal,
    );
  }

  return responseWithAssetSession(
    NextResponse.json(payload),
    authorizationPrincipal,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = illustrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "插图参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const assetMode = getIllustrationAssetMode();
  if (assetMode.reason === "storage_not_ready") {
    return NextResponse.json(
      { error: "插图资产服务暂不可用，请稍后重试。" },
      { status: 503 },
    );
  }
  const resolvedPrincipal = assetMode.enabled
    ? await resolveStoryAssetRequestPrincipal(req).catch(() => null)
    : null;
  if (assetMode.enabled && !resolvedPrincipal) {
    return NextResponse.json(
      { error: "插图资产服务暂不可用，请稍后重试。" },
      { status: 503 },
    );
  }

  const story = await getCachedStory(parsed.data.storyId);
  if (!story) {
    return responseWithAssetSession(
      NextResponse.json(
        { error: "没有找到对应故事，请重新生成。" },
        { status: 404 },
      ),
      resolvedPrincipal,
    );
  }
  const authorizationPrincipal = story.generationPrincipalIds?.length
    ? resolvedPrincipal ||
      (await resolveStoryAssetRequestPrincipal(req).catch(() => null))
    : resolvedPrincipal;
  if (
    story.generationPrincipalIds?.length &&
    (!authorizationPrincipal ||
      !canAccessGenerationResource(story, authorizationPrincipal))
  ) {
    return responseWithAssetSession(
      NextResponse.json(
        { error: "没有找到对应故事，请重新生成。" },
        { status: 404 },
      ),
      authorizationPrincipal,
    );
  }

  if (["generating_text", "reviewing_outline"].includes(story.status)) {
    return responseWithAssetSession(
      NextResponse.json(
        { error: "请先确认故事大纲，再开始生成插图。" },
        { status: 409 },
      ),
      authorizationPrincipal,
    );
  }

  const initialTargetPage = story.pages.find(
    (page) => page.page === parsed.data.page,
  );
  if (!initialTargetPage) {
    return responseWithAssetSession(
      NextResponse.json({ error: "没有找到对应页面。" }, { status: 404 }),
      authorizationPrincipal,
    );
  }

  const durableState = await reconcileDurablePageJob(story, parsed.data.page);
  const currentStory = durableState?.story || story;
  const targetPage = currentStory.pages.find(
    (page) => page.page === parsed.data.page,
  );
  if (!targetPage) {
    return responseWithAssetSession(
      NextResponse.json({ error: "没有找到对应页面。" }, { status: 404 }),
      authorizationPrincipal,
    );
  }

  if (durableState?.state === "active" || durableState?.state === "unknown") {
    const payload = getPagePayload(currentStory, parsed.data.page);
    return responseWithAssetSession(
      NextResponse.json(
        {
          status: "accepted",
          page: payload?.page || targetPage,
          allComplete: false,
          reused: true,
        },
        { status: 202 },
      ),
      authorizationPrincipal,
    );
  }
  if (durableState?.state === "completed") {
    const payload = getPagePayload(currentStory, parsed.data.page);
    return responseWithAssetSession(
      NextResponse.json(payload),
      authorizationPrincipal,
    );
  }

  if (
    isRecentPendingIllustration(
      areProductionGenerationJobsEnabled()
        ? targetPage
        : {
            ...targetPage,
            imageDurableJob: undefined,
            imageJobId: undefined,
          },
    )
  ) {
    const payload = getPagePayload(story, parsed.data.page);
    return responseWithAssetSession(
      NextResponse.json(
        {
          status: "accepted",
          page: payload?.page || targetPage,
          allComplete: false,
          reused: true,
        },
        { status: 202 },
      ),
      authorizationPrincipal,
    );
  }

  const rateLimit = getIllustrationRateLimitPerStory();
  if (
    !(await allowIpRequest(req, {
      limit: rateLimit,
      window: "1 h",
      windowMs: 60 * 60 * 1000,
      prefix: "illustration",
      identifier: parsed.data.storyId,
    }))
  ) {
    return responseWithAssetSession(
      NextResponse.json(
        { error: "这本绘本的插图重试次数较多，请稍后再试。" },
        {
          status: 429,
          headers: {
            "Retry-After": "3600",
            "X-RateLimit-Limit": String(rateLimit),
          },
        },
      ),
      authorizationPrincipal,
    );
  }

  const productionJobsEnabled = areProductionGenerationJobsEnabled();
  const pending = await markPagePending(
    currentStory,
    parsed.data.page,
    productionJobsEnabled,
  );
  if (!pending) {
    return responseWithAssetSession(
      NextResponse.json(
        { error: "故事状态已经变化，请刷新后重试。" },
        { status: 409 },
      ),
      authorizationPrincipal,
    );
  }
  let responseStory = pending.story;

  if (!pending.started || !pending.attemptId) {
    return responseWithAssetSession(
      NextResponse.json(
        {
          status: "accepted",
          page:
            getPagePayload(responseStory, parsed.data.page)?.page || targetPage,
          allComplete: false,
          reused: true,
        },
        { status: 202 },
      ),
      authorizationPrincipal,
    );
  }

  if (productionJobsEnabled) {
    let payloadRef: string | null = null;
    const idempotencyKey = `illustration:${pending.story.id}:${parsed.data.page}:${pending.attemptId}`;
    try {
      if (!authorizationPrincipal) {
        throw new Error("Illustration job principal is unavailable.");
      }
      payloadRef = await putGenerationJobPayload({
        kind: "illustration",
        assetPrincipals: illustrationAssetPrincipals(authorizationPrincipal),
        ...(parsed.data.regenerationMode === "free-fallback"
          ? { fallbackMode: "free-fallback" as const }
          : {}),
      });
      const enqueued = await enqueueGenerationJob({
        kind: "illustration",
        storyId: pending.story.id,
        page: parsed.data.page,
        generationAttemptId: pending.attemptId,
        payloadRef,
        idempotencyKey,
      });
      const attached = await attachIllustrationJobToPage({
        storyId: pending.story.id,
        pageNumber: parsed.data.page,
        attemptId: pending.attemptId,
        jobId: enqueued.job.jobId,
      }).catch((error) => {
        logGenerationEvent(
          {
            operation: "illustration.job_attach",
            story: pending.story.id,
            page: parsed.data.page,
            status: "unknown",
            errorClass: classifyGenerationError(error),
          },
          "warn",
        );
        return null;
      });
      if (attached) responseStory = attached.story;
    } catch (error) {
      let reconciledJob: GenerationJob | null = null;
      let reconciliationUnknown = false;
      if (payloadRef) {
        try {
          reconciledJob = await getGenerationJobByIdempotencyKey(idempotencyKey);
        } catch (lookupError) {
          reconciliationUnknown = true;
          logGenerationEvent(
            {
              operation: "illustration.job_enqueue_reconcile",
              story: pending.story.id,
              page: parsed.data.page,
              status: "unknown",
              errorClass: classifyGenerationError(lookupError),
            },
            "warn",
          );
        }
      }
      if (
        !payloadRef ||
        (!reconciliationUnknown &&
          !matchesIllustrationGenerationJob({
            job: reconciledJob,
            storyId: pending.story.id,
            page: parsed.data.page,
            attemptId: pending.attemptId,
            payloadRef,
          }))
      ) {
        if (payloadRef) {
          await deleteGenerationJobPayload(payloadRef).catch(() => false);
        }
        await rollbackPagePending({
          storyId: pending.story.id,
          pageNumber: parsed.data.page,
          attemptId: pending.attemptId,
        }).catch(() => undefined);
        return responseWithAssetSession(
          NextResponse.json(
            { error: "暂时无法创建可恢复的插图任务，请稍后重试。" },
            { status: 503 },
          ),
          authorizationPrincipal,
        );
      }
      if (reconciledJob) {
        const attached = await attachIllustrationJobToPage({
          storyId: pending.story.id,
          pageNumber: parsed.data.page,
          attemptId: pending.attemptId,
          jobId: reconciledJob.jobId,
        }).catch(() => null);
        if (attached) responseStory = attached.story;
      }
      logGenerationEvent({
        operation: "illustration.job_enqueue_reconcile",
        story: pending.story.id,
        page: parsed.data.page,
        status: reconciliationUnknown ? "accepted_unknown" : "committed",
        ...(reconciliationUnknown
          ? { errorClass: classifyGenerationError(error) }
          : {}),
      });
    }
  } else {
    after(async () => {
      await executeIllustrationGeneration({
        story: pending.story,
        pageNumber: parsed.data.page,
        attemptId: pending.attemptId!,
        fallbackProviders:
          parsed.data.regenerationMode === "free-fallback"
            ? getFreeRegenerationFallbackProviders()
            : undefined,
        ...(authorizationPrincipal
          ? { assetPrincipals: illustrationAssetPrincipals(authorizationPrincipal) }
          : {}),
      });
    });
  }

  return responseWithAssetSession(
    NextResponse.json(
      {
        status: "accepted",
        page:
          getPagePayload(responseStory, parsed.data.page)?.page || {
            ...targetPage,
            imageStatus: "pending",
          },
        allComplete: false,
      },
      { status: 202 },
    ),
    authorizationPrincipal,
  );
}
