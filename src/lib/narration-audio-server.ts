import "server-only";

import { createHash } from "node:crypto";
import {
  EdgeTtsAudioError,
  synthesizeEdgeTtsAudio,
} from "@/lib/edge-tts-server";
import {
  GeminiTtsAudioError,
  synthesizeGeminiTtsAudio,
} from "@/lib/gemini-tts-server";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { getCachedStory } from "@/lib/storage";

const STORY_AUDIO_BUCKET = "story-audio";
const GEMINI_TTS_MODEL_PRIMARY = "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_MODEL_FALLBACK = "gemini-3.1-flash-tts-preview";
const EDGE_TTS_MODEL = "edge-tts";
const DEFAULT_EDGE_TTS_VOICE_ZH = "zh-CN-XiaoxiaoNeural";
const DEFAULT_EDGE_TTS_VOICE_EN = "en-US-AnaNeural";
const DEFAULT_GEMINI_TTS_VOICE_ZH = "Leda";
const DEFAULT_GEMINI_TTS_VOICE_EN = "Aoede";
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3_600;
const MAX_NARRATION_TEXT_LENGTH = 5_000;

export const NARRATION_MODES = ["zh", "en", "zh-en"] as const;
export const NARRATION_FORMATS = ["mp3", "wav"] as const;
export const ALLOWED_TTS_MODELS = [
  GEMINI_TTS_MODEL_PRIMARY,
  GEMINI_TTS_MODEL_FALLBACK,
  EDGE_TTS_MODEL,
] as const;
export const GEMINI_TTS_VOICES = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
] as const;
export const EDGE_TTS_VOICES = [
  DEFAULT_EDGE_TTS_VOICE_ZH,
  DEFAULT_EDGE_TTS_VOICE_EN,
] as const;
export const ALLOWED_TTS_VOICES = [
  ...GEMINI_TTS_VOICES,
  ...EDGE_TTS_VOICES,
] as const;

export type NarrationMode = (typeof NARRATION_MODES)[number];
export type NarrationFormat = (typeof NARRATION_FORMATS)[number];
export type AllowedTtsModel = (typeof ALLOWED_TTS_MODELS)[number];
export type AllowedTtsVoice = (typeof ALLOWED_TTS_VOICES)[number];

export interface NarrationRequestInput {
  storyId?: string;
  text?: string;
  mode?: NarrationMode;
  model?: AllowedTtsModel;
  voice?: AllowedTtsVoice;
  format?: NarrationFormat;
  sampleRate?: number;
}

export interface ResolvedNarrationRequest {
  storyId?: string;
  text: string;
  textSource: "story" | "text";
  mode: NarrationMode;
  model: AllowedTtsModel;
  voice: AllowedTtsVoice;
  format: NarrationFormat;
  sampleRate: number;
  cacheKey: string;
  providerFallback?: boolean;
}

