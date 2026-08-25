import { after, NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createDemoPages } from "@/lib/image-generator";
import { getClientIp } from "@/lib/request-rate-limit";
import {
  cacheStory,
  cacheTextGenerationTask,
  createTextGenerationTaskIfAbsent,
  getCachedCharacterReference,
  getCachedStory,
  getCachedTextGenerationTask,
  getDailyFreeGenerationLimit,
  mutateCachedStory,
  rateLimiter,
} from "@/lib/storage";
import { normalizeCharacterName } from "@/lib/story-input";
import { buildStoryVisualBible } from "@/lib/story-visual-bible";
import {
  createPublicStoryInput,
} from "@/lib/family-story-characters";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { AuthenticationError, requireAuthenticatedUser } from "@/lib/supabase/server-auth";
import {
  classifyGenerationError,
  logGenerationEvent,
} from "@/lib/generation-observability";
import { GenerationProviderError } from "@/lib/generation-error";
import { areProductionGenerationJobsEnabled } from "@/lib/generation-job-config";
import {
  deleteGenerationJobPayload,
  putGenerationJobPayload,
} from "@/lib/generation-job-payloads";
import {
  enqueueGenerationJob,
  getGenerationJobByIdempotencyKey,
  type GenerationJob,
} from "@/lib/generation-jobs";
import {
  createGenerationQuotaReservationId,
  refundGenerationQuotaReservation,
  reserveGenerationQuota,
} from "@/lib/generation-quota-reservations";
import {
  attachStoryAssetSessionCookie,
  resolveStoryAssetRequestPrincipal,
  type StoryAssetRequestPrincipal,
} from "@/lib/story-asset-principal";
import {
  canAccessGenerationResource,
  getGenerationPrincipalIds,
} from "@/lib/generation-authorization";
import {
  executeTextGeneration,
  generateAndPersistStory,
} from "@/lib/text-generation-executor";
import { normalizeIllustrationPageForClient } from "@/lib/illustration-request-policy";
import { rebuildStoryPagesFromOutline } from "@/lib/story-outline-server";
import { getLibraryStorySpecByContentId } from "@/lib/library/personalization";
import {
  createPendingTextGenerationTask,
  createTextGenerationTaskResponse,
  createUnrecoverableTextGenerationTaskResponse,
  isStaleTextGenerationTask,
  type TextGenerationTask,
} from "@/lib/text-generation-task";
import type {
  FamilyCharacterInput,
  GenerateErrorResponse,
  GenerateResponse,
  GeneratedStory,
  StoryInput,
  StoryPage,
} from "@/types";

function matchesTextGenerationJob(input: {
  job: GenerationJob | null;
  storyId: string;
  taskId: string;
  payloadRef: string;
  quotaReservationId: string;
}) {
  return Boolean(
    input.job &&
      input.job.kind === "text" &&
      input.job.storyId === input.storyId &&
      input.job.taskId === input.taskId &&
      input.job.payloadRef === input.payloadRef &&
      input.job.quotaReservationId === input.quotaReservationId,
  );
}

export const runtime = "nodejs";
export const maxDuration = 300;

const personalizationAnchorSchema = z.object({
  version: z.literal(1),
  displayName: z.string().trim().min(1).max(80),
  relationship: z.string().trim().min(1).max(80),
  appearance: z.string().trim().min(1).max(1200),
  referenceType: z.enum(["canonical", "source", "text"]),
  characterId: z.string().uuid().optional(),
  storyReferenceToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,96}$/)
    .optional(),
  confirmedAt: z.string().datetime({ offset: true }),
});

