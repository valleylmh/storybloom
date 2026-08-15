import type { BrowserNarrationMode } from "@/lib/browser-narration";

export type StoryContentType = "library" | "personalized";

export type ReadingProgressRecord = {
  contentType: StoryContentType;
  contentId: string;
  pageIndex: number;
  maxPageIndex: number;
  positionMs?: number;
  languageMode: BrowserNarrationMode;
  playbackMode: "page";
  autoAdvance: boolean;
  progressPercent: number;
  completedAt?: string;
  lastReadAt: string;
  updatedAt: string;
};

type StoredReadingProgress = ReadingProgressRecord & { key: string };

const DB_NAME = "storybloom-reading-state";
const DB_VERSION = 1;
const STORE_NAME = "progress";
const FALLBACK_KEY = "storybloom.readingProgress.v1";

let databasePromise: Promise<IDBDatabase | null> | null = null;

export function createReadingProgressKey(
  contentType: StoryContentType,
  contentId: string,
) {
  return `${contentType}:${contentId}`;
}

export function calculateReadingProgressPercent(
  maxPageIndex: number,
  totalPages: number,
  completed = false,
) {
  if (totalPages <= 0) return 0;
  if (completed) return 100;
  const reachedPages = Math.min(totalPages, Math.max(0, maxPageIndex) + 1);
  return Math.min(99, Math.max(0, Math.round((reachedPages / totalPages) * 100)));
}

function validDate(value: string | undefined) {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

export function normalizeReadingProgress(
  value: ReadingProgressRecord,
): ReadingProgressRecord {
  const pageIndex = Math.max(0, Math.floor(value.pageIndex || 0));
  const maxPageIndex = Math.max(
    pageIndex,
    Math.floor(value.maxPageIndex ?? pageIndex),
  );
  const now = new Date().toISOString();
  return {
    contentType: value.contentType,
    contentId: value.contentId.trim(),
    pageIndex,
    maxPageIndex,
    ...(Number.isFinite(value.positionMs) && (value.positionMs ?? 0) > 0
      ? { positionMs: Math.max(0, Math.floor(value.positionMs!)) }
      : {}),
    languageMode: value.languageMode,
    playbackMode: "page",
    autoAdvance: value.autoAdvance,
    progressPercent: Math.min(100, Math.max(0, value.progressPercent || 0)),
    ...(validDate(value.completedAt) ? { completedAt: value.completedAt } : {}),
    lastReadAt: validDate(value.lastReadAt) ? value.lastReadAt : now,
    updatedAt: validDate(value.updatedAt) ? value.updatedAt : now,
  };
}

export function mergeReadingProgress(
  first: ReadingProgressRecord | null | undefined,
  second: ReadingProgressRecord | null | undefined,
) {
  if (!first) return second ? normalizeReadingProgress(second) : null;
  if (!second) return normalizeReadingProgress(first);
  const left = normalizeReadingProgress(first);
  const right = normalizeReadingProgress(second);
  if (
    left.contentType !== right.contentType ||
    left.contentId !== right.contentId
  ) {
    return new Date(right.updatedAt).getTime() > new Date(left.updatedAt).getTime()
      ? right
      : left;
  }

  const newer =
    new Date(right.updatedAt).getTime() > new Date(left.updatedAt).getTime()
      ? right
      : left;
  const completedAt = [left.completedAt, right.completedAt]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    ...newer,
    maxPageIndex: Math.max(left.maxPageIndex, right.maxPageIndex),
    progressPercent: Math.max(left.progressPercent, right.progressPercent),
    ...(completedAt ? { completedAt } : {}),
  } satisfies ReadingProgressRecord;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function readFallbackMap() {
  if (!canUseBrowserStorage()) return {} as Record<string, ReadingProgressRecord>;
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, ReadingProgressRecord>)
      : {};
  } catch {
    return {};
  }
}

function writeFallbackMap(records: Record<string, ReadingProgressRecord>) {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(records));
  } catch {
    // Progress remains in memory when browser storage is full or unavailable.
  }
}

function openDatabase() {
  if (!canUseBrowserStorage() || !("indexedDB" in window)) {
    return Promise.resolve<IDBDatabase | null>(null);
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("lastReadAt", "lastReadAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

async function getStoredRecord(key: string) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise<ReadingProgressRecord | null>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const stored = request.result as StoredReadingProgress | undefined;
        if (!stored) {
          resolve(null);
          return;
        }
        const { key, ...record } = stored;
        void key;
        resolve(normalizeReadingProgress(record));
      };
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getReadingProgress(
  contentType: StoryContentType,
  contentId: string,
) {
  const key = createReadingProgressKey(contentType, contentId);
  const fallback = readFallbackMap()[key];
  return mergeReadingProgress(await getStoredRecord(key), fallback);
}

export async function saveReadingProgress(record: ReadingProgressRecord) {
  const normalized = normalizeReadingProgress(record);
  const key = createReadingProgressKey(
    normalized.contentType,
    normalized.contentId,
  );
  const database = await openDatabase();
  if (database) {
    const didSave = await new Promise<boolean>((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put({ ...normalized, key });
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
    if (didSave) return normalized;
  }

  const records = readFallbackMap();
  records[key] = normalized;
  writeFallbackMap(records);
  return normalized;
}

export async function listReadingProgress() {
  const fallback = readFallbackMap();
  const database = await openDatabase();
  if (!database) return Object.values(fallback).map(normalizeReadingProgress);

  const indexed = await new Promise<ReadingProgressRecord[]>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () =>
        resolve(
          ((request.result || []) as StoredReadingProgress[]).map((stored) => {
            const { key, ...record } = stored;
            void key;
            return normalizeReadingProgress(record);
          }),
        );
      request.onerror = () => resolve([]);
      transaction.onabort = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
  const merged = new Map<string, ReadingProgressRecord>();
  [...indexed, ...Object.values(fallback)].forEach((record) => {
    const key = createReadingProgressKey(record.contentType, record.contentId);
    merged.set(key, mergeReadingProgress(merged.get(key), record)!);
  });
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime(),
  );
}