export interface NarrationAudioResult {
  audioUrl: string;
  bytes?: number;
  sourceUrl?: string;
  expiresAt?: number;
  signedUrlExpiresAt?: string;
  requestId?: string;
  usage?: {
    characters?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  model: AllowedTtsModel;
  voice: AllowedTtsVoice;
  format: NarrationFormat;
  sampleRate: number;
  mode: NarrationMode;
  storyId?: string;
  textSource: "story" | "text";
  cached: boolean;
  storage: "supabase" | "inline";
}

export type NarrationProgressStage =
  | "checking-cache"
  | "cached"
  | "generating"
  | "downloading"
  | "storing"
  | "ready"
  | "deduplicated";

interface PrepareNarrationOptions {
  onProgress?: (progress: {
    stage: NarrationProgressStage;
    model: AllowedTtsModel;
    voice: AllowedTtsVoice;
  }) => void;
}

interface GeneratedAudio {
  bytes: Buffer;
  contentType: string;
  sourceUrl?: string;
  expiresAt?: number;
  requestId?: string;
  usage?: {
    characters?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export class NarrationAudioError extends Error {
  readonly status: number;

  constructor(message: string, status = 500, options?: ErrorOptions) {
    super(message, options);
    this.name = "NarrationAudioError";
    this.status = status;
  }
}

const inflightAudio = new Map<string, Promise<NarrationAudioResult>>();

function isOneOf<T extends string>(value: string | undefined, values: readonly T[]): value is T {
  return Boolean(value && values.includes(value as T));
}

function readPositiveInteger(name: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, maximum);
}

function getConfiguredModel(requested?: AllowedTtsModel): AllowedTtsModel {
  if (requested) return requested;
  const geminiDisabled = /^(?:0|false|off)$/i.test(
    process.env.GEMINI_TTS_ENABLED?.trim() || "",
  );
  if (!process.env.GEMINI_API_KEY?.trim() || geminiDisabled) return EDGE_TTS_MODEL;

  const configured = process.env.GEMINI_TTS_MODEL?.trim();
  return isOneOf(configured, [
    GEMINI_TTS_MODEL_PRIMARY,
    GEMINI_TTS_MODEL_FALLBACK,
  ] as const)
    ? configured
    : GEMINI_TTS_MODEL_PRIMARY;
}

function getConfiguredVoice(
  mode: NarrationMode,
  model: AllowedTtsModel,
  requested?: AllowedTtsVoice,
): AllowedTtsVoice {
  if (model !== EDGE_TTS_MODEL) {
    if (requested && isOneOf(requested, GEMINI_TTS_VOICES)) return requested;
    const fallback =
      mode === "en" ? DEFAULT_GEMINI_TTS_VOICE_EN : DEFAULT_GEMINI_TTS_VOICE_ZH;
    const configured = (mode === "en"
      ? process.env.GEMINI_TTS_VOICE_EN?.trim()
      : process.env.GEMINI_TTS_VOICE_ZH?.trim()) as AllowedTtsVoice | undefined;
    return isOneOf(configured, GEMINI_TTS_VOICES) ? configured : fallback;
  }

  if (requested && isOneOf(requested, EDGE_TTS_VOICES)) return requested;
  const fallback =
    mode === "en" ? DEFAULT_EDGE_TTS_VOICE_EN : DEFAULT_EDGE_TTS_VOICE_ZH;
  const configured = (mode === "en"
    ? process.env.EDGE_TTS_VOICE_EN?.trim()
    : process.env.EDGE_TTS_VOICE_ZH?.trim()) as AllowedTtsVoice | undefined;
  return isOneOf(configured, EDGE_TTS_VOICES) ? configured : fallback;
}

function formatForModel(model: AllowedTtsModel): NarrationFormat {
  return model === EDGE_TTS_MODEL ? "mp3" : "wav";
}

function getNarrationText(
  pages: Array<{ zhText?: string; enText?: string }>,
  mode: NarrationMode,
) {
  return pages
    .flatMap((page) => {
      const lines: string[] = [];
      if ((mode === "zh" || mode === "zh-en") && page.zhText?.trim()) {
        lines.push(page.zhText.trim());
      }
      if ((mode === "en" || mode === "zh-en") && page.enText?.trim()) {
        lines.push(page.enText.trim());
      }
      return lines;
    })
    .join("\n\n");
}

function makeCacheKey(request: Omit<ResolvedNarrationRequest, "cacheKey">) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        text: request.text,
        mode: request.mode,
        model: request.model,
        voice: request.voice,
        format: request.format,
        sampleRate: request.sampleRate,
      }),
    )
    .digest("hex");
}

export async function resolveNarrationRequest(
  input: NarrationRequestInput,
): Promise<ResolvedNarrationRequest> {
  const mode = input.mode || "zh";
  let text = "";
  let textSource: "story" | "text" = "text";

  if (input.storyId) {
    const story = await getCachedStory(input.storyId);
    if (story) {
      text = getNarrationText(story.pages, mode);
      textSource = "story";
    } else if (input.text?.trim()) {
      // Static/custom stories are not necessarily in the server cache yet. Keep
      // the legacy text path available, but never let it override a cached story.
      text = input.text.trim();
    } else {
      throw new NarrationAudioError("未找到可朗读的绘本，请重新打开绘本后重试。", 404);
    }
  } else {
    text = input.text?.trim() || "";
  }

  if (!text) {
    throw new NarrationAudioError("当前语言模式没有可朗读文本。", 422);
  }
  if (text.length > MAX_NARRATION_TEXT_LENGTH) {
    throw new NarrationAudioError(
      `朗读文本不能超过 ${MAX_NARRATION_TEXT_LENGTH} 个字符。`,
      413,
    );
  }

  const model = getConfiguredModel(input.model);
  const baseRequest = {
    storyId: input.storyId,
    text,
    textSource,
    mode,
    model,
    voice: getConfiguredVoice(mode, model, input.voice),
    format: formatForModel(model),
    sampleRate: DEFAULT_SAMPLE_RATE,
  } satisfies Omit<ResolvedNarrationRequest, "cacheKey">;

  return {
    ...baseRequest,
    cacheKey: makeCacheKey(baseRequest),
  };
}

