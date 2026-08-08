export type SyncEntityType = "story" | "growth-record";

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface SyncMeta {
  localId: string;
  entityType: SyncEntityType;
  cloudId?: string;
  status: SyncStatus;
  lastSyncedAt?: string;
  error?: string;
}

export interface SyncMetaStore {
  list(): Promise<SyncMeta[]>;
  get(entityType: SyncEntityType, localId: string): Promise<SyncMeta | undefined>;
  put(meta: SyncMeta): Promise<SyncMeta>;
  putMany(meta: SyncMeta[]): Promise<SyncMeta[]>;
  remove(entityType: SyncEntityType, localId: string): Promise<void>;
}

const DB_PREFIX = "storybloom-sync-meta";
const DB_VERSION = 2;
const STORE_NAME = "sync_meta";

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function isEntityType(value: unknown): value is SyncEntityType {
  return value === "story" || value === "growth-record";
}

function isSyncStatus(value: unknown): value is SyncStatus {
  return (
    value === "pending" ||
    value === "syncing" ||
    value === "synced" ||
    value === "failed"
  );
}

export function isSyncMeta(value: unknown): value is SyncMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Partial<SyncMeta>;
  return (
    typeof meta.localId === "string" &&
    meta.localId.trim().length > 0 &&
    isEntityType(meta.entityType) &&
    isSyncStatus(meta.status) &&
    (meta.cloudId === undefined || typeof meta.cloudId === "string") &&
    (meta.lastSyncedAt === undefined || typeof meta.lastSyncedAt === "string") &&
    (meta.error === undefined || typeof meta.error === "string")
  );
}

export function getSyncMetaKey(
  entityType: SyncEntityType,
  localId: string,
) {
  return `${entityType}:${localId}`;
}

export function getSyncMetaDatabaseName(userId: string) {
  const normalized = userId.trim();
  if (!normalized) throw new Error("sync-meta-user-required");
  return `${DB_PREFIX}:${normalized}`;
}

function hasCompoundKeyPath(store: IDBObjectStore) {
  return (
    Array.isArray(store.keyPath) &&
    store.keyPath.length === 2 &&
    store.keyPath[0] === "entityType" &&
    store.keyPath[1] === "localId"
  );
}

function createSyncMetaStore(db: IDBDatabase) {
  return db.createObjectStore(STORE_NAME, {
    keyPath: ["entityType", "localId"],
  });
}

function upgradeSyncMetaStore(request: IDBOpenDBRequest) {
  const db = request.result;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    createSyncMetaStore(db);
    return;
  }

  const transaction = request.transaction;
  if (!transaction) return;
  const legacyStore = transaction.objectStore(STORE_NAME);
  if (hasCompoundKeyPath(legacyStore)) return;

  // A short-lived preview used localId as the key. Preserve valid rows while
  // upgrading to the compound key required when a story and growth record
  // intentionally share the same local id.
  const readRequest = legacyStore.getAll();
  readRequest.onerror = () => transaction.abort();
  readRequest.onsuccess = () => {
    const records = Array.isArray(readRequest.result)
      ? readRequest.result.filter(isSyncMeta)
      : [];
    db.deleteObjectStore(STORE_NAME);
    const nextStore = createSyncMetaStore(db);
    records.forEach((record) => nextStore.put(record));
  };
}

function openSyncMetaDb(userId: string) {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error("sync-meta-storage-unavailable"));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(
      getSyncMetaDatabaseName(userId),
      DB_VERSION,
    );
    request.onupgradeneeded = () => upgradeSyncMetaStore(request);
    request.onerror = () =>
      reject(request.error || new Error("sync-meta-storage-open-failed"));
    request.onblocked = () => reject(new Error("sync-meta-storage-blocked"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function readAll(db: IDBDatabase) {
  return new Promise<SyncMeta[]>((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onerror = () =>
        reject(request.error || new Error("sync-meta-storage-read-failed"));
      request.onsuccess = () =>
        resolve(
          Array.isArray(request.result)
            ? request.result.filter(isSyncMeta)
            : [],
        );
    } catch (error) {
      reject(error);
    }
  });
}

function readOne(
  db: IDBDatabase,
  entityType: SyncEntityType,
  localId: string,
) {
  return new Promise<SyncMeta | undefined>((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction
        .objectStore(STORE_NAME)
        .get([entityType, localId]);
      request.onerror = () =>
        reject(request.error || new Error("sync-meta-storage-read-failed"));
      request.onsuccess = () =>
        resolve(isSyncMeta(request.result) ? request.result : undefined);
    } catch (error) {
      reject(error);
    }
  });
}

function writeMany(db: IDBDatabase, records: SyncMeta[]) {
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      records.forEach((record) => store.put(record));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("sync-meta-storage-write-failed"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("sync-meta-storage-write-failed"));
    } catch (error) {
      reject(error);
    }
  });
}

function removeOne(
  db: IDBDatabase,
  entityType: SyncEntityType,
  localId: string,
) {
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete([entityType, localId]);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("sync-meta-storage-delete-failed"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("sync-meta-storage-delete-failed"));
    } catch (error) {
      reject(error);
    }
  });
}

export function createIndexedDbSyncMetaStore(userId: string): SyncMetaStore {
  async function withDatabase<T>(operation: (db: IDBDatabase) => Promise<T>) {
    const db = await openSyncMetaDb(userId);
    try {
      return await operation(db);
    } finally {
      db.close();
    }
  }

  return {
    list() {
      return withDatabase(readAll);
    },

    get(entityType, localId) {
      return withDatabase((db) => readOne(db, entityType, localId));
    },

    async put(meta) {
      if (!isSyncMeta(meta)) throw new Error("sync-meta-invalid");
      await withDatabase((db) => writeMany(db, [meta]));
      return meta;
    },

    async putMany(meta) {
      if (!meta.every(isSyncMeta)) throw new Error("sync-meta-invalid");
      await withDatabase((db) => writeMany(db, meta));
      return meta;
    },

    remove(entityType, localId) {
      return withDatabase((db) => removeOne(db, entityType, localId));
    },
  };
}

export function createMemorySyncMetaStore(
  initial: SyncMeta[] = [],
): SyncMetaStore {
  const records = new Map(
    initial.map((meta) => [getSyncMetaKey(meta.entityType, meta.localId), meta]),
  );

  return {
    async list() {
      return Array.from(records.values());
    },

    async get(entityType, localId) {
      return records.get(getSyncMetaKey(entityType, localId));
    },

    async put(meta) {
      if (!isSyncMeta(meta)) throw new Error("sync-meta-invalid");
      records.set(getSyncMetaKey(meta.entityType, meta.localId), meta);
      return meta;
    },

    async putMany(meta) {
      if (!meta.every(isSyncMeta)) throw new Error("sync-meta-invalid");
      meta.forEach((record) =>
        records.set(
          getSyncMetaKey(record.entityType, record.localId),
          record,
        ),
      );
      return meta;
    },

    async remove(entityType, localId) {
      records.delete(getSyncMetaKey(entityType, localId));
    },
  };
}
