import type { GenerateResponse } from "@/types";

const DB_NAME = "storybloom-client-history";
const DB_VERSION = 1;
const STORE_NAME = "stories";
const LOCAL_STORAGE_KEY = "storybloom.history.v1";
// A private family shelf is a long-lived collection, not a short "recent"
// carousel. Keep the existing v1 store and raise only its retention ceiling.
const HISTORY_LIMIT = 50;

export type StoryHistoryStatus = "generating" | "complete" | "failed";

export interface StoryHistoryRecord {
  storyId: string;
  result: GenerateResponse;
  createdAt: string;
  updatedAt: string;
  status: StoryHistoryStatus;
  imageProgress: {
    complete: number;
    total: number;
  };
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function getImageProgress(result: GenerateResponse) {
  return {
    complete: result.pages.filter((page) => page.imageStatus === "complete").length,
    total: result.pages.length,
  };
}

export function createHistoryRecord(
  result: GenerateResponse,
  existing?: StoryHistoryRecord
): StoryHistoryRecord {
  const now = new Date().toISOString();
  const imageProgress = getImageProgress(result);
  const hasFailed = result.pages.some((page) => page.imageStatus === "failed");
  const status =
    imageProgress.total > 0 && imageProgress.complete === imageProgress.total
      ? "complete"
      : hasFailed
        ? "failed"
        : "generating";

  return {
    storyId: result.storyId,
    result,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    status,
    imageProgress,
  };
}

function sortHistory(records: StoryHistoryRecord[]) {
  return [...records].sort((a, b) => {
    if (a.status === "generating" && b.status !== "generating") {
      return -1;
    }

    if (a.status !== "generating" && b.status === "generating") {
      return 1;
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function dedupeHistory(records: StoryHistoryRecord[]) {
  const byStoryId = new Map<string, StoryHistoryRecord>();

  sortHistory(records).forEach((record) => {
    if (!byStoryId.has(record.storyId)) {
      byStoryId.set(record.storyId, record);
    }
  });

  return Array.from(byStoryId.values());
}

function trimHistory(records: StoryHistoryRecord[], limit = HISTORY_LIMIT) {
  return sortHistory(dedupeHistory(records)).slice(0, limit);
}

function readFallbackHistory() {
  if (!canUseBrowserStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoryHistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackHistory(records: StoryHistoryRecord[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(trimHistory(records))
    );
  } catch {
    // Storage can be full or disabled; history is a convenience feature.
  }
}

function openHistoryDb() {
  if (!canUseBrowserStorage() || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "storyId" });
      }
    };

    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

async function readIndexedDbHistory(db: IDBDatabase) {
  return new Promise<StoryHistoryRecord[]>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        resolve(Array.isArray(request.result) ? request.result : []);
      };
    } catch {
      resolve([]);
    }
  });
}

async function writeIndexedDbHistory(
  db: IDBDatabase,
  records: StoryHistoryRecord[]
) {
  const nextRecords = trimHistory(records);
  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      nextRecords.forEach((record) => store.put(record));
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function listHistory() {
  const fallbackRecords = readFallbackHistory();
  const db = await openHistoryDb();
  if (!db) {
    return trimHistory(fallbackRecords);
  }

  const records = await readIndexedDbHistory(db);
  db.close();
  return trimHistory([...records, ...fallbackRecords]);
}

export async function upsertHistory(result: GenerateResponse) {
  const db = await openHistoryDb();
  if (!db) {
    const records = readFallbackHistory();
    const existing = records.find((record) => record.storyId === result.storyId);
    const next = [
      createHistoryRecord(result, existing),
      ...records.filter((record) => record.storyId !== result.storyId),
    ];
    writeFallbackHistory(next);
    return trimHistory(next);
  }

  const records = await readIndexedDbHistory(db);
  const existing = records.find((record) => record.storyId === result.storyId);
  const next = [
    createHistoryRecord(result, existing),
    ...records.filter((record) => record.storyId !== result.storyId),
  ];
  const didWriteIndexedDb = await writeIndexedDbHistory(db, next);
  db.close();
  if (!didWriteIndexedDb) {
    writeFallbackHistory(next);
  }
  return trimHistory(next);
}

export async function deleteHistory(storyId: string) {
  const db = await openHistoryDb();
  if (!db) {
    const next = readFallbackHistory().filter((record) => record.storyId !== storyId);
    writeFallbackHistory(next);
    return trimHistory(next);
  }

  const records = await readIndexedDbHistory(db);
  const next = records.filter((record) => record.storyId !== storyId);
  const didWriteIndexedDb = await writeIndexedDbHistory(db, next);
  db.close();
  const fallbackNext = readFallbackHistory().filter(
    (record) => record.storyId !== storyId
  );
  writeFallbackHistory(fallbackNext);
  if (!didWriteIndexedDb) {
    return trimHistory(fallbackNext);
  }
  return trimHistory(next);
}
