import type {
  GenerateResponse,
  IllustrationStyle,
  PersonalizationAnchorConfirmation,
} from "@/types";

const STORAGE_KEY = "storybloom.storyContinuations.v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoryContinuationDraft {
  sourceStoryId: string;
  characterId: string;
  characterName: string;
  relationship: string;
  appearance?: string;
  style: IllustrationStyle;
  suggestedIdea: string;
  confirmedAnchor?: Omit<PersonalizationAnchorConfirmation, "storyReferenceToken">;
  createdAt: string;
}

function readDrafts(): Record<string, StoryContinuationDraft> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, StoryContinuationDraft>)
      : {};
  } catch {
    return {};
  }
}

export function createStoryContinuationDraft(result: GenerateResponse) {
  const characterId = result.input.protagonistFamilyCharacterId;
  if (!characterId) return null;
  const anchor = result.input.personalizationAnchor;
  const familyCharacter = result.input.familyCharacters?.find(
    (character) => character.id === characterId,
  );
  const characterName =
    anchor?.displayName || familyCharacter?.name || result.input.childName;
  const relationship = anchor?.relationship || familyCharacter?.relation || "孩子";
  const confirmedAnchor = anchor
    ? {
        version: anchor.version,
        displayName: anchor.displayName,
        relationship: anchor.relationship,
        appearance: anchor.appearance,
        referenceType: anchor.referenceType,
        characterId: anchor.characterId,
        confirmedAt: anchor.confirmedAt,
      }
    : undefined;
  const draft: StoryContinuationDraft = {
    sourceStoryId: result.storyId,
    characterId,
    characterName,
    relationship,
    appearance: anchor?.appearance || familyCharacter?.appearance,
    style: result.input.style,
    suggestedIdea: `让${characterName}开启一次全新的家庭冒险，不沿用上一本的服装和场景。`,
    confirmedAnchor,
    createdAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readDrafts(), [result.storyId]: draft }),
    );
  } catch {
    return null;
  }
  return draft;
}

export function getStoryContinuationDraft(sourceStoryId: string) {
  const draft = readDrafts()[sourceStoryId];
  if (!draft) return null;
  const createdAt = new Date(draft.createdAt).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_AGE_MS) {
    return null;
  }
  return draft;
}
