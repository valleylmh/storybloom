import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const bookPreviewSource = readFileSync(
  new URL("../src/components/book/BookPreview.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

describe("reliable generation homepage contract", () => {
  it("does not infer generation progress from percentages or elapsed time", () => {
    expect(pageSource).not.toContain("setProgress(");
    expect(pageSource).not.toContain("elapsedSeconds");
    expect(pageSource).not.toContain("getGenerationStepIndex");
    expect(pageSource).not.toContain("progressInterval");
    expect(pageSource).not.toContain("Math.round(progress)");
  });

  it("uses persistent text tasks and writes the reviewed outline before images", () => {
    expect(pageSource).toContain('generationRequestMode: "async"');
    expect(pageSource).toContain("writeActiveGenerationTask({");
    expect(pageSource).toContain("requestStoryGenerationTask({");
    expect(pageSource).toContain("confirmStoryOutline({");
    expect(pageSource).toContain('step === "reviewing_outline"');
    expect(pageSource).toContain("shouldMountBookPreview(step, Boolean(result))");
  });

  it("keeps anonymous quick and full creation entry modes", () => {
    expect(pageSource).toContain('type EntryMode = "capture" | "minimal" | "full"');
    expect(pageSource).toContain('changeEntryMode("capture")');
    expect(pageSource).toContain('changeEntryMode("full")');
  });

  it("keeps the full creator header flush with the viewport top", () => {
    expect(pageSource).toContain('"page-shell full-creator-page-shell"');
    expect(globalStyles).toContain(".page-shell.full-creator-page-shell");
    expect(globalStyles).toContain("padding: 0 0 72px");
  });

  it("keeps recent-story actions on one row at tablet widths", () => {
    expect(globalStyles).toContain(
      "grid-template-columns: 58px minmax(0, 1fr) auto",
    );
    expect(globalStyles).toContain("flex-wrap: nowrap");
    expect(globalStyles).toContain("white-space: nowrap");
  });

  it("keeps durable illustration polling server-authoritative", () => {
    expect(bookPreviewSource).toContain("isDurablePendingIllustration");
    expect(bookPreviewSource).toContain(
      "while (durablePending || Date.now() < deadlineMs)",
    );
    expect(bookPreviewSource).toContain(
      "!isDurablePendingIllustration(page)",
    );
  });
});