function contentTypeForFormat(format: NarrationFormat) {
  return format === "mp3" ? "audio/mpeg" : "audio/wav";
}

async function synthesizeNarration(
  request: ResolvedNarrationRequest,
  onProgress?: PrepareNarrationOptions["onProgress"],
): Promise<GeneratedAudio> {
  onProgress?.({ stage: "generating", model: request.model, voice: request.voice });

  try {
    if (request.model !== EDGE_TTS_MODEL) {
      return await synthesizeGeminiTtsAudio({
        text: request.text,
        voice: request.voice,
        mode: request.mode,
        model: request.model,
      });
    }

    const result = await synthesizeEdgeTtsAudio({
      text: request.text,
      voice: request.voice,
      maxAttempts: request.providerFallback ? 1 : undefined,
    });
    return {
      bytes: result.bytes,
      contentType: contentTypeForFormat(request.format),
      requestId: result.requestId,
      usage: result.usage,
    };
  } catch (error) {
    if (error instanceof GeminiTtsAudioError) {
      throw new NarrationAudioError(error.message, error.status, { cause: error });
    }
    if (error instanceof EdgeTtsAudioError) {
      throw new NarrationAudioError(error.message, error.status, { cause: error });
    }
    throw error;
  }
}

function hasSupabaseAdminConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function storagePathForRequest(request: ResolvedNarrationRequest) {
  return `v1/${request.cacheKey.slice(0, 2)}/${request.cacheKey}.${request.format}`;
}

async function createSignedAudioUrl(path: string) {
  const ttlSeconds = readPositiveInteger(
    "STORY_AUDIO_SIGNED_URL_TTL_SECONDS",
    DEFAULT_SIGNED_URL_TTL_SECONDS,
    86_400,
  );
  const { data, error } = await getSupabaseAdmin()
    .storage.from(STORY_AUDIO_BUCKET)
    .createSignedUrl(path, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new NarrationAudioError(
      `无法为已存储的音频创建签名地址：${error?.message || "未知错误"}`,
      502,
    );
  }

  return {
    audioUrl: data.signedUrl,
    signedUrlExpiresAt: new Date(Date.now() + ttlSeconds * 1_000).toISOString(),
  };
}

