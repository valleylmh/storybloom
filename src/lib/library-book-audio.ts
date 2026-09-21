import "server-only";
import { createHash } from "node:crypto";
import manifest from "../../miniprogram/chinese-audio-manifest.json";
import localManifest from "../../content-drafts/chengyu/chengyu-51-60-audio.json";
import { validBookAudio } from "../../miniprogram/src/core/book-audio";
import type { BookAudio } from "../../miniprogram/src/core/types";
import type { StoryPage } from "@/types";

/** Return only this book's verified public asset; never bundle the full registry in the client. */
export function getLibraryChineseAudio(seriesId: string, bookId: string, pages: StoryPage[]): BookAudio | undefined {
  const hash = createHash("sha256").update(JSON.stringify({ version: 1, texts: pages.map(page => page.zhText.trim()) })).digest("hex");
  const local = (localManifest as Record<string, BookAudio>)[`${seriesId}/${bookId}`];
  // Bundled files are served by the current site, including localhost previews.
  // Validate their exact content-addressed path before reusing the timing validator.
  if (local?.contentHash === hash &&
      local.url === `/library/${seriesId}/${bookId}/zh-${hash.slice(0, 16)}.mp3` &&
      validBookAudio({ ...local, url: `https://local.invalid${local.url}` }, pages.length)) return local;
  const audio = (manifest as Record<string, BookAudio>)[`${seriesId}/${bookId}`];
  return audio?.contentHash === hash && validBookAudio(audio, pages.length) ? audio : undefined;
}
