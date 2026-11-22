"use client";

import Link from "next/link";
import {
  CONTINUOUS_PLAYBACK_STORAGE_KEY,
  formatNextBookAnnouncement,
  nextSeriesBook,
  parseContinuousPlaybackPreference,
  parsePlaybackHandoff,
  type SeriesPlaylistItem,
} from "@/lib/reader/continuous-playback";
import { getReadyAnnouncementUrl } from "@/lib/reader/next-book-announcement";
import {
  seriesAudioPlayer,
  type SeriesPlayerPhase,
  type SeriesPlayerState,
} from "@/lib/reader/series-audio-player";
import { useRouter } from "next/navigation";
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
import type { BookAudio } from "@/lib/reader/book-audio-transport";
import type { StoryPage } from "@/types";
import LibraryBookReader, {
  type ReaderMode,
} from "@/components/library/LibraryBookReader";
import LibraryFavoriteButton from "@/components/library/LibraryFavoriteButton";
import LibraryPlaylist from "@/components/library/LibraryPlaylist";
import LibraryNarrationToolbar from "@/components/library/LibraryNarrationToolbar";
import LibraryNextBookCountdown from "@/components/library/LibraryNextBookCountdown";
import LibraryBookFloatingActions, {
  type LibraryBookFloatingActionsConfig,
} from "@/components/library/LibraryBookFloatingActions";

type PendingUpcomingBook = {
  book: SeriesPlaylistItem;
  announcementText: string | null;
  announcementPlaying: boolean;
  managedBySeriesPlayer: boolean;
};

function mapSeriesPhaseToStatus(phase: SeriesPlayerPhase): PlaybackState["status"] {
  switch (phase) {
    case "loading":
      return "loading";
    case "playing":
      return "playing";
    case "paused":
      return "paused";
    case "announcing":
    case "ended":
      return "ended";
    case "error":
      return "error";
    case "idle":
    default:
      return "idle";
  }
}

