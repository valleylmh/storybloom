import type {
  FamilyCharacterInput,
  GenerateResponse,
  ImageStatus,
  StoryInput,
  StoryPage,
  StoryVisualBible,
  PersonalizationAnchorConfirmation,
} from "@/types";

export const PERSISTED_STORY_SNAPSHOT_VERSION = 1 as const;

export interface PersistedStoryImageAsset {
  storagePath: string;
  mimeType: "image/webp";
}

export interface PersistedFamilyCharacter {
  id: string;
  name: string;
  relation: string;
  appearance: string;
  isProtagonist?: boolean;
}

export interface PersistedStoryInput {
  childName: string;
  narrativePerspective?: StoryInput["narrativePerspective"];
  protagonistFamilyCharacterId?: string;
  ageGroup: StoryInput["ageGroup"];
  favoriteToy?: string;
  favoriteFood?: string;
  bestFriend?: string;
  otherDetails?: string;
  theme: StoryInput["theme"];
  customTheme?: string;
  parentFacts?: string;
  allowedImaginations?: string;
  storyTreatment?: StoryInput["storyTreatment"];
  style: StoryInput["style"];
  language: StoryInput["language"];
  characterReferenceId?: string;
  characterReferenceLabel?: string;
  characterReferencePrompt?: string;
  characterDescription?: string;
  dedication?: string;
  sourceLibraryBookId?: string;
  personalizationDraftId?: string;
  personalizationAnchor?: PersonalizationAnchorConfirmation;
  familyCharacters?: PersistedFamilyCharacter[];
  visualBible?: StoryVisualBible;
}

export interface PersistedStoryPage {
  page: number;
  zhText: string;
  enText: string;
  illustrationPrompt: string;
  castIds?: string[];
  imageStatus?: ImageStatus;
  image?: PersistedStoryImageAsset;
}

export interface PersistedStorySnapshot {
  version: typeof PERSISTED_STORY_SNAPSHOT_VERSION;
  storyId: string;
  input: PersistedStoryInput;
  coverTitle: string;
  pages: PersistedStoryPage[];
  totalPages: number;
  generationMode: GenerateResponse["generationMode"];
}

