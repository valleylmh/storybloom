import { describe, expect, it } from "vitest";
import {
  calculateReadingProgressPercent,
  createReadingProgressKey,
  mergeReadingProgress,
  normalizeReadingProgress,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";

function progress(
  overrides: Partial<ReadingProgressRecord> = {},
): ReadingProgressRecord {
  return {
    contentType: "library",
    contentId: "xiyouji/shi-hou-chu-shi",
    pageIndex: 0,
    maxPageIndex: 0,
    languageMode: "zh",
    playbackMode: "page",
    autoAdvance: true,
    progressPercent: 13,
    lastReadAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("local reading progress", () => {
  it("uses stable content keys for public and private books", () => {
    expect(
      createReadingProgressKey("library", "xiyouji/shi-hou-chu-shi"),
    ).toBe("library:xiyouji/shi-hou-chu-shi");
    expect(createReadingProgressKey("personalized", "story-123")).toBe(
      "personalized:story-123",
    );
  });

  it("keeps incomplete progress below 100 until the book is completed", () => {
    expect(calculateReadingProgressPercent(0, 8)).toBe(13);
    expect(calculateReadingProgressPercent(7, 8)).toBe(99);
    expect(calculateReadingProgressPercent(7, 8, true)).toBe(100);
  });

  it("normalizes invalid indexes and optional audio positions", () => {
    expect(
      normalizeReadingProgress(
        progress({ pageIndex: -2, maxPageIndex: -5, positionMs: -100 }),
      ),
    ).toMatchObject({ pageIndex: 0, maxPageIndex: 0 });
    expect(
      normalizeReadingProgress(
        progress({ pageIndex: -2, maxPageIndex: -5, positionMs: -100 }),
      ),
    ).not.toHaveProperty("positionMs");
  });

  it("uses the newer reading position while preserving completion and maximum progress", () => {
    const local = progress({
      pageIndex: 6,
      maxPageIndex: 7,
      progressPercent: 100,
      completedAt: "2026-08-15T23:00:00.000Z",
      updatedAt: "2026-08-15T23:00:00.000Z",
    });
    const cloud = progress({
      pageIndex: 2,
      maxPageIndex: 2,
      languageMode: "en",
      progressPercent: 38,
      updatedAt: "2026-08-16T01:00:00.000Z",
    });

    expect(mergeReadingProgress(local, cloud)).toMatchObject({
      pageIndex: 2,
      maxPageIndex: 7,
      languageMode: "en",
      progressPercent: 100,
      completedAt: "2026-08-15T23:00:00.000Z",
    });
  });
});
