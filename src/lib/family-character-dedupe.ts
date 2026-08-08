import { normalizeCharacterName } from "@/lib/story-input";

export type DedupeFamilyCharacter = {
  id: string;
  display_name: string;
  relationship: string;
  description?: string | null;
  source_photo_path?: string | null;
  canonical_photo_path?: string | null;
  status?: string;
  canonical_generation_count?: number;
};

function normalizeRelationship(relationship: string) {
  return relationship.trim().replace(/\s+/g, "").toLocaleLowerCase();
}

export function getFamilyCharacterIdentityKey(
  character: Pick<DedupeFamilyCharacter, "display_name" | "relationship">,
) {
  return `${normalizeCharacterName(character.display_name)}::${normalizeRelationship(
    character.relationship,
  )}`;
}

function getFamilyCharacterQuality(character: DedupeFamilyCharacter) {
  let score = 0;
  if (character.canonical_photo_path) score += 100;
  if (character.source_photo_path) score += 50;
  if (character.description?.trim()) score += 10;
  if (character.status === "ready") score += 8;
  if (character.status === "processing") score += 4;
  if (character.status === "source_uploaded") score += 3;
  score += Math.min(5, Math.max(0, character.canonical_generation_count || 0));
  return score;
}

export function dedupeFamilyCharacters<T extends DedupeFamilyCharacter>(
  characters: T[],
) {
  const result: T[] = [];
  const slotByIdentity = new Map<string, number>();

  for (const character of characters) {
    const key = getFamilyCharacterIdentityKey(character);
    const existingSlot = slotByIdentity.get(key);
    if (existingSlot === undefined) {
      slotByIdentity.set(key, result.length);
      result.push(character);
      continue;
    }

    if (
      getFamilyCharacterQuality(character) >
      getFamilyCharacterQuality(result[existingSlot])
    ) {
      result[existingSlot] = character;
    }
  }

  return result;
}

export function findReusableFamilyCharacter<T extends DedupeFamilyCharacter>(
  characters: T[],
  displayName: string,
  relationship: string,
) {
  const targetKey = getFamilyCharacterIdentityKey({
    display_name: displayName,
    relationship,
  });
  return dedupeFamilyCharacters(
    characters.filter(
      (character) => getFamilyCharacterIdentityKey(character) === targetKey,
    ),
  )[0];
}