async function findStoredAudio(request: ResolvedNarrationRequest) {
  if (!hasSupabaseAdminConfig()) return null;

  const path = storagePathForRequest(request);
  const separator = path.lastIndexOf("/");
  const folder = path.slice(0, separator);
  const fileName = path.slice(separator + 1);
  const { data, error } = await getSupabaseAdmin()
    .storage.from(STORY_AUDIO_BUCKET)
    .list(folder, { limit: 10, search: fileName });

  if (error) {
    console.warn("[audio] story-audio cache is unavailable; using inline audio", {
      error: error.message,
    });
    return null;
  }

  const storedFile = data.find((file) => file.name === fileName);
  if (!storedFile) return null;

  let signed: Awaited<ReturnType<typeof createSignedAudioUrl>>;
  try {
    signed = await createSignedAudioUrl(path);
  } catch (error) {
    console.warn("[audio] could not sign cached audio; regenerating inline", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  const storedSize = storedFile.metadata?.size;
  return {
    ...signed,
    bytes: typeof storedSize === "number" ? storedSize : undefined,
  };
}

function isDuplicateStorageError(error: { message?: string; statusCode?: string } | null) {
  if (!error) return false;
  return error.statusCode === "409" || /duplicate|already exists/i.test(error.message || "");
}

async function storeAudio(request: ResolvedNarrationRequest, audio: GeneratedAudio) {
  const path = storagePathForRequest(request);
  const { error } = await getSupabaseAdmin().storage.from(STORY_AUDIO_BUCKET).upload(
    path,
    audio.bytes,
    {
      contentType: contentTypeForFormat(request.format),
      cacheControl: "31536000",
      upsert: false,
    },
  );

  if (error && !isDuplicateStorageError(error)) {
    console.warn("[audio] could not persist narration; returning inline audio", {
      error: error.message,
    });
    return null;
  }

  try {
    return await createSignedAudioUrl(path);
  } catch (error) {
    console.warn("[audio] could not sign persisted narration; returning inline audio", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function resultMetadata(request: ResolvedNarrationRequest) {
  return {
    model: request.model,
    voice: request.voice,
    format: request.format,
    sampleRate: request.sampleRate,
    mode: request.mode,
    storyId: request.storyId,
    textSource: request.textSource,
  };
}

function createEdgeFallbackRequest(
  request: ResolvedNarrationRequest,
): ResolvedNarrationRequest {
  const baseRequest = {
    storyId: request.storyId,
    text: request.text,
    textSource: request.textSource,
    mode: request.mode,
    model: EDGE_TTS_MODEL,
    voice: getConfiguredVoice(request.mode, EDGE_TTS_MODEL),
    format: "mp3",
    sampleRate: DEFAULT_SAMPLE_RATE,
    providerFallback: true,
  } satisfies Omit<ResolvedNarrationRequest, "cacheKey">;

  return {
    ...baseRequest,
    cacheKey: makeCacheKey(baseRequest),
  };
}

function createGeminiFallbackRequest(
  request: ResolvedNarrationRequest,
): ResolvedNarrationRequest {
  const baseRequest = {
    storyId: request.storyId,
    text: request.text,
    textSource: request.textSource,
    mode: request.mode,
    model: GEMINI_TTS_MODEL_FALLBACK,
    voice: getConfiguredVoice(request.mode, GEMINI_TTS_MODEL_FALLBACK),
    format: "wav",
    sampleRate: DEFAULT_SAMPLE_RATE,
  } satisfies Omit<ResolvedNarrationRequest, "cacheKey">;

  return {
    ...baseRequest,
    cacheKey: makeCacheKey(baseRequest),
  };
}

async function prepareNarrationAudioUncached(
  request: ResolvedNarrationRequest,
  options: PrepareNarrationOptions,
): Promise<NarrationAudioResult> {
  if (hasSupabaseAdminConfig()) {
    options.onProgress?.({
      stage: "checking-cache",
      model: request.model,
      voice: request.voice,
    });
    const stored = await findStoredAudio(request);
    if (stored) {
      options.onProgress?.({ stage: "cached", model: request.model, voice: request.voice });
      return {
        ...stored,
        ...resultMetadata(request),
        cached: true,
        storage: "supabase",
      };
    }
  }

  let generated: GeneratedAudio;
  try {
    generated = await synthesizeNarration(request, options.onProgress);
  } catch (error) {
    if (request.model === EDGE_TTS_MODEL) throw error;

    const nextRequest =
      request.model === GEMINI_TTS_MODEL_PRIMARY
        ? createGeminiFallbackRequest(request)
        : createEdgeFallbackRequest(request);

    console.warn("[audio] TTS provider failed; using fallback", {
      model: request.model,
      fallbackModel: nextRequest.model,
      error: error instanceof Error ? error.message : String(error),
    });
    return prepareNarrationAudio(nextRequest, options);
  }

  if (hasSupabaseAdminConfig()) {
    options.onProgress?.({ stage: "storing", model: request.model, voice: request.voice });
    const stored = await storeAudio(request, generated);
    if (stored) {
      options.onProgress?.({ stage: "ready", model: request.model, voice: request.voice });
      return {
        ...stored,
        ...resultMetadata(request),
        bytes: generated.bytes.length,
        sourceUrl: generated.sourceUrl,
        expiresAt: generated.expiresAt,
        requestId: generated.requestId,
        usage: generated.usage,
        cached: false,
        storage: "supabase",
      };
    }
  }

  options.onProgress?.({ stage: "ready", model: request.model, voice: request.voice });
  return {
    audioUrl: `data:${generated.contentType};base64,${generated.bytes.toString("base64")}`,
    bytes: generated.bytes.length,
    sourceUrl: generated.sourceUrl,
    expiresAt: generated.expiresAt,
    requestId: generated.requestId,
    usage: generated.usage,
    ...resultMetadata(request),
    cached: false,
    storage: "inline",
  };
}

export async function prepareNarrationAudio(
  request: ResolvedNarrationRequest,
  options: PrepareNarrationOptions = {},
) {
  const existing = inflightAudio.get(request.cacheKey);
  if (existing) {
    options.onProgress?.({
      stage: "deduplicated",
      model: request.model,
      voice: request.voice,
    });
    return existing;
  }

  const pending = prepareNarrationAudioUncached(request, options);
  inflightAudio.set(request.cacheKey, pending);

  try {
    return await pending;
  } finally {
    if (inflightAudio.get(request.cacheKey) === pending) {
      inflightAudio.delete(request.cacheKey);
    }
  }
}
