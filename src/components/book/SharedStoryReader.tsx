"use client";

import { useCallback, useState } from "react";
import type { BrowserNarrationMode } from "@/lib/browser-narration";
import type { PlaybackState } from "@/lib/reader/playback-machine";
import type { StoryPage } from "@/types";
import LibraryBookReader, { type ReaderMode } from "@/components/library/LibraryBookReader";
import LibraryNarrationToolbar from "@/components/library/LibraryNarrationToolbar";

/**
 * Page-turning reader with narration for a shared story. Unlike the library
 * reader it keeps no reading progress: a visitor's own bookshelf and reading
 * records must not pick up someone else's shared book.
 */
export default function SharedStoryReader({
  shareId,
  title,
  pages,
  initialLanguageMode,
}: {
  shareId: string;
  title: string;
  pages: StoryPage[];
  initialLanguageMode: BrowserNarrationMode;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [readerMode, setReaderMode] = useState<ReaderMode>("turn");
  const [languageMode, setLanguageMode] = useState(initialLanguageMode);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [highlight, setHighlight] = useState<BrowserNarrationMode | null>(null);
  const [playback, setPlayback] = useState<Pick<PlaybackState, "status" | "positionMs" | "durationMs">>({
    status: "idle", positionMs: 0, durationMs: 0,
  });
  // The toolbar reports state from an effect keyed on this callback, so it must stay stable.
  const handlePlaybackStateChange = useCallback(
    ({ status, positionMs, durationMs }: PlaybackState) => setPlayback({ status, positionMs, durationMs }),
    [],
  );

  return (
    <section className="library-book-experience">
      <div className="library-bedtime-stage">
        <section className="library-narration-tools" aria-label="绘本朗读">
          <LibraryNarrationToolbar
            pages={pages}
            storyKey={`share-${shareId}`}
            currentPageIndex={pageIndex}
            turnModeActive={readerMode === "turn"}
            compactControls
            readerMode={readerMode}
            languageMode={languageMode}
            autoAdvance={autoAdvance}
            onPageIndexChange={setPageIndex}
            onLanguageModeChange={setLanguageMode}
            onAutoAdvanceChange={setAutoAdvance}
            onHighlightChange={setHighlight}
            onPlaybackStateChange={handlePlaybackStateChange}
            onRequestTurnMode={() => setReaderMode("turn")}
            onReaderModeChange={setReaderMode}
          />
        </section>

        <LibraryBookReader
          title={title}
          pages={pages}
          accent="#df6d47"
          pageIndex={pageIndex}
          readerMode={readerMode}
          playbackActive={playback.status === "playing" || playback.status === "loading"}
          narrationHighlight={highlight}
          playbackPositionMs={playback.positionMs}
          playbackDurationMs={playback.durationMs}
          showToolbar={false}
          onPageIndexChange={setPageIndex}
          onReaderModeChange={setReaderMode}
        />
      </div>
    </section>
  );
}
