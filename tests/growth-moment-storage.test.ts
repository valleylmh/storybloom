import { describe, expect, it } from "vitest";
import {
  addStorybookVersion,
  createStorybookVersion,
  migrateLegacyGrowthRecord,
  projectGrowthMomentBundle,
  removeStorybookVersion,
} from "@/lib/growth-moments";
import {
  buildGrowthMomentBundlesFromStoredValues,
  createGrowthMomentShadowValues,
  createGrowthRecord,
  prepareGrowthMomentBundleForStorage,
  type GrowthRecordDraft,
} from "@/lib/growth-records";
import type { GenerateResponse } from "@/types";

function story(storyId: string, title: string): GenerateResponse {
  return {
    storyId,
    input: {
      childName: "安安",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "第一次整理玩具",
      style: "watercolor",
      language: "zh",
    },
    coverTitle: title,
    pages: [
      {
        page: 1,
        zhText: "玩具都回家了。",
        enText: "Every toy went home.",
        illustrationPrompt: "A child tidies toys.",
        imageStatus: "complete",
        imageUrl: "data:image/webp;base64,scene",
      },
    ],
    totalPages: 1,
    generationMode: "live",
    freeChanceLabel: "免费生成",
  };
}

function draft(): GrowthRecordDraft {
  return {
    version: 1,
    childKey: "child-1",
    childName: "安安",
    occurredOn: "2026-08-05",
    note: "第一次自己整理。",
    idea: "安安整理玩具",
    photos: [
      {
        id: "photo-1",
        name: "moment.webp",
        dataUrl: "data:image/webp;base64,photo",
      },
    ],
  };
}

describe("growth moment mixed-store compatibility", () => {
  it("hydrates a legacy row as one Moment and one StorybookVersion", () => {
    const legacy = createGrowthRecord(
      story("story-1", "玩具回家"),
      draft(),
      undefined,
      "2026-08-05T10:00:00.000Z",
    );

    const bundles = buildGrowthMomentBundlesFromStoredValues([legacy]);

    expect(bundles).toHaveLength(1);
    expect(bundles[0].moment.momentId).toBe(legacy.id);
    expect(bundles[0].storybookVersions.map((version) => version.storyId)).toEqual([
      "story-1",
    ]);
  });

  it("is idempotent when shadow envelopes and the legacy projection coexist", () => {
    const legacy = createGrowthRecord(
      story("story-1", "玩具回家"),
      draft(),
      undefined,
      "2026-08-05T10:00:00.000Z",
    );
    const firstBundle = migrateLegacyGrowthRecord(legacy);
    const secondVersion = createStorybookVersion(
      firstBundle.moment.momentId,
      story("story-2", "玩具星球"),
      { createdAt: "2026-08-06T10:00:00.000Z" },
    );
    const multiVersionBundle = addStorybookVersion(firstBundle, secondVersion);
    const projection = projectGrowthMomentBundle(multiVersionBundle);

    const [hydrated] = buildGrowthMomentBundlesFromStoredValues([
      ...createGrowthMomentShadowValues(multiVersionBundle),
      legacy,
      projection,
    ]);

    expect(hydrated.storybookVersions.map((version) => version.storyId)).toEqual([
      "story-1",
      "story-2",
    ]);
    expect(hydrated.activeStorybookVersionId).toBe(secondVersion.versionId);
  });

  it("keeps a photo-bearing Moment after its last storybook version is removed", () => {
    const legacy = createGrowthRecord(story("story-1", "玩具回家"), draft());
    const migrated = migrateLegacyGrowthRecord(legacy);
    const momentOnly = removeStorybookVersion(
      migrated,
      migrated.storybookVersions[0].versionId,
    );

    const [hydrated] = buildGrowthMomentBundlesFromStoredValues(
      createGrowthMomentShadowValues(momentOnly),
    );

    expect(hydrated.moment.originalAssets).toHaveLength(1);
    expect(hydrated.storybookVersions).toEqual([]);
    expect(projectGrowthMomentBundle(hydrated)).toBeNull();
  });

  it("reconciles a newer legacy projection after a temporary client rollback", () => {
    const legacy = createGrowthRecord(
      story("story-1", "玩具回家"),
      draft(),
      undefined,
      "2026-08-05T10:00:00.000Z",
    );
    const firstBundle = migrateLegacyGrowthRecord(legacy);
    const secondVersion = createStorybookVersion(
      firstBundle.moment.momentId,
      story("story-2", "玩具星球"),
      { createdAt: "2026-08-06T10:00:00.000Z" },
    );
    const multiVersionBundle = addStorybookVersion(firstBundle, secondVersion);
    const legacyEdited = {
      ...legacy,
      id: multiVersionBundle.moment.momentId,
      momentId: multiVersionBundle.moment.momentId,
      activeStorybookVersionId: firstBundle.storybookVersions[0].versionId,
      note: "旧客户端修改后的家长备注。",
      updatedAt: "2026-08-07T10:00:00.000Z",
    };

    const [hydrated] = buildGrowthMomentBundlesFromStoredValues([
      ...createGrowthMomentShadowValues(multiVersionBundle),
      legacyEdited,
    ]);

    expect(hydrated.moment.parentNote).toBe("旧客户端修改后的家长备注。");
    expect(hydrated.activeStorybookVersionId).toBe(
      firstBundle.storybookVersions[0].versionId,
    );
    expect(hydrated.storybookVersions).toHaveLength(2);
  });

  it("backfills asset metadata and removes duplicate bytes before persistence", async () => {
    const dataUrl = `data:image/webp;base64,${Buffer.from("same-photo").toString(
      "base64",
    )}`;
    const legacy = createGrowthRecord(story("story-1", "玩具回家"), {
      ...draft(),
      photos: [
        { id: "photo-1", name: "first.webp", dataUrl },
        { id: "photo-2", name: "renamed.webp", dataUrl },
      ],
    });
    const migrated = migrateLegacyGrowthRecord(legacy);

    const prepared = await prepareGrowthMomentBundleForStorage(migrated, {
      verifyExisting: true,
    });
    const projected = projectGrowthMomentBundle(prepared);

    expect(prepared.moment.originalAssets).toHaveLength(1);
    expect(prepared.moment.originalAssets[0]).toMatchObject({
      assetId: "photo-1",
      mimeType: "image/webp",
      byteSize: 10,
    });
    expect(prepared.moment.originalAssets[0].checksumSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(projected?.photos[0].checksumSha256).toBe(
      prepared.moment.originalAssets[0].checksumSha256,
    );
  });
});
