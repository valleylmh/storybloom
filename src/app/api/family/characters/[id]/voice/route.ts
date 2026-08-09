import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  BailianVoiceCloningError,
  createBailianClonedVoice,
  deleteBailianClonedVoice,
  discoverBailianClonedVoiceIdsSince,
  listBailianClonedVoiceIds,
  queryBailianClonedVoice,
} from "@/lib/bailian-voice-cloning-server";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  createFamilyVoiceReadySnapshot,
  parseFamilyVoiceReadySnapshot,
  type FamilyVoiceReadySnapshot,
} from "@/lib/family-character-voice-private-server";
import {
  FamilyVoiceMediaError,
  inspectFamilyVoiceSample,
} from "@/lib/family-voice-media-server";
import {
  FAMILY_VOICE_CONSENT_VERSION,
  FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS,
  FAMILY_VOICE_MAX_SAMPLE_BYTES,
  FAMILY_VOICE_SAMPLE_BUCKET,
  FAMILY_VOICE_SIGNED_URL_TTL_SECONDS,
  FAMILY_VOICE_TARGET_MODEL,
  areFamilyVoiceTypeAndExtensionCompatible,
  createFamilyVoiceEnrollmentPrefix,
  isFamilyVoiceAmbiguousAbsenceGraceElapsed,
  isFamilyVoiceProcessingStale,
  isValidFamilyVoiceSampleSize,
  normalizeFamilyVoiceContentType,
  parseOwnedFamilyVoiceSamplePath,
} from "@/lib/family-voice";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";
import { allowIpRequest } from "@/lib/request-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const idSchema = z.string().uuid();
const requestSchema = z.object({
  sampleAudioPath: z.string().trim().min(1).max(512),
  sampleDurationSeconds: z.number().finite().min(10).max(60),
  consentConfirmed: z.literal(true),
});

const VOICE_SELECT = [
  "family_character_id",
  "profile_id",
  "user_id",
  "sample_audio_path",
  "sample_duration_seconds",
  "voice_id",
  "target_model",
  "status",
  "error_message",
  "provider_request_id",
  "enrollment_attempt_id",
  "retired_voice_ids",
  "previous_ready_voice",
  "retired_sample_paths",
  "provider_voice_ids_before_attempt",
  "consent_confirmed_at",
  "consent_version",
  "updated_at",
].join(",");

type FamilyCharacter = {
  id: string;
  profile_id: string;
  user_id: string;
  kind: "person" | "pet";
};

type FamilyCharacterVoice = {
  family_character_id: string;
  profile_id: string;
  user_id: string;
  sample_audio_path: string;
  sample_duration_seconds: number;
  voice_id: string | null;
  target_model: string;
  status: "processing" | "ready" | "failed" | "deleting";
  error_message: string | null;
  provider_request_id: string | null;
  enrollment_attempt_id: string;
  retired_voice_ids: string[] | null;
  previous_ready_voice: unknown;
  retired_sample_paths: string[] | null;
  provider_voice_ids_before_attempt: string[] | null;
  consent_confirmed_at: string;
  consent_version: string;
  updated_at: string;
};

class FamilyVoiceRouteError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FamilyVoiceRouteError";
    this.status = status;
  }
}

function getEnrollmentHourlyLimit() {
  const parsed = Number.parseInt(
    process.env.FAMILY_VOICE_ENROLLMENT_RATE_LIMIT_PER_HOUR || "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 12;
}

function getSampleReadRetryBaseMs() {
  const parsed = Number.parseInt(
    process.env.FAMILY_VOICE_SAMPLE_READ_RETRY_MS || "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 2_000) : 250;
}

function getStorageErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const status = Number(candidate.status ?? candidate.statusCode);
  return Number.isFinite(status) ? status : null;
}

function getStorageErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; name?: unknown; error?: unknown };
  for (const value of [candidate.code, candidate.error, candidate.name]) {
    if (typeof value === "string" && /^[a-z0-9._:-]{1,64}$/i.test(value)) {
      return value;
    }
  }
  return null;
}

function getStorageErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function isMissingVoiceBucketError(error: unknown) {
  const status = getStorageErrorStatus(error);
  const code = getStorageErrorCode(error)?.toLowerCase() || "";
  const message = getStorageErrorMessage(error);
  return (
    code === "nosuchbucket" ||
    code === "bucket_not_found" ||
    (status === 404 && /bucket/i.test(message)) ||
    /bucket .*not found|bucket does not exist/i.test(message)
  );
}

function isVoiceStoragePermissionError(error: unknown) {
  const status = getStorageErrorStatus(error);
  return status === 401 || status === 403;
}

async function downloadFamilyVoiceSampleWithRetry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  sampleAudioPath: string,
) {
  const maximumAttempts = 4;
  const retryBaseMs = getSampleReadRetryBaseMs();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const { data, error } = await supabase.storage
      .from(FAMILY_VOICE_SAMPLE_BUCKET)
      .download(sampleAudioPath);
    if (data && !error) return data;
    lastError = error;
    if (
      attempt === maximumAttempts - 1 ||
      isMissingVoiceBucketError(error) ||
      isVoiceStoragePermissionError(error)
    ) {
      break;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, retryBaseMs * 2 ** attempt),
    );
  }

  console.warn("[family-character-voice] sample download unavailable", {
    status: getStorageErrorStatus(lastError),
    code: getStorageErrorCode(lastError),
  });
  if (isMissingVoiceBucketError(lastError)) {
    throw new FamilyVoiceRouteError(
      "家庭声音存储尚未完成部署，请联系管理员。",
      503,
    );
  }
  if (isVoiceStoragePermissionError(lastError)) {
    throw new FamilyVoiceRouteError(
      "家庭声音存储服务配置异常，请联系管理员。",
      503,
    );
  }
  throw new FamilyVoiceRouteError(
    "录音已上传，但存储服务尚未同步完成，请稍后重新提交。",
    503,
  );
}

function isDuplicateKeyError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function safeFailureMessage(error: unknown) {
  if (error instanceof BailianVoiceCloningError) return error.message;
  return "声音创建失败，请稍后再试。";
}

function normalizeProviderVoiceIds(values: unknown[]) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length <= 300 &&
          /^[a-z0-9._:-]+$/i.test(value),
      ),
    ),
  );
}

function isAmbiguousCreateFailure(error: unknown) {
  return error instanceof BailianVoiceCloningError && error.ambiguous;
}

