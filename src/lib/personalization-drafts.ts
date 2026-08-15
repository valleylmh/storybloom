import type {
  PersonalizationAnchorConfirmation,
  PersonalizationDraft,
} from "@/types";

const STORAGE_KEY = "storybloom.personalizationDrafts.v1";
const ANONYMOUS_ID_KEY = "storybloom.personalizationAnonymousId.v1";
const MAX_DRAFTS = 12;
let memoryDrafts: PersonalizationDraft[] = [];
let memoryAnonymousId = "";

function readDrafts() {
  if (typeof window === "undefined") return memoryDrafts;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) {
      memoryDrafts = parsed as PersonalizationDraft[];
      return memoryDrafts;
    }
    return memoryDrafts;
  } catch {
    return memoryDrafts;
  }
}

function writeDrafts(drafts: PersonalizationDraft[]) {
  memoryDrafts = drafts
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_DRAFTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDrafts));
  } catch {
    // Restricted/private browser modes keep the draft for this tab session.
  }
}

function getAnonymousId() {
  try {
    const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(ANONYMOUS_ID_KEY, id);
    memoryAnonymousId = id;
    return id;
  } catch {
    if (!memoryAnonymousId) memoryAnonymousId = crypto.randomUUID();
    return memoryAnonymousId;
  }
}

export function getLatestPersonalizationDraft(sourceLibraryBookId: string) {
  return readDrafts().find(
    (draft) => draft.sourceLibraryBookId === sourceLibraryBookId,
  );
}

export function createPersonalizationDraft(input: {
  sourceLibraryBookId: string;
  sourceTitle: string;
  prompt: string;
  ageGroup: PersonalizationDraft["storySettings"]["ageGroup"];
  userId?: string;
}) {
  const now = new Date().toISOString();
  const draft: PersonalizationDraft = {
    id: crypto.randomUUID(),
    ...(input.userId ? { userId: input.userId } : { anonymousId: getAnonymousId() }),
    sourceLibraryBookId: input.sourceLibraryBookId,
    sourceTitle: input.sourceTitle,
    selectedCharacterIds: [],
    selectedStyle: "fairytale",
    storySettings: {
      prompt: input.prompt,
      ageGroup: input.ageGroup,
    },
    anchorStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };
  writeDrafts([draft, ...readDrafts()]);
  return draft;
}

export function updatePersonalizationDraft(
  id: string,
  patch: Partial<
    Pick<
      PersonalizationDraft,
      | "selectedCharacterIds"
      | "selectedStyle"
      | "storySettings"
      | "anchorStatus"
      | "generationJobId"
      | "generatedStoryId"
    >
  > & { anchor?: PersonalizationAnchorConfirmation },
) {
  const drafts = readDrafts();
  const index = drafts.findIndex((draft) => draft.id === id);
  if (index === -1) return null;
  const persistedAnchor = patch.anchor
    ? { ...patch.anchor, storyReferenceToken: undefined }
    : undefined;
  const next: PersonalizationDraft = {
    ...drafts[index],
    ...patch,
    ...(persistedAnchor ? { anchor: persistedAnchor } : {}),
    updatedAt: new Date().toISOString(),
  };
  drafts[index] = next;
  writeDrafts(drafts);
  return next;
}

export function markPersonalizationDraftGeneration(
  id: string,
  generationJobId: string,
) {
  return updatePersonalizationDraft(id, { generationJobId });
}

export function markPersonalizationDraftCompleted(
  id: string,
  generatedStoryId: string,
) {
  return updatePersonalizationDraft(id, { generatedStoryId });
}
