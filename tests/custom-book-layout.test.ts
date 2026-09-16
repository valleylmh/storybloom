import { describe, it, expect } from "vitest";
import { layoutTextBox, BOOK_LAYOUTS } from "../src/lib/custom-book/layout";
import { createWorkbenchDraft } from "../src/lib/custom-workbench";
import { customDraftSchema } from "../src/lib/custom-book/schema";
import { imagePrompt } from "../src/lib/custom-book/provider";

describe("book layout contracts", () => {
  it("keeps all text rectangles inside their own physical page and clear of gutter", () => {
    for (const layout of Object.keys(
      BOOK_LAYOUTS,
    ) as (keyof typeof BOOK_LAYOUTS)[]) {
      for (const [w, h] of [
        [800, 800],
        [720, 900],
        [960, 720],
      ])
        for (const side of [0, 1]) {
          const b = layoutTextBox(layout, w, h, side);
          expect(b.x).toBeGreaterThanOrEqual(side * w + 32);
          expect(b.x + b.width).toBeLessThanOrEqual((side + 1) * w - 32);
          expect(b.y + b.height).toBeLessThanOrEqual(h);
          expect(b.width).toBeGreaterThan(100);
        }
    }
  });
  it("accepts old drafts and preserves layout and typography choices", () => {
    const d = createWorkbenchDraft();
    d.renderingMode = "editable";
    delete d.cover;
    d.pages.forEach((p) => delete p.asset);
    d.characters.forEach((c) => delete c.asset);
    expect(customDraftSchema.safeParse(d).success).toBe(true);
    d.pages[1].layout = "embrace";
    d.pages[1].textTreatment = "natural";
    const parsed = customDraftSchema.parse(d);
    expect(parsed.pages[1].layout).toBe("embrace");
    expect(parsed.pages[1].textTreatment).toBe("natural");
    expect(
      imagePrompt(parsed, { kind: "page", index: 1, spread: true }),
    ).toContain("TWO quiet lower text areas");
  });
});
