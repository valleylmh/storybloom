import { describe, expect, it } from "vitest";
import { getAllSeries, getBook, getSeriesBooks } from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import {
  createPrivateStorySearchText,
  filterLibraryBooks,
  getLibraryRecommendations,
  matchesSearchText,
  normalizeSearchText,
  searchPrivateStoryItems,
  selectTonightRecommendation,
} from "@/lib/library/discovery";
import type { GenerateResponse } from "@/types";

function summaries() {
  return getAllSeries().flatMap((series) =>
    getSeriesBooks(series.id).map((book) =>
      createLibraryBookSummary(series, book),
    ),
  );
}

describe("library discovery", () => {
  it("normalizes bilingual queries and searches maintained metadata", () => {
    expect(normalizeSearchText("  Why？  天空！ ")).toBe("why 天空");
    expect(matchesSearchText("西游记 经典名著", "西游 经典")).toBe(true);

    const results = filterLibraryBooks(summaries(), {
      query: "天空 为什么",
    });
    expect(results.map((book) => book.contentId)).toContain(
      "haoqi/tian-kong-wei-shen-me-shi-lan-se",
    );
  });

  it("combines age, category, language, series, theme and bedtime filters", () => {
    const results = filterLibraryBooks(summaries(), {
      filters: {
        category: "idiom",
        age: "4-5",
        duration: "short",
        language: "bilingual",
        seriesId: "chengyu",
        theme: "成语",
        bedtimeOnly: true,
      },
    });

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (book) =>
          book.seriesId === "chengyu" &&
          book.metadata.category === "idiom" &&
          book.metadata.bedtimeSuitable,
      ),
    ).toBe(true);
  });

  it("selects a stable, explainable tonight recommendation without a profile", () => {
    const books = summaries();
    const first = selectTonightRecommendation(books, {
      age: "6-8",
      date: new Date("2026-08-16T12:00:00.000Z"),
    });
    const repeated = selectTonightRecommendation(books, {
      age: "6-8",
      date: new Date("2026-08-16T23:59:00.000Z"),
    });

    expect(first?.book.contentId).toBe(repeated?.book.contentId);
    expect(first?.explanation).toContain("6-8 岁");
  });

  it("puts the next series episode first and never recommends the current book", () => {
    const series = getAllSeries().find((item) => item.id === "xiyouji");
    const currentBook = getBook("xiyouji", "shi-hou-chu-shi");
    expect(series && currentBook).toBeTruthy();
    if (!series || !currentBook) return;

    const current = createLibraryBookSummary(series, currentBook);
    const recommendations = getLibraryRecommendations(current, summaries());
    expect(recommendations[0]).toMatchObject({
      book: { contentId: "xiyouji/mu-fa-du-dong-hai" },
      reason: "同系列下一本",
    });
    expect(recommendations.map((item) => item.book.metadata.seriesOrder)).toEqual([
      2, 3, 4, 5,
    ]);
    expect(
      recommendations.some((item) => item.book.contentId === current.contentId),
    ).toBe(false);
  });

  it("searches private story metadata locally without indexing page text", () => {
    const result = {
      storyId: "private-story",
      coverTitle: "小满的月亮船",
      input: {
        childName: "小满",
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "和爸爸一起看月亮",
        style: "watercolor",
        language: "zh-en",
      },
      pages: [],
      totalPages: 0,
      generationMode: "demo",
      freeChanceLabel: "",
    } satisfies GenerateResponse;
    const item = {
      searchText: createPrivateStorySearchText(result),
      id: result.storyId,
    };

    expect(searchPrivateStoryItems([item], "爸爸 月亮")).toEqual([item]);
    expect(searchPrivateStoryItems([item], "不存在的正文句子")).toEqual([]);
  });
});
