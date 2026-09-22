import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextDrafts from "../content-drafts/chengyu/chengyu-61-65.json";
import drafts from "../content-drafts/chengyu/chengyu-51-60.json";
import { getLibraryChineseAudio } from "../src/lib/library-book-audio";
import { getLibraryBookCategoryLabel, resolveLibraryBookMetadata } from "../src/lib/library/metadata";
import type { LibraryBook } from "../src/types/library";
import { getBook, getSeries } from "../src/lib/library";

const asBooks = (items: typeof drafts): LibraryBook[] => items.map(draft => ({
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

const books = asBooks(drafts);
const nextBooks = asBooks(nextDrafts);

describe("approved proverb and eight-character idiom books", () => {
  it("adds the new books to the existing series with their own complete artwork", () => {
    expect(getSeries("chengyu")?.title).toBe("成语与谚语");
    expect(getSeries("chengyu")?.bookCount).toBe(65);
    for (const draft of [...books, ...nextBooks]) {
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

  it("preserves the five confirmed follow-up stories with 104 bilingual pages", () => {
    expect(nextBooks.map(book => book.title)).toEqual([
      "三个臭皮匠，顶个诸葛亮", "磨刀不误砍柴工", "远水救不了近火",
      "路遥知马力，日久见人心", "一寸光阴一寸金，寸金难买寸光阴",
    ]);
    expect(nextBooks.map(book => book.pages.length)).toEqual([22, 20, 20, 22, 20]);
    expect(nextBooks.reduce((total, book) => total + book.pages.length, 0)).toBe(104);
    for (const [index, book] of nextBooks.entries()) {
      expect(book.order).toBe(61 + index);
      expect(book.origin).toContain("原创童话");
      expect(getLibraryBookCategoryLabel(resolveLibraryBookMetadata(book))).toBe("谚语故事");
      for (const page of book.pages) {
        expect(page.zhText.trim().length).toBeGreaterThan(10);
        expect(page.enText.trim().length).toBeGreaterThan(20);
        expect(page.illustrationPrompt.trim().length).toBeGreaterThan(30);
      }
    }
  });

  it("resolves all fifteen bundled MP3s with page-aligned timing and rejects stale narration", () => {
    for (const book of [...books, ...nextBooks]) {
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
