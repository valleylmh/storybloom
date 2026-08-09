import type { SupabaseClient } from "@supabase/supabase-js";
import {
  removeFamilyVoiceSamples,
  type FamilyCharacterVoiceSafeRow,
} from "@/lib/repositories/family-character-voice-repository";

export const FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS = 3 * 60 * 1_000;
// Keep a bounded browser-side safety net without silently dropping ordinary
// multi-character retry history. At roughly 100-150 bytes per entry this stays
// comfortably below common localStorage quotas.
const MAX_PENDING_UPLOADS_PER_USER = 200;
const STORAGE_KEY_PREFIX = "storybloom.familyVoicePendingUploads.v1";

export type PendingFamilyVoiceUpload = {
  path: string;
  createdAt: number;
};

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function isSafePendingUpload(value: unknown, userId: string) {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PendingFamilyVoiceUpload>;
  return (
    typeof candidate.path === "string" &&
    candidate.path.startsWith(`${userId}/`) &&
    candidate.path.split("/").length === 3 &&
    candidate.path.length <= 512 &&
    !/[?#\\]/.test(candidate.path) &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    candidate.createdAt > 0
  );
}

export function readPendingFamilyVoiceUploads(
  storage: Storage,
  userId: string,
): PendingFamilyVoiceUpload[] {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(userId)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => isSafePendingUpload(entry, userId))
      .slice(-MAX_PENDING_UPLOADS_PER_USER) as PendingFamilyVoiceUpload[];
  } catch {
    return [];
  }
}

function writePendingFamilyVoiceUploads(
  storage: Storage,
  userId: string,
  entries: PendingFamilyVoiceUpload[],
) {
  try {
    if (entries.length === 0) {
      storage.removeItem(storageKey(userId));
      return;
    }
    storage.setItem(
      storageKey(userId),
      JSON.stringify(entries.slice(-MAX_PENDING_UPLOADS_PER_USER)),
    );
  } catch {
    // Local reconciliation metadata is best effort only.
  }
}

export function rememberPendingFamilyVoiceUpload(
  storage: Storage,
  userId: string,
  path: string,
  createdAt = Date.now(),
) {
  const entries = readPendingFamilyVoiceUploads(storage, userId).filter(
    (entry) => entry.path !== path,
  );
  entries.push({ path, createdAt });
  writePendingFamilyVoiceUploads(storage, userId, entries);
}

export function forgetPendingFamilyVoiceUpload(
  storage: Storage,
  userId: string,
  path: string,
) {
  writePendingFamilyVoiceUploads(
    storage,
    userId,
    readPendingFamilyVoiceUploads(storage, userId).filter(
      (entry) => entry.path !== path,
    ),
  );
}

export async function reconcilePendingFamilyVoiceUploads(
  supabase: SupabaseClient,
  storage: Storage,
  userId: string,
  voices: FamilyCharacterVoiceSafeRow[],
  now = Date.now(),
) {
  const referencedPaths = new Set(
    voices.map((voice) => voice.sample_audio_path),
  );
  const retained: PendingFamilyVoiceUpload[] = [];

  for (const entry of readPendingFamilyVoiceUploads(storage, userId)) {
    if (referencedPaths.has(entry.path)) continue;
    if (now - entry.createdAt < FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS) {
      retained.push(entry);
      continue;
    }
    try {
      await removeFamilyVoiceSamples(supabase, [entry.path]);
    } catch {
      retained.push(entry);
    }
  }

  writePendingFamilyVoiceUploads(storage, userId, retained);
  return retained;
}
