import "server-only";

import {
  FAMILY_VOICE_TARGET_MODEL,
  isValidFamilyVoiceSampleDuration,
  parseOwnedFamilyVoiceSamplePath,
} from "@/lib/family-voice";

export type FamilyVoiceReadySnapshot = {
  sample_audio_path: string;
  sample_duration_seconds: number;
  voice_id: string;
  target_model: typeof FAMILY_VOICE_TARGET_MODEL;
  provider_request_id: string | null;
  consent_confirmed_at: string;
  consent_version: string;
};

function safeProviderId(value: unknown, maximum = 300) {
  return typeof value === "string" &&
    value.length <= maximum &&
    /^[a-z0-9._:-]+$/i.test(value)
    ? value
    : null;
}

export function parseFamilyVoiceReadySnapshot(
  value: unknown,
  userId: string,
  characterId: string,
): FamilyVoiceReadySnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const sampleAudioPath =
    typeof candidate.sample_audio_path === "string"
      ? candidate.sample_audio_path
      : "";
  const voiceId = safeProviderId(candidate.voice_id);
  const providerRequestId =
    candidate.provider_request_id === null
      ? null
      : safeProviderId(candidate.provider_request_id);
  if (
    !parseOwnedFamilyVoiceSamplePath(
      sampleAudioPath,
      userId,
      characterId,
      { allowLegacy: true },
    ) ||
    !isValidFamilyVoiceSampleDuration(candidate.sample_duration_seconds) ||
    !voiceId ||
    candidate.target_model !== FAMILY_VOICE_TARGET_MODEL ||
    (candidate.provider_request_id !== null && !providerRequestId) ||
    typeof candidate.consent_confirmed_at !== "string" ||
    !Number.isFinite(Date.parse(candidate.consent_confirmed_at)) ||
    typeof candidate.consent_version !== "string" ||
    candidate.consent_version.length < 1 ||
    candidate.consent_version.length > 100
  ) {
    return null;
  }

  return {
    sample_audio_path: sampleAudioPath,
    sample_duration_seconds: candidate.sample_duration_seconds as number,
    voice_id: voiceId,
    target_model: FAMILY_VOICE_TARGET_MODEL,
    provider_request_id: providerRequestId,
    consent_confirmed_at: candidate.consent_confirmed_at,
    consent_version: candidate.consent_version,
  };
}

export function createFamilyVoiceReadySnapshot(input: {
  sample_audio_path: string;
  sample_duration_seconds: number;
  voice_id: string;
  target_model: string;
  provider_request_id: string | null;
  consent_confirmed_at: string;
  consent_version: string;
}) {
  return {
    sample_audio_path: input.sample_audio_path,
    sample_duration_seconds: input.sample_duration_seconds,
    voice_id: input.voice_id,
    target_model: FAMILY_VOICE_TARGET_MODEL,
    provider_request_id: input.provider_request_id,
    consent_confirmed_at: input.consent_confirmed_at,
    consent_version: input.consent_version,
  } satisfies FamilyVoiceReadySnapshot;
}
