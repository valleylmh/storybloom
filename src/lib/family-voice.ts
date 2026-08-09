export const FAMILY_VOICE_SAMPLE_BUCKET = "family-voice-samples";
export const FAMILY_VOICE_MIN_SAMPLE_SECONDS = 10;
export const FAMILY_VOICE_MAX_SAMPLE_SECONDS = 60;
export const FAMILY_VOICE_MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
export const FAMILY_VOICE_MIN_SAMPLE_RATE_HZ = 16_000;
export const FAMILY_VOICE_CAPTURE_SAMPLE_RATE_HZ = 48_000;
export const FAMILY_VOICE_WAV_CHANNELS = 1;
export const FAMILY_VOICE_WAV_BITS_PER_SAMPLE = 16;
export const FAMILY_VOICE_SIGNED_URL_TTL_SECONDS = 10 * 60;
export const FAMILY_VOICE_PROCESSING_STALE_MS = 15 * 60 * 1_000;
export const FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS = 15 * 60 * 1_000;
export const FAMILY_VOICE_TARGET_MODEL = "qwen-audio-3.0-tts-plus";
export const FAMILY_VOICE_CONSENT_VERSION = "2026-08";

export type FamilyVoiceContentType =
  | "audio/mp4"
  | "audio/mpeg"
  | "audio/wav";

export type FamilyVoiceExtension = "m4a" | "mp3" | "wav";
export type FamilyVoiceStoredExtension =
  | FamilyVoiceExtension
  | "mp4"
  | "webm"
  | "ogg";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_FILENAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,159}$/i;

const CONTENT_TYPE_ALIASES: Record<string, FamilyVoiceContentType> = {
  "audio/mp4": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/vnd.wave": "audio/wav",
};

const EXTENSION_ALIASES: Record<string, FamilyVoiceExtension> = {
  m4a: "m4a",
  mp3: "mp3",
  wav: "wav",
};

const STORED_EXTENSION_ALIASES: Record<string, FamilyVoiceStoredExtension> = {
  ...EXTENSION_ALIASES,
  mp4: "mp4",
  webm: "webm",
  ogg: "ogg",
};

const CONTENT_TYPE_EXTENSIONS: Record<
  FamilyVoiceContentType,
  FamilyVoiceExtension
> = {
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

function writeWavAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeFamilyVoicePcm16Wav(
  chunks: readonly Float32Array[],
  sampleRate: number,
) {
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < FAMILY_VOICE_MIN_SAMPLE_RATE_HZ
  ) {
    throw new Error("family-voice-sample-rate-invalid");
  }

  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
    throw new Error("family-voice-pcm-empty");
  }

  const bytesPerSample = FAMILY_VOICE_WAV_BITS_PER_SAMPLE / 8;
  const dataByteLength = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  writeWavAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeWavAscii(view, 8, "WAVE");
  writeWavAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, FAMILY_VOICE_WAV_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * FAMILY_VOICE_WAV_CHANNELS * bytesPerSample,
    true,
  );
  view.setUint16(32, FAMILY_VOICE_WAV_CHANNELS * bytesPerSample, true);
  view.setUint16(34, FAMILY_VOICE_WAV_BITS_PER_SAMPLE, true);
  writeWavAscii(view, 36, "data");
  view.setUint32(40, dataByteLength, true);

  let byteOffset = 44;
  for (const chunk of chunks) {
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(
        byteOffset,
        sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
        true,
      );
      byteOffset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function isFamilyVoiceUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function isValidFamilyVoiceSampleDuration(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= FAMILY_VOICE_MIN_SAMPLE_SECONDS &&
    value <= FAMILY_VOICE_MAX_SAMPLE_SECONDS
  );
}

export function isValidFamilyVoiceSampleSize(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= FAMILY_VOICE_MAX_SAMPLE_BYTES
  );
}

export function isFamilyVoiceProcessingStale(
  updatedAt: string | null | undefined,
  nowMs = Date.now(),
) {
  if (!updatedAt) return false;
  const updatedAtMs = Date.parse(updatedAt);
  return (
    Number.isFinite(updatedAtMs) &&
    nowMs - updatedAtMs >= FAMILY_VOICE_PROCESSING_STALE_MS
  );
}

