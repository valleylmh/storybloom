import type { FamilyCharacterInput, StoryInput } from "@/types";

export function hasFamilyCharacterReference(character: FamilyCharacterInput) {
  return Boolean(
    character.storyReferenceToken ||
      character.sourceReferenceAssetPath ||
      character.canonicalReferenceAssetPath ||
      character.referenceAssetPath,
  );
}

export function attachStoryReferenceToken(
  input: StoryInput,
  characterId: string,
  storyReferenceToken: string,
): StoryInput {
  return {
    ...input,
    familyCharacters: input.familyCharacters?.map((character) =>
      character.id === characterId
        ? { ...character, storyReferenceToken }
        : character,
    ),
  };
}

export function createPublicStoryInput(input: StoryInput): StoryInput {
  const {
    customCharacterReferenceToken: _customCharacterReferenceToken,
    visualBible: _visualBible,
    ...publicInput
  } = input;

  return {
    ...publicInput,
    personalizationAnchor: input.personalizationAnchor
      ? {
          ...input.personalizationAnchor,
          storyReferenceToken: undefined,
        }
      : undefined,
    familyCharacters: input.familyCharacters?.map(
      ({
        referenceAssetPath: _referenceAssetPath,
        sourceReferenceAssetPath: _sourceReferenceAssetPath,
        canonicalReferenceAssetPath: _canonicalReferenceAssetPath,
        storyReferenceToken: _storyReferenceToken,
        ...character
      }) => character,
    ),
  };
}
