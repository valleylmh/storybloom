import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  mergeFavoriteCollections,
  mergeReadingProgressCollections,
} from "@/lib/cloud-reading-state";
import {
  mergeFavoriteRecords,
  normalizeFavoriteRecord,
  type FavoriteRecord,
} from "@/lib/favorites";
import { getBook } from "@/lib/library";
import {
  formatLibraryLanguages,
  resolveLibraryBookMetadata,
} from "@/lib/library/metadata";
import type { ReadingProgressRecord } from "@/lib/reading-progress";

function progress(
  contentId: string,
  updatedAt: string,
  pageIndex: number,
): ReadingProgressRecord {
  return {
    contentType: "library",
    contentId,
    pageIndex,
    maxPageIndex: pageIndex,
    languageMode: "zh",
    playbackMode: "page",
    autoAdvance: true,
    progressPercent: (pageIndex + 1) * 10,
    lastReadAt: updatedAt,
    updatedAt,
  };
}

function favorite(
  updatedAt: string,
  overrides: Partial<FavoriteRecord> = {},
): FavoriteRecord {
  return {
    contentType: "library",
    contentId: "xiyouji/shi-hou-chu-shi",
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt,
    ...overrides,
  };
}

describe("family story platform library state", () => {
  it("resolves maintainable metadata for every existing series shape", () => {
    const idiom = getBook("chengyu", "shou-zhu-dai-tu");
    const classic = getBook("xiyouji", "shi-hou-chu-shi");
    const science = getBook("haoqi", "tian-kong-wei-shen-me-shi-lan-se");
    expect(idiom && resolveLibraryBookMetadata(idiom)).toMatchObject({
      category: "idiom",
      languages: ["zh", "en"],
      personalizationEnabled: true,
    });
    expect(classic && resolveLibraryBookMetadata(classic)).toMatchObject({
      category: "classic",
      seriesOrder: 1,
    });
    expect(science && resolveLibraryBookMetadata(science)).toMatchObject({
      category: "science",
      bedtimeSuitable: false,
    });
    expect(formatLibraryLanguages(["zh", "en"])).toBe("中英双语");
  });

  it("uses the newer favorite state so an explicit unfavorite is preserved", () => {
    const active = favorite("2026-08-15T01:00:00.000Z");
    const deleted = favorite("2026-08-16T01:00:00.000Z", {
      deletedAt: "2026-08-16T01:00:00.000Z",
    });
    expect(mergeFavoriteRecords(active, deleted)).toMatchObject({
      deletedAt: "2026-08-16T01:00:00.000Z",
    });
    expect(normalizeFavoriteRecord(active).contentId).toBe(
      "xiyouji/shi-hou-chu-shi",
    );
  });

  it("merges local and cloud reading state without losing maximum progress", () => {
    const local = progress(
      "xiyouji/shi-hou-chu-shi",
      "2026-08-16T00:00:00.000Z",
      6,
    );
    const cloud = progress(
      "xiyouji/shi-hou-chu-shi",
      "2026-08-16T01:00:00.000Z",
      2,
    );
    expect(mergeReadingProgressCollections([local], [cloud])[0]).toMatchObject({
      pageIndex: 2,
      maxPageIndex: 6,
      progressPercent: 70,
    });
    expect(
      mergeFavoriteCollections(
        [favorite("2026-08-15T01:00:00.000Z")],
        [favorite("2026-08-16T01:00:00.000Z")],
      ),
    ).toHaveLength(1);
  });

  it("ships reversible account reading tables with owner-only RLS", () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../supabase/migrations/202608160001_family_reading_state.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const rollback = readFileSync(
      fileURLToPath(
        new URL(
          "../supabase/rollbacks/202608160001_family_reading_state.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    expect(migration).toContain("create table if not exists public.reading_progress");
    expect(migration).toContain("create table if not exists public.favorites");
    expect(migration).toContain("auth.uid() = user_id");
    expect(migration).toContain("unique (user_id, content_type, content_id)");
    expect(rollback).toContain("drop table if exists public.favorites");
    expect(rollback).toContain("drop table if exists public.reading_progress");
  });
});
