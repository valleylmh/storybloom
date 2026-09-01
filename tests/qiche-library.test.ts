import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import { filterLibraryBooks } from "@/lib/library/discovery";
import {
  getBook,
  getPublishedBooks,
  getSeries,
} from "@/lib/library";
import { getLibraryStorySpecByContentId } from "@/lib/library/personalization";

const EXPECTED_BOOKS = [
  { id: "hong-lu-deng-wei-shen-me-hui-bian-se", pages: 12 },
  { id: "gong-jiao-che-zen-me-zhi-dao-xia-yi-zhan", pages: 12 },
  { id: "di-tie-wei-shen-me-pao-de-kuai", pages: 12 },
  { id: "xiao-fang-che-wei-shen-me-yao-ming-di", pages: 12 },
  { id: "jiu-hu-che-zen-yang-zheng-fen-duo-miao", pages: 12 },
  { id: "la-ji-che-ba-la-ji-song-dao-na-li", pages: 12 },
  { id: "sa-shui-che-wei-shen-me-yi-lu-pen-shui", pages: 10 },
  { id: "xiao-che-wei-shen-me-yao-ting-wen-zai-xia-che", pages: 12 },
  { id: "an-quan-dai-bao-hu-shui", pages: 10 },
  { id: "dian-dong-qi-che-zen-me-chong-dian", pages: 12 },
  { id: "chu-zu-che-wei-shen-me-you-ding-deng", pages: 12 },
  { id: "chu-zu-che-zen-yang-zhao-dao-mu-de-di", pages: 12 },
  { id: "gao-tie-wei-shen-me-pao-de-kuai", pages: 12 },
  { id: "dong-che-zu-zen-yang-yi-qi-pao", pages: 12 },
  { id: "fei-ji-wei-shen-me-neng-fei", pages: 12 },
  { id: "fei-ji-zen-yang-an-quan-qi-fei-he-jiang-luo", pages: 12 },
] as const;

describe("Qiche city vehicle library", () => {
  it("publishes sixteen ordered variable-length bilingual books", () => {
    const series = getSeries("qiche");
    const books = getPublishedBooks("qiche");

    expect(series).toMatchObject({
      title: "城市汽车小队",
      bookCount: 16,
      ageRange: "4–8 岁",
    });
    expect(books.map(({ id, pages }) => ({ id, pages: pages.length }))).toEqual(
      EXPECTED_BOOKS,
    );

    for (const [index, book] of books.entries()) {
      expect(book.order).toBe(index + 1);
      expect(book.comingSoon).toBe(false);
      expect(book.pages.map((page) => page.page)).toEqual(
        Array.from({ length: book.pages.length }, (_, pageIndex) => pageIndex + 1),
      );
      expect(book.pages.every((page) => page.zhText.trim() && page.enText.trim())).toBe(
        true,
      );
      expect(
        book.pages.every(
          (page) =>
            page.illustrationPrompt.includes("安安") &&
            page.illustrationPrompt.includes("Avoid:") &&
            page.imageStatus === "complete",
        ),
      ).toBe(true);
      expect(book.metadata?.personalizationEnabled).toBe(false);
    }
  });

  it("makes vehicle topics searchable and keeps page text out of the index corpus", () => {
    const series = getSeries("qiche");
    expect(series).not.toBeNull();
    if (!series) return;
    const summaries = getPublishedBooks("qiche").map((book) =>
      createLibraryBookSummary(series, book),
    );

    expect(filterLibraryBooks(summaries, { query: "消防车 鸣笛" }).map((book) => book.id)).toEqual([
      "xiao-fang-che-wei-shen-me-yao-ming-di",
    ]);
    expect(filterLibraryBooks(summaries, { query: "电动汽车 充电" }).map((book) => book.id)).toEqual([
      "dian-dong-qi-che-zen-me-chong-dian",
    ]);
    expect(filterLibraryBooks(summaries, { query: "出租车 顶灯" }).map((book) => book.id)).toEqual([
      "chu-zu-che-wei-shen-me-you-ding-deng",
    ]);
    expect(filterLibraryBooks(summaries, { query: "出租车 目的地" }).map((book) => book.id)).toEqual([
      "chu-zu-che-zen-yang-zhao-dao-mu-de-di",
    ]);
    expect(filterLibraryBooks(summaries, { query: "高铁 空气阻力" }).map((book) => book.id)).toEqual([
      "gao-tie-wei-shen-me-pao-de-kuai",
    ]);
    expect(filterLibraryBooks(summaries, { query: "动车组 车厢连接" }).map((book) => book.id)).toEqual([
      "dong-che-zu-zen-yang-yi-qi-pao",
    ]);
    expect(filterLibraryBooks(summaries, { query: "飞机 升力" }).map((book) => book.id)).toEqual([
      "fei-ji-wei-shen-me-neng-fei",
    ]);
    expect(filterLibraryBooks(summaries, { query: "飞机 起飞 降落" }).map((book) => book.id)).toEqual([
      "fei-ji-zen-yang-an-quan-qi-fei-he-jiang-luo",
    ]);
    const firstPageText = getPublishedBooks("qiche")[0].pages[0].zhText;
    expect(summaries[0].searchText).not.toContain(firstPageText);
  });

  it("does not expose the fixed-eight-page personalization flow", () => {
    for (const { id } of EXPECTED_BOOKS) {
      expect(getLibraryStorySpecByContentId(`qiche/${id}`)).toBeNull();
    }
  });

  it("ships every square WebP illustration within the library budget", async () => {
    for (const { id, pages } of EXPECTED_BOOKS) {
      const book = getBook("qiche", id);
      expect(book).not.toBeNull();
      for (let page = 1; page <= pages; page += 1) {
        const imagePath = join(
          process.cwd(),
          "public",
          "library",
          "qiche",
          id,
          `${page}.webp`,
        );
        expect(existsSync(imagePath), imagePath).toBe(true);
        if (!existsSync(imagePath)) continue;
        expect(statSync(imagePath).size).toBeLessThanOrEqual(300 * 1024);
        const metadata = await sharp(imagePath).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1200);
        expect(book?.pages[page - 1]?.imageUrl).toBe(
          `/library/qiche/${id}/${page}.webp`,
        );
      }
    }
  });

  it("includes the series and all sixteen books in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/library/qiche"))).toBe(true);
    for (const { id } of EXPECTED_BOOKS) {
      expect(urls.some((url) => url.endsWith(`/library/qiche/${id}`))).toBe(true);
    }
  });

  it("keeps the maintained visual lock document reviewable", () => {
    const lock = readFileSync(
      join(process.cwd(), "docs", "library-prompts", "qiche", "characters.md"),
      "utf8",
    );
    expect(lock).toContain("安安");
    expect(lock).toContain("连续性验收");
    expect(lock).toContain("No text");
  });
});
