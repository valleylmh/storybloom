import type { BrowserNarrationMode } from "@/lib/browser-narration";
import type { BookAudio } from "@/lib/reader/book-audio-transport";

export const CONTINUOUS_PLAYBACK_STORAGE_KEY = "storybloom.continuous-playback";
export const NEXT_BOOK_COUNTDOWN_SECONDS = 3;

export type SeriesPlaylistItem = {
  id: string;
  title: string;
  englishTitle?: string;
  href: string;
  cover?: string;
  chineseAudio?: BookAudio;
};

export function parseContinuousPlaybackPreference(raw: string | null): boolean {
  return raw !== "false";
}

export function formatNextBookAnnouncement(
  book: { title: string; englishTitle?: string },
  mode: BrowserNarrationMode,
): { text: string; ttsMode: "zh" | "en"; lang: "zh-CN" | "en-US" } {
  const zhTitle = book.title.trim();
  const enTitle = book.englishTitle?.trim();
  if (mode === "en" && enTitle && enTitle !== zhTitle) {
    const end = /[.!?]$/.test(enTitle) ? "" : ".";
    return {
      text: `Next story: ${enTitle}${end}`,
      ttsMode: "en",
      lang: "en-US",
    };
  }
  const end = /[。！？!?]$/.test(zhTitle) ? "" : "。";
  return {
    text: `接下来播放下一本故事，${zhTitle}${end}`,
    ttsMode: "zh",
    lang: "zh-CN",
  };
}

export function startNextBookCountdown(onTick: (seconds: number) => void, onComplete: () => void): () => void {
  let seconds = NEXT_BOOK_COUNTDOWN_SECONDS;
  onTick(seconds);
  const timer = setInterval(() => {
    seconds -= 1;
    if (seconds === 0) {
      clearInterval(timer);
      onComplete();
    } else {
      onTick(seconds);
    }
  }, 1000);
  return () => clearInterval(timer);
}

export function nextSeriesBook<T extends { id: string }>(books: readonly T[], currentId: string): T | undefined {
  const index = books.findIndex(book => book.id === currentId);
  return index < 0 ? undefined : books[index + 1];
}

export function previousSeriesBook<T extends { id: string }>(books: readonly T[], currentId: string): T | undefined {
  const index = books.findIndex(book => book.id === currentId);
  return index > 0 ? books[index - 1] : undefined;
}

export function parsePlaybackHandoff(raw: string | null, contentId: string, now = Date.now()): { id: string; language: BrowserNarrationMode } | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || value.id !== contentId || typeof value.at !== "number" || now < value.at || now - value.at >= 60_000) return null;
    if (!["zh", "en", "zh-en"].includes(value.language)) return null;
    return value;
  } catch { return null; }
}