const generateSchema = z.object({
  generationRequestMode: z.enum(["async"]).optional(),
  generationTaskId: z.string().regex(/^[A-Za-z0-9_-]{12,80}$/).optional(),
  reviewBeforeIllustrations: z.boolean().optional(),
  childName: z.string().min(1).max(20),
  narrativePerspective: z.enum(["third-person", "first-person"]).optional(),
  protagonistFamilyCharacterId: z.string().uuid().optional(),
  ageGroup: z.enum(["2-3", "4-5", "6-8"]),
  favoriteToy: z.string().trim().max(80).optional(),
  favoriteFood: z.string().trim().max(80).optional(),
  bestFriend: z.string().trim().max(80).optional(),
  otherDetails: z.string().trim().max(200).optional(),
  theme: z.enum(["courage", "friendship", "nature", "family", "fear", "creativity", "custom"]),
  customTheme: z.string().max(100).optional(),
  parentFacts: z.string().trim().max(300).optional(),
  allowedImaginations: z.string().trim().max(300).optional(),
  storyTreatment: z
    .enum(["documentary", "warm-imagination", "fairytale"])
    .optional(),
  style: z.enum(["watercolor", "cartoon", "fairytale"]),
  language: z.enum(["zh-en", "en-zh", "zh", "en"]),
  characterReferenceId: z.string().max(80).optional(),
  characterReferenceLabel: z.string().max(80).optional(),
  characterReferencePrompt: z.string().max(800).optional(),
  customCharacterReferenceToken: z.string().regex(/^[A-Za-z0-9_-]{32,96}$/).optional(),
  characterDescription: z.string().max(1200).optional(),
  dedication: z.string().max(100).optional(),
  sourceLibraryBookId: z
    .string()
    .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/)
    .optional(),
  personalizationDraftId: z.string().uuid().optional(),
  personalizationAnchor: personalizationAnchorSchema.optional(),
  familyCharacterIds: z.array(z.string().uuid()).max(8).optional(),
  browserFingerprint: z.string().min(8).max(256).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const generationTaskQuerySchema = z.object({
  taskId: z.string().regex(/^[A-Za-z0-9_-]{12,80}$/),
});

const outlinePatchSchema = z.object({
  taskId: z.string().regex(/^[A-Za-z0-9_-]{12,80}$/),
  storyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  pages: z
    .array(
      z.object({
        page: z.number().int().min(1).max(8),
        zhText: z.string().max(2000),
        enText: z.string().max(2000),
      }),
    )
    .length(8),
});

type FamilyCharacterRow = {
  id: string;
  display_name: string;
  relationship: string;
  description: string | null;
  canonical_photo_path: string | null;
  source_photo_path: string | null;
  cartoonize: boolean;
};

async function getSelectedFamilyCharacters(
  req: NextRequest,
  familyCharacterIds: string[] | undefined,
  protagonistFamilyCharacterId?: string,
): Promise<FamilyCharacterInput[]> {
  const uniqueIds = [...new Set(familyCharacterIds ?? [])];
  if (uniqueIds.length === 0) {
    return [];
  }

  const user = await requireAuthenticatedUser(req);
  const { data, error } = await getSupabaseAdmin()
    .from("family_characters")
    .select(
      "id, display_name, relationship, description, canonical_photo_path, source_photo_path, cartoonize"
    )
    .eq("user_id", user.id)
    .in("id", uniqueIds);

  if (error) {
    throw new GenerationProviderError(
      "storage_unavailable",
      "Unable to load family characters.",
    );
  }

  const rows = (data ?? []) as FamilyCharacterRow[];
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  if (rows.length !== uniqueIds.length || uniqueIds.some((id) => !rowsById.has(id))) {
    throw new Error("部分家庭角色不可用，请刷新页面后重新选择。");
  }

  const orderedIds = protagonistFamilyCharacterId
    ? [protagonistFamilyCharacterId, ...uniqueIds.filter((id) => id !== protagonistFamilyCharacterId)]
    : uniqueIds;

  return orderedIds.map((id) => {
    const row = rowsById.get(id)!;
    const referenceAssetPath = row.cartoonize
      ? row.canonical_photo_path || row.source_photo_path
      : row.source_photo_path || row.canonical_photo_path;
    return {
      id: row.id,
      name: row.display_name,
      relation: row.relationship,
      appearance: row.description?.trim() || `${row.relationship} ${row.display_name}`,
      referenceAssetPath: referenceAssetPath || undefined,
      sourceReferenceAssetPath: row.source_photo_path || undefined,
      canonicalReferenceAssetPath:
        row.cartoonize && row.canonical_photo_path
          ? row.canonical_photo_path
          : undefined,
      isProtagonist: row.id === protagonistFamilyCharacterId,
    };
  });
}

function createRateLimitIdentifier(ip: string, browserFingerprint?: string) {
  const identifierSource = `ip:${ip}|browser:${browserFingerprint?.trim() || "none"}`;

  return crypto.createHash("sha256").update(identifierSource).digest("hex");
}

type TurnstileVerificationResult = {
  ok: boolean;
  configurationError?: boolean;
};

async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string
): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const required = process.env.NODE_ENV === "production" || Boolean(secret);

  if (!required) {
    return { ok: true };
  }

  if (!secret) {
    return { ok: false, configurationError: true };
  }

  if (!token) {
    return { ok: false };
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteIp && remoteIp !== "anonymous") {
    formData.append("remoteip", remoteIp);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    return { ok: false };
  }

  const result = (await response.json()) as { success?: boolean };
  return { ok: result.success === true };
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