function normalizeOwnedSamplePaths(
  values: unknown[],
  userId: string,
  characterId: string,
) {
  const paths = new Set<string>();
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (
      typeof value !== "string" ||
      !parseOwnedFamilyVoiceSamplePath(value, userId, characterId, {
        allowLegacy: true,
      })
    ) {
      throw new FamilyVoiceRouteError(
        "声音样本清理状态无效，请联系支持。",
        500,
      );
    }
    paths.add(value);
  }
  return Array.from(paths);
}

function isMissingLifecycleTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code =
    typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /account_voice_deletion_locks.*(?:does not exist|schema cache)/i.test(
      message,
    )
  );
}

async function isAccountVoiceDeletionLocked(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("account_voice_deletion_locks")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle<{ user_id: string }>();
  if (error) {
    // Keep the feature deployable before the additive lifecycle migration is
    // applied; the migration is still required for concurrency protection.
    if (isMissingLifecycleTable(error)) return false;
    throw error;
  }
  return Boolean(data);
}

async function removeVoiceSample(path: string) {
  try {
    const { error } = await getSupabaseAdmin().storage
      .from(FAMILY_VOICE_SAMPLE_BUCKET)
      .remove([path]);
    if (error) {
      console.warn("[family-character-voice] voice sample cleanup failed");
      return false;
    }
    return true;
  } catch {
    // Cleanup is best effort and must not replace the original result.
    return false;
  }
}

async function cleanupRetiredProviderVoices(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    userId: string;
    characterId: string;
    status: FamilyCharacterVoice["status"];
    enrollmentAttemptId: string;
    retiredVoiceIds: string[];
    allowListAbsenceConfirmation?: boolean;
  },
) {
  let remaining = [...input.retiredVoiceIds];
  for (const retiredVoiceId of input.retiredVoiceIds) {
    try {
      await deleteBailianClonedVoice(retiredVoiceId, {
        allowListAbsenceConfirmation:
          input.allowListAbsenceConfirmation === true,
      });
    } catch {
      console.warn("[family-character-voice] provider voice cleanup failed");
      continue;
    }
    remaining = remaining.filter((voiceId) => voiceId !== retiredVoiceId);
    const { error } = await supabase
      .from("family_character_voices")
      .update({ retired_voice_ids: remaining })
      .eq("family_character_id", input.characterId)
      .eq("user_id", input.userId)
      .eq("status", input.status)
      .eq("enrollment_attempt_id", input.enrollmentAttemptId);
    if (error) {
      // A later retry can safely repeat the provider deletion: the adapter
      // verifies list_voice absence when delete_voice reports an error.
      break;
    }
  }
  return remaining;
}

async function cleanupRetiredSamplePaths(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    userId: string;
    characterId: string;
    status: FamilyCharacterVoice["status"];
    enrollmentAttemptId: string;
    samplePaths: string[];
  },
) {
  let remaining = [...input.samplePaths];
  for (const samplePath of input.samplePaths) {
    if (!(await removeVoiceSample(samplePath))) continue;
    remaining = remaining.filter((path) => path !== samplePath);
    const { error } = await supabase
      .from("family_character_voices")
      .update({ retired_sample_paths: remaining })
      .eq("family_character_id", input.characterId)
      .eq("user_id", input.userId)
      .eq("status", input.status)
      .eq("enrollment_attempt_id", input.enrollmentAttemptId);
    if (error) break;
  }
  return remaining;
}

type VoiceFinalizationResult =
  | { status: "processing" }
  | { status: "ready" }
  | { status: "rejected"; restoredPreviousVoice: boolean };

async function cancelAmbiguousProcessingVoice(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  voice: FamilyCharacterVoice,
  discoveredVoiceIds: string[],
  userId: string,
  characterId: string,
) {
  const previousReadyVoice = parseFamilyVoiceReadySnapshot(
    voice.previous_ready_voice,
    userId,
    characterId,
  );
  if (voice.previous_ready_voice && !previousReadyVoice) {
    throw new FamilyVoiceRouteError(
      "声音恢复状态无效，请联系支持后重试。",
      500,
    );
  }
  const retiredVoiceIds = normalizeProviderVoiceIds([
    ...(voice.retired_voice_ids || []),
    ...discoveredVoiceIds,
  ]).filter((voiceId) => voiceId !== previousReadyVoice?.voice_id);
  const retiredSamplePaths = normalizeOwnedSamplePaths(
    [...(voice.retired_sample_paths || []), voice.sample_audio_path],
    userId,
    characterId,
  ).filter((path) => path !== previousReadyVoice?.sample_audio_path);
  const payload = previousReadyVoice
    ? {
        sample_audio_path: previousReadyVoice.sample_audio_path,
        sample_duration_seconds: previousReadyVoice.sample_duration_seconds,
        voice_id: previousReadyVoice.voice_id,
        target_model: previousReadyVoice.target_model,
        status: "ready" as const,
        error_message: null,
        provider_request_id: previousReadyVoice.provider_request_id,
        retired_voice_ids: retiredVoiceIds,
        previous_ready_voice: null,
        retired_sample_paths: retiredSamplePaths,
        provider_voice_ids_before_attempt: null,
        consent_confirmed_at: previousReadyVoice.consent_confirmed_at,
        consent_version: previousReadyVoice.consent_version,
      }
    : {
        voice_id: null,
        status: "failed" as const,
        error_message: "声音创建结果异常，请重新录制。",
        retired_voice_ids: retiredVoiceIds,
        previous_ready_voice: null,
        retired_sample_paths: retiredSamplePaths,
        provider_voice_ids_before_attempt: null,
      };
  const { data, error } = await supabase
    .from("family_character_voices")
    .update(payload)
    .eq("family_character_id", characterId)
    .eq("user_id", userId)
    .eq("status", "processing")
    .eq("enrollment_attempt_id", voice.enrollment_attempt_id)
    .select("status")
    .maybeSingle<{ status: "ready" | "failed" }>();
  if (error) throw error;
  if (!data) {
    throw new FamilyVoiceRouteError(
      "声音状态已经变化，请刷新后重试。",
      409,
    );
  }
  await cleanupRetiredProviderVoices(supabase, {
    userId,
    characterId,
    status: data.status,
    enrollmentAttemptId: voice.enrollment_attempt_id,
    retiredVoiceIds,
  });
  await cleanupRetiredSamplePaths(supabase, {
    userId,
    characterId,
    status: data.status,
    enrollmentAttemptId: voice.enrollment_attempt_id,
    samplePaths: retiredSamplePaths,
  });
  return Boolean(previousReadyVoice);
}

