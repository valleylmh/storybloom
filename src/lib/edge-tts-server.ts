import { createHash, randomBytes, randomUUID } from "node:crypto";
import WebSocket, { type RawData } from "ws";

const BASE_WEBSOCKET_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WINDOWS_EPOCH_SECONDS = 11_644_473_600;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const MAX_SSML_TEXT_BYTES = 4_096;

let clockSkewSeconds = 0;

export interface EdgeTtsSynthesisInput {
  text: string;
  voice: string;
  maxAttempts?: number;
}

export interface EdgeTtsSynthesisResult {
  bytes: Buffer;
  requestId: string;
  usage: { characters: number };
}

export class EdgeTtsAudioError extends Error {
  readonly status: number;
  readonly responseStatus?: number;
  readonly serverDate?: string;

  constructor(
    message: string,
    status = 502,
    options?: ErrorOptions & { responseStatus?: number; serverDate?: string },
  ) {
    super(message, options);
    this.name = "EdgeTtsAudioError";
    this.status = status;
    this.responseStatus = options?.responseStatus;
    this.serverDate = options?.serverDate;
  }
}

function readPositiveInteger(name: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function rawDataToBuffer(data: RawData) {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

function connectionId() {
  return randomUUID().replaceAll("-", "");
}

function generateMuid() {
  return randomBytes(16).toString("hex").toUpperCase();
}

export function generateSecMsGec(unixTimestamp = Date.now() / 1_000) {
  let ticks = unixTimestamp + clockSkewSeconds + WINDOWS_EPOCH_SECONDS;
  ticks -= ticks % 300;
  ticks *= 10_000_000;

  return createHash("sha256")
    .update(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, "ascii")
    .digest("hex")
    .toUpperCase();
}

function websocketBaseUrl() {
  const configured = process.env.EDGE_TTS_WEBSOCKET_URL?.trim();
  if (!configured) return BASE_WEBSOCKET_URL;

  const isLocalTestSocket =
    process.env.NODE_ENV === "test" && configured.startsWith("ws://127.0.0.1:");
  if (!configured.startsWith("wss://") && !isLocalTestSocket) {
    throw new EdgeTtsAudioError("Edge TTS WebSocket 地址必须使用 wss://。", 500);
  }
  return configured;
}

function createWebSocketUrl() {
  const url = new URL(websocketBaseUrl());
  if (!url.searchParams.has("TrustedClientToken")) {
    url.searchParams.set("TrustedClientToken", TRUSTED_CLIENT_TOKEN);
  }
  url.searchParams.set("ConnectionId", connectionId());
  url.searchParams.set("Sec-MS-GEC", generateSecMsGec());
  url.searchParams.set("Sec-MS-GEC-Version", SEC_MS_GEC_VERSION);
  return url.toString();
}

function browserDateString(date = new Date()) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${weekdays[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(
    date.getUTCDate(),
  )} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(
    date.getUTCMinutes(),
  )}:${pad(date.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

export function normalizeEdgeTtsText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function splitTextByByteLength(text: string, maximumBytes = MAX_SSML_TEXT_BYTES) {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (Buffer.byteLength(remaining, "utf8") > maximumBytes) {
    let byteCount = 0;
    let safeEnd = 0;
    let preferredEnd = -1;

    for (let index = 0; index < remaining.length; ) {
      const codePoint = remaining.codePointAt(index);
      if (codePoint === undefined) break;
      const character = String.fromCodePoint(codePoint);
      const nextByteCount = byteCount + Buffer.byteLength(character, "utf8");
      if (nextByteCount > maximumBytes) break;

      byteCount = nextByteCount;
      index += character.length;
      safeEnd = index;
      if (/\s/u.test(character)) preferredEnd = index;
    }

    const splitAt = preferredEnd > 0 ? preferredEnd : safeEnd;
    if (splitAt <= 0) {
      throw new EdgeTtsAudioError("Edge TTS 文本无法安全拆分。", 422);
    }
    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export function createEdgeTtsSsml(text: string, voice: string) {
  const safeVoice = voice.replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeVoice) {
    throw new EdgeTtsAudioError("Edge TTS 音色配置无效。", 500);
  }

  return (
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
    `<voice name='${safeVoice}'>` +
    "<prosody pitch='+0Hz' rate='+0%' volume='+0%'>" +
    escapeXml(text) +
    "</prosody></voice></speak>"
  );
}

function speechConfigMessage() {
  return (
    `X-Timestamp:${browserDateString()}\r\n` +
    "Content-Type:application/json; charset=utf-8\r\n" +
    "Path:speech.config\r\n\r\n" +
    '{"context":{"synthesis":{"audio":{"metadataoptions":{' +
    '"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},' +
    '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n'
  );
}

function ssmlMessage(text: string, voice: string, requestId: string) {
  return (
    `X-RequestId:${requestId}\r\n` +
    "Content-Type:application/ssml+xml\r\n" +
    `X-Timestamp:${browserDateString()}Z\r\n` +
    "Path:ssml\r\n\r\n" +
    createEdgeTtsSsml(text, voice)
  );
}

function parseHeaders(rawHeaders: Buffer | string) {
  const headers = new Map<string, string>();
  const text = Buffer.isBuffer(rawHeaders) ? rawHeaders.toString("utf8") : rawHeaders;
  for (const line of text.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return headers;
}

export function parseEdgeTtsBinaryFrame(frame: Buffer) {
  if (frame.length < 2) {
    throw new EdgeTtsAudioError("Edge TTS 返回了不完整的二进制帧。", 502);
  }

  const headerLength = frame.readUInt16BE(0);
  const audioOffset = 2 + headerLength;
  if (audioOffset > frame.length) {
    throw new EdgeTtsAudioError("Edge TTS 二进制帧头长度无效。", 502);
  }

  const headers = parseHeaders(frame.subarray(2, audioOffset));
  if (headers.get("path") !== "audio") {
    throw new EdgeTtsAudioError("Edge TTS 返回了未知的二进制消息。", 502);
  }

  const contentType = headers.get("content-type");
  const bytes = frame.subarray(audioOffset);
  if (!contentType && bytes.length === 0) return null;
  if (contentType !== "audio/mpeg") {
    throw new EdgeTtsAudioError("Edge TTS 返回了非 MP3 音频。", 502);
  }
  if (!bytes.length) {
    throw new EdgeTtsAudioError("Edge TTS 返回了空音频帧。", 502);
  }
  return bytes;
}

function pathFromTextMessage(message: string) {
  const separator = message.indexOf("\r\n\r\n");
  const headerBlock = separator >= 0 ? message.slice(0, separator) : message;
  return parseHeaders(headerBlock).get("path");
}

function synthesizeChunkOnce(text: string, voice: string): Promise<{ bytes: Buffer; requestId: string }> {
  return new Promise((resolve, reject) => {
    const requestId = connectionId();
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      const bytes = Buffer.concat(chunks);
      if (!bytes.length) {
        fail(new EdgeTtsAudioError("Edge TTS 请求完成但没有返回音频。", 502));
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (socket.readyState === WebSocket.OPEN) socket.close(1000);
      resolve({ bytes, requestId });
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.terminate();
      }
      reject(
        error instanceof EdgeTtsAudioError
          ? error
          : new EdgeTtsAudioError("Edge TTS 暂时不可用，请稍后重试。", 502, {
              cause: error,
            }),
      );
    };

    const socket = new WebSocket(createWebSocketUrl(), {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent":
          `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
          `(KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 ` +
          `Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: `muid=${generateMuid()};`,
      },
      perMessageDeflate: true,
    });

    const timeout = setTimeout(() => {
      fail(new EdgeTtsAudioError("Edge TTS 请求超时，请稍后重试。", 504));
    }, readPositiveInteger("EDGE_TTS_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 28_000));

    socket.on("open", () => {
      try {
        socket.send(speechConfigMessage());
        socket.send(ssmlMessage(text, voice, requestId));
      } catch (error) {
        fail(error);
      }
    });

    socket.on("message", (data, isBinary) => {
      try {
        if (isBinary) {
          const audio = parseEdgeTtsBinaryFrame(rawDataToBuffer(data));
          if (audio) chunks.push(audio);
          return;
        }

        if (pathFromTextMessage(rawDataToBuffer(data).toString("utf8")) === "turn.end") {
          finish();
        }
      } catch (error) {
        fail(error);
      }
    });

    socket.on("unexpected-response", (_request, response) => {
      const responseStatus = response.statusCode || 502;
      const serverDate = Array.isArray(response.headers.date)
        ? response.headers.date[0]
        : response.headers.date;
      response.resume();
      fail(
        new EdgeTtsAudioError(
          responseStatus === 403
            ? "Edge TTS 鉴权被拒绝，请稍后重试。"
            : `Edge TTS WebSocket 握手失败：HTTP ${responseStatus}`,
          502,
          { responseStatus, serverDate },
        ),
      );
    });

    socket.on("error", fail);
    socket.on("close", (code, reason) => {
      if (settled) return;
      if (chunks.length) {
        finish();
        return;
      }
      fail(
        new EdgeTtsAudioError(
          `Edge TTS WebSocket 提前关闭（${code}${
            reason.length ? `：${reason.toString()}` : ""
          }）。`,
          502,
        ),
      );
    });
  });
}

function adjustClockSkew(serverDate: string | undefined) {
  if (!serverDate) return false;
  const serverTimestamp = Date.parse(serverDate);
  if (!Number.isFinite(serverTimestamp)) return false;
  clockSkewSeconds += serverTimestamp / 1_000 - (Date.now() / 1_000 + clockSkewSeconds);
  return true;
}

function isRetryable(error: unknown) {
  return (
    error instanceof EdgeTtsAudioError &&
    (error.status === 504 || error.status === 502 || error.responseStatus === 403)
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function synthesizeChunk(text: string, voice: string, requestedAttempts?: number) {
  const maxAttempts = requestedAttempts
    ? Math.max(1, Math.min(requestedAttempts, 2))
    : readPositiveInteger("EDGE_TTS_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS, 2);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await synthesizeChunkOnce(text, voice);
    } catch (error) {
      lastError = error;
      if (error instanceof EdgeTtsAudioError && error.responseStatus === 403) {
        adjustClockSkew(error.serverDate);
      }
      if (attempt >= maxAttempts || !isRetryable(error)) throw error;
      await wait(250 * attempt);
    }
  }

  throw lastError;
}

export async function synthesizeEdgeTtsAudio(
  input: EdgeTtsSynthesisInput,
): Promise<EdgeTtsSynthesisResult> {
  const text = normalizeEdgeTtsText(input.text);
  if (!text) {
    throw new EdgeTtsAudioError("清理特殊字符后没有可合成的旁白文字。", 422);
  }

  const audioChunks: Buffer[] = [];
  let requestId = "";
  for (const chunk of splitTextByByteLength(text)) {
    const result = await synthesizeChunk(chunk, input.voice, input.maxAttempts);
    audioChunks.push(result.bytes);
    requestId ||= result.requestId;
  }

  const bytes = Buffer.concat(audioChunks);
  if (!bytes.length) {
    throw new EdgeTtsAudioError("Edge TTS 没有返回音频。", 502);
  }
  return {
    bytes,
    requestId,
    usage: { characters: text.length },
  };
}