export default function LibraryBookExperience({
  title,
  seriesTitle,
  chineseAudio,
  pages,
  accent,
  storyKey,
  contentType = "library",
  contentId = storyKey,
  preferCloudTts = true,
  initialReaderMode = "turn",
  onRetryIllustration,
  isIllustrationRetryable,
  getIllustrationStatusDetail,
  retryingIllustrationPages = [],
  personalizeHref,
  playlist = [],
  floatingActions,
}: {
  chineseAudio?: BookAudio;
  title: string;
  seriesTitle?: string;
  pages: StoryPage[];
  accent: string;
  storyKey: string;
  contentType?: StoryContentType;
  contentId?: string;
  preferCloudTts?: boolean;
  initialReaderMode?: ReaderMode;
  onRetryIllustration?: (pageNumber: number) => void;
  isIllustrationRetryable?: (page: StoryPage) => boolean;
  getIllustrationStatusDetail?: (page: StoryPage) => string | undefined;
  retryingIllustrationPages?: readonly number[];
  personalizeHref?: string;
  playlist?: SeriesPlaylistItem[];
  floatingActions?: LibraryBookFloatingActionsConfig;
}) {
  const router = useRouter();
  const [continuousPlayback, setContinuousPlayback] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const advancedBookRef = useRef(false);
  const [pendingUpcoming, setPendingUpcoming] = useState<PendingUpcomingBook | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [readerMode, setReaderMode] =
    useState<ReaderMode>(initialReaderMode);
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
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [bedtimeMode, setBedtimeMode] = useState(false);
  const progressRef = useRef<ReadingProgressRecord | null>(null);
  const lastSavedFingerprintRef = useRef("");
  const bedtimeExitButtonRef = useRef<HTMLButtonElement>(null);
  const navigatedBookIdRef = useRef<string | null>(null);
  const followingPlaybackRef = useRef(false);
  const progressReadyRef = useRef(progressReady);
  progressReadyRef.current = progressReady;
  const bedtimeModeRef = useRef(bedtimeMode);
  bedtimeModeRef.current = bedtimeMode;
  const continuousPlaybackRef = useRef(continuousPlayback);
  continuousPlaybackRef.current = continuousPlayback;
  const languageModeRef = useRef(languageMode);
  languageModeRef.current = languageMode;
  const syncProgressToAccount = useReadingProgressCloudSync();

  const currentPlaylistItem = playlist.find((item) => item.id === contentId);
  const currentBookCover =
    currentPlaylistItem?.cover ??
    (pages[0]?.imageStatus === "complete" ? pages[0].imageUrl : undefined);
  const currentBookHref = currentPlaylistItem?.href ?? "";

  useEffect(() => {
    let active = true;
    let handoff: { id: string; language: BrowserNarrationMode } | null = null;
    seriesAudioPlayer.claimBook(contentId);
    navigatedBookIdRef.current = null;
    try {
      setContinuousPlayback(
        parseContinuousPlaybackPreference(
          localStorage.getItem(CONTINUOUS_PLAYBACK_STORAGE_KEY),
        ),
      );
      const saved = sessionStorage.getItem("storybloom.next-book");
      if (saved) {
        handoff = parsePlaybackHandoff(saved, contentId);
      }
    } catch { /* Reading remains available without browser storage. */ }

    const liveSeries = seriesAudioPlayer.getActiveStateForBook(contentId);
    followingPlaybackRef.current = Boolean(liveSeries);
    advancedBookRef.current = false;
    setBedtimeMode(false);
    progressRef.current = null;
    lastSavedFingerprintRef.current = "";

    if (liveSeries) {
      try { sessionStorage.removeItem("storybloom.next-book"); } catch { /* Optional storage. */ }
      setAutoStart(false);
      setPageIndex(liveSeries.pageIndex);
      setReaderMode("turn");
      setLanguageMode(liveSeries.languageMode);
      setAutoAdvance(liveSeries.autoAdvance);
      setNarrationHighlight(liveSeries.phase === "playing" ? liveSeries.languageMode : null);
      setInitialPositionMs(liveSeries.positionMs);
      setResumeLabel(null);
      setPlaybackStatus(mapSeriesPhaseToStatus(liveSeries.phase));
      setPlaybackPositionMs(liveSeries.positionMs);
      setPlaybackDurationMs(liveSeries.durationMs);
      setPendingUpcoming(
        liveSeries.phase === "announcing" && liveSeries.pendingTarget
          ? {
              book: liveSeries.pendingTarget,
              announcementText: liveSeries.announcementText,
              announcementPlaying: liveSeries.announcementPlaying,
              managedBySeriesPlayer: true,
            }
          : null,
      );
      setProgressReady(true);
      void getReadingProgress(contentType, contentId).then((progress) => {
        if (!active || !progress) return;
        progressRef.current = progress;
      });
    } else {
      setAutoStart(false);
      setPendingUpcoming(null);
      setPageIndex(0);
      setReaderMode(initialReaderMode);
      setLanguageMode("zh");
      setAutoAdvance(true);
      setNarrationHighlight(null);
      setInitialPositionMs(0);
      setResumeLabel(null);
      setProgressReady(false);
      setPlaybackStatus("idle");
      setPlaybackPositionMs(0);
      setPlaybackDurationMs(0);

      void getReadingProgress(contentType, contentId).then((progress) => {
        if (!active) return;
        if (handoff) {
          try { sessionStorage.removeItem("storybloom.next-book"); } catch { /* Optional storage. */ }
          setLanguageMode(handoff.language);
          setAutoAdvance(true);
          setReaderMode("turn");
          setAutoStart(true);
        } else if (progress) {
          const restoredPageIndex = progress.completedAt && progress.pageIndex === pages.length - 1 && !progress.positionMs ? 0 : Math.min(
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
    }

    return () => {
      active = false;
      seriesAudioPlayer.releaseBook(contentId);
    };
  }, [contentId, contentType, initialReaderMode, pages.length, storyKey]);

  useEffect(() => {
    const syncSeriesSnapshot = (snapshot: SeriesPlayerState, preferReplace = false) => {
      if (snapshot.phase === "idle") {
        followingPlaybackRef.current = false;
        setPendingUpcoming((previous) =>
          previous?.managedBySeriesPlayer ? null : previous,
        );
        return;
      }

      if (snapshot.bookId === contentId) {
        followingPlaybackRef.current = true;
      }

      if (
        !snapshot.handoffOnly &&
        snapshot.bookId &&
        snapshot.bookId !== contentId &&
        snapshot.bookHref
      ) {
        // Only follow automatic series transitions when THIS book page was the
        // actively playing reader. If the user is merely browsing another book
        // while a previous book plays in the bottom mini player, never redirect.
        if (
          followingPlaybackRef.current &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible" &&
          navigatedBookIdRef.current !== snapshot.bookId
        ) {
          navigatedBookIdRef.current = snapshot.bookId;
          if (preferReplace) {
            router.replace(snapshot.bookHref);
          } else {
            router.push(snapshot.bookHref);
          }
        }
        return;
      }

      if (
        snapshot.bookId === contentId &&
        snapshot.phase === "announcing" &&
        snapshot.pendingTarget
      ) {
        setPendingUpcoming({
          book: snapshot.pendingTarget,
          announcementText: snapshot.announcementText,
          announcementPlaying: snapshot.announcementPlaying,
          managedBySeriesPlayer: true,
        });
        return;
      }

      setPendingUpcoming((previous) =>
        previous?.managedBySeriesPlayer ? null : previous,
      );
    };

    const unsubscribe = seriesAudioPlayer.subscribe((snapshot) => {
      syncSeriesSnapshot(snapshot, false);
    });

    const handleVisibilityWake = () => {
      if (document.visibilityState !== "visible") return;
      syncSeriesSnapshot(seriesAudioPlayer.getState(), true);
    };
    document.addEventListener("visibilitychange", handleVisibilityWake);
    window.addEventListener("pageshow", handleVisibilityWake);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityWake);
      window.removeEventListener("pageshow", handleVisibilityWake);
    };
  }, [contentId, router]);

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
      advancedBookRef.current = false;
      setPendingUpcoming((previous) =>
        previous?.managedBySeriesPlayer ? previous : null,
      );
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
      setPlaybackPositionMs(0);
      setPlaybackDurationMs(0);
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
      setPlaybackPositionMs(state.positionMs);
      setPlaybackDurationMs(state.durationMs);
      persistProgress({
        pageIndex: state.pageIndex,
        languageMode: state.languageMode,
        autoAdvance: state.autoAdvance,
        positionMs: state.positionMs,
        status: state.status,
      });
    }, [persistProgress],
  );

  const navigateWithHandoff = useCallback(
    (target: SeriesPlaylistItem) => {
      setPendingUpcoming(null);
      try {
        sessionStorage.setItem(
          "storybloom.next-book",
          JSON.stringify({
            id: target.id,
            language: languageModeRef.current,
            at: Date.now(),
          }),
        );
      } catch {
        return;
      }
      if (navigatedBookIdRef.current === target.id) return;
      navigatedBookIdRef.current = target.id;
      router.push(target.href);
    },
    [router],
  );

  const handleBookFinished = useCallback((): boolean => {
    if (
      !progressReadyRef.current ||
      bedtimeModeRef.current ||
      !continuousPlaybackRef.current
    ) {
      return false;
    }
    if (advancedBookRef.current) return false;
    const upcoming = nextSeriesBook(playlist, contentId);
    if (!upcoming) return false;
    advancedBookRef.current = true;

    const mode = languageModeRef.current;
    const { text: announcementText } = formatNextBookAnnouncement(upcoming, mode);
    const announcementUrl = preferCloudTts
      ? getReadyAnnouncementUrl(upcoming, mode)
      : null;
    const isHidden =
      typeof document !== "undefined" && document.visibilityState === "hidden";

    if (announcementUrl) {
      if (isHidden) {
        const started = seriesAudioPlayer.startHandoffAnnouncement({
          fromBookId: contentId,
          target: upcoming,
          mode,
          announcementUrl,
          seriesTitle,
        });
        navigateWithHandoff(upcoming);
        return started;
      }
      return seriesAudioPlayer.startHandoffAnnouncement({
        fromBookId: contentId,
        target: upcoming,
        mode,
        announcementUrl,
        seriesTitle,
        onComplete: () => navigateWithHandoff(upcoming),
      });
    }

    if (isHidden) {
      navigateWithHandoff(upcoming);
      return true;
    }

    setPendingUpcoming({
      book: upcoming,
      announcementText,
      announcementPlaying: false,
      managedBySeriesPlayer: false,
    });
    return false;
  }, [contentId, navigateWithHandoff, playlist, preferCloudTts, seriesTitle]);

  useEffect(() => {
    if (playbackStatus !== "ended") advancedBookRef.current = false;
    if (seriesAudioPlayer.ownsBook(contentId)) return;
    if (
      !progressReady ||
      bedtimeMode ||
      !continuousPlayback ||
      playbackStatus !== "ended" ||
      pageIndex !== pages.length - 1
    ) {
      setPendingUpcoming((previous) =>
        previous?.managedBySeriesPlayer ? previous : null,
      );
      return;
    }
    if (advancedBookRef.current) return;
    const next = nextSeriesBook(playlist, contentId);
    if (!next) return;
    advancedBookRef.current = true;
    const { text: announcementText } = formatNextBookAnnouncement(next, languageMode);
    setPendingUpcoming({
      book: next,
      announcementText,
      announcementPlaying: false,
      managedBySeriesPlayer: false,
    });
  }, [
    bedtimeMode,
    contentId,
    continuousPlayback,
    languageMode,
    pageIndex,
    pages.length,
    playbackStatus,
    playlist,
    progressReady,
  ]);

  const handlePlayPendingUpcoming = useCallback(() => {
    if (!pendingUpcoming) return;
    if (pendingUpcoming.managedBySeriesPlayer) {
      setPendingUpcoming(null);
      if (!seriesAudioPlayer.playPendingTargetNow()) {
        navigateWithHandoff(pendingUpcoming.book);
      }
      return;
    }
    navigateWithHandoff(pendingUpcoming.book);
  }, [navigateWithHandoff, pendingUpcoming]);

  const handleContinuousPlaybackChange = (enabled: boolean) => {
    setContinuousPlayback(enabled);
    try {
      localStorage.setItem(CONTINUOUS_PLAYBACK_STORAGE_KEY, String(enabled));
    } catch { /* Session preference still works. */ }
    if (enabled) handleAutoAdvanceChange(true);
  };

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
      {pendingUpcoming ? (
        <LibraryNextBookCountdown
          key={pendingUpcoming.book.id}
          title={pendingUpcoming.book.title}
          englishTitle={pendingUpcoming.book.englishTitle}
          languageMode={languageMode}
          announcementText={pendingUpcoming.announcementText}
          announcementPlaying={pendingUpcoming.announcementPlaying}
          onComplete={handlePlayPendingUpcoming}
          onCancel={() => {
            if (pendingUpcoming.managedBySeriesPlayer) {
              seriesAudioPlayer.cancelPendingTarget();
            }
            setPendingUpcoming(null);
            handleContinuousPlaybackChange(false);
          }}
        />
      ) : null}
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
        ) : null}

        <section className="library-narration-tools" aria-label="绘本朗读">
          <LibraryNarrationToolbar
            favoriteControl={contentType === "library" ? <LibraryFavoriteButton contentId={contentId} compact toolbar /> : undefined}
            playlistControl={playlist.length ? <LibraryPlaylist books={playlist} currentId={contentId} playing={playbackStatus === "playing"} /> : undefined}
            key={storyKey}
            autoStart={autoStart && progressReady}
            continuousPlayback={continuousPlayback}
            continuousActive={continuousPlayback && !bedtimeMode && playlist.length > 1}
            onContinuousPlaybackChange={playlist.length > 1 && !bedtimeMode ? handleContinuousPlaybackChange : undefined}
            chineseAudio={chineseAudio}
            pages={pages}
            storyKey={storyKey}
            contentId={contentId}
            bookTitle={title}
            bookHref={currentBookHref}
            bookCover={currentBookCover}
            seriesTitle={seriesTitle}
            playlist={playlist}
            currentPageIndex={pageIndex}
            turnModeActive={readerMode === "turn"}
            compactControls={!bedtimeMode}
            readerMode={readerMode}
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
            onReaderModeChange={setReaderMode}
            onEnterBedtimeMode={enterBedtimeMode}
            onBookFinished={handleBookFinished}
          />
        </section>

        <LibraryBookReader
          title={title}
          pages={pages}
          accent={accent}
          pageIndex={pageIndex}
          readerMode={readerMode}
          playbackActive={playbackStatus === "playing" || playbackStatus === "loading"}
          narrationHighlight={narrationHighlight}
          playbackPositionMs={playbackPositionMs}
          playbackDurationMs={playbackDurationMs}
          showToolbar={false}
          onRetryIllustration={onRetryIllustration}
          isIllustrationRetryable={isIllustrationRetryable}
          getIllustrationStatusDetail={getIllustrationStatusDetail}
          retryingIllustrationPages={retryingIllustrationPages}
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

      {!bedtimeMode && floatingActions ? (
        <LibraryBookFloatingActions
          {...floatingActions}
          title={title}
          contentId={contentId}
          pageNumbers={pages.map((page) => page.page)}
          currentPage={readerMode === "turn" ? pages[pageIndex]?.page : undefined}
        />
      ) : null}
    </section>
  );
}
