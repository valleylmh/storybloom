import { describe, expect, it } from "vitest";
import {
  attachStoryReferenceToken,
  createPublicStoryInput,
  hasFamilyCharacterReference,
} from "@/lib/family-story-characters";
import type { StoryInput } from "@/types";

const privateInput: StoryInput = {
  childName: "童童",
  ageGroup: "4-5",
  theme: "custom",
  customTheme: "睡前故事",
  style: "fairytale",
  language: "zh-en",
  customCharacterReferenceToken: "private-upload-token",
  familyCharacters: [
    {
      id: "child",
      name: "童童",
      relation: "孩子",
      appearance: "五岁短发孩子",
      referenceAssetPath: "user/child/canonical.png",
      sourceReferenceAssetPath: "user/child/source.webp",
      canonicalReferenceAssetPath: "user/child/canonical.png",
      storyReferenceToken: "private-story-anchor-token",
      isProtagonist: true,
    },
  ],
  visualBible: {
    version: 1,
    seriesStyleLock: "private prompt",
    paletteLock: "private palette",
    continuityPolicy: "private continuity prompt",
    characters: [],
  },
};

describe("family story character privacy", () => {
  it("recognizes legacy, source, canonical, and story-anchor references", () => {
    expect(hasFamilyCharacterReference({
      id: "one",
      name: "A",
      relation: "孩子",
      appearance: "A",
      storyReferenceToken: "token",
    })).toBe(true);
    expect(hasFamilyCharacterReference({
      id: "two",
      name: "B",
      relation: "孩子",
      appearance: "B",
    })).toBe(false);
  });

  it("attaches the temporary story anchor only to the matching character", () => {
    const input = {
      ...privateInput,
      familyCharacters: [
        ...privateInput.familyCharacters!,
        {
          id: "mother",
          name: "妈妈",
          relation: "妈妈",
          appearance: "妈妈",
        },
      ],
    };
    const result = attachStoryReferenceToken(input, "child", "new-token");

    expect(result.familyCharacters?.[0].storyReferenceToken).toBe("new-token");
    expect(result.familyCharacters?.[1].storyReferenceToken).toBeUndefined();
  });

  it("removes every private path, token, and internal prompt from client output", () => {
    const result = createPublicStoryInput(privateInput);
    const character = result.familyCharacters?.[0];

    expect(result.customCharacterReferenceToken).toBeUndefined();
    expect(result.visualBible).toBeUndefined();
    expect(character).toMatchObject({
      id: "child",
      name: "童童",
      relation: "孩子",
      appearance: "五岁短发孩子",
      isProtagonist: true,
    });
    expect(character?.referenceAssetPath).toBeUndefined();
    expect(character?.sourceReferenceAssetPath).toBeUndefined();
    expect(character?.canonicalReferenceAssetPath).toBeUndefined();
    expect(character?.storyReferenceToken).toBeUndefined();
  });
});
