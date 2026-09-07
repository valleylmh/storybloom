import "server-only";
import { createHash } from "node:crypto";
import manifest from "../../miniprogram/chinese-audio-manifest.json";
import { validBookAudio } from "../../miniprogram/src/core/book-audio";
import type { BookAudio } from "../../miniprogram/src/core/types";
import type { StoryPage } from "@/types";

/** Return only this book's verified public asset; never bundle the full registry in the client. */
export function getLibraryChineseAudio(seriesId: string, bookId: string, pages: StoryPage[]): BookAudio | undefined {
  const audio = (manifest as Record<string, BookAudio>)[`${seriesId}/${bookId}`];
  const hash = createHash("sha256").update(JSON.stringify({ version: 1, texts: pages.map(page => page.zhText.trim()) })).digest("hex");
  return audio?.contentHash === hash && validBookAudio(audio, pages.length) ? audio : undefined;
}
