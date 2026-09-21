import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import drafts from "../content-drafts/chengyu/chengyu-51-60.json";
import { getLibraryChineseAudio } from "../src/lib/library-book-audio";
import { getLibraryBookCategoryLabel, resolveLibraryBookMetadata } from "../src/lib/library/metadata";
import type { LibraryBook } from "../src/types/library";
import { getBook, getSeries } from "../src/lib/library";

const books: LibraryBook[] = drafts.map(draft => ({
  ...draft,
  seriesId: "chengyu",
  pages: draft.pages.map((page, index) => ({
    page: index + 1,
    zhText: page.zh,
    enText: page.en,
    illustrationPrompt: page.prompt,
    imageUrl: `/library/chengyu/${draft.id}/${index + 1}.webp`,
    imageStatus: "complete" as const,
  })),
}));

describe("approved proverb and eight-character idiom books", () => {
  it("adds the new books to the existing series with their own complete artwork", () => {
    expect(getSeries("chengyu")?.title).toBe("成语与谚语");
    expect(getSeries("chengyu")?.bookCount).toBe(60);
    for (const draft of books) {
      const book = getBook("chengyu", draft.id);
      expect(book?.pages).toHaveLength(draft.pages.length);
      expect(book?.metadata?.tags).toEqual(draft.metadata?.tags);
      for (const page of book?.pages ?? []) {
        expect(page.imageStatus).toBe("complete");
        const file = path.join(process.cwd(), "public", page.imageUrl!);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size).toBeGreaterThan(1000);
        expect(statSync(file).size).toBeLessThanOrEqual(300 * 1024);
      }
    }
  });

  it("keeps the ten approved selections, complete bilingual pages and honest source labels", () => {
    expect(books.map(b => b.title)).toEqual([
      "众人拾柴火焰高", "心急吃不了热豆腐", "一分耕耘，一分收获", "远亲不如近邻", "赠人玫瑰，手有余香",
      "吃一堑，长一智", "千里之行，始于足下", "尺有所短，寸有所长", "一叶障目，不见泰山", "八仙过海，各显神通",
    ]);
    expect(books.map(b => b.pages.length)).toEqual([20, 18, 20, 18, 18, 20, 22, 18, 18, 20]);
    expect(books.reduce((n, b) => n + b.pages.length, 0)).toBe(192);
    books.forEach((book, index) => {
      expect(book.order).toBe(index + 51);
      expect(book.origin).toMatch(index < 6 ? /原创童话/ : /语出|相关语句|民间传说/);
      const metadata = resolveLibraryBookMetadata(book);
      expect(getLibraryBookCategoryLabel(metadata)).toBe(index < 6 ? "谚语故事" : "八字成语");
      expect(metadata.personalizationEnabled).toBe(false);
      for (const page of book.pages) {
        expect(page.zhText.trim().length).toBeGreaterThan(10);
        expect(page.enText.trim().length).toBeGreaterThan(20);
        expect(page.illustrationPrompt.trim()).not.toBe("");
      }
    });
  });

  it("resolves all ten bundled MP3s with page-aligned timing and rejects stale narration", () => {
    for (const book of books) {
      const audio = getLibraryChineseAudio(book.seriesId, book.id, book.pages);
      expect(audio, book.id).toBeDefined();
      if (!audio) continue;
      expect(audio.url).toMatch(new RegExp(`^/library/chengyu/${book.id}/zh-[a-f0-9]{16}\\.mp3$`));
      expect(audio.pageStarts).toHaveLength(book.pages.length);
      expect(audio.pageStarts[0]).toBe(0);
      for (const [index, start] of audio.pageStarts.entries()) {
        expect(start).toBeLessThan(audio.duration);
        if (index) expect(start).toBeGreaterThan(audio.pageStarts[index - 1]);
      }
      const file = path.join(process.cwd(), "public", audio.url);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(10000);
      const changed = book.pages.map((p, i) => i ? p : { ...p, zhText: p.zhText + "新正文" });
      expect(getLibraryChineseAudio(book.seriesId, book.id, changed)).toBeUndefined();
      expect(getLibraryChineseAudio(book.seriesId, book.id, book.pages.slice(1))).toBeUndefined();
      expect(getLibraryChineseAudio("another-series", book.id, book.pages)).toBeUndefined();
    }
  });
});
