"use client";

/**
 * Local content is intentionally kept separate from Supabase auth storage.
 * Clearing this data must not silently sign the parent out or reset the
 * server-side generation allowance.
 */
const KNOWN_CONTENT_DATABASES = [
  ["storybloom-client-history", "stories"],
  ["storybloom-growth-records", "records"],
  ["storybloom-audio-cache", "narrations"],
] as const;

const CONTENT_LOCAL_STORAGE_KEYS = [
  "storybloom.history.v1",
  "storybloom.shareLinks.v1",
  "storybloom.generation.active.v1",
  "storybloom:minimal-identity-draft",
] as const;

const SYNC_DATABASE_PREFIX = "storybloom-sync-meta:";
const IMPORT_DISMISS_PREFIX = "storybloom.local-import.dismissed.";
const IMPORT_CONSENT_PREFIX = "storybloom.local-import.guardian-consent.";

export interface LocalDeviceClearReport {
  localStorageKeys: number;
  indexedDbStores: number;
  errors: string[];
}

function canUseBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function clearStore(databaseName: string, storeName: string) {
  return new Promise<"cleared" | "missing" | "failed">((resolve) => {
    let request: IDBOpenDBRequest;
    let createdEmptyDatabase = false;
    try {
      request = indexedDB.open(databaseName);
    } catch {
      resolve("failed");
      return;
    }

    request.onupgradeneeded = (event) => {
      createdEmptyDatabase = (event as IDBVersionChangeEvent).oldVersion === 0;
    };
    request.onerror = () => resolve("failed");
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.close();
        if (createdEmptyDatabase) indexedDB.deleteDatabase(databaseName);
        resolve("missing");
        return;
      }

      try {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).clear();
        transaction.oncomplete = () => {
          database.close();
          resolve("cleared");
        };
        transaction.onerror = () => {
          database.close();
          resolve("failed");
        };
        transaction.onabort = () => {
          database.close();
          resolve("failed");
        };
      } catch {
        database.close();
        resolve("failed");
      }
    };
  });
}

async function listDatabaseNames() {
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (typeof factory.databases !== "function") return [];
  try {
    return (await factory.databases())
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
}

function removeContentLocalStorage() {
  let removed = 0;
  try {
    for (const key of CONTENT_LOCAL_STORAGE_KEYS) {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        removed += 1;
      }
    }

    const prefixedKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (
        key &&
        (key.startsWith(IMPORT_DISMISS_PREFIX) ||
          key.startsWith(IMPORT_CONSENT_PREFIX) ||
          key.startsWith("storybloom.growth-record."))
      ) {
        prefixedKeys.push(key);
      }
    }
    prefixedKeys.forEach((key) => {
      window.localStorage.removeItem(key);
      removed += 1;
    });
  } catch {
    // A disabled localStorage should not prevent IndexedDB cleanup.
  }
  return removed;
}

/**
 * Remove story content, growth records, cached narration, share credentials,
 * pending identity drafts, and import metadata from this browser. Preferences
 * such as locale, browser id, entry mode, and free-generation usage remain.
 */
export async function clearCurrentDeviceData(userId?: string): Promise<LocalDeviceClearReport> {
  const report: LocalDeviceClearReport = {
    localStorageKeys: 0,
    indexedDbStores: 0,
    errors: [],
  };

  if (typeof window === "undefined") {
    return report;
  }

  report.localStorageKeys = removeContentLocalStorage();

  if (!canUseBrowser()) return report;

  const stores = [...KNOWN_CONTENT_DATABASES] as Array<readonly [string, string]>;
  const names = await listDatabaseNames();
  const syncNames = names.filter((name) => name.startsWith(SYNC_DATABASE_PREFIX));
  if (userId) {
    const currentName = `${SYNC_DATABASE_PREFIX}${userId}`;
    if (!syncNames.includes(currentName)) syncNames.push(currentName);
  }
  syncNames.forEach((name) => stores.push([name, "sync_meta"]));

  const results = await Promise.all(
    stores.map(async ([databaseName, storeName]) => ({
      databaseName,
      result: await clearStore(databaseName, storeName),
    })),
  );
  results.forEach(({ databaseName, result }) => {
    if (result === "cleared") report.indexedDbStores += 1;
    if (result === "failed") {
      report.errors.push(`无法清理本地数据库：${databaseName}`);
    }
  });

  return report;
}

export const LOCAL_CONTENT_STORAGE_KEYS = CONTENT_LOCAL_STORAGE_KEYS;
export const LOCAL_CONTENT_DATABASES = KNOWN_CONTENT_DATABASES;
