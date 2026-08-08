import { describe, expect, it } from "vitest";
import {
  buildStoryVisualBible,
  formatStoryVisualBible,
} from "@/lib/story-visual-bible";
import type { StoryInput } from "@/types";

function createInput(overrides: Partial<StoryInput> = {}): StoryInput {
  return {
    childName: "童童",
    ageGroup: "4-5",
    theme: "custom",
    customTheme: "童童第一次一个人在卧室睡觉",
    style: "fairytale",
    language: "zh-en",
    familyCharacters: [
      {
        id: "child",
        name: "童童",
        relation: "孩子",
        appearance: "五岁短发孩子",
        sourceReferenceAssetPath: "user/child/source.webp",
        canonicalReferenceAssetPath: "user/child/canonical.png",
        referenceAssetPath: "user/child/canonical.png",
        isProtagonist: true,
      },
      {
        id: "mother",
        name: "妈妈",
        relation: "妈妈",
        appearance: "长发妈妈",
        canonicalReferenceAssetPath: "user/mother/canonical.png",
        referenceAssetPath: "user/mother/canonical.png",
      },
    ],
    ...overrides,
  };
}

describe("story visual bible", () => {
  it("locks one exact bedtime outfit and separates face from cartoon reference roles", () => {
    const bible = buildStoryVisualBible(createInput());
    const child = bible.characters[0];

    expect(child.outfitLock).toContain("powder-blue long-sleeve pajama");
    expect(child.outfitLock).toContain("no print and no stripes");
    expect(child.referenceGuidance).toContain(
      "real-photo reference is authoritative for face identity",
    );
    expect(child.referenceGuidance).toContain(
      "canonical cartoon reference is authoritative for hairstyle silhouette",
    );
    expect(bible.continuityPolicy).toContain("never from the previous page");
  });

  it("formats only the characters visible on the current page", () => {
    const prompt = formatStoryVisualBible(
      buildStoryVisualBible(createInput()),
      ["child"],
    );

    expect(prompt).toContain("name=童童");
    expect(prompt).not.toContain("name=妈妈");
    expect(prompt).toContain("OUTFIT LOCK");
  });

  it("uses the canonical outfit as the generic story anchor", () => {
    const bible = buildStoryVisualBible(
      createInput({ theme: "friendship", customTheme: undefined }),
    );

    expect(bible.characters[0].outfitLock).toContain(
      "exact same outfit shown in the canonical cartoon reference",
    );
    expect(bible.characters[0].outfitLock).toContain("Do not restyle");
  });
});