function sanitizePersistedText(value: string) {
  return value
    .replace(/data:[^\s"'<>]+/gi, "[removed]")
    .replace(
      /https?:\/\/[^\s"'<>]*(?:token|signature|x-amz-signature|x-goog-signature)=[^\s"'<>]*/gi,
      "[removed]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [removed]");
}

function optionalText(value: string | undefined) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const sanitized = sanitizePersistedText(value);
  return sanitized.length > 0 ? sanitized : undefined;
}

function toPersistedFamilyCharacter(
  character: FamilyCharacterInput,
): PersistedFamilyCharacter {
  return {
    id: character.id,
    name: sanitizePersistedText(character.name),
    relation: sanitizePersistedText(character.relation),
    appearance: sanitizePersistedText(character.appearance),
    isProtagonist: character.isProtagonist || undefined,
  };
}

function toPersistedInput(input: StoryInput): PersistedStoryInput {
  return {
    childName: sanitizePersistedText(input.childName),
    narrativePerspective: input.narrativePerspective,
    protagonistFamilyCharacterId: optionalText(
      input.protagonistFamilyCharacterId,
    ),
    ageGroup: input.ageGroup,
    favoriteToy: optionalText(input.favoriteToy),
    favoriteFood: optionalText(input.favoriteFood),
    bestFriend: optionalText(input.bestFriend),
    otherDetails: optionalText(input.otherDetails),
    theme: input.theme,
    customTheme: optionalText(input.customTheme),
    parentFacts: optionalText(input.parentFacts),
    allowedImaginations: optionalText(input.allowedImaginations),
    storyTreatment: input.storyTreatment,
    style: input.style,
    language: input.language,
    characterReferenceId: optionalText(input.characterReferenceId),
    characterReferenceLabel: optionalText(input.characterReferenceLabel),
    characterReferencePrompt: optionalText(input.characterReferencePrompt),
    characterDescription: optionalText(input.characterDescription),
    dedication: optionalText(input.dedication),
    sourceLibraryBookId: optionalText(input.sourceLibraryBookId),
    personalizationDraftId: optionalText(input.personalizationDraftId),
    personalizationAnchor: input.personalizationAnchor
      ? {
          version: 1,
          displayName: sanitizePersistedText(
            input.personalizationAnchor.displayName,
          ),
          relationship: sanitizePersistedText(
            input.personalizationAnchor.relationship,
          ),
          appearance: sanitizePersistedText(
            input.personalizationAnchor.appearance,
          ),
          referenceType: input.personalizationAnchor.referenceType,
          characterId: optionalText(input.personalizationAnchor.characterId),
          confirmedAt: input.personalizationAnchor.confirmedAt,
        }
      : undefined,
    familyCharacters: input.familyCharacters?.map(toPersistedFamilyCharacter),
    visualBible: input.visualBible
      ? {
          version: 1,
          seriesStyleLock: sanitizePersistedText(
            input.visualBible.seriesStyleLock,
          ),
          paletteLock: sanitizePersistedText(input.visualBible.paletteLock),
          continuityPolicy: sanitizePersistedText(
            input.visualBible.continuityPolicy,
          ),
          characters: input.visualBible.characters.map((character) => ({
            id: character.id,
            name: sanitizePersistedText(character.name),
            identityLock: sanitizePersistedText(character.identityLock),
            outfitLock: sanitizePersistedText(character.outfitLock),
            referenceGuidance: sanitizePersistedText(
              character.referenceGuidance,
            ),
          })),
        }
      : undefined,
  };
}

export function isPersistedStoragePath(value: string | undefined) {
  if (!value || value.startsWith("/") || value.includes("\\")) return false;
  if (/^(?:data|blob|https?):/i.test(value)) return false;
  const segments = value.split("/");
  return (
    segments.length >= 3 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("?"),
    )
  );
}

function toPersistedPage(page: StoryPage): PersistedStoryPage {
  const image = isPersistedStoragePath(page.imageUrl)
    ? {
        storagePath: page.imageUrl!,
        mimeType: "image/webp" as const,
      }
    : undefined;

  return {
    page: page.page,
    zhText: sanitizePersistedText(page.zhText),
    enText: sanitizePersistedText(page.enText),
    illustrationPrompt: sanitizePersistedText(page.illustrationPrompt),
    castIds: page.castIds ? [...page.castIds] : undefined,
    imageStatus:
      page.imageStatus === "complete" && !image ? "pending" : page.imageStatus,
    image,
  };
}

export function toPersistedStorySnapshot(
  result: GenerateResponse,
): PersistedStorySnapshot {
  return {
    version: PERSISTED_STORY_SNAPSHOT_VERSION,
    storyId: result.storyId,
    input: toPersistedInput(result.input),
    coverTitle: sanitizePersistedText(result.coverTitle),
    pages: result.pages.map(toPersistedPage),
    totalPages: result.totalPages,
    generationMode: result.generationMode,
  };
}

export function fromPersistedStorySnapshot(
  snapshot: PersistedStorySnapshot,
): GenerateResponse {
  if (
    snapshot.version !== PERSISTED_STORY_SNAPSHOT_VERSION ||
    !snapshot.storyId ||
    !Array.isArray(snapshot.pages)
  ) {
    throw new Error("persisted-story-snapshot-invalid");
  }

  return {
    storyId: snapshot.storyId,
    input: {
      childName: snapshot.input.childName,
      narrativePerspective: snapshot.input.narrativePerspective,
      protagonistFamilyCharacterId:
        snapshot.input.protagonistFamilyCharacterId,
      ageGroup: snapshot.input.ageGroup,
      favoriteToy: snapshot.input.favoriteToy,
      favoriteFood: snapshot.input.favoriteFood,
      bestFriend: snapshot.input.bestFriend,
      otherDetails: snapshot.input.otherDetails,
      theme: snapshot.input.theme,
      customTheme: snapshot.input.customTheme,
      parentFacts: snapshot.input.parentFacts,
      allowedImaginations: snapshot.input.allowedImaginations,
      storyTreatment: snapshot.input.storyTreatment,
      style: snapshot.input.style,
      language: snapshot.input.language,
      characterReferenceId: snapshot.input.characterReferenceId,
      characterReferenceLabel: snapshot.input.characterReferenceLabel,
      characterReferencePrompt: snapshot.input.characterReferencePrompt,
      characterDescription: snapshot.input.characterDescription,
      dedication: snapshot.input.dedication,
      sourceLibraryBookId: snapshot.input.sourceLibraryBookId,
      personalizationDraftId: snapshot.input.personalizationDraftId,
      personalizationAnchor: snapshot.input.personalizationAnchor
        ? { ...snapshot.input.personalizationAnchor }
        : undefined,
      familyCharacters: snapshot.input.familyCharacters?.map((character) => ({
        id: character.id,
        name: character.name,
        relation: character.relation,
        appearance: character.appearance,
        isProtagonist: character.isProtagonist,
      })),
      visualBible: snapshot.input.visualBible
        ? {
            version: 1,
            seriesStyleLock: snapshot.input.visualBible.seriesStyleLock,
            paletteLock: snapshot.input.visualBible.paletteLock,
            continuityPolicy: snapshot.input.visualBible.continuityPolicy,
            characters: snapshot.input.visualBible.characters.map((character) => ({
              id: character.id,
              name: character.name,
              identityLock: character.identityLock,
              outfitLock: character.outfitLock,
              referenceGuidance: character.referenceGuidance,
            })),
          }
        : undefined,
    },
    coverTitle: snapshot.coverTitle,
    pages: snapshot.pages.map((page) => ({
      page: page.page,
      zhText: page.zhText,
      enText: page.enText,
      illustrationPrompt: page.illustrationPrompt,
      castIds: page.castIds ? [...page.castIds] : undefined,
      imageUrl: isPersistedStoragePath(page.image?.storagePath)
        ? page.image?.storagePath
        : undefined,
      imageStatus: page.imageStatus,
    })),
    totalPages: snapshot.totalPages,
    generationMode: snapshot.generationMode,
    freeChanceLabel: "",
  };
}
