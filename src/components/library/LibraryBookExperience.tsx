"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserNarrationMode } from "@/lib/browser-narration";
import {
  calculateReadingProgressPercent,
  getReadingProgress,
  saveReadingProgress,
  type ReadingProgressRecord,
  type StoryContentType,
} from "@/lib/reading-progress";
import type { PlaybackState } from "@/lib/reader/playback-machine";
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
  contentType = "library",
  contentId = storyKey,
  preferCloudTts = true,
}: {
  title: string;
  pages: StoryPage[];
  accent: string;
  storyKey: string;
  contentType?: StoryContentType;
  contentId?: string;
  preferCloudTts?: boolean;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [readerMode, setReaderMode] = useState<ReaderMode>("turn");
  const [languageMode, setLanguageMode] =
    useState<BrowserNarrationMode>("zh");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [narrationHighlight, setNarrationHighlight] =
    useState<BrowserNarrationMode | null>(null);
  const [initialPositionMs, setInitialPositionMs] = useState(0);
  const [resumeLabel, setResumeLabel] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const progressRef = useRef<ReadingProgressRecord | null>(null);
  const lastSavedFingerprintRef = useRef("");

  useEffect(() => {
    let active = true;
    setPageIndex(0);
    setReaderMode("turn");
    setLanguageMode("zh");
    setAutoAdvance(true);
    setNarrationHighlight(null);
    setInitialPositionMs(0);
    setResumeLabel(null);
    setProgressReady(false);
    progressRef.current = null;
    lastSavedFingerprintRef.current = "";

    void getReadingProgress(contentType, contentId).then((progress) => {
      if (!active) return;
      if (progress) {
        const restoredPageIndex = Math.min(
          Math.max(0, progress.pageIndex),
          Math.max(0, pages.length - 1),
        );
        progressRef.current = { ...progress, pageIndex: restoredPageIndex };
        setPageIndex(restoredPageIndex);
        setLanguageMode(progress.languageMode);
        setAutoAdvance(progress.autoAdvance);
        setInitialPositionMs(progress.positionMs ?? 0);
        if (restoredPageIndex > 0 || (progress.positionMs ?? 0) > 0) {
          setResumeLabel(`继续第 ${restoredPageIndex + 1} 页`);
        }
      }
      setProgressReady(true);
    });

    return () => {
      active = false;
    };
  }, [contentId, contentType, pages.length, storyKey]);

  const persistProgress = useCallback(
    (input: {
      pageIndex: number;
      languageMode: BrowserNarrationMode;
      autoAdvance: boolean;
      positionMs?: number;
      status?: PlaybackState["status"];
    }) => {
      if (!progressReady || pages.length === 0) return;
      const now = new Date().toISOString();
      const previous = progressRef.current;
      const safePageIndex = Math.min(
        Math.max(0, input.pageIndex),
        pages.length - 1,
      );
      const maxPageIndex = Math.max(
        previous?.maxPageIndex ?? 0,
        safePageIndex,
      );
      const completedNow =
        input.status === "ended" && safePageIndex === pages.length - 1;
      const completedAt = completedNow ? now : previous?.completedAt;
      const positionMs =
        input.positionMs && input.positionMs > 0
          ? Math.floor(input.positionMs)
          : undefined;
      const next: ReadingProgressRecord = {
        contentType,
        contentId,
        pageIndex: safePageIndex,
        maxPageIndex,
        ...(positionMs ? { positionMs } : {}),
        languageMode: input.languageMode,
        playbackMode: "page",
        autoAdvance: input.autoAdvance,
        progressPercent: calculateReadingProgressPercent(
          maxPageIndex,
          pages.length,
          Boolean(completedAt),
        ),
        ...(completedAt ? { completedAt } : {}),
        lastReadAt: now,
        updatedAt: now,
      };
      const fingerprint = JSON.stringify({
        pageIndex: next.pageIndex,
        maxPageIndex: next.maxPageIndex,
        positionSecond: Math.floor((next.positionMs ?? 0) / 1000),
        languageMode: next.languageMode,
        autoAdvance: next.autoAdvance,
        progressPercent: next.progressPercent,
        completedAt: next.completedAt,
      });
      progressRef.current = next;
      if (fingerprint === lastSavedFingerprintRef.current) return;
      lastSavedFingerprintRef.current = fingerprint;
      void saveReadingProgress(next);
    },
    [contentId, contentType, pages.length, progressReady],
  );

  const handlePageIndexChange = useCallback(
    (nextPageIndex: number) => {
      setInitialPositionMs(0);
      setResumeLabel(null);
      setPageIndex(nextPageIndex);
      persistProgress({
        pageIndex: nextPageIndex,
        languageMode,
        autoAdvance,
        positionMs: 0,
      });
    }, [autoAdvance, languageMode, persistProgress],
  );

  const handleLanguageModeChange = useCallback(
    (nextMode: BrowserNarrationMode) => {
      setInitialPositionMs(0);
      setResumeLabel(null);
      setLanguageMode(nextMode);
      persistProgress({
        pageIndex,
        languageMode: nextMode,
        autoAdvance,
        positionMs: 0,
      });
    }, [autoAdvance, pageIndex, persistProgress],
  );

  const handleAutoAdvanceChange = useCallback(
    (nextAutoAdvance: boolean) => {
      setAutoAdvance(nextAutoAdvance);
      persistProgress({
        pageIndex,
        languageMode,
        autoAdvance: nextAutoAdvance,
        positionMs: progressRef.current?.positionMs,
      });
    }, [languageMode, pageIndex, persistProgress],
  );

  const handlePlaybackStateChange = useCallback(
    (state: PlaybackState) => {
      persistProgress({
        pageIndex: state.pageIndex,
        languageMode: state.languageMode,
        autoAdvance: state.autoAdvance,
        positionMs: state.positionMs,
        status: state.status,
      });
    }, [persistProgress],
  );

  return (
    <>
      <section className="library-narration-tools" aria-label="绘本朗读">
        <LibraryNarrationToolbar
          pages={pages}
          storyKey={storyKey}
          currentPageIndex={pageIndex}
          turnModeActive={readerMode === "turn"}
          languageMode={languageMode}
          autoAdvance={autoAdvance}
          initialPositionMs={initialPositionMs}
          resumeLabel={resumeLabel}
          preferCloudTts={preferCloudTts}
          onPageIndexChange={handlePageIndexChange}
          onLanguageModeChange={handleLanguageModeChange}
          onAutoAdvanceChange={handleAutoAdvanceChange}
          onHighlightChange={setNarrationHighlight}
          onPlaybackStateChange={handlePlaybackStateChange}
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
        onPageIndexChange={handlePageIndexChange}
        onReaderModeChange={setReaderMode}
      />
    </>
  );
}
