"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoonStars, X } from "@phosphor-icons/react";
import { useReadingProgressCloudSync } from "@/hooks/useReadingProgressCloudSync";
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
  personalizeHref,
}: {
  title: string;
  pages: StoryPage[];
  accent: string;
  storyKey: string;
  contentType?: StoryContentType;
  contentId?: string;
  preferCloudTts?: boolean;
  personalizeHref?: string;
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
  const [playbackStatus, setPlaybackStatus] =
    useState<PlaybackState["status"]>("idle");
  const [bedtimeMode, setBedtimeMode] = useState(false);
  const progressRef = useRef<ReadingProgressRecord | null>(null);
  const lastSavedFingerprintRef = useRef("");
  const bedtimeExitButtonRef = useRef<HTMLButtonElement>(null);
  const syncProgressToAccount = useReadingProgressCloudSync();

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
    setPlaybackStatus("idle");
    setBedtimeMode(false);
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

  useEffect(() => {
    if (!bedtimeMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => bedtimeExitButtonRef.current?.focus(),
      0,
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBedtimeMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [bedtimeMode]);

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
      syncProgressToAccount(next, input.status);
    },
    [
      contentId,
      contentType,
      pages.length,
      progressReady,
      syncProgressToAccount,
    ],
  );

  const handlePageIndexChange = useCallback(
    (nextPageIndex: number) => {
      setPlaybackStatus("idle");
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
      setPlaybackStatus(state.status);
      persistProgress({
        pageIndex: state.pageIndex,
        languageMode: state.languageMode,
        autoAdvance: state.autoAdvance,
        positionMs: state.positionMs,
        status: state.status,
      });
    }, [persistProgress],
  );

  const enterBedtimeMode = useCallback(() => {
    setReaderMode("turn");
    handleAutoAdvanceChange(true);
    setBedtimeMode(true);
  }, [handleAutoAdvanceChange]);

  return (
    <section
      className={`library-book-experience ${
        bedtimeMode ? "library-book-experience-bedtime" : ""
      }`}
      aria-label={bedtimeMode ? `${title}睡前阅读` : undefined}
    >
      <div className="library-bedtime-stage">
        {bedtimeMode ? (
          <header className="library-bedtime-header">
            <div>
              <MoonStars aria-hidden="true" weight="fill" />
              <span>
                <strong>{title}</strong>
                <small>低刺激显示 · 读完整本后停止，不会自动进入下一本</small>
              </span>
            </div>
            <button
              ref={bedtimeExitButtonRef}
              type="button"
              onClick={() => setBedtimeMode(false)}
            >
              <X aria-hidden="true" />
              退出睡前模式
            </button>
          </header>
        ) : (
          <div className="library-bedtime-entry">
            <div>
              <MoonStars aria-hidden="true" weight="fill" />
              <span>
                <strong>睡前模式</strong>
                <small>降低视觉刺激，保留大号播放和翻页；读完整本即停止。</small>
              </span>
            </div>
            <button type="button" onClick={enterBedtimeMode}>
              进入睡前模式
            </button>
          </div>
        )}

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
      </div>

      {!bedtimeMode &&
      personalizeHref &&
      playbackStatus === "ended" &&
      pageIndex === pages.length - 1 ? (
        <section className="library-reader-personalize" role="status">
          <span>孩子喜欢这个故事？</span>
          <strong>让孩子成为故事主角</strong>
          <p>故事主题和结构会自动带入，只需选择家庭角色并确认形象。</p>
          <Link href={personalizeHref}>让孩子成为主角</Link>
        </section>
      ) : null}
    </section>
  );
}
