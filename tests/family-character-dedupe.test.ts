import { describe, expect, it } from "vitest";
import {
  dedupeFamilyCharacters,
  findReusableFamilyCharacter,
  getFamilyCharacterIdentityKey,
} from "@/lib/family-character-dedupe";

const duplicates = [
  {
    id: "draft-one",
    display_name: "童童",
    relationship: "孩子",
    description: "",
    source_photo_path: null,
    canonical_photo_path: null,
    status: "draft",
    canonical_generation_count: 0,
  },
  {
    id: "photo-one",
    display_name: " 童童 ",
    relationship: "孩子",
    description: "短发孩子",
    source_photo_path: "user/child/source.webp",
    canonical_photo_path: null,
    status: "source_uploaded",
    canonical_generation_count: 0,
  },
  {
    id: "canonical-one",
    display_name: "童童",
    relationship: "孩子",
    description: "短发孩子",
    source_photo_path: "user/child/source.webp",
    canonical_photo_path: "user/child/canonical.png",
    status: "ready",
    canonical_generation_count: 1,
  },
];

describe("family character deduplication", () => {
  it("uses normalized name and relationship as the identity key", () => {
    expect(getFamilyCharacterIdentityKey(duplicates[0])).toBe(
      getFamilyCharacterIdentityKey(duplicates[1]),
    );
  });

  it("shows one record and prefers the most complete character", () => {
    const result = dedupeFamilyCharacters(duplicates);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("canonical-one");
  });

  it("reuses the best existing record when saving the same identity", () => {
    expect(
      findReusableFamilyCharacter(duplicates, "童童", "孩子")?.id,
    ).toBe("canonical-one");
  });

  it("keeps same-name characters with different relationships separate", () => {
    const result = dedupeFamilyCharacters([
      duplicates[2],
      {
        ...duplicates[2],
        id: "pet-one",
        relationship: "宠物",
      },
    ]);

    expect(result.map((character) => character.id)).toEqual([
      "canonical-one",
      "pet-one",
    ]);
  });
});
