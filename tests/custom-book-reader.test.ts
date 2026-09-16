import { describe, expect, it } from "vitest";
import { bookOpenings, openingForPage } from "../src/lib/custom-book/reader";
import { pdfPageNumbers } from "../src/lib/custom-book/reader";

describe("physical book openings and PDF sheets", () => {
  it("keeps the cover and page one independent and pairs facing pages", () => {
    expect(bookOpenings(4)).toEqual([0, 1, 2, 4]);
    expect(bookOpenings(5)).toEqual([0, 1, 2, 4]);
    expect(bookOpenings(12)).toEqual([0, 1, 2, 4, 6, 8, 10, 12]);
    expect([0, 1, 2, 3, 4, 5].map(openingForPage)).toEqual([0, 1, 2, 2, 4, 4]);
  });
  it("exports each continuous spread once, without dropping independent pages", () => {
    expect(pdfPageNumbers({ pageCount: 8, spreads: [2, 6] })).toEqual([
      0, 1, 2, 4, 5, 6, 8,
    ]);
    expect(pdfPageNumbers({ pageCount: 5, spreads: [4] })).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(pdfPageNumbers({ pageCount: 4, spreads: [4] })).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(pdfPageNumbers({ pageCount: 4, spreads: [] })).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });
});