function createGenerateResponseFromStory(
  story: GeneratedStory,
  previousResult?: Pick<
    GenerateResponse,
    "freeChanceLabel" | "freeGenerationsRemaining" | "freeGenerationsLimit"
  >,
): GenerateResponse {
  const hasRemaining = previousResult?.freeGenerationsRemaining !== undefined;
  return {
    storyId: story.id,
    input: createPublicStoryInput(story.input),
    coverTitle: story.coverTitle,
    pages: story.pages.map(normalizeIllustrationPageForClient),
    totalPages: story.pages.length,
    generationMode: story.generationMode,
    freeChanceLabel:
      previousResult?.freeChanceLabel ||
      (hasRemaining
        ? `今日剩余 ${previousResult.freeGenerationsRemaining} / ${
            previousResult.freeGenerationsLimit || getDailyFreeGenerationLimit()
          } 次`
        : `今日免费生成 ${getDailyFreeGenerationLimit()} 次`),
    ...(hasRemaining
      ? {
          freeGenerationsRemaining: previousResult.freeGenerationsRemaining,
          freeGenerationsLimit:
            previousResult.freeGenerationsLimit || getDailyFreeGenerationLimit(),
        }
      : {}),
    imagesPending: !story.pages.every((page) => page.imageStatus === "complete"),
  };
}

function normalizeTextGenerationTaskForClient(
  task: TextGenerationTask,
): TextGenerationTask {
  if (!task.result) return task;
  return {
    ...task,
    result: {
      ...task.result,
      pages: task.result.pages.map(normalizeIllustrationPageForClient),
    },
  };
}

function getClientGenerationStatus(story: GeneratedStory) {
  if (story.status === "complete") return "ready" as const;
  if (
    story.status === "partially_failed" ||
    story.pages.some((page) => page.imageStatus === "failed")
  ) {
    return "partially_failed" as const;
  }
  if (
    story.status === "generating_images" &&
    story.pages.length > 0 &&
    story.pages.every(
      (page) => page.imageStatus === "complete" && Boolean(page.imageUrl),
    )
  ) {
    return "ready" as const;
  }
  return story.status;
}

async function createLatestTextGenerationTaskResponse(task: TextGenerationTask) {
  const story = await getCachedStory(task.storyId);
  if (!story) {
    if (task.status === "failed") {
      return createTextGenerationTaskResponse(
        normalizeTextGenerationTaskForClient(task),
      );
    }
    return task.status === "generating_text"
      ? createTextGenerationTaskResponse(
          normalizeTextGenerationTaskForClient(task),
        )
      : createUnrecoverableTextGenerationTaskResponse(
          task.taskId,
          task.storyId,
          "故事快照已失效，无法继续恢复，请重新生成。",
        );
  }
  return {
    ...createTextGenerationTaskResponse(task),
    status: getClientGenerationStatus(story),
    result: createGenerateResponseFromStory(
      story,
      task.result,
    ),
  };
}

async function runAsyncTextGeneration(input: {
  task: TextGenerationTask;
  storyInput: StoryInput;
  protagonistCharacter?: FamilyCharacterInput;
  familyCharacters: FamilyCharacterInput[];
  dailyLimit: number;
  freeGenerationsRemaining?: number;
  releaseRateLimit: () => Promise<void>;
}) {
  await executeTextGeneration({
    task: input.task,
    storyInput: input.storyInput,
    protagonistCharacter: input.protagonistCharacter,
    familyCharacters: input.familyCharacters,
    dailyLimit: input.dailyLimit,
    freeGenerationsRemaining: input.freeGenerationsRemaining,
    onFailure: async () => {
      await input.releaseRateLimit().catch((releaseError) => {
        logGenerationEvent(
          {
            operation: "generation.rate_limit_release",
            task: input.task.taskId,
            story: input.task.storyId,
            status: "failed",
            errorClass: classifyGenerationError(releaseError),
          },
          "error",
        );
      });
    },
  });
}

