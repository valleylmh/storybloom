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
const footerSource = readFileSync(
  fileURLToPath(
    new URL("../src/components/layout/Footer.tsx", import.meta.url),
  ),
  "utf8",
);
const seriesSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibrarySeriesExperience.tsx",
      import.meta.url,
    ),
  ),
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

  it("renders every series book immediately without expansion controls", () => {
    expect(catalogSource).toContain(
      "allSeriesBooks.map((book) => renderCard(book, true, true))",
    );
    expect(catalogSource).not.toContain("expandedSeriesIds");
    expect(catalogSource).not.toContain("library-series-expand");
    expect(catalogSource).not.toContain("展开全部");
    expect(catalogSource).not.toContain("查看全部");
    expect(catalogSource).not.toContain("item.href");
  });

  it("uses a centered series heading without an extra kicker", () => {
    expect(catalogSource).toContain("library-series-home-header");
    expect(catalogSource).not.toContain("按顺序慢慢读");
    expect(globalStyles).toContain(".library-series-home-header");
    expect(globalStyles).toContain(".library-series-home-header h2::after");
  });

  it("keeps the bookshelf out of the global footer", () => {
    expect(footerSource).not.toContain('href="/me/books"');
    expect(footerSource).not.toContain("我的书架");
  });

  it("uses the same minimal cards across every series detail page", () => {
    expect(seriesSource).toContain('className="library-home-row"');
    expect(seriesSource).toContain("publishedBooks.map((book)");
    expect(seriesSource).toContain("compact");
    expect(seriesSource).toContain("minimal");
    expect(seriesSource).not.toContain("visibleCount");
    expect(seriesSource).not.toContain("library-catalog-more");
  });

  it("renders recent playback and favorites as lightweight paired lists", () => {
    expect(catalogSource).toContain("library-quick-panels");
    expect(catalogSource).toContain("library-quick-list-item");
    expect(catalogSource).toContain("library-quick-list-meta");
    expect(catalogSource).toContain("renderQuickItem(book, true)");
    expect(globalStyles).toContain(".library-quick-panels");
    expect(globalStyles).toContain(".library-quick-panel + .library-quick-panel");
  });

  it("does not duplicate recent progress in a separate continue-reading block", () => {
    expect(catalogSource).not.toContain("continueReading");
    expect(catalogSource).not.toContain("continue-reading-title");
    expect(catalogSource).not.toContain("接着上次");
  });

  it("keeps the tonight recommendation out of the current library home", () => {
    expect(catalogSource).not.toContain("selectTonightRecommendation");
    expect(catalogSource).not.toContain("TONIGHT_AGE_PREFERENCE_KEY");
    expect(catalogSource).not.toContain("library-tonight");
    expect(catalogSource).not.toContain("今晚读什么");
  });

  it("keeps discovery filters and the full catalog off the current home", () => {
    expect(catalogSource).not.toContain("library-discovery");
    expect(catalogSource).not.toContain("library-filter-panel");
    expect(catalogSource).not.toContain("全部精选绘本");
    expect(catalogSource).not.toContain("filterLibraryBooks");
    expect(catalogSource).not.toContain("searchPrivateStoryItems");
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
    expect(globalStyles).toContain("opacity: 0");
    expect(globalStyles).toContain("pointer-events: none");
    expect(globalStyles).toContain(
      ".library-catalog-card-minimal:hover .library-card-favorite",
    );
    expect(globalStyles).toContain("@media (hover: none), (pointer: coarse)");
  });
});
