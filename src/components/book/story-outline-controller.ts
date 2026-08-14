import type { Language, StoryPage } from "@/types";

export const STORY_OUTLINE_PAGE_COUNT = 8;

export type StoryOutlineTextField = "zhText" | "enText";

export type ReliableGenerationStage =
  | "submitting"
  | "generating_text"
  | "reviewing_outline"
  | "generating_images"
  | "ready"
  | "partially_failed"
  | "failed"
  | "unrecoverable";

export type StoryOutlineValidation = {
  valid: boolean;
  structureValid: boolean;
  missingFieldsByPage: Record<number, StoryOutlineTextField[]>;
};

export type StoryOutlineEditorField = {
  page: number;
  field: StoryOutlineTextField;
  inputId: string;
  value: string;
};

export function getStoryOutlineTextFields(
  language: Language,
): StoryOutlineTextField[] {
  if (language === "zh") return ["zhText"];
  if (language === "en") return ["enText"];
  if (language === "en-zh") return ["enText", "zhText"];
  return ["zhText", "enText"];
}

export function createStoryOutlineDraft(pages: StoryPage[]) {
  return pages
    .map((page) => ({ ...page }))
    .sort((left, right) => left.page - right.page);
}

export function createStoryOutlineEditorFields(
  pages: StoryPage[],
  language: Language,
): StoryOutlineEditorField[] {
  const fields = getStoryOutlineTextFields(language);
  return createStoryOutlineDraft(pages).flatMap((page) =>
    fields.map((field) => ({
      page: page.page,
      field,
      inputId: `outline-page-${page.page}-${field}`,
      value: page[field],
    })),
  );
}

export function updateStoryOutlineText(
  pages: StoryPage[],
  pageNumber: number,
  field: StoryOutlineTextField,
  value: string,
) {
  return pages.map((page) =>
    page.page === pageNumber ? { ...page, [field]: value } : page,
  );
}

export function validateStoryOutlinePages(
  pages: StoryPage[],
  language: Language,
): StoryOutlineValidation {
  const expectedPageNumbers = Array.from(
    { length: STORY_OUTLINE_PAGE_COUNT },
    (_, index) => index + 1,
  );
  const actualPageNumbers = pages
    .map((page) => page.page)
    .sort((left, right) => left - right);
  const structureValid =
    pages.length === STORY_OUTLINE_PAGE_COUNT &&
    actualPageNumbers.every(
      (pageNumber, index) => pageNumber === expectedPageNumbers[index],
    );
  const requiredFields = getStoryOutlineTextFields(language);
  const missingFieldsByPage: Record<number, StoryOutlineTextField[]> = {};

  pages.forEach((page) => {
    const missingFields = requiredFields.filter(
      (field) => !page[field].trim(),
    );
    if (missingFields.length > 0) {
      missingFieldsByPage[page.page] = missingFields;
    }
  });

  return {
    valid: structureValid && Object.keys(missingFieldsByPage).length === 0,
    structureValid,
    missingFieldsByPage,
  };
}

export function shouldMountBookPreview(
  stage: ReliableGenerationStage | "form",
  hasResult: boolean,
) {
  return (
    hasResult &&
    (stage === "generating_images" ||
      stage === "ready" ||
      stage === "partially_failed")
  );
}
