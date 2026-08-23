import { describe, expect, it } from "vitest";
import { HOME_FEATURED_LIBRARY_BOOKS } from "../src/lib/library/home-featured";
import { getBook, getSeries } from "../src/lib/library";

describe("homepage library series selection", () => {
  it("keeps the curated homepage trio and leaves tangshi in the library", () => {
    expect(HOME_FEATURED_LIBRARY_BOOKS).toHaveLength(3);
    expect(
      new Set(HOME_FEATURED_LIBRARY_BOOKS.map((book) => book.seriesId)).size,
    ).toBe(3);
    expect(
      HOME_FEATURED_LIBRARY_BOOKS.map((book) => String(book.seriesId)),
    ).not.toContain("tangshi");

    for (const featured of HOME_FEATURED_LIBRARY_BOOKS) {
      const series = getSeries(featured.seriesId);
      const book = getBook(featured.seriesId, featured.id);

      expect(series?.title).toBe(featured.seriesTitle);
      expect(series?.accent).toBe(featured.accent);
      expect(book?.comingSoon).not.toBe(true);
      expect(book?.title).toBe(featured.title);
      expect(book?.subtitle).toBe(featured.subtitle);
      expect(book?.pages[0]?.imageUrl).toBe(featured.coverImage);
      expect(featured.href).toBe(`/library/${featured.seriesId}/${featured.id}`);
    }
  });
});
