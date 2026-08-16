import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const narrationToolbarSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryNarrationToolbar.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);
const libraryBookPageSource = readFileSync(
  fileURLToPath(
    new URL("../src/app/library/[seriesId]/[bookId]/page.tsx", import.meta.url),
  ),
  "utf8",
);
const bookPreviewSource = readFileSync(
  fileURLToPath(
    new URL("../src/components/book/BookPreview.tsx", import.meta.url),
  ),
  "utf8",
);
const libraryBookExperienceSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryBookExperience.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("family story reader product boundaries", () => {
  it("keeps the core reader free from microphone and recording APIs", () => {
    expect(narrationToolbarSource).not.toContain("getUserMedia");
    expect(narrationToolbarSource).not.toContain("mediaDevices");
    expect(narrationToolbarSource).not.toContain("MediaRecorder");
    expect(narrationToolbarSource).toContain("不会请求麦克风权限");
  });

  it("uses the same reader experience for library and personalized books", () => {
    expect(libraryBookPageSource).toContain("<LibraryBookExperience");
    expect(bookPreviewSource).toContain("<LibraryBookExperience");
    expect(bookPreviewSource).toContain('contentType="personalized"');
    expect(bookPreviewSource).toContain('preferCloudTts={false}');
  });

  it("keeps page completion finite and user controlled", () => {
    expect(narrationToolbarSource).toContain(
      "pageIndex < pages.length - 1",
    );
    expect(narrationToolbarSource).toContain("dispatch({ type: \"BOOK_ENDED\" })");
    expect(narrationToolbarSource).toContain("autoAdvance");
    expect(narrationToolbarSource).not.toContain("nextBook");
  });

  it("invalidates failed cloud audio before falling back", () => {
    expect(narrationToolbarSource).toContain("deleteCachedNarrationAudio");
    expect(narrationToolbarSource).toContain(
      "cloudAudioCacheRef.current.delete",
    );
    expect(narrationToolbarSource).toContain("playBrowserFallback");
  });

  it("keeps bedtime mode finite, low-friction and microphone free", () => {
    expect(libraryBookExperienceSource).toContain(
      "library-book-experience-bedtime",
    );
    expect(libraryBookExperienceSource).toContain('setReaderMode("turn")');
    expect(libraryBookExperienceSource).toContain(
      "handleAutoAdvanceChange(true)",
    );
    expect(libraryBookExperienceSource).toContain('event.key === "Escape"');
    expect(libraryBookExperienceSource).toContain("读完整本后停止");
    expect(libraryBookExperienceSource).not.toContain("getUserMedia");
    expect(libraryBookExperienceSource).not.toContain("nextBook");
  });
});
