import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAllSeries, getSeriesBooks } from "../src/lib/library";
import { exportMiniContent } from "../scripts/lib/miniprogram-content";
import { bookAudioHash } from "../scripts/lib/miniprogram-book-audio";
import { validBookAudio } from "../miniprogram/src/core/book-audio";
import type { BookAudio } from "../miniprogram/src/core/types";

describe("published Chinese book audio assets", () => {
  it("covers every published illustrated book with matching text and complete timing", () => {
    const exported = exportMiniContent(getAllSeries(), getSeriesBooks, "");
    const manifest = JSON.parse(readFileSync("miniprogram/chinese-audio-manifest.json", "utf8")) as Record<string, BookAudio>;
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(exported.books).sort());
    for (const book of Object.values(exported.books)) {
      const audio = manifest[book.id];
      expect(audio.contentHash, book.id).toBe(bookAudioHash(book));
      expect(validBookAudio(audio, book.pages.length), book.id).toBe(true);
      const url = new URL(audio.url);
      expect(url.pathname).toContain("/object/public/library-audio-public/");
      expect(url.search).toBe("");
    }
  });
});
