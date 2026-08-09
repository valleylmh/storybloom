import "server-only";

const DEFAULT_ENDPOINT =
  "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer";
const DEFAULT_MODEL = "qwen-audio-3.0-tts-plus";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_SAMPLE_RATE = 24_000;

interface TokenPlanTtsResponse {
  output?: {
    audio?: {
      data?: string;
      id?: string;
      expires_at?: number;
      url?: string;
    };
    finish_reason?: string;
  };
  usage?: {
    characters?: number;
  };
  request_id?: string;
  code?: string;
  message?: string;
}

export interface TokenPlanTtsInput {
  text: string;
  voice: string;
  model?: string;
}

export interface TokenPlanTtsResult {
  bytes: Buffer;
  contentType: "audio/mpeg";
  requestId?: string;
  expiresAt?: number;
  usage: { characters: number };
}

export class TokenPlanTtsError extends Error {
  readonly status: number;

  constructor(message: string, status = 502, options?: ErrorOptions) {
    super(message, options);
    this.name = "TokenPlanTtsError";
    this.status = status;
  }
}

function readPositiveInteger(name: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function hasTokenPlanTtsConfig() {
  return Boolean(process.env.DASHSCOPE_TOKEN_KEY?.trim());
}

function getTokenPlanApiKey() {
  const apiKey = process.env.DASHSCOPE_TOKEN_KEY?.trim();
  if (!apiKey) {
    throw new TokenPlanTtsError(
      "Token Plan TTS 未配置 DASHSCOPE_TOKEN_KEY。",
      503,
    );
  }
  return apiKey;
}

function getEndpoint() {
  const configured = process.env.TOKEN_PLAN_TTS_ENDPOINT?.trim();
  const endpoint = configured || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new TokenPlanTtsError("Token Plan TTS 接口必须使用 HTTPS。", 500);
  }
  return url.toString();
}

export function isTrustedTokenPlanAudioUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "oss-cn-beijing.aliyuncs.com" ||
        url.hostname.endsWith(".oss-cn-beijing.aliyuncs.com"))
    );
  } catch {
    return false;
  }
}

function normalizeAudioUrl(value: string) {
  if (!isTrustedTokenPlanAudioUrl(value)) {
    throw new TokenPlanTtsError("Token Plan TTS 返回了不可信的音频地址。", 502);
  }
  const url = new URL(value);
  url.protocol = "https:";
  return url.toString();
}

function isMp3(bytes: Buffer) {
  return (
    bytes.subarray(0, 3).toString("ascii") === "ID3" ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

function providerErrorMessage(payload: TokenPlanTtsResponse | null, status: number) {
  const code = payload?.code?.trim();
  if (code && /^[a-z0-9._:-]{1,64}$/i.test(code)) {
    return `Token Plan TTS 请求失败：${code}`;
  }
  return `Token Plan TTS 请求失败：HTTP ${status}`;
}

export async function synthesizeTokenPlanTtsAudio(input: TokenPlanTtsInput) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger("TOKEN_PLAN_TTS_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 8_000),
  );

  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTokenPlanApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model || DEFAULT_MODEL,
        input: {
          text: input.text,
          voice: input.voice,
          format: "mp3",
          sample_rate: DEFAULT_SAMPLE_RATE,
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as TokenPlanTtsResponse | null;
    if (!response.ok) {
      throw new TokenPlanTtsError(providerErrorMessage(payload, response.status), 502);
    }

    const audio = payload?.output?.audio;
    const audioUrl = audio?.url?.trim();
    if (payload?.output?.finish_reason !== "stop" || !audioUrl) {
      throw new TokenPlanTtsError("Token Plan TTS 没有返回可下载的音频。", 502);
    }

    const audioResponse = await fetch(normalizeAudioUrl(audioUrl), {
      signal: controller.signal,
    });
    if (!audioResponse.ok) {
      throw new TokenPlanTtsError(
        `Token Plan TTS 音频下载失败：HTTP ${audioResponse.status}`,
        502,
      );
    }

    const bytes = Buffer.from(await audioResponse.arrayBuffer());
    if (!isMp3(bytes)) {
      throw new TokenPlanTtsError("Token Plan TTS 返回了无效的 MP3 音频。", 502);
    }

    return {
      bytes,
      contentType: "audio/mpeg" as const,
      requestId: payload?.request_id,
      expiresAt: audio?.expires_at,
      usage: {
        characters: payload?.usage?.characters ?? input.text.length,
      },
    };
  } catch (error) {
    if (error instanceof TokenPlanTtsError) throw error;
    if (controller.signal.aborted) {
      throw new TokenPlanTtsError(
        "Token Plan TTS 请求超时，请稍后重试。",
        504,
        { cause: error },
      );
    }
    throw new TokenPlanTtsError(
      "Token Plan TTS 暂时不可用，请稍后重试。",
      502,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}
