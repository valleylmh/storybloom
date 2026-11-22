import type { BookAudio } from "@/lib/reader/book-audio-transport";
import type { SeriesPlaylistItem } from "@/lib/reader/continuous-playback";
import { concatenateMp3WithPause } from "@/lib/reader/mp3-concat";
import { prefetchAnnouncementAudio } from "@/lib/reader/next-book-announcement";

const FETCH_AUDIO_TIMEOUT_MS = 25_000;
const MAX_CACHED_BUNDLES = 3;

export type PreparedNextBookAudio =
  | {
      kind: "combined";
      key: string;
      blobUrl: string;
      introDurationSec: number;
      asset: BookAudio;
      revokeUrls: string[];
    }
  | {
      kind: "separate";
      key: string;
      announcementUrl: string | null;
      bookAsset: BookAudio;
      revokeUrls: string[];
    };

const readyBundles = new Map<string, PreparedNextBookAudio>();
const inflightBundles = new Map<string, Promise<PreparedNextBookAudio | null>>();
let activeProtectedKey: string | null = null;

function bundleKey(book: SeriesPlaylistItem): string | null {
  if (!book.chineseAudio?.url) return null;
  return `${book.id}::${book.chineseAudio.contentHash}`;
}

function decodeDataAudioUrl(url: string): Uint8Array | null {
  const comma = url.indexOf(",");
  if (comma === -1) return null;
  const meta = url.slice(0, comma);
  if (!/;base64$/i.test(meta)) return null;
  const base64 = url.slice(comma + 1);
  if (typeof atob === "function") {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  return null;
}

async function fetchAudioBytes(
  url: string,
  fetchImpl: typeof fetch,
): Promise<Uint8Array | null> {
  if (url.startsWith("data:audio/")) {
    return decodeDataAudioUrl(url);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_AUDIO_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;
    return new Uint8Array(buffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createAudioBlobUrl(bytes: Uint8Array, mimeType = "audio/mpeg"): string | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  if (typeof Blob === "undefined") return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy.buffer], { type: mimeType }));
}

function revokeBundle(bundle: PreparedNextBookAudio) {
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
    return;
  }
  for (const url of bundle.revokeUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revoke failures.
    }
  }
}

function storeBundle(bundle: PreparedNextBookAudio) {
  const existing = readyBundles.get(bundle.key);
  if (existing && existing !== bundle) {
    revokeBundle(existing);
  }
  readyBundles.delete(bundle.key);
  readyBundles.set(bundle.key, bundle);

  for (const [key, entry] of readyBundles) {
    if (readyBundles.size <= MAX_CACHED_BUNDLES) break;
    if (key === bundle.key || key === activeProtectedKey) continue;
    readyBundles.delete(key);
    revokeBundle(entry);
  }
}

export function markPreparedBundleActive(key: string | null) {
  activeProtectedKey = key;
}

export function getPreparedNextBookAudio(
  book: SeriesPlaylistItem,
): PreparedNextBookAudio | null {
  const key = bundleKey(book);
  if (!key) return null;
  return readyBundles.get(key) ?? null;
}

/**
 * Pre-downloads the next book's spoken announcement MP3 AND its full story MP3
 * into local RAM while the current book is playing, combining them into a single
 * gapless MP3 `blob:` URL whenever both streams share the same MPEG format.
 */
export function prefetchNextBookAudioBundle(
  book: SeriesPlaylistItem,
  options: {
    preferCloudAnnouncement?: boolean;
    fetchImpl?: typeof fetch;
    prefetchAnnouncementImpl?: typeof prefetchAnnouncementAudio;
  } = {},
): Promise<PreparedNextBookAudio | null> {
  const key = bundleKey(book);
  const chineseAudio = book.chineseAudio;
  if (!key || !chineseAudio) return Promise.resolve(null);

  const existingReady = readyBundles.get(key);
  if (existingReady) return Promise.resolve(existingReady);

  const existingInflight = inflightBundles.get(key);
  if (existingInflight) return existingInflight;

  const fetchImpl =
    options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchImpl) return Promise.resolve(null);

  const prefetchAnnouncementImpl =
    options.prefetchAnnouncementImpl ?? prefetchAnnouncementAudio;
  const preferCloudAnnouncement = options.preferCloudAnnouncement ?? true;

  const task = (async (): Promise<PreparedNextBookAudio | null> => {
    try {
      const [announcementUrl, bookBytes] = await Promise.all([
        preferCloudAnnouncement
          ? prefetchAnnouncementImpl(book, "zh", { fetchImpl })
          : Promise.resolve(null),
        fetchAudioBytes(chineseAudio.url, fetchImpl),
      ]);

      if (!bookBytes) return null;

      const announcementBytes = announcementUrl
        ? await fetchAudioBytes(announcementUrl, fetchImpl)
        : null;

      if (announcementBytes) {
        const combined = concatenateMp3WithPause(announcementBytes, bookBytes, 0.35);
        if (combined) {
          const blobUrl = createAudioBlobUrl(combined.bytes, "audio/mpeg");
          if (blobUrl) {
            const prepared: PreparedNextBookAudio = {
              kind: "combined",
              key,
              blobUrl,
              introDurationSec: combined.introDurationSec,
              asset: {
                ...chineseAudio,
                url: blobUrl,
                pageStarts: chineseAudio.pageStarts.map(
                  (start) => start + combined.introDurationSec,
                ),
                duration: combined.totalDurationSec,
              },
              revokeUrls: [blobUrl],
            };
            storeBundle(prepared);
            return prepared;
          }
        }
      }

      // Fallback when announcement is unavailable or uses a different audio format:
      // still keep Book 2's full MP3 (and announcement if available) as local blob URLs
      // so mobile PWAs never stall on a cold remote network fetch in the background.
      const bookBlobUrl = createAudioBlobUrl(bookBytes, "audio/mpeg");
      if (!bookBlobUrl) return null;
      const revokeUrls = [bookBlobUrl];

      let resolvedAnnouncementUrl = announcementUrl;
      if (announcementBytes && announcementUrl && !announcementUrl.startsWith("data:")) {
        const mimeType = announcementUrl.includes(".wav") ? "audio/wav" : "audio/mpeg";
        const announcementBlobUrl = createAudioBlobUrl(announcementBytes, mimeType);
        if (announcementBlobUrl) {
          resolvedAnnouncementUrl = announcementBlobUrl;
          revokeUrls.push(announcementBlobUrl);
        }
      }

      const prepared: PreparedNextBookAudio = {
        kind: "separate",
        key,
        announcementUrl: resolvedAnnouncementUrl,
        bookAsset: {
          ...chineseAudio,
          url: bookBlobUrl,
        },
        revokeUrls,
      };
      storeBundle(prepared);
      return prepared;
    } catch {
      return null;
    }
  })();

  inflightBundles.set(key, task);
  void task.finally(() => {
    if (inflightBundles.get(key) === task) {
      inflightBundles.delete(key);
    }
  });
  return task;
}

export function resetPreparedNextBookBundles() {
  for (const bundle of readyBundles.values()) {
    revokeBundle(bundle);
  }
  readyBundles.clear();
  inflightBundles.clear();
  activeProtectedKey = null;
}
