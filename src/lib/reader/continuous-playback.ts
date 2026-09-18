import type { BrowserNarrationMode } from "@/lib/browser-narration";

export function nextSeriesBook<T extends { id: string }>(books: readonly T[], currentId: string): T | undefined {
  const index = books.findIndex(book => book.id === currentId);
  return index < 0 ? undefined : books[index + 1];
}

export function parsePlaybackHandoff(raw: string | null, contentId: string, now = Date.now()): { id: string; language: BrowserNarrationMode } | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || value.id !== contentId || typeof value.at !== "number" || now < value.at || now - value.at >= 60_000) return null;
    if (!["zh", "en", "zh-en"].includes(value.language)) return null;
    return value;
  } catch { return null; }
}
