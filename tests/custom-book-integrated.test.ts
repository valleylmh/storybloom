import { describe, expect, it } from "vitest";
import { createWorkbenchDraft } from "../src/lib/custom-workbench";
import { customDraftSchema } from "../src/lib/custom-book/schema";
import { imagePrompt } from "../src/lib/custom-book/provider";
import {
  artworkText,
  artworkMatchesText,
} from "../src/lib/custom-book/integrated";
function draft() {
  const d = createWorkbenchDraft();
  delete d.cover;
  d.pages.forEach((p) => delete p.asset);
  d.characters.forEach((c) => delete c.asset);
  return customDraftSchema.parse(d);
}
describe("integrated picture book generation", () => {
  it("defaults new drafts to integrated while old drafts retain editable behavior", () => {
    expect(draft().renderingMode).toBe("integrated");
    const old = draft();
    delete old.renderingMode;
    expect(imagePrompt(old, { kind: "cover" })).toContain("No text, letters");
  });
  it("renders exact cover text and keeps character references text-free", () => {
    const d = draft();
    expect(imagePrompt(d, { kind: "cover" })).toContain(
      JSON.stringify(d.title),
    );
    expect(imagePrompt(d, { kind: "cover" })).not.toContain("No text, letters");
    expect(imagePrompt(d, { kind: "character", index: 0 })).toContain(
      "No text, letters",
    );
  });
  it("passes both spread texts and distinct page directions without overlay instructions", () => {
    const d = draft();
    d.spreads = [2];
    d.pages[1].artDirection = "Top left sky";
    d.pages[2].artDirection = "Lower right path";
    const prompt = imagePrompt(d, { kind: "page", index: 1, spread: true });
    for (const expected of [
      d.pages[1].text,
      d.pages[2].text,
      "Top left sky",
      "Lower right path",
      "Central 8 percent",
    ])
      expect(prompt).toContain(expected);
    expect(prompt).not.toContain("text to be added later");
  });
  it("detects changed text and unpaired baked spreads instead of silently exporting stale text", () => {
    const d = draft();
    d.spreads = [2];
    const baked = artworkText(d, 2);
    expect(artworkText(d, 3)).toEqual(baked);
    expect(artworkMatchesText(baked, artworkText(d, 2))).toBe(true);
    d.pages[2].text = "新的正文";
    expect(artworkMatchesText(baked, artworkText(d, 2))).toBe(false);
    d.spreads = [];
    expect(artworkMatchesText(baked, artworkText(d, 2))).toBe(false);
  });
});
