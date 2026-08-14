import { describe, expect, it } from "vitest";
import {
  createStoryOutlineDraft,
  createStoryOutlineEditorFields,
  getStoryOutlineTextFields,
  shouldMountBookPreview,
  updateStoryOutlineText,
  validateStoryOutlinePages,
} from "@/components/book/story-outline-controller";
import type { StoryPage } from "@/types";

function createPages(): StoryPage[] {
  return Array.from({ length: 8 }, (_, index) => ({
    page: index + 1,
    zhText: `第 ${index + 1} 页`,
    enText: `Page ${index + 1}`,
    illustrationPrompt: `scene-${index + 1}`,
    castIds: [`character-${index + 1}`],
    imageStatus: "demo" as const,
  }));
}

describe("story outline review contract", () => {
  it("renders all eight pages as editable bilingual fields", () => {
    const fields = createStoryOutlineEditorFields(createPages(), "zh-en");

    expect(fields).toHaveLength(16);
    expect(new Set(fields.map((field) => field.page)).size).toBe(8);
    expect(fields[0]).toEqual({
      page: 1,
      field: "zhText",
      inputId: "outline-page-1-zhText",
      value: "第 1 页",
    });
    expect(fields.at(-1)).toEqual({
      page: 8,
      field: "enText",
      inputId: "outline-page-8-enText",
      value: "Page 8",
    });
  });

  it("creates an editable eight-page draft without mutating the generated result", () => {
    const source = createPages().reverse();
    const draft = createStoryOutlineDraft(source);
    const edited = updateStoryOutlineText(draft, 4, "zhText", "修改后的第四页");

    expect(draft.map((page) => page.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(edited).toHaveLength(8);
    expect(edited[3]).toMatchObject({
      page: 4,
      zhText: "修改后的第四页",
      enText: "Page 4",
      illustrationPrompt: "scene-4",
      castIds: ["character-4"],
    });
    expect(source.find((page) => page.page === 4)?.zhText).toBe("第 4 页");
  });

  it("requires every active language field on all eight consecutive pages", () => {
    const pages = createPages();
    pages[2] = { ...pages[2], enText: "   " };

    expect(validateStoryOutlinePages(pages, "zh-en")).toMatchObject({
      valid: false,
      structureValid: true,
      missingFieldsByPage: { 3: ["enText"] },
    });
    expect(validateStoryOutlinePages(pages, "zh").valid).toBe(true);
    expect(validateStoryOutlinePages(pages.slice(0, 7), "zh")).toMatchObject({
      valid: false,
      structureValid: false,
    });
    expect(getStoryOutlineTextFields("en-zh")).toEqual(["enText", "zhText"]);
  });

  it("never mounts BookPreview before the outline has been confirmed", () => {
    expect(shouldMountBookPreview("submitting", true)).toBe(false);
    expect(shouldMountBookPreview("generating_text", true)).toBe(false);
    expect(shouldMountBookPreview("reviewing_outline", true)).toBe(false);
    expect(shouldMountBookPreview("failed", true)).toBe(false);
    expect(shouldMountBookPreview("unrecoverable", true)).toBe(false);

    expect(shouldMountBookPreview("generating_images", true)).toBe(true);
    expect(shouldMountBookPreview("ready", true)).toBe(true);
    expect(shouldMountBookPreview("partially_failed", true)).toBe(true);
    expect(shouldMountBookPreview("generating_images", false)).toBe(false);
  });
});
