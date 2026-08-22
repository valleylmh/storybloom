import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const previewSource = readFileSync(
  fileURLToPath(
    new URL("../src/components/book/BookPreview.tsx", import.meta.url),
  ),
  "utf8",
);

describe("illustration quality UI", () => {
  it("shows a compact whole-book quality result only when reports exist", () => {
    expect(previewSource).toContain("illustrationQualitySummary");
    expect(previewSource).toContain("checkedPages.length === 0");
    expect(previewSource).toContain("插图质量检查通过");
    expect(previewSource).toContain("页建议复查");
    expect(previewSource).toContain("尺寸、清晰度和占位图残留");
  });

  it("passes per-page illustration wait and retry actions into the tiled reader", () => {
    expect(previewSource).toContain("onRetryIllustration");
    expect(previewSource).toContain("isIllustrationRetryable");
    expect(previewSource).toContain("正在生成 · 已等待");
  });
});
