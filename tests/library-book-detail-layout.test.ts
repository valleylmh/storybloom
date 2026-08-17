import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const bookPageSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/app/library/[seriesId]/[bookId]/page.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);
const bookToolsSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryBookTools.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);
const storyVideoSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/video/StoryVideoPanel.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);
const globalStyles = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

describe("library book detail layout", () => {
  it("keeps the favorite action at the title's upper-right edge", () => {
    expect(bookPageSource).toContain('className="library-book-title-row"');
    expect(bookPageSource).toContain("<LibraryFavoriteButton");
    expect(bookPageSource).toContain("compact");
    expect(globalStyles).toContain(".library-book-title-row");
    expect(globalStyles).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(globalStyles).toContain(".library-favorite-button-compact");
  });

  it("uses compact icon-only share actions with accessible labels", () => {
    expect(bookToolsSource).toContain('aria-label={');
    expect(bookToolsSource).toContain('title="分享这本绘本"');
    expect(bookToolsSource).toContain('aria-label={shareStatus === "copied"');
    expect(globalStyles).toContain(".library-share-action");
    expect(globalStyles).toContain("width: 46px");
    expect(globalStyles).toContain("border-radius: 50%");
  });

  it("places adjacent-book navigation before tools without a recommendation rail", () => {
    const adjacentIndex = bookPageSource.indexOf(
      'className="library-adjacent"',
    );
    const toolsIndex = bookPageSource.indexOf("<LibraryBookTools");

    expect(adjacentIndex).toBeGreaterThan(-1);
    expect(toolsIndex).toBeGreaterThan(adjacentIndex);
    expect(bookPageSource).not.toContain("<LibraryRelatedBooks");
    expect(bookPageSource).not.toContain("getLibraryRecommendations");
  });

  it("matches compact video actions to the icon-only share layout", () => {
    expect(bookToolsSource).toContain("compact");
    expect(storyVideoSource).toContain("story-video-panel-compact");
    expect(storyVideoSource).toContain("compact ? null : <span>{generateLabel}</span>");
    expect(storyVideoSource).toContain("适合手机分享的竖屏视频");
    expect(globalStyles).toContain(
      ".story-video-panel-compact .story-video-generate-btn",
    );
  });

  it("uses a styled accessible narration-language popover", () => {
    expect(storyVideoSource).toContain("story-video-language-trigger");
    expect(storyVideoSource).toContain('aria-haspopup="listbox"');
    expect(storyVideoSource).toContain('role="option"');
    expect(storyVideoSource).toContain('shortLabel: "中"');
    expect(storyVideoSource).toContain("selectedNarrationShortLabel");
    expect(storyVideoSource).not.toContain("CaretDown");
    expect(storyVideoSource).not.toContain('className="story-video-select"');
    expect(globalStyles).toContain(".story-video-language-popover");
    expect(globalStyles).toContain(".story-video-language-option-selected");
  });
});
