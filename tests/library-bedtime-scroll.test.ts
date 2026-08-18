import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

function readRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalStyles.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"),
  );

  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

describe("library bedtime mobile scrolling", () => {
  it("lets the fixed bedtime reader escape the generated preview shell", () => {
    const previewRule = readRule(
      ".preview-wrap:has(.library-book-experience-bedtime)",
    );

    expect(previewRule).toContain("overflow: visible;");
    expect(previewRule).toContain("backdrop-filter: none;");
    expect(previewRule).toContain("-webkit-backdrop-filter: none;");
  });

  it("keeps the full-screen reader vertically touch-scrollable", () => {
    const bedtimeRule = readRule(".library-book-experience-bedtime");

    expect(bedtimeRule).toContain("position: fixed;");
    expect(bedtimeRule).toContain("inset: 0;");
    expect(bedtimeRule).toContain("overflow: auto;");
    expect(bedtimeRule).toContain("-webkit-overflow-scrolling: touch;");
    expect(bedtimeRule).toContain("touch-action: pan-y;");
  });
});
