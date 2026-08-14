import { describe, expect, it } from "vitest";
import {
  addStorybookVersion,
  clearGrowthMomentOriginalAssets,
  createGrowthMoment,
  createStorybookVersion,
  isGrowthMoment,
  isStorybookVersion,
  migrateLegacyGrowthRecord,
  projectGrowthMomentBundle,
  removeStorybookVersion,
  selectActiveStorybookVersion,
} from "@/lib/growth-moments";
import { createGrowthRecord, type GrowthRecordDraft } from "@/lib/growth-records";
import type { GenerateResponse } from "@/types";

function story(storyId: string, title: string): GenerateResponse {
  return {
    storyId,
    input: {
      childName: "安安",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "第一次自己收好积木",
      style: "fairytale",
      language: "zh",
    },
    coverTitle: title,
    pages: [
      {
        page: 1,
        zhText: "积木回到了盒子里。",
        enText: "The blocks returned to their box.",
        illustrationPrompt: "A child tidies wooden blocks.",
        imageStatus: "complete",
        imageUrl: "data:image/webp;base64,scene",
        imageProvider: "agnes",
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
    childKey: "child-local-1",
    childName: "安安",
    childCharacterId: "family-character-1",
    occurredOn: "2026-08-05",
    note: "安安收好以后特别骄傲。",
    idea: "安安第一次自己收好积木",
    parentFacts: "安安第一次独立收好积木。",
    allowedImaginations: "积木可以轻轻鼓掌。",
    readingStage: "4-5",
    storyTreatment: "warm-imagination",
    photos: [
      {
        id: "photo-1",
        name: "blocks.webp",
        dataUrl: "data:image/webp;base64,photo",
      },
    ],
  };
}

describe("growth moment domain model", () => {
  it("separates parent-confirmed facts and original assets from a storybook version", () => {
    const moment = createGrowthMoment(draft(), {
      momentId: "moment-1",
      now: "2026-08-05T10:00:00.000Z",
    });
    const version = createStorybookVersion("moment-1", story("story-1", "积木回家了"), {
      characterReferenceId: draft().childCharacterId,
      storyTreatment: draft().storyTreatment,
      createdAt: "2026-08-05T10:01:00.000Z",
    });

    expect(moment).toMatchObject({
      parentFacts: "安安第一次独立收好积木。",
      originalAssets: [expect.objectContaining({ assetId: "photo-1" })],
    });
    expect(moment).not.toHaveProperty("childCharacterId");
    expect(moment).not.toHaveProperty("story");
    expect(moment).not.toHaveProperty("readingStage");
    expect(moment).not.toHaveProperty("storyTreatment");
    expect(version).toMatchObject({
      momentId: "moment-1",
      storyId: "story-1",
      characterReferenceId: "family-character-1",
      imageProviders: ["agnes"],
    });
    expect(version).not.toHaveProperty("originalAssets");
    expect(isGrowthMoment(moment)).toBe(true);
    expect(isStorybookVersion(version)).toBe(true);
  });

  it("migrates a legacy GrowthRecord without losing its compatibility projection", () => {
    const legacy = createGrowthRecord(
      story("story-1", "积木回家了"),
      draft(),
      undefined,
      "2026-08-05T10:00:00.000Z",
    );
    const bundle = migrateLegacyGrowthRecord(legacy);
    const projected = projectGrowthMomentBundle(bundle);

    expect(bundle.moment).toMatchObject({
      momentId: legacy.id,
      parentNote: legacy.note,
      sourceIdea: legacy.idea,
    });
    expect(bundle.storybookVersions).toHaveLength(1);
    expect(projected).toMatchObject({
      id: legacy.id,
      momentId: legacy.id,
      storyId: legacy.storyId,
      activeStorybookVersionId: `storybook_${legacy.storyId}`,
      storybookVersionCount: 1,
      photos: legacy.photos,
      story: legacy.story,
    });

    const remoteAvatarLegacy = {
      ...legacy,
      childAvatarDataUrl: "https://example.com/private-child.webp",
    };
    expect(
      migrateLegacyGrowthRecord(remoteAvatarLegacy).moment,
    ).not.toHaveProperty("childAvatarDataUrl");
  });

  it("supports multiple versions and removing a version without deleting the Moment", () => {
    const moment = createGrowthMoment(draft(), {
      momentId: "moment-1",
      now: "2026-08-05T10:00:00.000Z",
    });
    const first = createStorybookVersion("moment-1", story("story-1", "版本一"), {
      createdAt: "2026-08-05T10:01:00.000Z",
    });
    const second = createStorybookVersion("moment-1", story("story-2", "版本二"), {
      createdAt: "2026-08-05T10:02:00.000Z",
    });
    const bundle = addStorybookVersion(
      addStorybookVersion({ moment, storybookVersions: [] }, first),
      second,
    );

    expect(bundle.storybookVersions).toHaveLength(2);
    expect(selectActiveStorybookVersion(bundle)?.storyId).toBe("story-2");

    const withoutSecond = removeStorybookVersion(bundle, second.versionId);
    expect(withoutSecond.moment.originalAssets).toHaveLength(1);
    expect(withoutSecond.storybookVersions).toHaveLength(1);
    expect(selectActiveStorybookVersion(withoutSecond)?.storyId).toBe("story-1");

    const withoutBooks = removeStorybookVersion(withoutSecond, first.versionId);
    expect(withoutBooks.storybookVersions).toEqual([]);
    expect(withoutBooks.moment.parentFacts).toContain("独立收好积木");
    expect(projectGrowthMomentBundle(withoutBooks)).toBeNull();
  });

  it("projects reading stage and treatment from the selected version, not the Moment", () => {
    const moment = createGrowthMoment(draft(), {
      momentId: "moment-1",
      now: "2026-08-05T10:00:00.000Z",
    });
    const youngerStory = story("story-younger", "低龄版本");
    youngerStory.input = {
      ...youngerStory.input,
      ageGroup: "2-3",
      style: "cartoon",
    };
    const version = createStorybookVersion("moment-1", youngerStory, {
      storyTreatment: "documentary",
    });
    const projected = projectGrowthMomentBundle({
      moment,
      storybookVersions: [version],
      activeStorybookVersionId: version.versionId,
    });

    expect(projected).toMatchObject({
      readingStage: "2-3",
      storyTreatment: "documentary",
    });
    expect(moment).not.toHaveProperty("readingStage");
    expect(moment).not.toHaveProperty("storyTreatment");
  });

  it("can delete original photos while retaining every generated version", () => {
    const migrated = migrateLegacyGrowthRecord(
      createGrowthRecord(story("story-1", "积木回家了"), draft()),
    );
    const cleared = clearGrowthMomentOriginalAssets(
      migrated,
      "2026-08-06T00:00:00.000Z",
    );

    expect(cleared.moment.originalAssets).toEqual([]);
    expect(cleared.moment.updatedAt).toBe("2026-08-06T00:00:00.000Z");
    expect(cleared.storybookVersions).toEqual(migrated.storybookVersions);
  });

  it("rejects malformed cross-linked versions and damaged runtime data", () => {
    const moment = createGrowthMoment(draft(), { momentId: "moment-1" });
    const otherVersion = createStorybookVersion(
      "moment-2",
      story("story-2", "错误版本"),
    );
    expect(() =>
      addStorybookVersion({ moment, storybookVersions: [] }, otherVersion),
    ).toThrow("growth-storybook-moment-mismatch");
    expect(
      isGrowthMoment({ ...moment, occurredOn: "2026-02-30" }),
    ).toBe(false);
    expect(
      isGrowthMoment({
        ...moment,
        childAvatarDataUrl: "https://example.com/private-child.webp",
      }),
    ).toBe(false);
    expect(
      isStorybookVersion({
        ...otherVersion,
        storyId: "different-story",
      }),
    ).toBe(false);
  });
});
