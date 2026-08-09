import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FAMILY_VOICE_MAX_SAMPLE_BYTES,
  FAMILY_VOICE_SAMPLE_BUCKET,
  normalizeFamilyVoiceContentType,
} from "@/lib/family-voice";

export const FAMILY_VOICE_SAMPLES_BUCKET = FAMILY_VOICE_SAMPLE_BUCKET;

export const FAMILY_CHARACTER_VOICE_SAFE_COLUMNS = [
  "id",
  "family_character_id",
  "profile_id",
  "user_id",
  "sample_audio_path",
  "sample_duration_seconds",
  "target_model",
  "status",
  "error_message",
  "consent_confirmed_at",
  "consent_version",
  "created_at",
  "updated_at",
] as const;

export const FAMILY_CHARACTER_VOICE_SAFE_SELECT =
  FAMILY_CHARACTER_VOICE_SAFE_COLUMNS.join(",");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIO_CONTENT_TYPE_BY_EXTENSION = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
} as const;

type VoiceSampleExtension = keyof typeof AUDIO_CONTENT_TYPE_BY_EXTENSION;

export type FamilyCharacterVoiceStatus =
  | "processing"
  | "ready"
  | "failed"
  | "deleting";

export interface FamilyCharacterVoiceSafeRow {
  id: string;
  family_character_id: string;
  profile_id: string;
  user_id: string;
  sample_audio_path: string;
  sample_duration_seconds: number;
  target_model: "qwen-audio-3.0-tts-plus";
  status: FamilyCharacterVoiceStatus;
  error_message: string | null;
  consent_confirmed_at: string;
  consent_version: string;
  created_at: string;
  updated_at: string;
}

function isMissingFamilyCharacterVoicesRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .*family_character_voices.* does not exist/i.test(message) ||
    /could not find (?:the )?table .*family_character_voices/i.test(message) ||
    /family_character_voices.*schema cache/i.test(message)
  );
}

function getVoiceSampleExtension(storagePath: string): VoiceSampleExtension {
  const segments = storagePath.split("/");
  if (
    segments.length !== 3 ||
    !UUID_PATTERN.test(segments[0] || "") ||
    !UUID_PATTERN.test(segments[1] || "") ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("?") ||
        segment.includes("#"),
    )
  ) {
    throw new Error("family-voice-sample-path-invalid");
  }
  const extension = segments[2].split(".").pop()?.toLowerCase() || "";
  if (!(extension in AUDIO_CONTENT_TYPE_BY_EXTENSION)) {
    throw new Error("family-voice-sample-extension-invalid");
  }
  return extension as VoiceSampleExtension;
}

export async function listFamilyCharacterVoices<
  T extends FamilyCharacterVoiceSafeRow = FamilyCharacterVoiceSafeRow,
>(
  supabase: SupabaseClient,
  filter: { userId?: string; profileId?: string; familyCharacterId?: string } = {},
  options: { missingRelation?: "empty" | "throw" } = {},
) {
  let query = supabase
    .from("family_character_voices")
    .select(FAMILY_CHARACTER_VOICE_SAFE_SELECT)
    .order("updated_at", { ascending: false });
  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.profileId) query = query.eq("profile_id", filter.profileId);
  if (filter.familyCharacterId) {
    query = query.eq("family_character_id", filter.familyCharacterId);
  }

  const { data, error } = await query;
  if (error) {
    // The voice-cloning migration can be deployed after the existing Family
    // Library UI. Treat an absent relation as an empty optional capability.
    if (
      options.missingRelation !== "throw" &&
      isMissingFamilyCharacterVoicesRelation(error)
    ) {
      return [] as T[];
    }
    throw error;
  }
  return (data || []) as unknown as T[];
}

export async function uploadFamilyVoiceSample(
  supabase: SupabaseClient,
  storagePath: string,
  blob: Blob,
  options: { contentType?: string } = {},
) {
  const extension = getVoiceSampleExtension(storagePath);
  if (blob.size <= 0 || blob.size > FAMILY_VOICE_MAX_SAMPLE_BYTES) {
    throw new Error("family-voice-sample-size-invalid");
  }

  const expectedContentType = AUDIO_CONTENT_TYPE_BY_EXTENSION[extension];
  const requestedContentType = normalizeFamilyVoiceContentType(
    options.contentType || blob.type || expectedContentType,
  );
  if (requestedContentType !== expectedContentType) {
    throw new Error("family-voice-sample-content-type-invalid");
  }

  const { error } = await supabase.storage
    .from(FAMILY_VOICE_SAMPLES_BUCKET)
    .upload(storagePath, blob, {
      contentType: expectedContentType,
      upsert: false,
    });
  if (error) throw error;
  return storagePath;
}

export async function removeFamilyVoiceSamples(
  supabase: SupabaseClient,
  storagePaths: string[],
) {
  const paths = Array.from(new Set(storagePaths.filter(Boolean)));
  if (paths.length === 0) return;
  paths.forEach(getVoiceSampleExtension);
  const { error } = await supabase.storage
    .from(FAMILY_VOICE_SAMPLES_BUCKET)
    .remove(paths);
  if (error) throw error;
}
