import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);
const readerSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryBookReader.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

function readZIndex(selector: string): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalStyles.match(
    new RegExp(`${escapedSelector}\\s*\\{[^}]*z-index:\\s*(\\d+)`, "s"),
  );

  if (!match) {
    throw new Error(`Missing z-index for ${selector}`);
  }

  return Number(match[1]);
}

describe("library image preview layering", () => {
  it("keeps the image lightbox above the full-screen bedtime reader", () => {
    expect(readZIndex(".lightbox-backdrop")).toBeGreaterThan(
      readZIndex(".library-book-experience-bedtime"),
    );
  });

  it("places navigation beside the enlarged image", () => {
    expect(readerSource).toContain('className="lightbox-media"');
    expect(globalStyles).toContain(
      ".lightbox-media {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;",
    );
    expect(globalStyles).toContain(
      ".lightbox-nav {\n  position: static;",
    );
    expect(globalStyles).not.toContain("translateX(24px)");
  });
});
