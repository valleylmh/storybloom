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
  it("keeps series previews focused on the cover, episode title and subtitle", () => {
    expect(catalogSource).toContain("renderCard(book, true, true)");
    expect(cardSource).toContain("library-catalog-card-minimal");
    expect(cardSource).toContain("library-catalog-minimal-subtitle");
    expect(cardSource).toContain("第 ${book.episodeNumber} 回 · ${book.title}");
    expect(cardSource).not.toContain("<em>第 {book.episodeNumber} 回</em>");
    expect(cardSource).toContain("!minimal ?");
  });

  it("shows read and current progress directly on series cards", () => {
    expect(cardSource).toContain('progress?.completedAt\n    ? "已读"');
    expect(cardSource).toContain("当前 · 第 ${progress.pageIndex + 1} 页");
    expect(cardSource).toContain("library-catalog-minimal-progress");
  });

  it("keeps complete series on the library page without a view-all route", () => {
    expect(catalogSource).toContain("expandedSeriesIds");
    expect(catalogSource).toContain("展开全部 ${allSeriesBooks.length}");
    expect(catalogSource).toContain('aria-expanded={expanded}');
    expect(catalogSource).not.toContain("查看全部");
    expect(catalogSource).not.toContain("item.href");
  });

  it("renders recent playback and favorites as lightweight paired lists", () => {
    expect(catalogSource).toContain("library-quick-panels");
    expect(catalogSource).toContain("library-quick-list-item");
    expect(catalogSource).toContain("renderQuickItem(book, true)");
    expect(globalStyles).toContain(".library-quick-panels");
  });

  it("does not duplicate recent progress in a separate continue-reading block", () => {
    expect(catalogSource).not.toContain("continueReading");
    expect(catalogSource).not.toContain("continue-reading-title");
    expect(catalogSource).not.toContain("接着上次");
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
