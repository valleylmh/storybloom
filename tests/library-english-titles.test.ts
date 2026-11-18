import { describe, expect, it } from "vitest";
import { getAllSeries, getBook, getPublishedBooks, getSeries } from "@/lib/library";
import { ENGLISH_TITLES, bookEnglishTitle } from "@/lib/library/english-titles";
import { bookDescription, bookMetadata, bookStructuredData } from "@/lib/library/seo";

const CJK = /[㐀-鿿]/;

describe("English library titles", () => {
  it("only names published books, in English", () => {
    const published = new Set(getAllSeries().flatMap((series) => getPublishedBooks(series.id).map((book) => `${book.seriesId}/${book.id}`)));
    for (const [contentId, title] of Object.entries(ENGLISH_TITLES)) {
      expect(published.has(contentId), contentId).toBe(true);
      expect(title.trim(), contentId).toBe(title);
      expect(CJK.test(title), contentId).toBe(false);
    }
  });

  it("leads English metadata with the English title and keeps the Chinese one", () => {
    const book = getBook("richang", "yao-huang-de-di-yi-ke-xiao-ru-ya")!;
    const series = getSeries("richang")!;
    const metadata = bookMetadata(book, series, "en");
    expect(metadata.title).toBe("My First Wobbly Tooth (摇晃的第一颗小乳牙) | Everyday Stories for Kids - StoryBloom");
    expect(metadata.alternates?.canonical).toBe("/en/library/richang/yao-huang-de-di-yi-ke-xiao-ru-ya");
    expect(bookDescription(book, "en").startsWith("My First Wobbly Tooth: ")).toBe(true);
    expect(bookStructuredData(book, series, "en")["@graph"][0]).toMatchObject({ name: "My First Wobbly Tooth" });
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
