import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);
const minimalStoryEntrySource = readFileSync(
  fileURLToPath(
    new URL("../src/components/book/MinimalStoryEntry.tsx", import.meta.url),
  ),
  "utf8",
);

function readCssBlock(selector: string) {
  const marker = `\n${selector} {`;
  const markerStart = globalStyles.indexOf(marker);
  const start = markerStart < 0 ? -1 : markerStart + 1;
  if (start < 0) throw new Error(`Missing CSS selector: ${selector}`);
  const end = globalStyles.indexOf("\n}", start);
  return globalStyles.slice(start, end);
}

describe("mobile icon-only controls", () => {
  it("uses an SVG and a square iOS-reset close button in the protagonist dialog", () => {
    expect(minimalStoryEntrySource).toContain(
      '<X aria-hidden="true" weight="bold" />',
    );

    const closeButton = readCssBlock(".minimal-identity-close");
    expect(closeButton).toContain("width: 34px;");
    expect(closeButton).toContain("height: 34px;");
    expect(closeButton).toContain("padding: 0;");
    expect(closeButton).toContain("-webkit-appearance: none;");
    expect(closeButton).toContain("align-items: center;");
    expect(closeButton).toContain("justify-content: center;");
  });

  it("keeps previous and next page icons inside fixed square controls", () => {
    const pageButton = readCssBlock(".book-nav-btn");
    expect(pageButton).toContain("width: 44px;");
    expect(pageButton).toContain("height: 44px;");
    expect(pageButton).toContain("padding: 0;");
    expect(pageButton).toContain("-webkit-appearance: none;");
    expect(pageButton).toContain("align-items: center;");
    expect(pageButton).toContain("justify-content: center;");

    const pageIcon = readCssBlock(".book-nav-btn > svg");
    expect(pageIcon).toContain("display: block;");
    expect(pageIcon).toContain("width: 21px;");
    expect(pageIcon).toContain("height: 21px;");
  });
});

describe("mobile protagonist relationship control", () => {
  it("keeps the native picker semantics with a custom closed-state appearance", () => {
    expect(minimalStoryEntrySource).toContain(
      'className="minimal-identity-select-wrap"',
    );
    expect(minimalStoryEntrySource).toContain(
      '<CaretDown aria-hidden="true" weight="bold" />',
    );

    const select = readCssBlock(".minimal-identity-select-wrap select");
    expect(select).toContain("-webkit-appearance: none;");
    expect(select).toContain("padding: 0 42px 0 14px;");
  });
});
