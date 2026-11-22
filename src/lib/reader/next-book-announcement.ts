import {
  pickBrowserVoice,
  type BrowserNarrationMode,
} from "@/lib/browser-narration";
import {
  createNarrationCacheKey,
  deleteCachedNarrationAudio,
  getCachedNarrationAudio,
  setCachedNarrationAudio,
} from "@/lib/client-audio-cache";
import { formatNextBookAnnouncement } from "@/lib/reader/continuous-playback";

const ANNOUNCEMENT_TIMEOUT_MS = 15_000;
const INLINE_AUDIO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SIGNED_URL_EXPIRY_BUFFER_MS = 60_000;
const ANNOUNCEMENT_STORY_ID = "library-next-book-announcement";

type ReadyAnnouncementEntry = {
  url: string;
  cacheKey: string;
  expiresAt?: number;
};

const readyAnnouncements = new Map<string, ReadyAnnouncementEntry>();
const inflightAnnouncements = new Map<string, Promise<string | null>>();

function announcementMemoryKey(
  book: { title: string; englishTitle?: string },
  mode: BrowserNarrationMode,
) {
  const { text, ttsMode } = formatNextBookAnnouncement(book, mode);
  return { memoryKey: `${ttsMode}::${text}`, text, ttsMode };
}

function isUrlUsable(input: {
  audioUrl: string;
  signedUrlExpiresAt?: string;
  expiresAt?: number;
  updatedAt?: number;
}) {
  if (!input.audioUrl) return false;
  if (input.audioUrl.startsWith("data:audio/")) {
    return input.updatedAt === undefined
      ? true
      : Date.now() - input.updatedAt < INLINE_AUDIO_CACHE_TTL_MS;
  }
  const expiresAt =
    input.expiresAt ??
    (input.signedUrlExpiresAt
      ? new Date(input.signedUrlExpiresAt).getTime()
      : undefined);
  if (expiresAt !== undefined && Number.isFinite(expiresAt)) {
    return expiresAt > Date.now() + SIGNED_URL_EXPIRY_BUFFER_MS;
  }
  if (input.audioUrl.startsWith("/")) {
    return input.updatedAt === undefined
      ? true
      : Date.now() - input.updatedAt < 86_400_000;
  }
  return true;
}

/**
 * Synchronous in-memory lookup used directly inside `audio.onended` so mobile
 * browsers can chain into the spoken prompt without any async/timer gap.
 */
export function getReadyAnnouncementUrl(
  book: { title: string; englishTitle?: string },
  mode: BrowserNarrationMode,
): string | null {
  const { memoryKey } = announcementMemoryKey(book, mode);
  const entry = readyAnnouncements.get(memoryKey);
  if (!entry) return null;
  if (!isUrlUsable({ audioUrl: entry.url, expiresAt: entry.expiresAt })) {
    readyAnnouncements.delete(memoryKey);
    return null;
  }
  return entry.url;
}

export function invalidateAnnouncementAudio(
  book: { title: string; englishTitle?: string },
  mode: BrowserNarrationMode,
) {
  const { memoryKey } = announcementMemoryKey(book, mode);
  const entry = readyAnnouncements.get(memoryKey);
  readyAnnouncements.delete(memoryKey);
  if (entry?.cacheKey) {
    void deleteCachedNarrationAudio(entry.cacheKey);
  }
}

export function prefetchAnnouncementAudio(
  book: { title: string; englishTitle?: string },
  mode: BrowserNarrationMode,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<string | null> {
  const ready = getReadyAnnouncementUrl(book, mode);
  if (ready) return Promise.resolve(ready);

  const { memoryKey, text, ttsMode } = announcementMemoryKey(book, mode);
  const existing = inflightAnnouncements.get(memoryKey);
  if (existing) return existing;

  const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchImpl) return Promise.resolve(null);

  const task = (async (): Promise<string | null> => {
    try {
      const { key, textHash } = await createNarrationCacheKey(
        ANNOUNCEMENT_STORY_ID,
        ttsMode,
        "configured",
        text,
      );
      const cached = await getCachedNarrationAudio(key);
      if (cached && isUrlUsable(cached)) {
        const expiresAt = cached.signedUrlExpiresAt
          ? new Date(cached.signedUrlExpiresAt).getTime()
          : undefined;
        readyAnnouncements.set(memoryKey, {
          url: cached.audioUrl,
          cacheKey: key,
          expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
        });
        return cached.audioUrl;
      }

      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(() => controller.abort(), ANNOUNCEMENT_TIMEOUT_MS);

      try {
        const response = await fetchImpl("/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            mode: ttsMode,
            sampleRate: 24000,
          }),
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as {
          audioUrl?: string;
          model?: string;
          voice?: string;
          format?: string;
          bytes?: number;
          signedUrlExpiresAt?: string;
        } | null;

        if (!response.ok || !result?.audioUrl) return null;

        const expiresAt = result.signedUrlExpiresAt
          ? new Date(result.signedUrlExpiresAt).getTime()
          : undefined;
        readyAnnouncements.set(memoryKey, {
          url: result.audioUrl,
          cacheKey: key,
          expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
        });
        void setCachedNarrationAudio({
          key,
          storyId: ANNOUNCEMENT_STORY_ID,
          mode: ttsMode,
          voice: result.voice || "configured",
          textHash,
          audioUrl: result.audioUrl,
          model: result.model,
          format: result.format,
          bytes: result.bytes,
          signedUrlExpiresAt: result.signedUrlExpiresAt,
          updatedAt: Date.now(),
        });
        return result.audioUrl;
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abort);
      }
    } catch {
      return null;
    }
  })();

  inflightAnnouncements.set(memoryKey, task);
  void task.finally(() => {
    if (inflightAnnouncements.get(memoryKey) === task) {
      inflightAnnouncements.delete(memoryKey);
    }
  });
  return task;
}

/**
 * Foreground-only speechSynthesis fallback used only when the screen is visible
 * and cloud TTS announcement audio was not preloaded in time or failed.
 */
export function speakAnnouncementInForeground(
  book: { title: string; englishTitle?: string },
  mode: BrowserNarrationMode,
): () => void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    document.visibilityState === "hidden" ||
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    return () => {};
  }

  const { text, lang } = formatNextBookAnnouncement(book, mode);
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang === "zh-CN" ? 0.9 : 0.94;
    utterance.pitch = 1;
    utterance.voice = pickBrowserVoice(window.speechSynthesis.getVoices(), lang);
    let active = true;
    utterance.onend = () => {
      active = false;
    };
    utterance.onerror = () => {
      active = false;
    };
    window.speechSynthesis.speak(utterance);
    return () => {
      if (!active) return;
      active = false;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech cancel failures.
      }
    };
  } catch {
    return () => {};
  }
}

export function resetAnnouncementMemoryCache() {
  readyAnnouncements.clear();
  inflightAnnouncements.clear();
}
