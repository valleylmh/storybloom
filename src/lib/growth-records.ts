import type { GenerateResponse } from "@/types";

const DB_NAME = "storybloom-growth-records";
const DB_VERSION = 1;
const STORE_NAME = "records";

export interface GrowthRecordPhoto {
  id: string;
  name: string;
  dataUrl: string;
}

export interface GrowthRecordDraft {
  version: 1;
  childKey: string;
  childName: string;
  childCharacterId?: string;
  childAvatarDataUrl?: string;
  occurredOn: string;
  note: string;
  idea: string;
  photos: GrowthRecordPhoto[];
}

export interface GrowthRecord {
  id: string;
  storyId: string;
  childKey: string;
  childName: string;
  childCharacterId?: string;
  childAvatarDataUrl?: string;
  occurredOn: string;
  note: string;
  idea: string;
  photos: GrowthRecordPhoto[];
  story: GenerateResponse;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthChildSummary {
  childKey: string;
  childName: string;
  avatarUrl?: string;
  coverUrl?: string;
  recordCount: number;
  latestOccurredOn: string;
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function sortRecords(records: GrowthRecord[]) {
  return [...records].sort((a, b) => {
    const occurredDiff = b.occurredOn.localeCompare(a.occurredOn);
    return occurredDiff || b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function isValidGrowthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isGrowthRecordPhoto(value: unknown): value is GrowthRecordPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<GrowthRecordPhoto>;
  return (
    typeof photo.id === "string" &&
    photo.id.trim().length > 0 &&
    typeof photo.name === "string" &&
    typeof photo.dataUrl === "string" &&
    photo.dataUrl.startsWith("data:image/")
  );
}

function hasValidGrowthPhotos(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    value.every(isGrowthRecordPhoto)
  );
}

function isGrowthRecord(value: unknown): value is GrowthRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<GrowthRecord>;
  const story = record.story as Partial<GenerateResponse> | undefined;
  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    typeof record.storyId === "string" &&
    record.storyId.trim().length > 0 &&
    typeof record.childKey === "string" &&
    record.childKey.trim().length > 0 &&
    typeof record.childName === "string" &&
    record.childName.trim().length > 0 &&
    typeof record.occurredOn === "string" &&
    isValidGrowthDate(record.occurredOn) &&
    typeof record.note === "string" &&
    typeof record.idea === "string" &&
    record.idea.trim().length > 0 &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    typeof story?.storyId === "string" &&
    typeof story.coverTitle === "string" &&
    Array.isArray(story.pages) &&
    hasValidGrowthPhotos(record.photos)
  );
}

export function isGrowthRecordDraft(value: unknown): value is GrowthRecordDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<GrowthRecordDraft>;
  return (
    draft.version === 1 &&
    typeof draft.childKey === "string" &&
    draft.childKey.trim().length > 0 &&
    typeof draft.childName === "string" &&
    draft.childName.trim().length > 0 &&
    typeof draft.occurredOn === "string" &&
    isValidGrowthDate(draft.occurredOn) &&
    typeof draft.note === "string" &&
    draft.note.length <= 200 &&
    typeof draft.idea === "string" &&
    draft.idea.trim().length > 0 &&
    hasValidGrowthPhotos(draft.photos)
  );
}