export function isFamilyVoiceAmbiguousAbsenceGraceElapsed(
  updatedAt: string | null | undefined,
  nowMs = Date.now(),
) {
  if (!updatedAt) return false;
  const updatedAtMs = Date.parse(updatedAt);
  return (
    Number.isFinite(updatedAtMs) &&
    nowMs - updatedAtMs >= FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS
  );
}

export function normalizeFamilyVoiceContentType(
  value: string | null | undefined,
): FamilyVoiceContentType | null {
  const baseType = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (!baseType) return null;
  return CONTENT_TYPE_ALIASES[baseType] || null;
}

export function normalizeFamilyVoiceExtension(
  value: string | null | undefined,
): FamilyVoiceExtension | null {
  const normalized = value?.trim().toLowerCase().replace(/^\./, "");
  if (!normalized) return null;
  const extension = normalized.includes(".")
    ? normalized.slice(normalized.lastIndexOf(".") + 1)
    : normalized;
  return EXTENSION_ALIASES[extension] || null;
}

export function normalizeFamilyVoiceStoredExtension(
  value: string | null | undefined,
): FamilyVoiceStoredExtension | null {
  const normalized = value?.trim().toLowerCase().replace(/^\./, "");
  if (!normalized) return null;
  const extension = normalized.includes(".")
    ? normalized.slice(normalized.lastIndexOf(".") + 1)
    : normalized;
  return STORED_EXTENSION_ALIASES[extension] || null;
}

export function areFamilyVoiceTypeAndExtensionCompatible(
  contentType: FamilyVoiceContentType,
  extension: FamilyVoiceExtension,
) {
  return CONTENT_TYPE_EXTENSIONS[contentType] === extension;
}

export function getFamilyVoiceCanonicalExtension(
  contentType: FamilyVoiceContentType,
) {
  return CONTENT_TYPE_EXTENSIONS[contentType];
}

export function isValidFamilyVoiceFilename(
  value: string,
  options: { allowLegacy?: boolean } = {},
) {
  return (
    SAFE_FILENAME_PATTERN.test(value) &&
    !value.includes("..") &&
    (options.allowLegacy
      ? normalizeFamilyVoiceStoredExtension(value)
      : normalizeFamilyVoiceExtension(value)) !== null
  );
}

export function parseOwnedFamilyVoiceSamplePath(
  path: string,
  userId: string,
  characterId: string,
  options?: { allowLegacy?: false },
): { filename: string; extension: FamilyVoiceExtension } | null;
export function parseOwnedFamilyVoiceSamplePath(
  path: string,
  userId: string,
  characterId: string,
  options: { allowLegacy: true },
): { filename: string; extension: FamilyVoiceStoredExtension } | null;
export function parseOwnedFamilyVoiceSamplePath(
  path: string,
  userId: string,
  characterId: string,
  options: { allowLegacy?: boolean } = {},
) {
  if (!isFamilyVoiceUuid(userId) || !isFamilyVoiceUuid(characterId)) {
    return null;
  }
  if (!path || path !== path.trim() || path.length > 512) return null;

  const segments = path.split("/");
  if (
    segments.length !== 3 ||
    segments[0] !== userId ||
    segments[1] !== characterId ||
    !isValidFamilyVoiceFilename(segments[2], options)
  ) {
    return null;
  }

  const extension = options.allowLegacy
    ? normalizeFamilyVoiceStoredExtension(segments[2])
    : normalizeFamilyVoiceExtension(segments[2]);
  if (!extension) return null;
  return { filename: segments[2], extension };
}

export function createFamilyVoiceEnrollmentPrefix(characterId: string) {
  if (!isFamilyVoiceUuid(characterId)) {
    throw new Error("Invalid family character ID.");
  }
  return `sb${characterId.replaceAll("-", "").slice(0, 8).toLowerCase()}`;
}
