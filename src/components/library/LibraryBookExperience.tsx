"use client";

import { useEffect, useState } from "react";
import type { BrowserNarrationMode } from "@/lib/browser-narration";
import type { StoryPage } from "@/types";
import LibraryBookReader, {
  type ReaderMode,
} from "@/components/library/LibraryBookReader";
import LibraryNarrationToolbar from "@/components/library/LibraryNarrationToolbar";

export default function LibraryBookExperience({
  title,
  pages,
  accent,
  storyKey,
}: {
  title: string;
  pages: StoryPage[];
  accent: string;
  storyKey: string;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [readerMode, setReaderMode] = useState<ReaderMode>("turn");
  const [narrationHighlight, setNarrationHighlight] =
    useState<BrowserNarrationMode | null>(null);

  useEffect(() => {
    setPageIndex(0);
    setReaderMode("turn");
    setNarrationHighlight(null);
  }, [storyKey]);

  return (
    <>
      <section className="library-narration-tools" aria-label="绘本朗读">
        <LibraryNarrationToolbar
          pages={pages}
          storyKey={storyKey}
          currentPageIndex={pageIndex}
          turnModeActive={readerMode === "turn"}
          onPageIndexChange={setPageIndex}
          onHighlightChange={setNarrationHighlight}
          onRequestTurnMode={() => setReaderMode("turn")}
        />
      </section>

      <LibraryBookReader
        title={title}
        pages={pages}
        accent={accent}
        pageIndex={pageIndex}
        readerMode={readerMode}
        narrationHighlight={narrationHighlight}
        onPageIndexChange={setPageIndex}
        onReaderModeChange={setReaderMode}
      />
    </>
  );
}
