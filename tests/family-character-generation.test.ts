import { describe, expect, it } from "vitest";
import {
  MAX_FAMILY_CHARACTER_GENERATIONS,
  canGenerateFamilyCharacter,
  getRemainingFamilyCharacterGenerations,
  normalizeFamilyCharacterGenerationCount,
} from "@/lib/family-character-generation";

describe("family character generation limits", () => {
  it("allows five image-to-image generations for a new character", () => {
    expect(MAX_FAMILY_CHARACTER_GENERATIONS).toBe(5);
    expect(getRemainingFamilyCharacterGenerations(0)).toBe(5);
    expect(canGenerateFamilyCharacter(0)).toBe(true);
  });

  it("blocks generation after the fifth claimed attempt", () => {
    expect(getRemainingFamilyCharacterGenerations(4)).toBe(1);
    expect(getRemainingFamilyCharacterGenerations(5)).toBe(0);
    expect(canGenerateFamilyCharacter(5)).toBe(false);
  });

  it("normalizes missing and out-of-range stored values", () => {
    expect(normalizeFamilyCharacterGenerationCount(undefined)).toBe(0);
    expect(normalizeFamilyCharacterGenerationCount(-3)).toBe(0);
    expect(normalizeFamilyCharacterGenerationCount(99)).toBe(5);
  });
});