async function finalizeProcessingVoice(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  voice: FamilyCharacterVoice,
  userId: string,
  characterId: string,
): Promise<VoiceFinalizationResult> {
  if (voice.status !== "processing" || !voice.voice_id) {
    return { status: "processing" };
  }

  let providerStatus: "DEPLOYING" | "OK" | "UNDEPLOYED";
  try {
    providerStatus = (await queryBailianClonedVoice(voice.voice_id)).status;
  } catch {
    // A transient status lookup must not discard the provider voice. The
    // browser polls this authenticated endpoint and can finish it later.
    return { status: "processing" };
  }
  if (providerStatus === "DEPLOYING") return { status: "processing" };

  const previousReadyVoice = parseFamilyVoiceReadySnapshot(
    voice.previous_ready_voice,
    userId,
    characterId,
  );
  let retiredVoiceIds = normalizeProviderVoiceIds(
    voice.retired_voice_ids || [],
  ).filter((voiceId) => voiceId !== voice.voice_id);
  let retiredSamplePaths = normalizeOwnedSamplePaths(
    voice.retired_sample_paths || [],
    userId,
    characterId,
  ).filter((path) => path !== voice.sample_audio_path);

  if (providerStatus === "UNDEPLOYED") {
    retiredVoiceIds = normalizeProviderVoiceIds([
      ...retiredVoiceIds,
      voice.voice_id,
    ]);
    if (previousReadyVoice) {
      retiredVoiceIds = retiredVoiceIds.filter(
        (voiceId) => voiceId !== previousReadyVoice.voice_id,
      );
      retiredSamplePaths = retiredSamplePaths.filter(
        (path) => path !== previousReadyVoice.sample_audio_path,
      );
    }
    retiredSamplePaths = normalizeOwnedSamplePaths(
      [...retiredSamplePaths, voice.sample_audio_path],
      userId,
      characterId,
    );

    const rollbackPayload = previousReadyVoice
      ? {
          sample_audio_path: previousReadyVoice.sample_audio_path,
          sample_duration_seconds: previousReadyVoice.sample_duration_seconds,
          voice_id: previousReadyVoice.voice_id,
          target_model: previousReadyVoice.target_model,
          status: "ready" as const,
          error_message: null,
          provider_request_id: previousReadyVoice.provider_request_id,
          retired_voice_ids: retiredVoiceIds,
          previous_ready_voice: null,
          retired_sample_paths: retiredSamplePaths,
          provider_voice_ids_before_attempt: null,
          consent_confirmed_at: previousReadyVoice.consent_confirmed_at,
          consent_version: previousReadyVoice.consent_version,
        }
      : {
          voice_id: null,
          status: "failed" as const,
          error_message: "声音样本未通过百炼审核，请重新录制。",
          retired_voice_ids: retiredVoiceIds,
          previous_ready_voice: null,
          retired_sample_paths: retiredSamplePaths,
          provider_voice_ids_before_attempt: null,
        };
    const { data: rolledBack, error } = await supabase
      .from("family_character_voices")
      .update(rollbackPayload)
      .eq("family_character_id", characterId)
      .eq("user_id", userId)
      .eq("status", "processing")
      .eq("voice_id", voice.voice_id)
      .eq("enrollment_attempt_id", voice.enrollment_attempt_id)
      .select("status")
      .maybeSingle<{ status: "ready" | "failed" }>();
    if (error) throw error;
    if (!rolledBack) {
      throw new FamilyVoiceRouteError(
        "声音状态已经变化，请刷新后重试。",
        409,
      );
    }
    await cleanupRetiredProviderVoices(supabase, {
      userId,
      characterId,
      status: rolledBack.status,
      enrollmentAttemptId: voice.enrollment_attempt_id,
      retiredVoiceIds,
    });
    await cleanupRetiredSamplePaths(supabase, {
      userId,
      characterId,
      status: rolledBack.status,
      enrollmentAttemptId: voice.enrollment_attempt_id,
      samplePaths: retiredSamplePaths,
    });
    return {
      status: "rejected",
      restoredPreviousVoice: Boolean(previousReadyVoice),
    };
  }

  if (
    previousReadyVoice?.voice_id &&
    previousReadyVoice.voice_id !== voice.voice_id
  ) {
    retiredVoiceIds = normalizeProviderVoiceIds([
      ...retiredVoiceIds,
      previousReadyVoice.voice_id,
    ]);
  }
  retiredVoiceIds = retiredVoiceIds.filter(
    (voiceId) => voiceId !== voice.voice_id,
  );
  if (
    previousReadyVoice?.sample_audio_path &&
    previousReadyVoice.sample_audio_path !== voice.sample_audio_path
  ) {
    retiredSamplePaths = normalizeOwnedSamplePaths(
      [...retiredSamplePaths, previousReadyVoice.sample_audio_path],
      userId,
      characterId,
    );
  }
  retiredSamplePaths = retiredSamplePaths.filter(
    (path) => path !== voice.sample_audio_path,
  );

  const { data: savedVoice, error } = await supabase
    .from("family_character_voices")
    .update({
      status: "ready",
      error_message: null,
      retired_voice_ids: retiredVoiceIds,
      previous_ready_voice: null,
      retired_sample_paths: retiredSamplePaths,
      provider_voice_ids_before_attempt: null,
    })
    .eq("family_character_id", characterId)
    .eq("user_id", userId)
    .eq("status", "processing")
    .eq("voice_id", voice.voice_id)
    .eq("enrollment_attempt_id", voice.enrollment_attempt_id)
    .select("status")
    .maybeSingle<{ status: "ready" }>();
  if (error) throw error;
  if (!savedVoice) {
    throw new FamilyVoiceRouteError(
      "声音状态已经变化，请刷新后重试。",
      409,
    );
  }

  await cleanupRetiredProviderVoices(supabase, {
    userId,
    characterId,
    status: "ready",
    enrollmentAttemptId: voice.enrollment_attempt_id,
    retiredVoiceIds,
  });
  await cleanupRetiredSamplePaths(supabase, {
    userId,
    characterId,
    status: "ready",
    enrollmentAttemptId: voice.enrollment_attempt_id,
    samplePaths: retiredSamplePaths,
  });
  return { status: "ready" };
}

async function removeVoiceSampleIfUnreferenced(
  path: string,
  userId: string,
  characterId: string,
) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("family_character_voices")
      .select("family_character_id")
      .eq("family_character_id", characterId)
      .eq("user_id", userId)
      .eq("sample_audio_path", path)
      .maybeSingle<{ family_character_id: string }>();
    if (error || data) return false;
    return await removeVoiceSample(path);
  } catch {
    // If reference verification is unavailable, retaining the private sample is safer.
    return false;
  }
}

