import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  findAdjacentPublishedBooks,
  getAdjacentBooks,
  getAllSeries,
  getBook,
  getPublishedBookCount,
  getPublishedBooks,
  getSeries,
  getSeriesBooks,
} from "@/lib/library";
import type { LibraryBook } from "@/types/library";

const CHENGYU_BOOK_IDS = [
  "shou-zhu-dai-tu",
  "hu-jia-hu-wei",
  "hua-she-tian-zu",
  "ba-miao-zhu-zhang",
  "wang-yang-bu-lao",
  "jing-di-zhi-wa",
  "yu-gong-yi-shan",
  "ke-zhou-qiu-jian",
  "yan-er-dao-ling",
  "dui-niu-tan-qin",
];
const MAX_LIBRARY_IMAGE_SIZE_BYTES = 300 * 1024;

describe("library access functions", () => {
  it("lists the chengyu series with a consistent published book count", () => {
    const chengyu = getAllSeries().find((series) => series.id === "chengyu");
    const publishedBooks = getSeriesBooks("chengyu").filter(
      (book) => !book.comingSoon,
    );

    expect(chengyu).toBeDefined();
    expect(chengyu?.bookCount).toBe(getPublishedBookCount("chengyu"));
    expect(getPublishedBooks("chengyu")).toEqual(publishedBooks);
    expect(getPublishedBookCount("chengyu")).toBe(CHENGYU_BOOK_IDS.length);
    expect(getPublishedBooks("chengyu").map((book) => book.id)).toEqual(
      CHENGYU_BOOK_IDS,
    );
    expect(getPublishedBookCount()).toBe(
      getAllSeries().reduce(
        (total, series) => total + getPublishedBookCount(series.id),
        0,
      ),
    );
    expect(getSeries("chengyu")).toEqual(chengyu);
  });

  it("returns a book with 8 bilingual StoryPage pages", () => {
    const book = getBook("chengyu", "shou-zhu-dai-tu");

    expect(book).not.toBeNull();
    expect(book?.pages).toHaveLength(8);
    for (const page of book?.pages ?? []) {
      expect(page.zhText).toBeTruthy();
      expect(page.enText).toBeTruthy();
      expect(page.illustrationPrompt).toBeTruthy();
    }
    expect(book?.pages.map((page) => page.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("includes exactly the published chengyu books in sitemap order", () => {
    const entries = sitemap();
    const baseUrl = entries[0].url.replace(/\/$/, "");
    const bookUrlPrefix = `${baseUrl}/library/chengyu/`;
    const bookUrls = entries
      .map((entry) => entry.url)
      .filter((url) => url.startsWith(bookUrlPrefix));
    const expectedBookUrls = CHENGYU_BOOK_IDS.map(
      (bookId) => `${bookUrlPrefix}${bookId}`,
    );

    expect(bookUrls).toEqual(expectedBookUrls);
  });

  it("keeps each chengyu book's illustration URLs in its own directory", () => {
    const expectedUrls = (bookId: string) =>
      Array.from(
        { length: 8 },
        (_, index) => `/library/chengyu/${bookId}/${index + 1}.webp`,
      );
    let verifiedImageCount = 0;

    for (const [index, bookId] of CHENGYU_BOOK_IDS.entries()) {
      const book = getBook("chengyu", bookId);
      const imageUrls = expectedUrls(bookId);

      expect(book).toMatchObject({
        id: bookId,
        seriesId: "chengyu",
        order: index + 1,
        publishedAt: "2026-07-20",
      });
      expect(book?.comingSoon).not.toBe(true);
      expect(book?.pages).toHaveLength(8);
      expect(book?.pages.map((page) => page.imageUrl)).toEqual(imageUrls);
      expect(
        book?.pages.every((page) => page.imageStatus === "complete"),
      ).toBe(true);

      for (const [pageIndex] of imageUrls.entries()) {
        const imagePath = join(
          process.cwd(),
          "public",
          "library",
          "chengyu",
          bookId,
          `${pageIndex + 1}.webp`,
        );
        const imageExists = existsSync(imagePath);

        expect(imageExists, `${imagePath} should exist`).toBe(true);
        if (!imageExists) {
          continue;
        }

        const imageStats = statSync(imagePath);
        expect(imageStats.isFile(), `${imagePath} should be a file`).toBe(true);
        expect(imageStats.size, `${imagePath} should not be empty`).toBeGreaterThan(
          0,
        );
        expect(
          imageStats.size,
          `${imagePath} should not exceed 300KB`,
        ).toBeLessThanOrEqual(MAX_LIBRARY_IMAGE_SIZE_BYTES);
        verifiedImageCount += 1;
      }
    }

    expect(verifiedImageCount).toBe(CHENGYU_BOOK_IDS.length * 8);
  });

  it("returns null for unknown series or book ids", () => {
    expect(getSeries("unknown")).toBeNull();
    expect(getBook("chengyu", "unknown")).toBeNull();
    expect(getBook("unknown", "shou-zhu-dai-tu")).toBeNull();
    expect(getSeriesBooks("unknown")).toEqual([]);
  });

  it("computes adjacent books by series order", () => {
    for (const [index, bookId] of CHENGYU_BOOK_IDS.entries()) {
      const { previous, next } = getAdjacentBooks("chengyu", bookId);

      expect(previous?.id ?? null).toBe(CHENGYU_BOOK_IDS[index - 1] ?? null);
      expect(next?.id ?? null).toBe(CHENGYU_BOOK_IDS[index + 1] ?? null);
    }

    expect(getAdjacentBooks("chengyu", "unknown")).toEqual({
      previous: null,
      next: null,
    });
  });

  it("skips coming-soon gaps when finding published neighbors", () => {
    const template = getBook("chengyu", "shou-zhu-dai-tu");
    expect(template).not.toBeNull();

    const makeBook = (
      id: string,
      order: number,
      comingSoon = false,
    ): LibraryBook => ({
      ...template!,
      id,
      order,
      comingSoon,
    });
    const books = [
      makeBook("first", 1),
      makeBook("draft-before", 2, true),
      makeBook("current", 3),
      makeBook("draft-after", 4, true),
      makeBook("last", 5),
    ];

    const { previous, next } = findAdjacentPublishedBooks(books, "current");

    expect(previous?.id).toBe("first");
    expect(next?.id).toBe("last");
  });
});

describe("xiyouji and haoqi published series (tasks B/C)", () => {
  it("registers both series with two published books and complete images", () => {
    for (const seriesId of ["xiyouji", "haoqi"]) {
      const series = getSeries(seriesId);
      expect(series, seriesId).not.toBeNull();
      expect(series?.bookCount).toBe(2);
      expect(getPublishedBookCount(seriesId)).toBe(2);
      expect(getSeriesBooks(seriesId).length).toBeGreaterThan(0);
      for (const book of getSeriesBooks(seriesId)) {
        expect(book.comingSoon, `${seriesId}/${book.id}`).not.toBe(true);
        expect(book.pages).toHaveLength(8);
        for (const page of book.pages) {
          expect(page.zhText).toBeTruthy();
          expect(page.enText).toBeTruthy();
          expect(page.illustrationPrompt).toBeTruthy();
          expect(page.imageUrl).toMatch(new RegExp(`/library/${seriesId}/`));
          expect(page.imageStatus).toBe("complete");
        }
      }
    }
  });

  it("numbers xiyouji episodes and sets haoqi questions", () => {
    for (const [index, book] of getSeriesBooks("xiyouji").entries()) {
      expect(book.episodeNumber).toBe(index + 1);
    }
    for (const book of getSeriesBooks("haoqi")) {
      expect(book.question).toMatch(/？$/);
    }
  });

  it("includes the four published book routes in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(
      urls.some((url) => url.endsWith("/library/xiyouji/shi-hou-chu-shi")),
    ).toBe(true);
    expect(
      urls.some((url) => url.endsWith("/library/xiyouji/bai-shi-xue-yi")),
    ).toBe(true);
    expect(
      urls.some((url) => url.endsWith("/library/haoqi/tian-kong-wei-shen-me-shi-lan-se")),
    ).toBe(true);
    expect(
      urls.some((url) => url.endsWith("/library/haoqi/yue-liang-wei-shen-me-gen-zhe-wo-zou")),
    ).toBe(true);
    expect(urls.some((url) => url.endsWith("/library/xiyouji"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/library/haoqi"))).toBe(true);
  });
});
