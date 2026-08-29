import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const bookPageSource = read("../src/app/library/[seriesId]/[bookId]/page.tsx");
const backLinkSource = read(
  "../src/components/library/LibraryDetailBackLink.tsx",
);
const cardSource = read("../src/components/library/LibraryCatalogCard.tsx");
const catalogSource = read(
  "../src/components/library/LibraryCatalogExperience.tsx",
);
const seriesSource = read(
  "../src/components/library/LibrarySeriesExperience.tsx",
);
const restorerSource = read(
  "../src/components/library/LibraryScrollRestorer.tsx",
);

describe("library return navigation", () => {
  it("records the exact source scroll position before opening a detail", () => {
    expect(cardSource).toContain("rememberLibraryReturnPosition(book.href)");
    expect(catalogSource).toContain("rememberLibraryReturnPosition(book.href)");
    expect(read("../src/lib/library/navigation.ts")).toContain(
      "window.history.replaceState(",
    );
  });

  it("uses actual browser history for a detail-page return", () => {
    expect(bookPageSource).toContain("<LibraryDetailBackLink");
    expect(backLinkSource).toContain("window.history.back()");
    expect(backLinkSource).toContain(
      "saved?.destinationPathname === window.location.pathname",
    );
    expect(backLinkSource).not.toContain("scrollIntoView");
  });

  it("restores the stored y position on both catalog and series pages", () => {
    expect(catalogSource).toContain("<LibraryScrollRestorer />");
    expect(catalogSource).not.toContain("scrollIntoView");
    expect(catalogSource).toContain("tabList.scrollTo");
    expect(seriesSource).toContain("<LibraryScrollRestorer />");
    expect(restorerSource).toContain("top: returnPosition.scrollY");
    expect(restorerSource).toContain(
      'window.addEventListener("popstate", scheduleRestore)',
    );
    expect(restorerSource).toContain(
      'window.history.scrollRestoration = "manual"',
    );
  });
});
