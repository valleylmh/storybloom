import type { StoryContentType } from "@/lib/reading-progress";

export type FavoriteRecord = {
  contentType: StoryContentType;
  contentId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

const FAVORITES_KEY = "storybloom.favorites.v1";
export const FAVORITES_CHANGED_EVENT = "storybloom:favorites-changed";
let memoryFavoriteRecords: Record<string, FavoriteRecord> = {};

export function createFavoriteKey(
  contentType: StoryContentType,
  contentId: string,
) {
  return `${contentType}:${contentId}`;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function validDate(value: string | undefined) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

export function normalizeFavoriteRecord(record: FavoriteRecord): FavoriteRecord {
  const now = new Date().toISOString();
  const createdAt = validDate(record.createdAt) ? record.createdAt : now;
  const updatedAt = validDate(record.updatedAt) ? record.updatedAt : createdAt;
  return {
    contentType: record.contentType,
    contentId: record.contentId.trim(),
    createdAt,
    updatedAt,
    ...(validDate(record.deletedAt) ? { deletedAt: record.deletedAt } : {}),
  };
}

export function mergeFavoriteRecords(
  first: FavoriteRecord | null | undefined,
  second: FavoriteRecord | null | undefined,
) {
  if (!first) return second ? normalizeFavoriteRecord(second) : null;
  if (!second) return normalizeFavoriteRecord(first);
  const left = normalizeFavoriteRecord(first);
  const right = normalizeFavoriteRecord(second);
  return new Date(right.updatedAt).getTime() > new Date(left.updatedAt).getTime()
    ? right
    : left;
}

function readFavoriteMap() {
  if (!canUseBrowserStorage()) return { ...memoryFavoriteRecords };
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const stored =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, FavoriteRecord>)
        : {};
    const merged = { ...stored };
    Object.entries(memoryFavoriteRecords).forEach(([key, record]) => {
      merged[key] = mergeFavoriteRecords(stored[key], record) ?? record;
    });
    return merged;
  } catch {
    return { ...memoryFavoriteRecords };
  }
}

function writeFavoriteMap(records: Record<string, FavoriteRecord>) {
  if (!canUseBrowserStorage()) return;
  memoryFavoriteRecords = { ...records };
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(records));
  } catch {
    // Favorites remain usable for the current interaction when storage fails.
  }
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

export function listFavoriteRecords(options?: { includeDeleted?: boolean }) {
  const records = Object.values(readFavoriteMap()).map(normalizeFavoriteRecord);
  return records
    .filter((record) => options?.includeDeleted || !record.deletedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function getFavoriteRecord(
  contentType: StoryContentType,
  contentId: string,
) {
  const record = readFavoriteMap()[createFavoriteKey(contentType, contentId)];
  return record ? normalizeFavoriteRecord(record) : null;
}

export function isFavorite(
  contentType: StoryContentType,
  contentId: string,
) {
  const record = getFavoriteRecord(contentType, contentId);
  return Boolean(record && !record.deletedAt);
}

export function saveFavoriteRecord(record: FavoriteRecord) {
  const normalized = normalizeFavoriteRecord(record);
  const records = readFavoriteMap();
  records[createFavoriteKey(normalized.contentType, normalized.contentId)] =
    normalized;
  writeFavoriteMap(records);
  return normalized;
}

export function setFavorite(
  contentType: StoryContentType,
  contentId: string,
  favorited: boolean,
) {
  const current = getFavoriteRecord(contentType, contentId);
  const now = new Date().toISOString();
  return saveFavoriteRecord({
    contentType,
    contentId,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    ...(favorited ? {} : { deletedAt: now }),
  });
}
