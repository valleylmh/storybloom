import { describe, expect, it, vi } from "vitest";
import { appendGeneratedStorybookVersion } from "@/lib/growth-version-result";
import type { GrowthMomentBundle } from "@/lib/growth-moments";
import type { GrowthRecordDraft } from "@/lib/growth-records";
import type { GenerateResponse } from "@/types";

const draft: GrowthRecordDraft = {
  version: 1,
  childKey: "child-1",
  childName: "安安",
  childCharacterId: "character-1",
  occurredOn: "2026-08-05",
  note: "家长备注",
  idea: "安安整理积木",
  readingStage: "4-5",
  storyTreatment: "warm-imagination",
  photos: [],
};

const result: GenerateResponse = {
  storyId: "story-new",
  input: {
    childName: "安安",
    ageGroup: "4-5",
    theme: "custom",
    customTheme: "安安整理积木",
    style: "watercolor",
    language: "zh",
  },
  coverTitle: "积木回家",
  pages: [],
  totalPages: 0,
  generationMode: "live",
  freeChanceLabel: "免费生成",
};

function bundle(childKey = "child-1"): GrowthMomentBundle {
  return {
    moment: {
      schemaVersion: 1,
      momentId: "moment-1",
      clientMomentId: "moment-1",
      childKey,
      childName: "安安",
      occurredOn: "2026-08-05",
      parentNote: "家长备注",
      sourceIdea: "安安整理积木",
      originalAssets: [],
      confirmedTags: [],
      createdAt: "2026-08-05T10:00:00.000Z",
      updatedAt: "2026-08-05T10:00:00.000Z",
    },
    storybookVersions: [],
  };
}

describe("generated StorybookVersion destination", () => {
  it("appends to the verified Moment with version-specific metadata", async () => {
    const updated = bundle();
    const repository = {
      get: vi.fn().mockResolvedValue(bundle()),
      addVersion: vi.fn().mockResolvedValue(updated),
    };

    await expect(
      appendGeneratedStorybookVersion({
        repository,
        targetMomentId: "moment-1",
        growthRecordDraft: draft,
        result,
      }),
    ).resolves.toBe(updated);
    expect(repository.addVersion).toHaveBeenCalledWith(
      "moment-1",
      result,
      expect.objectContaining({
        storyTreatment: "warm-imagination",
        characterReferenceId: "character-1",
        source: "generated",
      }),
    );
  });

  it("never creates or overwrites a Moment when the destination is missing or mismatched", async () => {
    const missingRepository = {
      get: vi.fn().mockResolvedValue(undefined),
      addVersion: vi.fn(),
    };
    await expect(
      appendGeneratedStorybookVersion({
        repository: missingRepository,
        targetMomentId: "moment-1",
        growthRecordDraft: draft,
        result,
      }),
    ).rejects.toThrow("growth-version-target-not-found");
    expect(missingRepository.addVersion).not.toHaveBeenCalled();

    const mismatchRepository = {
      get: vi.fn().mockResolvedValue(bundle("child-2")),
      addVersion: vi.fn(),
    };
    await expect(
      appendGeneratedStorybookVersion({
        repository: mismatchRepository,
        targetMomentId: "moment-1",
        growthRecordDraft: draft,
        result,
      }),
    ).rejects.toThrow("growth-version-target-mismatch");
    expect(mismatchRepository.addVersion).not.toHaveBeenCalled();
  });
});