export async function GET(req: NextRequest) {
  const parsed = generationTaskQuerySchema.safeParse({
    taskId: req.nextUrl.searchParams.get("taskId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "文本生成任务参数不完整，请检查后重试。" },
      { status: 400 },
    );
  }

  const task = await getCachedTextGenerationTask(parsed.data.taskId);
  if (!task) {
    return NextResponse.json(
      createUnrecoverableTextGenerationTaskResponse(parsed.data.taskId),
      { status: 404 },
    );
  }
  if (task.generationPrincipalIds?.length) {
    const resolved = await resolveStoryAssetRequestPrincipal(req).catch(() => null);
    if (!resolved || !canAccessGenerationResource(task, resolved)) {
      return NextResponse.json(
        createUnrecoverableTextGenerationTaskResponse(parsed.data.taskId),
        { status: 404 },
      );
    }
  }
  const payload = await createLatestTextGenerationTaskResponse(task);
  if (isStaleTextGenerationTask(task) && payload.status === "generating_text") {
    return NextResponse.json(
      createUnrecoverableTextGenerationTaskResponse(
        task.taskId,
        task.storyId,
        "文本生成任务中断，无法继续恢复，请重新生成。",
      ),
      { status: 404 },
    );
  }

  return NextResponse.json(payload, {
    status:
      payload.status === "unrecoverable"
        ? 404
        : payload.status === "generating_text"
          ? 202
          : 200,
  });
}

export async function PATCH(req: NextRequest) {
  const parsed = outlinePatchSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "大纲必须包含连续的 8 页文字。", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pageNumbers = parsed.data.pages
    .map((page) => page.page)
    .sort((left, right) => left - right);
  if (!pageNumbers.every((page, index) => page === index + 1)) {
    return NextResponse.json({ error: "大纲页码必须为连续的 1 到 8 页。" }, { status: 400 });
  }

  const [task, story] = await Promise.all([
    getCachedTextGenerationTask(parsed.data.taskId),
    getCachedStory(parsed.data.storyId),
  ]);
  if (!task || !story) {
    return NextResponse.json(
      createUnrecoverableTextGenerationTaskResponse(
        parsed.data.taskId,
        parsed.data.storyId,
      ),
      { status: 404 },
    );
  }
  if (task.generationPrincipalIds?.length || story.generationPrincipalIds?.length) {
    const resolved = await resolveStoryAssetRequestPrincipal(req).catch(() => null);
    if (
      !resolved ||
      !canAccessGenerationResource(task, resolved) ||
      !canAccessGenerationResource(story, resolved)
    ) {
      return NextResponse.json(
        createUnrecoverableTextGenerationTaskResponse(
          parsed.data.taskId,
          parsed.data.storyId,
        ),
        { status: 404 },
      );
    }
  }
  if (task.storyId !== parsed.data.storyId || story.id !== task.storyId) {
    return NextResponse.json({ error: "任务与故事不匹配。" }, { status: 409 });
  }
  if (
    task.status === "generating_images" ||
    story.status === "generating_images" ||
    story.status === "complete" ||
    story.status === "partially_failed"
  ) {
    return NextResponse.json(await createLatestTextGenerationTaskResponse(task));
  }
  if (
    !["generating_text", "reviewing_outline"].includes(task.status) ||
    story.status !== "reviewing_outline"
  ) {
    return NextResponse.json({ error: "当前任务不能确认大纲。" }, { status: 409 });
  }

  const requiredFields = story.input.language === "zh"
    ? (["zhText"] as const)
    : story.input.language === "en"
      ? (["enText"] as const)
      : (["zhText", "enText"] as const);
  const hasBlankText = parsed.data.pages.some((page) =>
    requiredFields.some((field) => !page[field].trim()),
  );
  if (hasBlankText) {
    return NextResponse.json({ error: "每页当前语言的故事文字都不能为空。" }, { status: 400 });
  }

  const mutation = await mutateCachedStory(story.id, (latestStory) => {
    // The story is the authoritative state for this transition. If another
    // confirmation already won the race, do not rebuild pages from a stale
    // snapshot or overwrite the newer illustration state.
    if (latestStory.status !== "reviewing_outline") return null;
    const pages = createDemoPages(
      rebuildStoryPagesFromOutline(
        latestStory.input,
        latestStory.pages,
        parsed.data.pages,
      ),
      latestStory.input.style,
    );
    return {
      nextStory: {
        ...latestStory,
        pages,
        status: "generating_images",
      },
      value: true,
    };
  });

  if (!mutation) {
    const [latestTask, latestStory] = await Promise.all([
      getCachedTextGenerationTask(parsed.data.taskId),
      getCachedStory(parsed.data.storyId),
    ]);
    if (latestTask && latestStory && latestTask.storyId === latestStory.id) {
      return NextResponse.json(await createLatestTextGenerationTaskResponse(latestTask));
    }
    return NextResponse.json({ error: "大纲确认请求已失效，请刷新后重试。" }, { status: 409 });
  }

  const updatedTask: TextGenerationTask = {
    ...task,
    status: "generating_images",
    result: createGenerateResponseFromStory(
      mutation.story,
      task.result,
    ),
    updatedAt: new Date().toISOString(),
  };
  try {
    await cacheTextGenerationTask(updatedTask);
  } catch (error) {
    // The atomic story transition already succeeded and remains authoritative.
    // A stale task pointer can recover from that story on the next GET, so do
    // not report a failed outline confirmation or roll the story backwards.
    logGenerationEvent(
      {
        operation: "text.task_pointer",
        task: updatedTask.taskId,
        story: updatedTask.storyId,
        status: "write_failed",
        errorClass: classifyGenerationError(error),
      },
      "error",
    );
  }

  return NextResponse.json(createTextGenerationTaskResponse(updatedTask));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "表单参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const {
    generationRequestMode,
    generationTaskId,
    reviewBeforeIllustrations = false,
    browserFingerprint,
    turnstileToken,
    familyCharacterIds,
    protagonistFamilyCharacterId,
    ...baseInput
  } = parsed.data;
  const wantsAsyncResponse =
    generationRequestMode === "async" ||
    req.headers.get("prefer")?.toLowerCase().includes("respond-async");
  const requestedTaskId = generationTaskId || (wantsAsyncResponse ? nanoid(24) : undefined);
  if (wantsAsyncResponse && requestedTaskId) {
    const existingTask = await getCachedTextGenerationTask(requestedTaskId);
    if (existingTask) {
      if (existingTask.generationPrincipalIds?.length) {
        const resolved = await resolveStoryAssetRequestPrincipal(req).catch(() => null);
        if (!resolved || !canAccessGenerationResource(existingTask, resolved)) {
          return NextResponse.json(
            createUnrecoverableTextGenerationTaskResponse(requestedTaskId),
            { status: 404 },
          );
        }
      }
      const payload = await createLatestTextGenerationTaskResponse(existingTask);
      return NextResponse.json(payload, {
        status:
          payload.status === "unrecoverable"
            ? 404
            : payload.status === "generating_text"
              ? 202
              : 200,
      });
    }
  }
  if (
    protagonistFamilyCharacterId &&
    !(familyCharacterIds || []).includes(protagonistFamilyCharacterId)
  ) {
    return NextResponse.json(
      { error: "确认的主角不在已选择的家庭角色中。" },
      { status: 400 },
    );
  }
  const sourceStorySpec = baseInput.sourceLibraryBookId
    ? getLibraryStorySpecByContentId(baseInput.sourceLibraryBookId)
    : null;
  if (baseInput.sourceLibraryBookId && !sourceStorySpec) {
    return NextResponse.json(
      { error: "来源绘本不存在或暂不支持家庭专属改编。" },
      { status: 400 },
    );
  }
  if (
    sourceStorySpec &&
    (!baseInput.personalizationDraftId || !baseInput.personalizationAnchor)
  ) {
    return NextResponse.json(
      { error: "请先确认家庭角色形象，再生成专属绘本。" },
      { status: 400 },
    );
  }
  if (
    baseInput.personalizationAnchor &&
    baseInput.personalizationAnchor.characterId !==
      protagonistFamilyCharacterId &&
    (baseInput.personalizationAnchor.characterId ||
      protagonistFamilyCharacterId)
  ) {
    return NextResponse.json(
      { error: "确认的角色 Anchor 与故事主角不一致。" },
      { status: 400 },
    );
  }
  let familyCharacters: FamilyCharacterInput[];
  try {
    familyCharacters = await getSelectedFamilyCharacters(
      req,
      familyCharacterIds,
      protagonistFamilyCharacterId,
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "登录状态已失效，请重新登录后再试。" },
        { status: error.status },
      );
    }
    logGenerationEvent(
      {
        operation: "generation.family_characters",
        status: "failed",
        errorClass: classifyGenerationError(error),
      },
      "error",
    );
    return NextResponse.json(
      { error: "家庭角色读取失败，请稍后重试。" },
      { status: 400 },
    );
  }
  const confirmedStoryAnchorToken =
    baseInput.personalizationAnchor?.storyReferenceToken;
  if (confirmedStoryAnchorToken) {
    if (!protagonistFamilyCharacterId) {
      return NextResponse.json(
        { error: "故事级 Anchor 必须绑定已选择的家庭主角。" },
        { status: 400 },
      );
    }
    const confirmedAnchor = await getCachedCharacterReference(
      confirmedStoryAnchorToken,
    );
    if (!confirmedAnchor) {
      return NextResponse.json(
        { error: "确认的角色 Anchor 已过期，请重新生成并确认。" },
        { status: 410 },
      );
    }
    familyCharacters = familyCharacters.map((character) =>
      character.id === protagonistFamilyCharacterId
        ? { ...character, storyReferenceToken: confirmedStoryAnchorToken }
        : character,
    );
  }
  const storyInput: StoryInput = {
    ...baseInput,
    ...(sourceStorySpec
      ? {
          ageGroup: sourceStorySpec.ageGroup,
          theme: "custom" as const,
        }
      : {}),
    protagonistFamilyCharacterId,
    customCharacterReferenceToken:
      baseInput.characterReferenceId === "custom-upload"
        ? baseInput.customCharacterReferenceToken
        : undefined,
    familyCharacters: familyCharacters.length > 0 ? familyCharacters : undefined,
  };
  const input: StoryInput = {
    ...storyInput,
    visualBible: buildStoryVisualBible(storyInput),
  };
  const protagonistCharacter = protagonistFamilyCharacterId
    ? familyCharacters.find((character) => character.id === protagonistFamilyCharacterId)
    : undefined;
  if (
    protagonistCharacter &&
    normalizeCharacterName(protagonistCharacter.name) !== normalizeCharacterName(input.childName)
  ) {
    return NextResponse.json(
      { error: "确认的主角姓名与家庭角色不一致，请重新确认。" },
      { status: 400 },
    );
  }
  if (input.characterReferenceId === "custom-upload") {
    if (!input.customCharacterReferenceToken) {
      return NextResponse.json(
        { error: "自定义人物参考图已失效，请重新上传。" },
        { status: 400 }
      );
    }
    if (familyCharacters.length > 0) {
      return NextResponse.json(
        { error: "自定义主角照片不能与家庭角色同时使用。" },
        { status: 400 }
      );
    }
    const customReference = await getCachedCharacterReference(
      input.customCharacterReferenceToken
    );
    if (!customReference) {
      return NextResponse.json(
        { error: "自定义人物参考图已过期，请重新上传。" },
        { status: 410 }
      );
    }
  }
  const turnstile = await verifyTurnstile(turnstileToken, ip);

  if (!turnstile.ok) {
    return NextResponse.json(
      {
        error: turnstile.configurationError
          ? "人机验证未配置，请联系站点管理员。"
          : "人机验证失败，请刷新后重试。",
      },
      { status: turnstile.configurationError ? 500 : 403 }
    );
  }

  const dailyLimit = getDailyFreeGenerationLimit();
  const rateLimitIdentifier = createRateLimitIdentifier(ip, browserFingerprint);
  const useDurableJobs = wantsAsyncResponse && areProductionGenerationJobsEnabled();
  const generationOwner = useDurableJobs
    ? await resolveStoryAssetRequestPrincipal(req).catch(() => null)
    : null;
  if (useDurableJobs && !generationOwner) {
    return NextResponse.json(
      {
        error: "暂时无法创建可恢复的生成任务，请稍后再试。",
        stage: "generating_text",
        retryable: true,
      } satisfies GenerateErrorResponse,
      { status: 503 },
    );
  }
  const generationPrincipalIds = generationOwner
    ? getGenerationPrincipalIds(generationOwner)
    : undefined;
  const requestedQuotaReservationId = useDurableJobs
    ? createGenerationQuotaReservationId()
    : undefined;
  let durableQuota: Awaited<ReturnType<typeof reserveGenerationQuota>> | null = null;
  if (requestedQuotaReservationId && requestedTaskId) {
    try {
      durableQuota = await reserveGenerationQuota({
        identifierHash: rateLimitIdentifier,
        reservationId: requestedQuotaReservationId,
        idempotencyKey: `text:${requestedTaskId}`,
      });
    } catch (error) {
      logGenerationEvent(
        {
          operation: "generation.quota_reserve",
          task: requestedTaskId,
          status: "failed",
          errorClass: classifyGenerationError(error),
        },
        "error",
      );
      return NextResponse.json(
        {
          error: "暂时无法创建可恢复的生成任务，请稍后再试。",
          stage: "generating_text",
          retryable: true,
        } satisfies GenerateErrorResponse,
        { status: 503 },
      );
    }
  }
  const quotaReservationId = durableQuota?.reservation?.reservationId;
  const rateLimitReservation = durableQuota
    ? null
    : await rateLimiter.reserve(rateLimitIdentifier);
  const success = durableQuota
    ? durableQuota.outcome === "reserved"
    : rateLimitReservation!.success;
  const remaining = durableQuota
    ? durableQuota.remaining
    : rateLimitReservation!.remaining;

  if (!success) {
    const quotaUnavailable = durableQuota && durableQuota.outcome !== "quota_exhausted";
    return NextResponse.json(
      {
        error: quotaUnavailable
          ? "暂时无法创建可恢复的生成任务，请稍后再试。"
          : `今日 ${dailyLimit} 次免费生成机会已用完，请明天再试。`,
        ...(quotaUnavailable
          ? { stage: "generating_text" as const, retryable: true }
          : {}),
      },
      {
        status: quotaUnavailable ? 503 : 429,
        headers: {
          "X-RateLimit-Limit": String(dailyLimit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const storyId = nanoid(12);

  if (wantsAsyncResponse && requestedTaskId) {
    const pendingTask = createPendingTextGenerationTask({
      taskId: requestedTaskId,
      storyId,
      reviewBeforeIllustrations,
      durableJob: useDurableJobs,
      freeGenerationsRemaining: remaining,
      generationPrincipalIds,
    });
    let taskReservation: Awaited<
      ReturnType<typeof createTextGenerationTaskIfAbsent>
    >;
    try {
      taskReservation = await createTextGenerationTaskIfAbsent(pendingTask, {
        // Async recovery is a production promise only when a shared backend
        // exists. Local file/memory fallbacks remain available for tests and
        // single-process development, but must not return a misleading 202 in
        // a multi-instance deployment.
        requireDurable: process.env.NODE_ENV === "production",
      });
    } catch (error) {
      if (quotaReservationId) {
        const concurrentTask = await getCachedTextGenerationTask(
          pendingTask.taskId,
        ).catch(() => null);
        if (!concurrentTask) {
          await refundGenerationQuotaReservation({ reservationId: quotaReservationId }).catch(
            () => undefined,
          );
        }
      } else {
        await rateLimitReservation!.release().catch(() => undefined);
      }
      logGenerationEvent(
        {
          operation: "text.task_create",
          task: pendingTask.taskId,
          story: pendingTask.storyId,
          status: "failed",
          errorClass: classifyGenerationError(error),
        },
        "error",
      );
      return NextResponse.json(
        {
          error: "暂时无法创建可恢复的生成任务，请稍后再试。",
          stage: "generating_text",
          retryable: true,
        } satisfies GenerateErrorResponse,
        { status: 503 },
      );
    }
    if (!taskReservation.created) {
      if (!quotaReservationId) {
        await rateLimitReservation!.release().catch(() => undefined);
      }
      const payload = await createLatestTextGenerationTaskResponse(
        taskReservation.task,
      );
      return NextResponse.json(
        payload,
        {
          status:
            payload.status === "unrecoverable"
              ? 404
              : payload.status === "generating_text"
                ? 202
                : 200,
        },
      );
    }

    const assetPrincipal: StoryAssetRequestPrincipal | null = generationOwner;
    if (useDurableJobs) {
      let payloadRef: string | null = null;
      const idempotencyKey = `text:${pendingTask.taskId}`;
      try {
        payloadRef = await putGenerationJobPayload({
          storyInput: input,
          protagonistCharacter,
          familyCharacters,
          dailyLimit,
          reviewBeforeIllustrations,
          quotaReservationId: quotaReservationId!,
          generationPrincipalIds: generationPrincipalIds!,
        });
        const enqueued = await enqueueGenerationJob({
          kind: "text",
          storyId: pendingTask.storyId,
          taskId: pendingTask.taskId,
          payloadRef,
          quotaReservationId,
          idempotencyKey,
        });
        await cacheTextGenerationTask({
          ...pendingTask,
          durableJobId: enqueued.job.jobId,
          updatedAt: new Date().toISOString(),
        }).catch((error) => {
          logGenerationEvent(
            {
              operation: "text.task_job_link",
              task: pendingTask.taskId,
              story: pendingTask.storyId,
              status: "failed",
              errorClass: classifyGenerationError(error),
            },
            "error",
          );
        });
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
                operation: "text.job_enqueue_reconcile",
                task: pendingTask.taskId,
                story: pendingTask.storyId,
                status: "unknown",
                errorClass: classifyGenerationError(lookupError),
              },
              "warn",
            );
          }
        }
        if (
          payloadRef &&
          matchesTextGenerationJob({
            job: reconciledJob,
            storyId: pendingTask.storyId,
            taskId: pendingTask.taskId,
            payloadRef,
            quotaReservationId: quotaReservationId!,
          })
        ) {
          await cacheTextGenerationTask({
            ...pendingTask,
            durableJobId: reconciledJob!.jobId,
            updatedAt: new Date().toISOString(),
          }).catch(() => undefined);
          logGenerationEvent({
            operation: "text.job_enqueue_reconcile",
            task: pendingTask.taskId,
            story: pendingTask.storyId,
            status: "committed",
          });
        } else if (reconciliationUnknown) {
          // The enqueue may already be committed. Keep its payload, quota and
          // pending task intact so a later worker/retry can reconcile safely.
        } else {
          if (payloadRef) {
            await deleteGenerationJobPayload(payloadRef).catch(() => false);
          }
          await refundGenerationQuotaReservation({
            reservationId: quotaReservationId!,
          }).catch(() => undefined);
          await cacheTextGenerationTask({
            ...pendingTask,
            status: "failed",
            error: "暂时无法创建可恢复的生成任务，请稍后再试。",
            retryable: true,
            updatedAt: new Date().toISOString(),
          }).catch(() => undefined);
          logGenerationEvent(
            {
              operation: "text.job_enqueue",
              task: pendingTask.taskId,
              story: pendingTask.storyId,
              status: "failed",
              errorClass: classifyGenerationError(error),
            },
            "error",
          );
          return NextResponse.json(
            {
              error: "暂时无法创建可恢复的生成任务，请稍后再试。",
              stage: "generating_text",
              retryable: true,
            } satisfies GenerateErrorResponse,
            { status: 503 },
          );
        }
      }
    } else {
      after(() =>
        runAsyncTextGeneration({
          task: pendingTask,
          storyInput: input,
          protagonistCharacter,
          familyCharacters,
          dailyLimit,
          freeGenerationsRemaining: remaining,
          releaseRateLimit: rateLimitReservation!.release,
        }),
      );
    }

    const response = NextResponse.json(createTextGenerationTaskResponse(pendingTask), {
      status: 202,
      headers: {
        Location: `/api/generate?taskId=${encodeURIComponent(pendingTask.taskId)}`,
        "Retry-After": "1",
        "X-RateLimit-Limit": String(dailyLimit),
        "X-RateLimit-Remaining": String(remaining),
      },
    });
    return assetPrincipal
      ? attachStoryAssetSessionCookie(response, assetPrincipal)
      : response;
  }

  try {
    const { response } = await generateAndPersistStory({
      storyId,
      storyInput: input,
      protagonistCharacter,
      familyCharacters,
      dailyLimit,
      freeGenerationsRemaining: remaining,
      reviewBeforeIllustrations: false,
    });

    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Limit": String(dailyLimit),
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  } catch (error) {
    logGenerationEvent(
      {
        operation: "text.generate_request",
        story: storyId,
        provider: "cpa",
        model: process.env.STORY_TEXT_MODEL?.trim() || "gemini-3-flash",
        status: "failed",
        errorClass: classifyGenerationError(error),
      },
      "error",
    );
    await rateLimitReservation!.release().catch((releaseError) => {
      logGenerationEvent(
        {
          operation: "generation.rate_limit_release",
          story: storyId,
          status: "failed",
          errorClass: classifyGenerationError(releaseError),
        },
        "error",
      );
    });

    const payload: GenerateErrorResponse = {
      error: "故事生成失败，请稍后再试。",
      stage: "generating_text",
      retryable: true,
    };

    return NextResponse.json(payload, { status: 500 });
  }
}
