import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const timelineSource = readFileSync(
  new URL("../src/components/growth/GrowthTimeline.tsx", import.meta.url),
  "utf8",
);
const minimalEntrySource = readFileSync(
  new URL("../src/components/book/MinimalStoryEntry.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);

describe("growth version creation UI contract", () => {
  it("starts from both populated and Moment-only timeline cards without putting the id in the URL", () => {
    expect(timelineSource).toContain("writeGrowthVersionCreationIntent");
    expect(timelineSource).toContain("再生成一个版本");
    expect(timelineSource).toContain("生成第一个绘本版本");
    expect(timelineSource).toContain("getGrowthVersionCreationHref()");
  });

  it("locks real Moment fields while keeping version settings editable", () => {
    expect(minimalEntrySource).toContain("readOnly={creatingGrowthVersion}");
    expect(minimalEntrySource).toContain("disabled={creatingGrowthVersion}");
    expect(minimalEntrySource).toContain("growthIllustrationStyle");
    expect(minimalEntrySource).toContain("targetMomentId");
  });

  it("restores the local destination and appends instead of creating another Moment", () => {
    expect(pageSource).toContain("readGrowthVersionCreationIntent");
    expect(pageSource).toContain("appendGeneratedStorybookVersion");
    expect(pageSource).toContain("targetMomentId: normalizedTargetMomentId");
    expect(pageSource).not.toContain("createGrowthRecordInput(generatedResult, growthRecordDraft, targetMomentId)");
  });
});
