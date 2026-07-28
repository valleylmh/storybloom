import "server-only";

const DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_SAMPLE_RATE = 24_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 1;
const PCM_SAMPLE_WIDTH_BYTES = 2;
const PCM_CHANNELS = 1;

interface GeminiTtsResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface GeminiTtsAudioInput {
  text: string;
  voice: string;
  mode: "zh" | "en" | "zh-en";
  model?: string;
}

export interface GeminiTtsAudioResult {
  bytes: Buffer;
  contentType: "audio/wav";
  requestId?: string;
  usage: {
    characters: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export class GeminiTtsAudioError extends Error {
  readonly status: number;

  constructor(message: string, status = 502, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeminiTtsAudioError";
    this.status = status;
  }
}

function readPositiveInteger(name: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiTtsAudioError(
      "Gemini TTS 未配置 GEMINI_API_KEY，将使用 Edge TTS。",
      503,
    );
  }
  return apiKey;
}

function getEndpoint(model: string) {
  const baseUrl = (
    process.env.GEMINI_TTS_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/+$/, "");
  return `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
}

export function buildGeminiTtsPrompt(
  text: string,
  mode: GeminiTtsAudioInput["mode"],
) {
  if (mode === "en") {
    return [
      "Read the following text as a warm, natural children's picture-book narrator.",
      "Use a gentle pace and clear pauses. Read only the supplied text without adding an introduction or explanation.",
      "",
      text,
    ].join("\n");
  }

  if (mode === "zh-en") {
    return [
      "请以温暖、自然、富有想象力的儿童绘本旁白语气朗读以下中英文正文。",
      "语速稍慢、停顿清晰，并自然切换语言。只朗读正文，不要添加开场白或解释。",
      "",
      text,
    ].join("\n");
  }

  return [
    "请以温暖、自然、富有想象力的儿童绘本旁白语气朗读以下正文。",
    "语速稍慢、停顿清晰。只朗读正文，不要添加开场白或解释。",
    "",
    text,
  ].join("\n");
}

export function wrapPcm16LeAsWav(
  pcm: Buffer,
  sampleRate = DEFAULT_SAMPLE_RATE,
  channels = PCM_CHANNELS,
) {
  if (pcm.length === 0 || pcm.length % PCM_SAMPLE_WIDTH_BYTES !== 0) {
    throw new GeminiTtsAudioError("Gemini TTS 返回了无效的 PCM 音频。", 502);
  }

  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * PCM_SAMPLE_WIDTH_BYTES;
  const blockAlign = channels * PCM_SAMPLE_WIDTH_BYTES;

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(PCM_SAMPLE_WIDTH_BYTES * 8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function statusForProviderError(status: number) {
  if (status === 429) return 503;
  if (status === 408 || status === 504) return 504;
  return 502;
}

async function synthesizeOnce(input: GeminiTtsAudioInput) {
  const model = input.model || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger("GEMINI_TTS_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 28_000),
  );

  let response: Response;
  try {
    response = await fetch(getEndpoint(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getGeminiApiKey(),
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildGeminiTtsPrompt(input.text, input.mode) }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: input.voice },
            },
          },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiTtsAudioError("Gemini TTS 请求超时，将使用 Edge TTS。", 504, {
        cause: error,
      });
    }
    throw new GeminiTtsAudioError("Gemini TTS 暂时不可用，将使用 Edge TTS。", 502, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => null)) as GeminiTtsResponse | null;
  if (!response.ok) {
    const detail = payload?.error?.message?.trim();
    throw new GeminiTtsAudioError(
      detail ? `Gemini TTS 请求失败：${detail}` : `Gemini TTS 请求失败：HTTP ${response.status}`,
      statusForProviderError(response.status),
    );
  }

  const audioPart = payload?.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  );
  const encodedPcm = audioPart?.inlineData?.data;
  const mimeType = audioPart?.inlineData?.mimeType || "";
  if (!encodedPcm) {
    throw new GeminiTtsAudioError(
      `Gemini TTS 没有返回音频${payload?.candidates?.[0]?.finishReason ? `（${payload.candidates[0].finishReason}）` : ""}。`,
      502,
    );
  }
  if (!/^audio\/(?:L16|pcm)(?:;|$)/i.test(mimeType)) {
    throw new GeminiTtsAudioError(`Gemini TTS 返回了不支持的音频格式：${mimeType || "未知"}。`, 502);
  }

  const rateMatch = mimeType.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Number.parseInt(rateMatch[1], 10) : DEFAULT_SAMPLE_RATE;
  if (sampleRate !== DEFAULT_SAMPLE_RATE) {
    throw new GeminiTtsAudioError(
      `Gemini TTS 返回了不支持的采样率：${sampleRate} Hz。`,
      502,
    );
  }

  const pcm = Buffer.from(encodedPcm, "base64");
  return {
    bytes: wrapPcm16LeAsWav(pcm, sampleRate),
    contentType: "audio/wav" as const,
    requestId:
      response.headers.get("x-request-id") ||
      response.headers.get("x-goog-request-id") ||
      undefined,
    usage: {
      characters: input.text.length,
      inputTokens: payload?.usageMetadata?.promptTokenCount,
      outputTokens: payload?.usageMetadata?.candidatesTokenCount,
      totalTokens: payload?.usageMetadata?.totalTokenCount,
    },
  };
}

export async function synthesizeGeminiTtsAudio(input: GeminiTtsAudioInput) {
  const attempts = readPositiveInteger(
    "GEMINI_TTS_MAX_ATTEMPTS",
    DEFAULT_MAX_ATTEMPTS,
    2,
  );
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await synthesizeOnce(input);
    } catch (error) {
      lastError = error;
      if (
        attempt >= attempts ||
        !(error instanceof GeminiTtsAudioError) ||
        !isRetryableStatus(error.status)
      ) {
        throw error;
      }
    }
  }

  throw lastError;
}
