import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const catalogSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryCatalogExperience.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);
const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

describe("library series anchor navigation", () => {
  it("links each series tab to its matching on-page section", () => {
    expect(catalogSource).toContain('aria-label="系列故事导航"');
    expect(catalogSource).toContain(
      'href={`#library-series-${item.id}`}',
    );
    expect(catalogSource).toContain('id={`library-series-${item.id}`}');
    expect(catalogSource).toContain(
      'aria-labelledby={`library-series-title-${item.id}`}',
    );
    expect(catalogSource).toContain(
      '<h3 id={`library-series-title-${item.id}`}>',
    );
  });

  it("keeps the compact tab row sticky, touch-scrollable and comfortably aligned", () => {
    expect(globalStyles).toContain(".library-series-tabs {");
    expect(globalStyles).toContain("position: sticky;");
    expect(globalStyles).toContain("top: 10px;");
    expect(globalStyles).toContain("overflow-x: auto;");
    expect(globalStyles).toContain("-webkit-overflow-scrolling: touch;");
    expect(globalStyles).toContain("min-height: 44px;");
    expect(globalStyles).toContain("width: fit-content;");
    expect(globalStyles).toContain('a[aria-current="true"]');
    expect(globalStyles).toContain("scroll-margin-top: 76px;");
    expect(globalStyles).toContain(
      ".library-series-tabs a:hover {\n    transform: none;",
    );
  });
});
