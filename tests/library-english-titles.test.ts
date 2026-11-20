import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getAllSeries, getBook, getBookByEnglishSlug, getPublishedBooks, getSeries, getSeriesByEnglishSlug } from "@/lib/library";
import { ENGLISH_BOOKS, bookEnglishTitle } from "@/lib/library/english-titles";
import { libraryBookPath, librarySeriesPath } from "@/lib/library/paths";
import { bookDescription, bookMetadata, bookStructuredData } from "@/lib/library/seo";
import { middleware } from "@/middleware";

const CJK = /[㐀-鿿]/;

describe("English library titles and URLs", () => {
  it("gives published books English titles and unique public slugs", () => {
    const published = getAllSeries().flatMap((series) => getPublishedBooks(series.id));
    expect(Object.keys(ENGLISH_BOOKS).sort()).toEqual(published.map((book) => `${book.seriesId}/${book.id}`).sort());
    for (const [contentId, { title, slug }] of Object.entries(ENGLISH_BOOKS)) {
      expect(title.trim(), contentId).toBe(title);
      expect(CJK.test(title), contentId).toBe(false);
      expect(slug, contentId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    const paths = published.map((book) => libraryBookPath(book, "en"));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("resolves every English alias and redirects legacy URLs", () => {
    const base = "https://storybloom.valleylmh.vip";
    for (const series of getAllSeries()) {
      const seriesPath = librarySeriesPath(series.id, "en");
      expect(getSeriesByEnglishSlug(seriesPath.split("/").at(-1)!)).toBe(series);
      const oldSeries = middleware(new NextRequest(`${base}/en/library/${series.id}`));
      expect(oldSeries.status).toBe(308);
      expect(oldSeries.headers.get("location")).toBe(`${base}${seriesPath}`);

      for (const book of getPublishedBooks(series.id)) {
        const newPath = libraryBookPath(book, "en");
        expect(getBookByEnglishSlug(series.id, newPath.split("/").at(-1)!)).toBe(book);
        const oldBook = middleware(new NextRequest(`${base}/en/library/${series.id}/${book.id}?ref=reader`));
        expect(oldBook.status).toBe(308);
        expect(oldBook.headers.get("location")).toBe(`${base}${newPath}?ref=reader`);
        expect(middleware(new NextRequest(`${base}${newPath}`)).headers.get("location")).toBeNull();
      }
    }
    const proverb = middleware(new NextRequest(`${base}/en/library/chengyu/zhong-ren-shi-chai`));
    expect(proverb.headers.get("location")).toBe(`${base}/en/library/chinese-proverbs/many-hands-make-the-fire-burn-high`);
    const unknownBook = middleware(new NextRequest(`${base}/en/library/richang/missing`));
    expect(unknownBook.headers.get("location")).toBeNull();
  });

  it("publishes English metadata with the localized slug and reciprocal alternates", () => {
    const book = getBook("richang", "yao-huang-de-di-yi-ke-xiao-ru-ya")!;
    const series = getSeries("richang")!;
    const englishPath = "/en/library/everyday-stories/first-wiggly-tooth";
    const chinesePath = "/library/richang/yao-huang-de-di-yi-ke-xiao-ru-ya";
    const metadata = bookMetadata(book, series, "en");
    expect(metadata.title).toBe("My First Wobbly Tooth | Everyday Stories for Kids - StoryBloom");
    expect(metadata.alternates?.canonical).toBe(englishPath);
    expect(metadata.alternates?.languages).toEqual({ "zh-CN": chinesePath, en: englishPath, "x-default": chinesePath });
    expect(bookMetadata(book, series).alternates?.languages).toEqual(metadata.alternates?.languages);
    expect(bookDescription(book, "en").startsWith("My First Wobbly Tooth: ")).toBe(true);
    expect(bookStructuredData(book, series, "en")["@graph"][0]).toMatchObject({
      name: "My First Wobbly Tooth", url: expect.stringContaining(englishPath), inLanguage: "en",
    });
  });

  it("does not change Chinese pages", () => {
    const book = getBook("chengyu", "shou-zhu-dai-tu")!;
    const series = getSeries("chengyu")!;
    expect(bookMetadata(book, series).title).toBe("守株待兔 - 中英双语成语故事绘本 | StoryBloom");
    expect(bookStructuredData(book, series)["@graph"][0]).toMatchObject({ name: "守株待兔" });
  });

  it("falls back to the Chinese title for a book without an entry", () => {
    const book = { ...getBook("chengyu", "shou-zhu-dai-tu")!, id: "not-translated-yet" };
    expect(bookEnglishTitle(book)).toBe("守株待兔");
    expect(bookMetadata(book, getSeries("chengyu")!, "en").title).toBe("守株待兔 | Chinese Idiom Stories for Kids - StoryBloom");
  });
});
