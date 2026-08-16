import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
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

  it("pulls desktop arrows inward toward the image edges", () => {
    expect(globalStyles).toContain(
      ".lightbox-nav-prev {\n  transform: translateX(24px);",
    );
    expect(globalStyles).toContain(
      ".lightbox-nav-next {\n  transform: translateX(-24px);",
    );
  });
});
