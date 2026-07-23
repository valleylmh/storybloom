export type CachedNarrationAudio = {
  key: string;
  storyId: string;
  mode: "zh" | "en" | "zh-en";
  voice: string;
  textHash: string;
  audioUrl: string;
  model?: string;
  format?: string;
  bytes?: number;
  usage?: { characters?: number };
  signedUrlExpiresAt?: string;
  updatedAt: number;
};

const AUDIO_CACHE_DB = "storybloom-audio-cache";
const AUDIO_CACHE_STORE = "narrations";
const AUDIO_CACHE_VERSION = 1;

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openAudioCache() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve<IDBDatabase | null>(null);
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve) => {
    const request = window.indexedDB.open(
      AUDIO_CACHE_DB,
      AUDIO_CACHE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(AUDIO_CACHE_STORE)) {
        const store = database.createObjectStore(AUDIO_CACHE_STORE, {
          keyPath: "key",
        });
        store.createIndex("storyId", "storyId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return databasePromise;
}

function fallbackHash(text: string) {
  let first = 2166136261;
  let second = 0x9e3779b9;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + ((second << 6) >>> 0) + (second >>> 2);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(
    second >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

export async function hashNarrationText(text: string) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text),
      );
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    } catch {
      // Some embedded browsers expose SubtleCrypto but deny digest access.
    }
  }

  return fallbackHash(text);
}

export async function createNarrationCacheKey(
  storyId: string,
  mode: CachedNarrationAudio["mode"],
  voice: string,
  text: string,
) {
  const textHash = await hashNarrationText(text);
  return {
    key: [storyId, mode, voice, textHash].join("::"),
    textHash,
  };
}

export async function getCachedNarrationAudio(key: string) {
  try {
    const database = await openAudioCache();
    if (!database) {
      return null;
    }

    return await new Promise<CachedNarrationAudio | null>((resolve) => {
      const transaction = database.transaction(
        AUDIO_CACHE_STORE,
        "readonly",
      );
      const request = transaction.objectStore(AUDIO_CACHE_STORE).get(key);
      request.onsuccess = () =>
        resolve((request.result as CachedNarrationAudio | undefined) || null);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedNarrationAudio(entry: CachedNarrationAudio) {
  try {
    const database = await openAudioCache();
    if (!database) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = database.transaction(
        AUDIO_CACHE_STORE,
        "readwrite",
      );
      transaction.objectStore(AUDIO_CACHE_STORE).put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // Audio remains usable in memory when storage is unavailable or full.
  }
}
