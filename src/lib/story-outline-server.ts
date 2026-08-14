import type { StoryInput, StoryPage } from "@/types";

const CAMERA_PLAN = [
  "warm establishing shot that clearly introduces the setting",
  "medium-wide shot with the important props visible",
  "gentle action shot that advances the story",
  "relationship-focused medium shot with natural gestures",
  "environmental shot that shows the challenge without scary imagery",
  "dynamic but child-safe climax with the main action easy to read",
  "warm resolution shot with expressive reactions",
  "calm closing wide shot with emotional closure",
] as const;

function quotePromptText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1800);
}

function getVisibleCastPrompt(input: StoryInput, castIds: string[]) {
  const visibleIds = new Set(castIds);
  const visibleCharacters = (input.familyCharacters ?? []).filter((character) =>
    visibleIds.has(character.id),
  );
  if (visibleCharacters.length === 0) return null;

  return `Visible family characters only: ${visibleCharacters
    .map(
      (character) =>
        `${character.name} (${character.relation}, id=${character.id}): ${character.appearance}`,
    )
    .join("; ")}. Do not add unlisted family members.`;
}

function getVisualBiblePrompt(input: StoryInput, castIds: string[]) {
  const bible = input.visualBible;
  if (!bible) return null;
  const visibleIds = new Set(castIds);
  const characterLocks = bible.characters
    .filter((character) => visibleIds.size === 0 || visibleIds.has(character.id))
    .map(
      (character) =>
        `${character.name}: ${character.identityLock}; ${character.outfitLock}; ${character.referenceGuidance}`,
    )
    .join(" | ");

  return [
    `Series style lock: ${bible.seriesStyleLock}.`,
    `Palette lock: ${bible.paletteLock}.`,
    `Continuity: ${bible.continuityPolicy}.`,
    characterLocks ? `Character locks: ${characterLocks}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export type StoryOutlinePageEdit = Pick<
  StoryPage,
  "page" | "zhText" | "enText"
>;

export function rebuildStoryPagesFromOutline(
  input: StoryInput,
  existingPages: StoryPage[],
  edits: StoryOutlinePageEdit[],
) {
  const editsByPage = new Map(edits.map((page) => [page.page, page]));

  return existingPages.map((page, index) => {
    const edit = editsByPage.get(page.page);
    if (!edit) throw new Error(`Missing outline page ${page.page}.`);
    const castIds = page.castIds ?? [];
    const zhText = edit.zhText.trim();
    const enText = edit.enText.trim();
    const textPrompt = [
      zhText ? `Chinese: ${quotePromptText(zhText)}` : null,
      enText ? `English: ${quotePromptText(enText)}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    return {
      ...page,
      zhText,
      enText,
      illustrationPrompt: [
        `Create a ${input.style} children's picture-book illustration for page ${page.page} of 8.`,
        `Parent-confirmed page text: ${textPrompt}.`,
        "Depict this exact story moment; the confirmed text overrides any earlier scene direction.",
        `Camera and layout: ${CAMERA_PLAN[index] ?? CAMERA_PLAN.at(-1)}.`,
        "Show a concrete setting, relevant props, visible action, and an age-appropriate emotion. Keep the child at roughly 25-45% of the image so the environment also tells the story.",
        input.characterDescription?.trim()
          ? `Main character identity lock: ${input.characterDescription.trim()}.`
          : `Keep ${input.childName} visually consistent with every other page.`,
        getVisibleCastPrompt(input, castIds),
        getVisualBiblePrompt(input, castIds),
        "Keep the same identity, outfit, palette, material texture, and rendering quality across all eight pages. Vary pose, expression, camera distance, and composition.",
        "No text, letters, logos, captions, or watermarks in the image. No violence, horror, distorted hands, or extra limbs.",
      ]
        .filter(Boolean)
        .join(" "),
      imageStatus: "demo" as const,
      imageError: undefined,
      imageProvider: undefined,
      imageStartedAt: undefined,
      imageAttemptId: undefined,
      imageDurableJob: undefined,
      imageJobId: undefined,
      imageCompletedAt: undefined,
      imageDurationMs: undefined,
      imageAttempts: [],
    };
  });
}
