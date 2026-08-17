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
  "ye-gong-hao-long",
  "zi-xiang-mao-dun",
  "lan-yu-chong-shu",
  "mai-du-huan-zhu",
  "nan-yuan-bei-zhe",
  "bei-gong-she-ying",
  "sai-weng-shi-ma",
  "wen-ji-qi-wu",
  "tie-chu-cheng-zhen",
  "xiong-you-cheng-zhu",
  "hua-long-dian-jing",
  "cao-chong-cheng-xiang",
  "lao-ma-shi-tu",
  "han-dan-xue-bu",
  "cheng-men-li-xue",
  "wei-bian-san-jue",
  "shui-di-shi-chuan",
  "shu-neng-sheng-qiao",
  "wang-mei-zhi-ke",
  "meng-mu-san-qian",
];
const XIYOUJI_BOOK_IDS = [
  "shi-hou-chu-shi",
  "bai-shi-xue-yi",
  "long-gong-jie-bao",
  "da-nao-tian-gong",
  "wu-xing-shan-xia",
  "shi-tu-xiang-yu",
  "bai-long-ma",
  "gao-lao-zhuang-yu-ba-jie",
  "liu-sha-he-shou-sha-seng",
  "san-da-bai-gu-jing",
  "bao-xiang-guo-jiu-gong-zhu",
  "zhi-dou-jin-jiao-yin-jiao",
  "wu-ji-guo-bian-zhen-wang",
  "huo-yun-dong-shou-hong-hai-er",
  "che-chi-guo-san-chang-bi-shi",
  "tong-tian-he-jiu-tong-zi",
  "nu-er-guo-ci-bie",
  "zhen-jia-mei-hou-wang",
  "san-jie-ba-jiao-shan",
  "xiao-lei-yin-si-shi-jia-fo",
  "pan-si-dong-qiao-tuo-xian",
  "huang-hua-guan-jie-cai-cha",
  "shi-tuo-ling-san-guan",
  "bi-qiu-guo-hu-tong-xin",
  "wu-di-dong-zhao-shi-fu",
  "mie-fa-guo-huan-xin-yi",
  "yin-wu-shan-bian-zhen-ying",
  "feng-xian-jun-qiu-gan-yu",
  "yu-hua-zhou-shou-xin-tu",
  "tian-zhu-guo-bian-yu-tu",
  "tong-tai-fu-jie-shan-yuan",
  "kou-fu-ci-bie",
  "kou-zhai-shi-bao",
  "wu-kong-xun-zhen-zheng",
  "ling-yun-du-guo-qiao",
  "wu-zi-jing-shu",
  "zhen-jing-dao-shou",
  "lao-yuan-wen-jiu-nuo",
  "shai-jing-shi-liu-hen",
  "chang-an-gong-de-yuan-man",
  "hei-feng-shan-hu-jia-sha",
  "huang-feng-ling-ding-feng-zhu",
  "si-sheng-shi-chan-xin",
  "wu-zhuang-guan-ren-shen-guo",
  "hei-shui-he-bian-tuo-long",
  "jin-dou-dong-shou-qing-niu",
  "ji-sai-guo-sao-bao-ta",
  "mu-xian-an-shi-hui",
  "zhu-zi-guo-jie-xin-jie",
  "jin-ping-fu-shou-hua-deng",
  "tian-ma-yuan-zhi-ban-biao",
  "pan-tao-yuan-de-qing-tie",
  "shuang-cha-ling-ren-lu",
  "bao-lin-si-jie-ye-xin",
  "hua-guo-shan-qing-shi-xiong",
  "tong-tian-he-an-quan-lu",
  "jing-ji-ling-kai-lu",
  "qi-jue-shan-qing-guo-xiang",
  "zhu-zi-guo-wen-wen-zhen",
  "yu-hua-zhou-zhao-gong-ju",
  "mu-fa-du-dong-hai",
  "san-geng-wu-an-hao",
  "qi-shi-er-bian-lian-xi",
  "long-gong-shi-san-bao",
  "ding-hai-shen-zhen-ren-zhu",
  "hua-guo-shan-chong-ju",
  "gao-lao-zhuang-fen-xing-li",
  "liu-sha-he-da-mu-pai",
  "wu-zhuang-guan-xiu-guo-zhi",
  "huo-yan-shan-liang-feng-lu",
];
const HAOQI_BOOK_IDS = [
  "tian-kong-wei-shen-me-shi-lan-se",
  "yue-liang-wei-shen-me-gen-zhe-wo-zou",
  "xing-xing-wei-shen-me-hui-zha-yan",
  "wei-shen-me-hui-xia-yu",
  "cai-hong-shi-zen-me-lai-de",
  "feng-wei-shen-me-hui-chui",
  "shu-ye-wei-shen-me-hui-bian-huang",
  "wei-shen-me-yao-shui-jiao",
  "du-zi-wei-shen-me-hui-gu-gu-jiao",
  "hai-shui-wei-shen-me-shi-xian-de",
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
        publishedAt:
          index < 10
            ? "2026-07-20"
            : index < 20
              ? "2026-07-29"
              : "2026-07-30",
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
  it("publishes all seventy xiyouji books with complete optimized images", () => {
    const books = getSeriesBooks("xiyouji");
    expect(books).toHaveLength(XIYOUJI_BOOK_IDS.length);
    expect(getSeries("xiyouji")?.bookCount).toBe(XIYOUJI_BOOK_IDS.length);
    expect(getPublishedBookCount("xiyouji")).toBe(XIYOUJI_BOOK_IDS.length);
    expect(getPublishedBooks("xiyouji").map((book) => book.id)).toEqual(
      XIYOUJI_BOOK_IDS,
    );

    let verifiedImageCount = 0;

    for (const [index, book] of books.entries()) {
      expect(book.id).toBe(XIYOUJI_BOOK_IDS[index]);
      expect(book.episodeNumber).toBe(index + 1);
      expect(book.comingSoon).not.toBe(true);
      expect(book.pages).toHaveLength(8);
      expect(book.pages.every((page) => page.imageStatus === "complete")).toBe(
        true,
      );

      for (const page of book.pages) {
        const imageUrl = page.imageUrl;

        expect(page.zhText).toBeTruthy();
        expect(page.enText).toBeTruthy();
        expect(page.illustrationPrompt).toBeTruthy();
        expect(page.illustrationPrompt).not.toContain("[[");
        expect(imageUrl).toBe(
          `/library/xiyouji/${book.id}/${page.page}.webp`,
        );
        if (!imageUrl) {
          continue;
        }

        const imagePath = join(process.cwd(), "public", imageUrl);
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

    expect(verifiedImageCount).toBe(XIYOUJI_BOOK_IDS.length * 8);
  });

  it("publishes all ten haoqi books with scientifically reviewed optimized images", () => {
    const books = getSeriesBooks("haoqi");
    expect(books).toHaveLength(HAOQI_BOOK_IDS.length);
    expect(getSeries("haoqi")?.bookCount).toBe(HAOQI_BOOK_IDS.length);
    expect(getPublishedBookCount("haoqi")).toBe(HAOQI_BOOK_IDS.length);
    expect(getPublishedBooks("haoqi").map((book) => book.id)).toEqual(
      HAOQI_BOOK_IDS,
    );

    let verifiedImageCount = 0;

    for (const [index, book] of books.entries()) {
      expect(book.id).toBe(HAOQI_BOOK_IDS[index]);
      expect(book.comingSoon).not.toBe(true);
      expect(book.question).toMatch(/？$/);
      expect(book.pages).toHaveLength(8);
      expect(book.pages.every((page) => page.imageStatus === "complete")).toBe(true);

      for (const page of book.pages) {
        const imageUrl = page.imageUrl;

        expect(page.zhText).toBeTruthy();
        expect(page.enText).toBeTruthy();
        expect(page.illustrationPrompt).toBeTruthy();
        expect(imageUrl).toBe(`/library/haoqi/${book.id}/${page.page}.webp`);
        if (!imageUrl) {
          continue;
        }

        const imagePath = join(process.cwd(), "public", imageUrl);
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

    expect(verifiedImageCount).toBe(HAOQI_BOOK_IDS.length * 8);
  });

  it("includes every published xiyouji and haoqi route in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    const xiyoujiUrls = urls.filter((url) => url.includes("/library/xiyouji/"));
    const xiyoujiUrlPrefix = xiyoujiUrls[0]?.replace(/\/[^/]+$/, "/") ?? "";
    const haoqiUrls = urls.filter((url) => url.includes("/library/haoqi/"));
    const haoqiUrlPrefix = haoqiUrls[0]?.replace(/\/[^/]+$/, "/") ?? "";

    expect(xiyoujiUrls).toEqual(
      XIYOUJI_BOOK_IDS.map((bookId) => `${xiyoujiUrlPrefix}${bookId}`),
    );
    expect(haoqiUrls).toEqual(
      HAOQI_BOOK_IDS.map((bookId) => `${haoqiUrlPrefix}${bookId}`),
    );
    expect(urls.some((url) => url.endsWith("/library/xiyouji"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/library/haoqi"))).toBe(true);
  });
});
