import { describe, expect, it } from "vitest";
import {
  clearGrowthVersionCreationIntent,
  createGrowthVersionCreationPreset,
  getGrowthVersionCreationHref,
  GROWTH_VERSION_INTENT_STORAGE_KEY,
  isGrowthVersionCreationRequested,
  readGrowthVersionCreationIntent,
  writeGrowthVersionCreationIntent,
} from "@/lib/growth-version-creation";
import {
  createGrowthMoment,
  createStorybookVersion,
  type GrowthMomentBundle,
} from "@/lib/growth-moments";
import type { GrowthRecordDraft } from "@/lib/growth-records";
import type { GenerateResponse } from "@/types";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function draft(): GrowthRecordDraft {
  return {
    version: 1,
    childKey: "child-1",
    childName: "安安",
    childCharacterId: "family-character-1",
    occurredOn: "2026-08-05",
    note: "安安第一次自己整理玩具。",
    idea: "安安把积木放回盒子里",
    parentFacts: "安安独立整理了积木。",
    allowedImaginations: "积木可以轻轻鼓掌。",
    readingStage: "4-5",
    storyTreatment: "warm-imagination",
    photos: [
      {
        id: "photo-1",
        name: "blocks.webp",
        dataUrl: "data:image/webp;base64,private-photo",
      },
    ],
  };
}

function story(): GenerateResponse {
  return {
    storyId: "story-1",
    input: {
      childName: "安安",
      ageGroup: "6-8",
      theme: "custom",
      customTheme: "安安整理积木",
      style: "cartoon",
      language: "zh",
    },
    coverTitle: "积木回家了",
    pages: [],
    totalPages: 0,
    generationMode: "live",
    freeChanceLabel: "免费生成",
  };
}

describe("growth version creation intent", () => {
  it("keeps only an opaque Moment id in session storage and the URL", () => {
    const storage = createStorage();
    const written = writeGrowthVersionCreationIntent("moment-1", {
      storage,
      now: "2026-08-14T10:00:00.000Z",
    });
    const raw = storage.getItem(GROWTH_VERSION_INTENT_STORAGE_KEY) || "";

    expect(written?.targetMomentId).toBe("moment-1");
    expect(raw).not.toContain("data:image/");
    expect(raw).not.toContain("安安");
    expect(getGrowthVersionCreationHref()).toBe("/?growthVersion=1");
    expect(isGrowthVersionCreationRequested("/?growthVersion=1")).toBe(true);
    expect(isGrowthVersionCreationRequested("/?growthVersion=1&growthVersion=1")).toBe(
      false,
    );
  });

  it("expires stale intents and supports explicit clearing", () => {
    const storage = createStorage();
    writeGrowthVersionCreationIntent("moment-1", {
      storage,
      now: "2026-08-14T10:00:00.000Z",
    });
    expect(
      readGrowthVersionCreationIntent({
        storage,
        now: Date.parse("2026-08-14T11:00:00.000Z"),
      })?.targetMomentId,
    ).toBe("moment-1");
    expect(
      readGrowthVersionCreationIntent({
        storage,
        now: Date.parse("2026-08-14T13:00:01.000Z"),
      }),
    ).toBeNull();

    writeGrowthVersionCreationIntent("moment-2", { storage });
    expect(clearGrowthVersionCreationIntent({ storage })).toBe(true);
    expect(storage.getItem(GROWTH_VERSION_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("prefills immutable Moment facts and version-specific defaults", () => {
    const moment = createGrowthMoment(draft(), {
      momentId: "moment-1",
      now: "2026-08-05T10:00:00.000Z",
    });
    const version = createStorybookVersion("moment-1", story(), {
      storyTreatment: "fairytale",
      characterReferenceId: "family-character-1",
    });
    const bundle: GrowthMomentBundle = {
      moment,
      storybookVersions: [version],
      activeStorybookVersionId: version.versionId,
    };

    const preset = createGrowthVersionCreationPreset(bundle);

    expect(preset).toMatchObject({
      targetMomentId: "moment-1",
      existingVersionCount: 1,
      illustrationStyle: "cartoon",
      draft: {
        childKey: "child-1",
        childName: "安安",
        childCharacterId: "family-character-1",
        occurredOn: "2026-08-05",
        parentFacts: "安安独立整理了积木。",
        readingStage: "6-8",
        storyTreatment: "fairytale",
      },
    });
    expect(preset.draft.photos[0].dataUrl).toContain("private-photo");
  });
});
