import "server-only";

import { parseBuffer } from "music-metadata";
import {
  FAMILY_VOICE_MAX_SAMPLE_SECONDS,
  FAMILY_VOICE_MIN_SAMPLE_RATE_HZ,
  FAMILY_VOICE_MIN_SAMPLE_SECONDS,
  FAMILY_VOICE_WAV_BITS_PER_SAMPLE,
  type FamilyVoiceContentType,
} from "@/lib/family-voice";

const DURATION_TOLERANCE_SECONDS = 0.35;

const CONTAINER_PATTERNS: Record<FamilyVoiceContentType, RegExp> = {
  "audio/mp4": /(?:mp4|m4a|isom|quicktime)/i,
  "audio/mpeg": /(?:mpeg|mp3)/i,
  "audio/wav": /(?:wave|wav|riff)/i,
};

export class FamilyVoiceMediaError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "FamilyVoiceMediaError";
    this.status = status;
  }
}

export async function inspectFamilyVoiceSample(
  blob: Blob,
  expectedContentType: FamilyVoiceContentType,
) {
  let metadata;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    metadata = await parseBuffer(
      bytes,
      { mimeType: expectedContentType, size: bytes.byteLength },
      { duration: true, skipCovers: true },
    );
  } catch (error) {
    throw new FamilyVoiceMediaError(
      "录音文件无法解析，请重新录制。",
      415,
      { cause: error },
    );
  }

  const container = metadata.format.container?.trim() || "";
  if (
    metadata.format.hasAudio !== true ||
    metadata.format.hasVideo === true ||
    !CONTAINER_PATTERNS[expectedContentType].test(container)
  ) {
    throw new FamilyVoiceMediaError(
      "录音容器与文件格式不匹配，请重新录制。",
      415,
    );
  }

  const sampleRate = metadata.format.sampleRate;
  if (
    typeof sampleRate !== "number" ||
    !Number.isFinite(sampleRate) ||
    sampleRate < FAMILY_VOICE_MIN_SAMPLE_RATE_HZ
  ) {
    throw new FamilyVoiceMediaError(
      `录音采样率需至少为 ${FAMILY_VOICE_MIN_SAMPLE_RATE_HZ / 1_000}kHz。`,
      422,
    );
  }

  const bitsPerSample = metadata.format.bitsPerSample;
  if (
    expectedContentType === "audio/wav" &&
    bitsPerSample !== FAMILY_VOICE_WAV_BITS_PER_SAMPLE
  ) {
    throw new FamilyVoiceMediaError(
      `WAV 录音必须为 ${FAMILY_VOICE_WAV_BITS_PER_SAMPLE}-bit PCM。`,
      422,
    );
  }

  const durationSeconds = metadata.format.duration;
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds)
  ) {
    throw new FamilyVoiceMediaError(
      "无法确认录音时长，请重新录制。",
      422,
    );
  }
  if (
    durationSeconds <
      FAMILY_VOICE_MIN_SAMPLE_SECONDS - DURATION_TOLERANCE_SECONDS ||
    durationSeconds >
      FAMILY_VOICE_MAX_SAMPLE_SECONDS + DURATION_TOLERANCE_SECONDS
  ) {
    throw new FamilyVoiceMediaError(
      `录音实际时长需为 ${FAMILY_VOICE_MIN_SAMPLE_SECONDS}–${FAMILY_VOICE_MAX_SAMPLE_SECONDS} 秒。`,
      422,
    );
  }

  return {
    durationSeconds: Math.min(
      FAMILY_VOICE_MAX_SAMPLE_SECONDS,
      Math.max(FAMILY_VOICE_MIN_SAMPLE_SECONDS, durationSeconds),
    ),
    container,
    sampleRate,
    bitsPerSample,
  };
}
