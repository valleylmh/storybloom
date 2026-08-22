import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readerSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryBookReader.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("library reader illustration accessibility", () => {
  it("announces all four page illustration states through a polite live region", () => {
    expect(readerSource).toContain("第 ${page.page} 页插图已完成");
    expect(readerSource).toContain("第 ${page.page} 页插图正在生成");
    expect(readerSource).toContain("第 ${page.page} 页插图生成失败");
    expect(readerSource).toContain("第 ${page.page} 页插图等待生成");
    expect(readerSource).toContain('aria-live="polite"');
    expect(readerSource).toContain('aria-atomic="true"');
  });

  it("includes the illustration state in page navigation and fallback labels", () => {
    expect(readerSource).toContain("getIllustrationStatusLabel(page)");
    expect(readerSource).toContain("getIllustrationStatusLabel(item)");
    expect(readerSource).toContain('role="img"');
    expect(readerSource).not.toMatch(
      /className="(?:book-image-fallback|library-page-fallback)"[\s\S]{0,180}aria-hidden="true"/,
    );
  });
});
