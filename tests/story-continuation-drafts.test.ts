import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStoryContinuationDraft,
  getStoryContinuationDraft,
} from "@/lib/story-continuation-drafts";
import type { GenerateResponse } from "@/types";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function createResult(): GenerateResponse {
  return {
    storyId: "story-1",
    coverTitle: "小雨的森林冒险",
    input: {
      childName: "小雨",
      protagonistFamilyCharacterId: "character-1",
      ageGroup: "4-5",
      theme: "custom",
      style: "watercolor",
      language: "zh-en",
      personalizationAnchor: {
        version: 1,
        displayName: "小雨",
        relationship: "孩子",
        appearance: "短发，戴圆框眼镜",
        referenceType: "canonical",
        characterId: "character-1",
        storyReferenceToken: "temporary-secret-token",
        confirmedAt: "2026-08-16T00:00:00.000Z",
      },
    },
    pages: [],
    totalPages: 0,
    generationMode: "live",
    freeChanceLabel: "",
  };
}

describe("same-character continuation", () => {
  it("inherits identity and style without persisting the temporary anchor token", () => {
    const draft = createStoryContinuationDraft(createResult());
    expect(draft).toMatchObject({
      characterId: "character-1",
      characterName: "小雨",
      style: "watercolor",
      appearance: "短发，戴圆框眼镜",
    });
    expect(draft?.suggestedIdea).toContain("不沿用上一本的服装和场景");
    expect(draft?.confirmedAnchor).not.toHaveProperty("storyReferenceToken");
    expect(getStoryContinuationDraft("story-1")).toEqual(draft);
  });
});
