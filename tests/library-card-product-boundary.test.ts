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
const cardSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryCatalogCard.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);
const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

describe("library series card product boundary", () => {
  it("keeps series previews focused on the cover and title", () => {
    expect(catalogSource).toContain("renderCard(book, true, true)");
    expect(cardSource).toContain("library-catalog-card-minimal");
    expect(cardSource).toContain("library-catalog-minimal-subtitle");
    expect(cardSource).toContain("!minimal ?");
  });

  it("keeps an accessible favorite target without a visible circular plate", () => {
    const favoriteRule = globalStyles.match(
      /\.library-card-favorite \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(favoriteRule).toContain("width: 44px");
    expect(favoriteRule).toContain("height: 44px");
    expect(favoriteRule).toContain("border: 0");
    expect(favoriteRule).toContain("background: transparent");
    expect(favoriteRule).not.toContain("border-radius: 999px");
    expect(globalStyles).toContain(
      ".library-catalog-card-minimal .library-card-favorite",
    );
    expect(globalStyles).toContain("top: auto");
    expect(globalStyles).toContain("bottom: 0");
  });
});
