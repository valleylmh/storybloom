import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createFavoriteKey,
  mergeFavoriteRecords,
  type FavoriteRecord,
} from "@/lib/favorites";
import {
  createReadingProgressKey,
  mergeReadingProgress,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";

type ReadingProgressRow = {
  content_type: ReadingProgressRecord["contentType"];
  content_id: string;
  page_index: number;
  max_page_index: number;
  position_ms: number | null;
  language_mode: ReadingProgressRecord["languageMode"];
  playback_mode: "page";
  auto_advance: boolean;
  progress_percent: number;
  completed_at: string | null;
  last_read_at: string;
  updated_at: string;
};

type FavoriteRow = {
  content_type: FavoriteRecord["contentType"];
  content_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toReadingProgress(row: ReadingProgressRow): ReadingProgressRecord {
  return {
    contentType: row.content_type,
    contentId: row.content_id,
    pageIndex: row.page_index,
    maxPageIndex: row.max_page_index,
    ...(row.position_ms && row.position_ms > 0
      ? { positionMs: row.position_ms }
      : {}),
    languageMode: row.language_mode,
    playbackMode: "page",
    autoAdvance: row.auto_advance,
    progressPercent: row.progress_percent,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    lastReadAt: row.last_read_at,
    updatedAt: row.updated_at,
  };
}

function toFavorite(row: FavoriteRow): FavoriteRecord {
  return {
    contentType: row.content_type,
    contentId: row.content_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  };
}

export function mergeReadingProgressCollections(
  local: ReadingProgressRecord[],
  cloud: ReadingProgressRecord[],
) {
  const merged = new Map<string, ReadingProgressRecord>();
  [...local, ...cloud].forEach((record) => {
    const key = createReadingProgressKey(record.contentType, record.contentId);
    const next = mergeReadingProgress(merged.get(key), record);
    if (next) merged.set(key, next);
  });
  return Array.from(merged.values());
}

export function mergeFavoriteCollections(
  local: FavoriteRecord[],
  cloud: FavoriteRecord[],
) {
  const merged = new Map<string, FavoriteRecord>();
  [...local, ...cloud].forEach((record) => {
    const key = createFavoriteKey(record.contentType, record.contentId);
    const next = mergeFavoriteRecords(merged.get(key), record);
    if (next) merged.set(key, next);
  });
  return Array.from(merged.values());
}

export async function listCloudReadingProgress(
  supabase: SupabaseClient,
  userId: string,
) {
  const result = await supabase
    .from("reading_progress")
    .select(
      "content_type,content_id,page_index,max_page_index,position_ms,language_mode,playback_mode,auto_advance,progress_percent,completed_at,last_read_at,updated_at",
    )
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return ((result.data || []) as ReadingProgressRow[]).map(toReadingProgress);
}

export async function upsertCloudReadingProgress(
  supabase: SupabaseClient,
  userId: string,
  records: ReadingProgressRecord[],
) {
  if (!records.length) return;
  const result = await supabase.from("reading_progress").upsert(
    records.map((record) => ({
      user_id: userId,
      content_type: record.contentType,
      content_id: record.contentId,
      page_index: record.pageIndex,
      max_page_index: record.maxPageIndex,
      position_ms: record.positionMs ?? null,
      language_mode: record.languageMode,
      playback_mode: "page",
      auto_advance: record.autoAdvance,
      progress_percent: record.progressPercent,
      completed_at: record.completedAt ?? null,
      last_read_at: record.lastReadAt,
      updated_at: record.updatedAt,
    })),
    { onConflict: "user_id,content_type,content_id" },
  );
  if (result.error) throw result.error;
}

export async function listCloudFavoriteRecords(
  supabase: SupabaseClient,
  userId: string,
) {
  const result = await supabase
    .from("favorites")
    .select("content_type,content_id,created_at,updated_at,deleted_at")
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return ((result.data || []) as FavoriteRow[]).map(toFavorite);
}

export async function upsertCloudFavoriteRecords(
  supabase: SupabaseClient,
  userId: string,
  records: FavoriteRecord[],
) {
  if (!records.length) return;
  const result = await supabase.from("favorites").upsert(
    records.map((record) => ({
      user_id: userId,
      content_type: record.contentType,
      content_id: record.contentId,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      deleted_at: record.deletedAt ?? null,
    })),
    { onConflict: "user_id,content_type,content_id" },
  );
  if (result.error) throw result.error;
}
