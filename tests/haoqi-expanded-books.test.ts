import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBook } from "@/lib/library";
import plan from "../content-drafts/haoqi/batch-31-48/plan.json";
import audio from "../content-drafts/haoqi/local-audio.json";
import { validBookAudio } from "../miniprogram/src/core/book-audio";
import type { BookAudio } from "../miniprogram/src/core/types";

describe("approved curiosity books 31–48", () => {
  it("delivers 344 consecutive bilingual illustrated pages with matching prepared narration", () => {
    let pages = 0;
    for (const [index, [id, title, count]] of plan.entries()) {
      const book = getBook("haoqi", String(id));
      expect(book).toBeTruthy();
      if (!book) continue;
      expect(book.title).toBe(title);
      expect(book.order).toBe(index + 31);
      expect(book.pages.length).toBe(count);
      expect(book.pages.map(p => p.page)).toEqual(Array.from({ length: Number(count) }, (_, n) => n + 1));
      pages += book.pages.length;
      for (const page of book.pages) {
        expect(page.zhText.trim()).not.toBe("");
        expect(page.enText.trim()).not.toBe("");
        const bytes = readFileSync(path.resolve(`public${page.imageUrl}`));
        expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
        expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
        expect(bytes.length).toBeLessThanOrEqual(300 * 1024);
      }
      const hash = createHash("sha256").update(JSON.stringify({ version: 1, texts: book.pages.map(p => p.zhText.trim()) })).digest("hex");
      const narration = (audio as Record<string, BookAudio>)[`haoqi/${id}`];
      expect(narration).toBeTruthy();
      expect(narration.contentHash).toBe(hash);
      expect(validBookAudio({ ...narration, url: `https://local.invalid${narration.url}` }, book.pages.length)).toBe(true);
      expect(statSync(path.resolve(`public${narration.url}`)).size).toBeGreaterThan(1000);
    }
    expect(pages).toBe(344);
  });
});