export function createGrowthRecord(
  story: GenerateResponse,
  draft: GrowthRecordDraft,
  existing?: GrowthRecord,
  now = new Date().toISOString(),
): GrowthRecord {
  return {
    id: existing?.id || story.storyId,
    storyId: story.storyId,
    childKey: draft.childKey,
    childName: draft.childName,
    childCharacterId: draft.childCharacterId,
    childAvatarDataUrl: draft.childAvatarDataUrl || existing?.childAvatarDataUrl,
    occurredOn: draft.occurredOn,
    note: draft.note,
    idea: draft.idea,
    photos: draft.photos,
    story,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function getGrowthRecordCover(record: GrowthRecord) {
  return (
    record.photos[0]?.dataUrl ||
    record.story.pages.find((page) => page.imageUrl)?.imageUrl ||
    undefined
  );
}

export function groupGrowthRecordsByChild(records: GrowthRecord[]) {
  const children = new Map<string, GrowthChildSummary>();

  sortRecords(records).forEach((record) => {
    const existing = children.get(record.childKey);
    if (existing) {
      existing.recordCount += 1;
      if (!existing.avatarUrl && record.childAvatarDataUrl) {
        existing.avatarUrl = record.childAvatarDataUrl;
      }
      if (!existing.coverUrl) {
        existing.coverUrl = getGrowthRecordCover(record);
      }
      return;
    }

    children.set(record.childKey, {
      childKey: record.childKey,
      childName: record.childName,
      avatarUrl: record.childAvatarDataUrl,
      coverUrl: getGrowthRecordCover(record),
      recordCount: 1,
      latestOccurredOn: record.occurredOn,
    });
  });

  return Array.from(children.values()).sort((a, b) =>
    b.latestOccurredOn.localeCompare(a.latestOccurredOn),
  );
}

function openGrowthDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

function readAllRecords(db: IDBDatabase) {
  return new Promise<GrowthRecord[]>((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onerror = () => resolve([]);
      request.onsuccess = () =>
        resolve(
          Array.isArray(request.result)
            ? request.result.filter(isGrowthRecord)
            : [],
        );
    } catch {
      resolve([]);
    }
  });
}

function putRecord(db: IDBDatabase, record: GrowthRecord) {
  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function listGrowthRecords() {
  const db = await openGrowthDb();
  if (!db) return [];
  const records = await readAllRecords(db);
  db.close();
  return sortRecords(records);
}

export async function upsertGrowthRecord(
  story: GenerateResponse,
  draft: GrowthRecordDraft,
) {
  const db = await openGrowthDb();
  if (!db) throw new Error("growth-storage-unavailable");
  const records = await readAllRecords(db);
  const existing = records.find((record) => record.storyId === story.storyId);
  const record = createGrowthRecord(story, draft, existing);
  const saved = await putRecord(db, record);
  db.close();
  if (!saved) throw new Error("growth-storage-write-failed");
  return record;
}

export async function updateGrowthRecordStory(story: GenerateResponse) {
  const db = await openGrowthDb();
  if (!db) return undefined;
  const records = await readAllRecords(db);
  const existing = records.find((record) => record.storyId === story.storyId);
  if (!existing) {
    db.close();
    return undefined;
  }
  const next = { ...existing, story, updatedAt: new Date().toISOString() };
  const saved = await putRecord(db, next);
  db.close();
  return saved ? next : undefined;
}

export async function updateGrowthRecordDetails(
  storyId: string,
  details: { occurredOn: string; note: string },
) {
  return patchGrowthRecord(storyId, details);
}

export async function patchGrowthRecord(
  id: string,
  patch: {
    occurredOn?: string;
    note?: string;
    idea?: string;
    photos?: GrowthRecordPhoto[];
    story?: GenerateResponse;
  },
) {
  if (patch.occurredOn !== undefined && !isValidGrowthDate(patch.occurredOn)) {
    throw new Error("growth-date-invalid");
  }
  if (patch.photos !== undefined && !hasValidGrowthPhotos(patch.photos)) {
    throw new Error("growth-photos-invalid");
  }
  const db = await openGrowthDb();
  if (!db) throw new Error("growth-storage-unavailable");
  const records = await readAllRecords(db);
  const existing = records.find(
    (record) => record.id === id || record.storyId === id,
  );
  if (!existing) {
    db.close();
    throw new Error("growth-record-not-found");
  }
  const next = {
    ...existing,
    ...(patch.occurredOn !== undefined
      ? { occurredOn: patch.occurredOn }
      : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.idea !== undefined ? { idea: patch.idea } : {}),
    ...(patch.photos !== undefined ? { photos: patch.photos } : {}),
    ...(patch.story !== undefined ? { story: patch.story } : {}),
    updatedAt: new Date().toISOString(),
  };
  const saved = await putRecord(db, next);
  db.close();
  if (!saved) throw new Error("growth-storage-write-failed");
  return next;
}

export async function deleteGrowthRecord(storyId: string) {
  const db = await openGrowthDb();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(storyId);
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
      transaction.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}
