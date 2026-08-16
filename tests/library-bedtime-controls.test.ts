import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

describe("library bedtime controls", () => {
  it("reduces the narration panel to a compact button bar", () => {
    expect(globalStyles).toContain(
      ".library-book-experience-bedtime .library-narration-heading {\n  position: absolute;",
    );
    expect(globalStyles).toContain(
      ".library-book-experience-bedtime .library-narration-panel {\n  position: relative;\n  grid-template-columns: minmax(0, 1fr) auto;",
    );
    expect(globalStyles).toContain("font-size: 0;");
  });
});
