import { describe, expect, it } from "vitest";
import {
  createDefaultLocalGrowthRetentionPreference,
  createLocalGrowthRetentionPreview,
  getLocalGrowthRetentionCutoff,
  LOCAL_GROWTH_RETENTION_KEY,
  readLocalGrowthRetentionPreference,
  writeLocalGrowthRetentionPreference,
} from "@/lib/growth-archive-retention";
import type { GrowthMomentBundle } from "@/lib/growth-moments";

function storage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(LOCAL_GROWTH_RETENTION_KEY, initial);
  return {
    getItem(key: string) {
      return values.get(key) || null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function bundle(
  momentId: string,
  occurredOn: string,
  photos: number,
  versions: number,
): GrowthMomentBundle {
  return {
    moment: {
      schemaVersion: 1,
      momentId,
      clientMomentId: momentId,
      childKey: "child-1",
      childName: "安安",
      occurredOn,
      parentNote: "",
      sourceIdea: "成长时刻",
      parentFacts: "真实发生的事",
      originalAssets: Array.from({ length: photos }, (_, index) => ({
        assetId: `${momentId}-photo-${index}`,
        kind: "photo" as const,
        name: `${index}.webp`,
        dataUrl: "data:image/webp;base64,cGhvdG8=",
      })),
      confirmedTags: [],
      createdAt: `${occurredOn}T00:00:00.000Z`,
      updatedAt: `${occurredOn}T00:00:00.000Z`,
    },
    storybookVersions: Array.from({ length: versions }, (_, index) => ({
      schemaVersion: 1 as const,
      versionId: `${momentId}-version-${index}`,
      momentId,
      storyId: `${momentId}-story-${index}`,
      result: {
        storyId: `${momentId}-story-${index}`,
        input: {
          childName: "安安",
          ageGroup: "4-5" as const,
          theme: "custom" as const,
          customTheme: "成长时刻",
          style: "watercolor" as const,
          language: "zh-en" as const,
        },
        coverTitle: "成长故事",
        pages: [],
        totalPages: 0,
        generationMode: "live" as const,
        freeChanceLabel: "",
      },
      readingStage: "4-5" as const,
      style: "watercolor" as const,
      source: "generated" as const,
      createdAt: `${occurredOn}T00:00:00.000Z`,
      updatedAt: `${occurredOn}T00:00:00.000Z`,
    })),
  };
}

describe("local growth archive retention", () => {
  it("defaults to keeping data until a parent actively deletes it", () => {
    expect(createDefaultLocalGrowthRetentionPreference("2026-08-15T00:00:00.000Z")).toEqual({
      version: 1,
      policy: "keep-forever",
      updatedAt: "2026-08-15T00:00:00.000Z",
    });
    expect(readLocalGrowthRetentionPreference(storage())).toMatchObject({
      policy: "keep-forever",
    });
  });

  it("persists only the policy and update time, not child data", () => {
    const target = storage();
    const saved = writeLocalGrowthRetentionPreference(
      "3-years",
      target,
      "2026-08-15T00:00:00.000Z",
    );

    expect(saved?.policy).toBe("3-years");
    expect(readLocalGrowthRetentionPreference(target)).toEqual(saved);
  });

  it("previews expired moments without modifying the archive", () => {
    const bundles = [
      bundle("old", "2025-08-15", 2, 1),
      bundle("new", "2025-08-16", 1, 2),
    ];
    const preview = createLocalGrowthRetentionPreview(
      bundles,
      "1-year",
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(getLocalGrowthRetentionCutoff("1-year", new Date("2026-08-15"))).toBe(
      "2025-08-15",
    );
    expect(preview).toMatchObject({
      cutoffDate: "2025-08-15",
      momentIds: ["old"],
      momentCount: 1,
      photoCount: 2,
      storybookVersionCount: 1,
    });
    expect(bundles).toHaveLength(2);
  });

  it("uses the browser-local calendar date instead of the UTC date", () => {
    const localMorning = new Date(2026, 7, 15, 0, 30);

    expect(getLocalGrowthRetentionCutoff("1-year", localMorning)).toBe(
      "2025-08-15",
    );
  });

  it("never marks content as expired for keep-forever", () => {
    expect(
      createLocalGrowthRetentionPreview(
        [bundle("old", "2020-01-01", 1, 1)],
        "keep-forever",
      ),
    ).toMatchObject({ momentIds: [], momentCount: 0 });
  });
});