function errorResponse(
  message: string,
  status: number,
  cleanupSample: boolean,
) {
  return NextResponse.json(
    cleanupSample ? { error: message, cleanupSample: true } : { error: message },
    { status },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let userId = "";
  let characterId = "";
  let sampleAudioPath = "";
  let samplePathOwned = false;
  let cleanupSampleAllowed = false;
  let claimed = false;
  let enrollmentAttemptId = "";
  let createdVoiceId = "";
  let existingVoice: FamilyCharacterVoice | null = null;
  let recoverableReadyVoice: FamilyVoiceReadySnapshot | null = null;

  try {
    const user = await requireAuthenticatedUser(request);
    userId = user.id;
    characterId = idSchema.parse((await context.params).id);
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new FamilyVoiceRouteError("声音创建请求参数无效。", 400);
    }
    const body = requestSchema.parse(rawBody);
    sampleAudioPath = body.sampleAudioPath;
    const parsedPath = parseOwnedFamilyVoiceSamplePath(
      sampleAudioPath,
      user.id,
      characterId,
    );
    if (!parsedPath) {
      throw new FamilyVoiceRouteError("录音文件路径无效。", 400);
    }
    samplePathOwned = true;

    const rateLimitAllowed = await allowIpRequest(request, {
      limit: getEnrollmentHourlyLimit(),
      window: "1 h",
      windowMs: 60 * 60 * 1_000,
      prefix: "family-voice-enrollment",
      identifier: user.id,
    });
    if (!rateLimitAllowed) {
      throw new FamilyVoiceRouteError(
        "声音创建请求过于频繁，请稍后再试。",
        429,
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: character, error: characterError } = await supabase
      .from("family_characters")
      .select("id,profile_id,user_id,kind")
      .eq("id", characterId)
      .eq("user_id", user.id)
      .maybeSingle<FamilyCharacter>();
    if (characterError) throw characterError;
    if (!character) {
      throw new FamilyVoiceRouteError("没有找到这个家庭角色。", 404);
    }
    if (character.kind !== "person") {
      throw new FamilyVoiceRouteError("只有家庭人物角色可以创建真人声音。", 400);
    }
    if (await isAccountVoiceDeletionLocked(supabase, user.id)) {
      throw new FamilyVoiceRouteError(
        "账户数据正在删除，暂时不能创建新的家庭声音。",
        409,
      );
    }

    const sampleBlob = await downloadFamilyVoiceSampleWithRetry(
      supabase,
      sampleAudioPath,
    );
    if (!isValidFamilyVoiceSampleSize(sampleBlob.size)) {
      const message =
        sampleBlob.size > FAMILY_VOICE_MAX_SAMPLE_BYTES
          ? "录音文件不能超过 10MB。"
          : "录音文件为空。";
      throw new FamilyVoiceRouteError(message, sampleBlob.size ? 413 : 400);
    }

    const contentType = normalizeFamilyVoiceContentType(sampleBlob.type);
    if (
      !contentType ||
      !areFamilyVoiceTypeAndExtensionCompatible(
        contentType,
        parsedPath.extension,
      )
    ) {
      throw new FamilyVoiceRouteError(
        "录音格式无效，请使用 WAV、MP3 或 M4A。",
        415,
      );
    }
    const inspectedSample = await inspectFamilyVoiceSample(
      sampleBlob,
      contentType,
    );

    const { data: currentVoice, error: currentVoiceError } = await supabase
      .from("family_character_voices")
      .select(VOICE_SELECT)
      .eq("family_character_id", character.id)
      .eq("user_id", user.id)
      .maybeSingle<FamilyCharacterVoice>();
    if (currentVoiceError) throw currentVoiceError;
    existingVoice = currentVoice || null;
    if (
      existingVoice?.status === "processing" &&
      !isFamilyVoiceProcessingStale(existingVoice.updated_at)
    ) {
      throw new FamilyVoiceRouteError(
        "这个家庭角色正在创建声音，请稍候。",
        409,
      );
    }
    if (
      existingVoice?.status === "processing" &&
      !existingVoice.voice_id &&
      Array.isArray(existingVoice.provider_voice_ids_before_attempt)
    ) {
      throw new FamilyVoiceRouteError(
        "上一次声音创建结果仍在确认，请稍候；如长时间未完成，可先删除声音后重试。",
        409,
      );
    }
    if (existingVoice?.status === "deleting") {
      throw new FamilyVoiceRouteError(
        "这个家庭角色的声音正在删除，请稍候。",
        409,
      );
    }
    recoverableReadyVoice =
      existingVoice?.status === "ready" && existingVoice.voice_id
        ? createFamilyVoiceReadySnapshot({
            sample_audio_path: existingVoice.sample_audio_path,
            sample_duration_seconds: existingVoice.sample_duration_seconds,
            voice_id: existingVoice.voice_id,
            target_model: existingVoice.target_model,
            provider_request_id: existingVoice.provider_request_id,
            consent_confirmed_at: existingVoice.consent_confirmed_at,
            consent_version: existingVoice.consent_version,
          })
        : parseFamilyVoiceReadySnapshot(
            existingVoice?.previous_ready_voice,
            user.id,
            character.id,
          );

    const consentConfirmedAt = new Date().toISOString();
    enrollmentAttemptId = randomUUID();
    const carriedRetiredVoiceIds = normalizeProviderVoiceIds([
      ...(existingVoice?.retired_voice_ids || []),
      ...(existingVoice?.status !== "ready" && existingVoice?.voice_id
        ? [existingVoice.voice_id]
        : []),
    ]);
    const carriedRetiredSamplePaths = normalizeOwnedSamplePaths(
      [
        ...(existingVoice?.retired_sample_paths || []),
        ...(existingVoice &&
        existingVoice.status !== "ready" &&
        existingVoice.sample_audio_path !== sampleAudioPath
          ? [existingVoice.sample_audio_path]
          : []),
      ],
      user.id,
      character.id,
    );
    const processingPayload = {
      family_character_id: character.id,
      profile_id: character.profile_id,
      user_id: user.id,
      sample_audio_path: sampleAudioPath,
      sample_duration_seconds: Number(
        inspectedSample.durationSeconds.toFixed(3),
      ),
      voice_id: null,
      target_model: FAMILY_VOICE_TARGET_MODEL,
      status: "processing",
      error_message: null,
      provider_request_id: null,
      enrollment_attempt_id: enrollmentAttemptId,
      retired_voice_ids: carriedRetiredVoiceIds,
      previous_ready_voice: recoverableReadyVoice,
      retired_sample_paths: carriedRetiredSamplePaths,
      provider_voice_ids_before_attempt: null,
      consent_confirmed_at: consentConfirmedAt,
      consent_version: FAMILY_VOICE_CONSENT_VERSION,
    };

    if (existingVoice) {
      const { data: claimedVoice, error: claimError } = await supabase
        .from("family_character_voices")
        .update(processingPayload)
        .eq("family_character_id", character.id)
        .eq("user_id", user.id)
        .eq("status", existingVoice.status)
        .eq("sample_audio_path", existingVoice.sample_audio_path)
        .eq("updated_at", existingVoice.updated_at)
        .select("family_character_id,status")
        .maybeSingle<{ family_character_id: string; status: string }>();
      if (claimError) throw claimError;
      if (!claimedVoice) {
        throw new FamilyVoiceRouteError(
          "声音状态已经变化，请刷新后再试。",
          409,
        );
      }
    } else {
      const { data: claimedVoice, error: claimError } = await supabase
        .from("family_character_voices")
        .insert(processingPayload)
        .select("family_character_id,status")
        .maybeSingle<{ family_character_id: string; status: string }>();
      if (isDuplicateKeyError(claimError)) {
        throw new FamilyVoiceRouteError(
          "这个家庭角色正在创建声音，请稍候。",
          409,
        );
      }
      if (claimError) throw claimError;
      if (!claimedVoice) {
        throw new FamilyVoiceRouteError("声音创建状态保存失败。", 500);
      }
    }
    claimed = true;

    await cleanupRetiredSamplePaths(supabase, {
      userId: user.id,
      characterId: character.id,
      status: "processing",
      enrollmentAttemptId,
      samplePaths: carriedRetiredSamplePaths,
    });

    const enrollmentPrefix = createFamilyVoiceEnrollmentPrefix(character.id);
    const providerVoiceIdsBeforeAttempt = normalizeProviderVoiceIds([
      ...(await listBailianClonedVoiceIds(enrollmentPrefix)),
      existingVoice?.voice_id,
      ...(existingVoice?.retired_voice_ids || []),
      recoverableReadyVoice?.voice_id,
    ]);
    const { data: pendingVoice, error: snapshotError } = await supabase
      .from("family_character_voices")
      .update({
        provider_voice_ids_before_attempt: providerVoiceIdsBeforeAttempt,
      })
      .eq("family_character_id", character.id)
      .eq("user_id", user.id)
      .eq("status", "processing")
      .eq("sample_audio_path", sampleAudioPath)
      .eq("enrollment_attempt_id", enrollmentAttemptId)
      .select(VOICE_SELECT)
      .maybeSingle<FamilyCharacterVoice>();
    if (snapshotError) throw snapshotError;
    if (!pendingVoice) {
      throw new FamilyVoiceRouteError(
        "声音创建状态已经变化，请刷新后重试。",
        409,
      );
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(FAMILY_VOICE_SAMPLE_BUCKET)
      .createSignedUrl(
        sampleAudioPath,
        FAMILY_VOICE_SIGNED_URL_TTL_SECONDS,
      );
    const signedUrl = signedData?.signedUrl?.trim();
    if (signedError || !signedUrl) {
      throw new Error("Could not create a signed voice sample URL.");
    }

    let clonedVoice: { voiceId: string; requestId?: string };
    try {
      clonedVoice = await createBailianClonedVoice({
        sampleUrl: signedUrl,
        prefix: enrollmentPrefix,
      });
    } catch (error) {
      if (!isAmbiguousCreateFailure(error)) throw error;
      let discoveredVoiceIds: string[] | null = null;
      try {
        discoveredVoiceIds = await discoverBailianClonedVoiceIdsSince(
          enrollmentPrefix,
          providerVoiceIdsBeforeAttempt,
        );
      } catch {
        // Keep the durable processing row. GET polling, explicit deletion and
        // account deletion can reconcile the prefix later.
      }
      if (!discoveredVoiceIds || discoveredVoiceIds.length === 0) {
        return NextResponse.json(
          { ok: true, status: "processing" },
          { status: 202 },
        );
      }
      if (discoveredVoiceIds.length > 1) {
        const restoredPreviousVoice = await cancelAmbiguousProcessingVoice(
          supabase,
          pendingVoice,
          discoveredVoiceIds,
          user.id,
          character.id,
        );
        return NextResponse.json(
          {
            error: restoredPreviousVoice
              ? "声音创建结果异常，已继续使用原来的真人声音。"
              : "声音创建结果异常，请重新录制。",
          },
          { status: 502 },
        );
      }
      clonedVoice = { voiceId: discoveredVoiceIds[0] };
    }
    createdVoiceId = clonedVoice.voiceId;
    const { data: trackedVoice, error: saveError } = await supabase
      .from("family_character_voices")
      .update({
        voice_id: clonedVoice.voiceId,
        target_model: FAMILY_VOICE_TARGET_MODEL,
        status: "processing",
        error_message: null,
        provider_request_id: clonedVoice.requestId || null,
      })
      .eq("family_character_id", character.id)
      .eq("user_id", user.id)
      .eq("status", "processing")
      .eq("sample_audio_path", sampleAudioPath)
      .eq("enrollment_attempt_id", enrollmentAttemptId)
      .select(VOICE_SELECT)
      .maybeSingle<FamilyCharacterVoice>();
    if (saveError) throw saveError;
    if (!trackedVoice) {
      throw new Error("Voice enrollment state changed before completion.");
    }
    if (await isAccountVoiceDeletionLocked(supabase, user.id)) {
      throw new FamilyVoiceRouteError(
        "账户数据删除已开始，本次声音创建已取消。",
        409,
      );
    }

    const finalization = await finalizeProcessingVoice(
      supabase,
      trackedVoice,
      user.id,
      character.id,
    );
    if (finalization.status === "processing") {
      createdVoiceId = "";
      return NextResponse.json(
        { ok: true, status: "processing" },
        { status: 202 },
      );
    }
    if (finalization.status === "rejected") {
      createdVoiceId = "";
      return NextResponse.json(
        {
          error: finalization.restoredPreviousVoice
            ? "新录音未通过百炼审核，已继续使用原来的真人声音。"
            : "录音未通过百炼审核，请在安静环境中重新录制。",
        },
        { status: 422 },
      );
    }
    createdVoiceId = "";
    return NextResponse.json({ ok: true, status: "ready" });
  } catch (error) {
    if (claimed && userId && characterId && sampleAudioPath) {
      const supabase = getSupabaseAdmin();
      const retainedProviderVoiceIds = normalizeProviderVoiceIds([
        ...(existingVoice?.retired_voice_ids || []),
        ...(existingVoice?.status !== "ready" && existingVoice?.voice_id
          ? [existingVoice.voice_id]
          : []),
        createdVoiceId,
      ]);
      let retainedSamplePaths: string[] = [];
      try {
        retainedSamplePaths = normalizeOwnedSamplePaths(
          [
            ...(existingVoice?.retired_sample_paths || []),
            ...(existingVoice &&
            existingVoice.status !== "ready" &&
            existingVoice.sample_audio_path !== sampleAudioPath
              ? [existingVoice.sample_audio_path]
              : []),
            sampleAudioPath,
          ],
          userId,
          characterId,
        );
      } catch {
        // Preserve the original error; an explicit DELETE can diagnose and
        // retry cleanup if stored lifecycle data is malformed.
      }

      if (recoverableReadyVoice) {
        const readyVoiceToRestore = recoverableReadyVoice;
        try {
          const restoredRetiredProviderVoiceIds =
            retainedProviderVoiceIds.filter(
              (voiceId) => voiceId !== readyVoiceToRestore.voice_id,
            );
          const restoredRetiredSamplePaths = retainedSamplePaths.filter(
            (path) => path !== readyVoiceToRestore.sample_audio_path,
          );
          const { data: restoredVoice } = await supabase
            .from("family_character_voices")
            .update({
              sample_audio_path: readyVoiceToRestore.sample_audio_path,
              sample_duration_seconds:
                readyVoiceToRestore.sample_duration_seconds,
              voice_id: readyVoiceToRestore.voice_id,
              target_model: readyVoiceToRestore.target_model,
              status: "ready",
              error_message: null,
              provider_request_id: readyVoiceToRestore.provider_request_id,
              retired_voice_ids: restoredRetiredProviderVoiceIds,
              previous_ready_voice: null,
              retired_sample_paths: restoredRetiredSamplePaths,
              provider_voice_ids_before_attempt: null,
              consent_confirmed_at:
                readyVoiceToRestore.consent_confirmed_at,
              consent_version: readyVoiceToRestore.consent_version,
            })
            .eq("family_character_id", characterId)
            .eq("user_id", userId)
            .eq("status", "processing")
            .eq("sample_audio_path", sampleAudioPath)
            .eq("enrollment_attempt_id", enrollmentAttemptId)
            .select("status")
            .maybeSingle<{ status: "ready" }>();
          if (restoredVoice) {
            await cleanupRetiredProviderVoices(supabase, {
              userId,
              characterId,
              status: "ready",
              enrollmentAttemptId,
              retiredVoiceIds: restoredRetiredProviderVoiceIds,
            });
            const remainingSamples = await cleanupRetiredSamplePaths(
              supabase,
              {
                userId,
                characterId,
                status: "ready",
                enrollmentAttemptId,
                samplePaths: restoredRetiredSamplePaths,
              },
            );
            cleanupSampleAllowed = !remainingSamples.includes(sampleAudioPath);
          }
        } catch {
          // Keep the new sample if rollback cannot be confirmed.
        }
      } else {
        try {
          const requestId =
            error instanceof BailianVoiceCloningError
              ? error.requestId || null
              : null;
          const { data: failedVoice, error: failedVoiceError } = await supabase
            .from("family_character_voices")
            .update({
              voice_id: null,
              status: "failed",
              error_message: safeFailureMessage(error),
              provider_request_id: requestId,
              retired_voice_ids: retainedProviderVoiceIds,
              previous_ready_voice: null,
              retired_sample_paths: retainedSamplePaths,
              provider_voice_ids_before_attempt: null,
            })
            .eq("family_character_id", characterId)
            .eq("user_id", userId)
            .eq("status", "processing")
            .eq("sample_audio_path", sampleAudioPath)
            .eq("enrollment_attempt_id", enrollmentAttemptId)
            .select("family_character_id")
            .maybeSingle<{ family_character_id: string }>();
          if (failedVoiceError) throw failedVoiceError;
          if (failedVoice) {
            const remainingProviderVoiceIds =
              await cleanupRetiredProviderVoices(supabase, {
                userId,
                characterId,
                status: "failed",
                enrollmentAttemptId,
                retiredVoiceIds: retainedProviderVoiceIds,
              });
            const remainingSamplePaths = await cleanupRetiredSamplePaths(
              supabase,
              {
                userId,
                characterId,
                status: "failed",
                enrollmentAttemptId,
                samplePaths: retainedSamplePaths,
              },
            );
            if (
              remainingProviderVoiceIds.length === 0 &&
              remainingSamplePaths.length === 0
            ) {
              const { data: deletedVoice, error: deleteError } = await supabase
                .from("family_character_voices")
                .delete()
                .eq("family_character_id", characterId)
                .eq("user_id", userId)
                .eq("status", "failed")
                .eq("enrollment_attempt_id", enrollmentAttemptId)
                .select("family_character_id")
                .maybeSingle<{ family_character_id: string }>();
              if (deleteError) throw deleteError;
              cleanupSampleAllowed = Boolean(deletedVoice);
            }
          }
        } catch {
          // Preserve the original enrollment failure. The claimed row remains
          // the durable retry point for provider and Storage cleanup.
        }
      }
    }

    if (
      !cleanupSampleAllowed &&
      samplePathOwned &&
      userId &&
      characterId &&
      sampleAudioPath
    ) {
      cleanupSampleAllowed = await removeVoiceSampleIfUnreferenced(
        sampleAudioPath,
        userId,
        characterId,
      );
    }

    if (error instanceof AuthenticationError) {
      return errorResponse("请先登录。", 401, cleanupSampleAllowed);
    }
    if (error instanceof z.ZodError) {
      return errorResponse(
        "声音创建请求参数无效。",
        400,
        cleanupSampleAllowed,
      );
    }
    if (error instanceof FamilyVoiceRouteError) {
      return errorResponse(
        error.message,
        error.status,
        cleanupSampleAllowed,
      );
    }
    if (error instanceof BailianVoiceCloningError) {
      return errorResponse(
        error.message,
        error.status,
        cleanupSampleAllowed,
      );
    }
    if (error instanceof FamilyVoiceMediaError) {
      return errorResponse(
        error.message,
        error.status,
        cleanupSampleAllowed,
      );
    }

    console.error("[family-character-voice] voice enrollment failed");
    return errorResponse(
      "声音创建失败，请稍后再试。",
      500,
      cleanupSampleAllowed,
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser(request);
    const characterId = idSchema.parse((await context.params).id);
    const supabase = getSupabaseAdmin();
    if (await isAccountVoiceDeletionLocked(supabase, user.id)) {
      throw new FamilyVoiceRouteError(
        "账户数据正在删除，声音状态暂时不可更新。",
        409,
      );
    }
    const { data, error } = await supabase
      .from("family_character_voices")
      .select(VOICE_SELECT)
      .eq("family_character_id", characterId)
      .eq("user_id", user.id)
      .maybeSingle<FamilyCharacterVoice>();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ ok: true, status: "absent" });
    }
    let voice = data;

    if (voice.status === "processing") {
      if (
        !voice.voice_id &&
        Array.isArray(voice.provider_voice_ids_before_attempt)
      ) {
        let discoveredVoiceIds: string[];
        try {
          discoveredVoiceIds = await discoverBailianClonedVoiceIdsSince(
            createFamilyVoiceEnrollmentPrefix(characterId),
            voice.provider_voice_ids_before_attempt,
          );
        } catch {
          return NextResponse.json(
            { ok: true, status: "processing" },
            { status: 202 },
          );
        }
        if (discoveredVoiceIds.length === 0) {
          return NextResponse.json(
            { ok: true, status: "processing" },
            { status: 202 },
          );
        }
        if (discoveredVoiceIds.length > 1) {
          const restoredPreviousVoice = await cancelAmbiguousProcessingVoice(
            supabase,
            voice,
            discoveredVoiceIds,
            user.id,
            characterId,
          );
          return NextResponse.json({
            ok: true,
            status: restoredPreviousVoice ? "ready" : "failed",
            rejected: true,
          });
        }
        const { data: recoveredVoice, error: recoveryError } = await supabase
          .from("family_character_voices")
          .update({ voice_id: discoveredVoiceIds[0] })
          .eq("family_character_id", characterId)
          .eq("user_id", user.id)
          .eq("status", "processing")
          .eq("enrollment_attempt_id", voice.enrollment_attempt_id)
          .select(VOICE_SELECT)
          .maybeSingle<FamilyCharacterVoice>();
        if (recoveryError) throw recoveryError;
        if (!recoveredVoice) {
          throw new FamilyVoiceRouteError(
            "声音状态已经变化，请刷新后重试。",
            409,
          );
        }
        voice = recoveredVoice;
      }
      const finalization = await finalizeProcessingVoice(
        supabase,
        voice,
        user.id,
        characterId,
      );
      if (finalization.status === "processing") {
        return NextResponse.json(
          { ok: true, status: "processing" },
          { status: 202 },
        );
      }
      if (finalization.status === "rejected") {
        return NextResponse.json({
          ok: true,
          status: finalization.restoredPreviousVoice ? "ready" : "failed",
          rejected: true,
        });
      }
      return NextResponse.json({ ok: true, status: "ready" });
    }
    if (voice.status === "deleting") {
      return NextResponse.json({ ok: true, status: "deleting" });
    }

    const retiredVoiceIds = normalizeProviderVoiceIds(
      voice.retired_voice_ids || [],
    ).filter((voiceId) => voiceId !== voice.voice_id);
    const retiredSamplePaths = normalizeOwnedSamplePaths(
      voice.retired_sample_paths || [],
      user.id,
      characterId,
    ).filter(
      (path) => voice.status !== "ready" || path !== voice.sample_audio_path,
    );
    if (retiredVoiceIds.length > 0) {
      await cleanupRetiredProviderVoices(supabase, {
        userId: user.id,
        characterId,
        status: voice.status,
        enrollmentAttemptId: voice.enrollment_attempt_id,
        retiredVoiceIds,
        allowListAbsenceConfirmation:
          isFamilyVoiceAmbiguousAbsenceGraceElapsed(voice.updated_at),
      });
    }
    if (retiredSamplePaths.length > 0) {
      await cleanupRetiredSamplePaths(supabase, {
        userId: user.id,
        characterId,
        status: voice.status,
        enrollmentAttemptId: voice.enrollment_attempt_id,
        samplePaths: retiredSamplePaths,
      });
    }
    return NextResponse.json({ ok: true, status: voice.status });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "声音状态请求参数无效。" },
        { status: 400 },
      );
    }
    if (error instanceof FamilyVoiceRouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[family-character-voice] voice status refresh failed");
    return NextResponse.json(
      { error: "声音状态暂时无法更新，请稍后重试。" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser(request);
    const characterId = idSchema.parse((await context.params).id);
    const supabase = getSupabaseAdmin();
    const { data: existingVoice, error: existingVoiceError } = await supabase
      .from("family_character_voices")
      .select(VOICE_SELECT)
      .eq("family_character_id", characterId)
      .eq("user_id", user.id)
      .maybeSingle<FamilyCharacterVoice>();
    if (existingVoiceError) throw existingVoiceError;
    if (!existingVoice) {
      return NextResponse.json({ ok: true, status: "absent" });
    }
    if (await isAccountVoiceDeletionLocked(supabase, user.id)) {
      throw new FamilyVoiceRouteError(
        "账户数据正在删除，请等待当前删除操作完成。",
        409,
      );
    }
    if (
      existingVoice.status === "processing" &&
      !isFamilyVoiceProcessingStale(existingVoice.updated_at)
    ) {
      throw new FamilyVoiceRouteError(
        "声音仍在创建或审核中，请稍候再删除。",
        409,
      );
    }
    const hasAmbiguousCreateSnapshot =
      !existingVoice.voice_id &&
      Array.isArray(existingVoice.provider_voice_ids_before_attempt);
    if (
      existingVoice.status === "deleting" &&
      !hasAmbiguousCreateSnapshot &&
      !isFamilyVoiceProcessingStale(existingVoice.updated_at)
    ) {
      throw new FamilyVoiceRouteError(
        "声音正在删除，请稍候。",
        409,
      );
    }

    const ambiguousProviderVoiceIds =
      (existingVoice.status === "processing" ||
        existingVoice.status === "deleting") &&
      hasAmbiguousCreateSnapshot
        ? await discoverBailianClonedVoiceIdsSince(
            createFamilyVoiceEnrollmentPrefix(characterId),
            existingVoice.provider_voice_ids_before_attempt || [],
          )
        : [];
    const ambiguousCreateStillUnresolved =
      hasAmbiguousCreateSnapshot && ambiguousProviderVoiceIds.length === 0;
    const ambiguousAbsenceGraceElapsed =
      existingVoice.status === "deleting" &&
      isFamilyVoiceAmbiguousAbsenceGraceElapsed(existingVoice.updated_at);
    if (
      ambiguousCreateStillUnresolved &&
      existingVoice.status === "deleting" &&
      !ambiguousAbsenceGraceElapsed
    ) {
      return NextResponse.json(
        {
          ok: true,
          status: "deleting",
          pending: true,
          retryAfterSeconds: Math.ceil(
            FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS / 1_000,
          ),
          message: "正在继续观察百炼音色状态，请稍后再试。",
        },
        { status: 202 },
      );
    }

    let previousReadyVoice = parseFamilyVoiceReadySnapshot(
      existingVoice.previous_ready_voice,
      user.id,
      characterId,
    );
    if (existingVoice.previous_ready_voice && !previousReadyVoice) {
      throw new FamilyVoiceRouteError(
        "声音恢复状态无效，请联系支持后重试删除。",
        500,
      );
    }
    let retiredSamplePaths = normalizeOwnedSamplePaths(
      [
        ...(existingVoice.retired_sample_paths || []),
        existingVoice.sample_audio_path,
        previousReadyVoice?.sample_audio_path,
      ],
      user.id,
      characterId,
    );
    let retiredVoiceIds = normalizeProviderVoiceIds([
      ...(existingVoice.retired_voice_ids || []),
      ...ambiguousProviderVoiceIds,
    ]);

    const deletionAttemptId = randomUUID();
    const deletionClaimPayload: Record<string, unknown> = {
      status: "deleting",
      error_message: null,
      enrollment_attempt_id: deletionAttemptId,
      retired_voice_ids: retiredVoiceIds,
      retired_sample_paths: retiredSamplePaths,
    };
    if (!hasAmbiguousCreateSnapshot || ambiguousProviderVoiceIds.length > 0) {
      deletionClaimPayload.provider_voice_ids_before_attempt = null;
    }
    const { data: claimedVoice, error: claimError } = await supabase
      .from("family_character_voices")
      .update(deletionClaimPayload)
      .eq("family_character_id", characterId)
      .eq("user_id", user.id)
      .eq("status", existingVoice.status)
      .eq("sample_audio_path", existingVoice.sample_audio_path)
      .eq("updated_at", existingVoice.updated_at)
      .select("family_character_id")
      .maybeSingle<{ family_character_id: string }>();
    if (claimError) throw claimError;
    if (!claimedVoice) {
      throw new FamilyVoiceRouteError(
        "声音状态已经变化，请刷新后再试。",
        409,
      );
    }
    if (
      ambiguousCreateStillUnresolved &&
      existingVoice.status !== "deleting"
    ) {
      return NextResponse.json(
        {
          ok: true,
          status: "deleting",
          pending: true,
          message: "正在确认百炼是否已创建音色，请稍后继续删除。",
        },
        { status: 202 },
      );
    }

    let activeVoiceId = existingVoice.voice_id;
    const providerVoiceIds = normalizeProviderVoiceIds([
      activeVoiceId,
      ...retiredVoiceIds,
      previousReadyVoice?.voice_id,
    ]);
    const allowListAbsenceConfirmation =
      existingVoice.status === "deleting" &&
      ambiguousProviderVoiceIds.length === 0 &&
      isFamilyVoiceAmbiguousAbsenceGraceElapsed(existingVoice.updated_at);
    for (const providerVoiceId of providerVoiceIds) {
      await deleteBailianClonedVoice(providerVoiceId, {
        allowListAbsenceConfirmation,
      });
      if (activeVoiceId === providerVoiceId) activeVoiceId = null;
      retiredVoiceIds = retiredVoiceIds.filter(
        (voiceId) => voiceId !== providerVoiceId,
      );
      if (previousReadyVoice?.voice_id === providerVoiceId) {
        previousReadyVoice = null;
      }
      const { data: savedDeletion, error: saveDeletionError } = await supabase
        .from("family_character_voices")
        .update({
          voice_id: activeVoiceId,
          retired_voice_ids: retiredVoiceIds,
          previous_ready_voice: previousReadyVoice,
        })
        .eq("family_character_id", characterId)
        .eq("user_id", user.id)
        .eq("status", "deleting")
        .eq("enrollment_attempt_id", deletionAttemptId)
        .select("family_character_id")
        .maybeSingle<{ family_character_id: string }>();
      if (saveDeletionError || !savedDeletion) {
        throw new FamilyVoiceRouteError(
          "声音删除状态保存失败，请重试。",
          500,
        );
      }
    }

    for (const samplePath of [...retiredSamplePaths]) {
      if (!(await removeVoiceSample(samplePath))) {
        throw new FamilyVoiceRouteError(
          "私有录音删除失败，请稍后重试。",
          502,
        );
      }
      retiredSamplePaths = retiredSamplePaths.filter(
        (path) => path !== samplePath,
      );
      const { data: savedDeletion, error: saveDeletionError } = await supabase
        .from("family_character_voices")
        .update({ retired_sample_paths: retiredSamplePaths })
        .eq("family_character_id", characterId)
        .eq("user_id", user.id)
        .eq("status", "deleting")
        .eq("enrollment_attempt_id", deletionAttemptId)
        .select("family_character_id")
        .maybeSingle<{ family_character_id: string }>();
      if (saveDeletionError || !savedDeletion) {
        throw new FamilyVoiceRouteError(
          "录音删除状态保存失败，请重试。",
          500,
        );
      }
    }

    const { data: deletedVoice, error: deleteError } = await supabase
      .from("family_character_voices")
      .delete()
      .eq("family_character_id", characterId)
      .eq("user_id", user.id)
      .eq("status", "deleting")
      .eq("enrollment_attempt_id", deletionAttemptId)
      .select("family_character_id")
      .maybeSingle<{ family_character_id: string }>();
    if (deleteError) throw deleteError;
    if (!deletedVoice) {
      throw new FamilyVoiceRouteError(
        "声音删除状态已经变化，请刷新后重试。",
        409,
      );
    }
    return NextResponse.json({ ok: true, status: "deleted" });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "声音删除请求参数无效。" },
        { status: 400 },
      );
    }
    if (error instanceof FamilyVoiceRouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof BailianVoiceCloningError) {
      return NextResponse.json(
        { error: "声音删除失败，请稍后重试。" },
        { status: error.status },
      );
    }
    console.error("[family-character-voice] voice deletion failed");
    return NextResponse.json(
      { error: "声音删除失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
