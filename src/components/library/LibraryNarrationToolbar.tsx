"use client";

import { useCallback, useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  ArrowClockwise,
  GearSix,
  MoonStars,
  Pause,
  Play,
  SpinnerGap,
  Stop,
} from "@phosphor-icons/react";
import type { ReaderMode } from "@/components/library/LibraryBookReader";
import {
  getBrowserNarrationSegments,
  pickBrowserVoice,
  type BrowserNarrationMode,
  type BrowserNarrationSegment,
} from "@/lib/browser-narration";
import {
  createNarrationCacheKey,
  deleteCachedNarrationAudio,
  getCachedNarrationAudio,
  setCachedNarrationAudio,
} from "@/lib/client-audio-cache";
import {
  createInitialPlaybackState,
  playbackReducer,
  type PlaybackError,
  type PlaybackState,
} from "@/lib/reader/playback-machine";
import { BookAudioTransport, type BookAudio } from "@/lib/reader/book-audio-transport";
import {
  nextSeriesBook,
  type SeriesPlaylistItem,
} from "@/lib/reader/continuous-playback";
import { prefetchAnnouncementAudio } from "@/lib/reader/next-book-announcement";
import {
  seriesAudioPlayer,
  type SeriesPlayerState,
} from "@/lib/reader/series-audio-player";
import {
  clearAudioElementHandlers,
  clearMediaSession,
  getSharedAudioElement,
  updateMediaSession,
} from "@/lib/reader/shared-audio-element";
import type { StoryPage } from "@/types";

const NARRATION_OPTIONS: Array<{
  mode: BrowserNarrationMode;
  label: string;
}> = [
  { mode: "zh", label: "中文" },
  { mode: "en", label: "English" },
  { mode: "zh-en", label: "中英双语" },
];

const CLOUD_REQUEST_TIMEOUT_MS = 45_000;
const INLINE_AUDIO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CloudNarrationResult = {
  audioUrl: string;
  cacheKey: string;
  model?: string;
  voice?: string;
  format?: string;
  bytes?: number;
  cached?: boolean;
  signedUrlExpiresAt?: string;
};

class AudioRequestTimeoutError extends Error {
  constructor() {
    super("云端朗读准备超时。");
    this.name = "AudioRequestTimeoutError";
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function providerLabel(model?: string) {
  if (model === "qwen-audio-3.0-tts-plus") return "百炼 TTS";
  if (model?.startsWith("gemini-")) return "备用 Gemini TTS";
  if (model === "edge-tts") return "备用 Edge TTS";
  return "云端 TTS";
}

function cachedAudioIsUsable(input: {
  audioUrl: string;
  signedUrlExpiresAt?: string;
  updatedAt: number;
}) {
  if (input.audioUrl.startsWith("data:audio/")) {
    return Date.now() - input.updatedAt < INLINE_AUDIO_CACHE_TTL_MS;
  }
  if (input.signedUrlExpiresAt) {
    return (
      new Date(input.signedUrlExpiresAt).getTime() > Date.now() + 60_000
    );
  }
  return input.audioUrl.startsWith("/") && Date.now() - input.updatedAt < 86_400_000;
}

function toPlaybackError(error: unknown): PlaybackError {
  if (error instanceof AudioRequestTimeoutError) {
    return {
      code: "audio_timeout",
      message: "播放准备超时，请检查网络后重试。",
      retryable: true,
    };
  }
  return {
    code: isAbortError(error) ? "audio_aborted" : "audio_failed",
    message:
      error instanceof Error && error.message
        ? error.message
        : "播放失败，点击重试。",
    retryable: !isAbortError(error),
  };
}

export default function LibraryNarrationToolbar({
  pages,
  autoStart = false,
  continuousPlayback = false,
  continuousActive = false,
  onContinuousPlaybackChange,
  chineseAudio,
  storyKey,
  contentId,
  bookTitle,
  bookHref,
  bookCover,
  seriesTitle,
  playlist = [],
  currentPageIndex,
  turnModeActive,
  compactControls = false,
  playlistControl,
  favoriteControl,
  readerMode = "turn",
  languageMode,
  autoAdvance,
  initialPositionMs = 0,
  resumeLabel,
  preferCloudTts = true,
  onPageIndexChange,
  onLanguageModeChange,
  onAutoAdvanceChange,
  onHighlightChange,
  onPlaybackStateChange,
  onRequestTurnMode,
  onReaderModeChange,
  onEnterBedtimeMode,
  onBookFinished,
}: {
  autoStart?: boolean;
  continuousPlayback?: boolean;
  continuousActive?: boolean;
  onContinuousPlaybackChange?: (enabled: boolean) => void;
  pages: StoryPage[];
  chineseAudio?: BookAudio;
  storyKey: string;
  contentId?: string;
  bookTitle?: string;
  bookHref?: string;
  bookCover?: string;
  seriesTitle?: string;
  playlist?: SeriesPlaylistItem[];
  currentPageIndex: number;
  turnModeActive: boolean;
  compactControls?: boolean;
  playlistControl?: ReactNode;
  favoriteControl?: ReactNode;
  readerMode?: ReaderMode;
  languageMode: BrowserNarrationMode;
  autoAdvance: boolean;
  initialPositionMs?: number;
  resumeLabel?: string | null;
  preferCloudTts?: boolean;
  onPageIndexChange: (pageIndex: number) => void;
  onLanguageModeChange: (mode: BrowserNarrationMode) => void;
  onAutoAdvanceChange: (autoAdvance: boolean) => void;
  onHighlightChange: (mode: BrowserNarrationMode | null) => void;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onRequestTurnMode: () => void;
  onReaderModeChange?: (mode: ReaderMode) => void;
  onEnterBedtimeMode?: () => void;
  onBookFinished?: () => boolean;
}) {
  const [state, dispatch] = useReducer(
    playbackReducer,
    createInitialPlaybackState({
      pageIndex: currentPageIndex,
      languageMode,
      autoAdvance,
      positionMs: initialPositionMs,
    }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const currentPageIndexRef = useRef(currentPageIndex);
  currentPageIndexRef.current = currentPageIndex;
  const runRef = useRef(0);
  const autoStartedRef = useRef(false);
  const restartBookPendingRef = useRef(false);
  const bookTransportRef = useRef<BookAudioTransport | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const browserCancelRef = useRef<(() => void) | null>(null);
  const browserHighlightRef = useRef<BrowserNarrationMode | null>(null);
  const pausedBrowserHighlightRef = useRef<BrowserNarrationMode | null>(null);
  const sessionAbortRef = useRef<AbortController | null>(null);
  const cloudAudioCacheRef = useRef(
    new Map<string, Promise<CloudNarrationResult>>(),
  );
  const resolvedCloudAudioRef = useRef(
    new Map<string, CloudNarrationResult>(),
  );
  const previousPageIndexRef = useRef(currentPageIndex);
  const previousLanguageModeRef = useRef(languageMode);
  const languageRestartRef = useRef(false);
  const initialPositionConsumedRef = useRef(false);
  const lastPositionSecondRef = useRef(-1);
  const lastSeriesPhaseRef = useRef<string | null>(null);
  const lastSeriesPositionSecondRef = useRef(-1);
  const lastSeriesPageRef = useRef(-1);
  const attachedToSeriesRef = useRef(false);
  const handoffUnsubRef = useRef<(() => void) | null>(null);

  const usesSeriesPlayer = Boolean(
    preferCloudTts &&
      contentId &&
      ((languageMode === "zh" && chineseAudio) || bookHref),
  );

  const getAudioElement = useCallback(() => {
    return getSharedAudioElement() ?? audioRef.current;
  }, []);

  const setHighlight = useCallback(
    (highlight: BrowserNarrationMode | null) => {
      browserHighlightRef.current = highlight;
      dispatch({ type: "HIGHLIGHT_CHANGED", highlight });
      onHighlightChange(highlight);
    },
    [onHighlightChange],
  );

  const clearMedia = useCallback(
    (removeSource = false) => {
      bookTransportRef.current?.destroy();
      bookTransportRef.current = null;
      browserCancelRef.current?.();
      browserCancelRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      const audio = getAudioElement();
      if (!audio) return;
      clearAudioElementHandlers(audio);
      audio.pause();
      if (removeSource) {
        audio.removeAttribute("src");
        audio.load();
      }
    },
    [getAudioElement],
  );

  const cancelCurrentSession = useCallback(
    (stopSeries = true) => {
      runRef.current += 1;
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = null;
      handoffUnsubRef.current?.();
      handoffUnsubRef.current = null;
      if (stopSeries && contentId && seriesAudioPlayer.ownsBook(contentId)) {
        seriesAudioPlayer.stop();
        lastSeriesPhaseRef.current = null;
        lastSeriesPositionSecondRef.current = -1;
        lastSeriesPageRef.current = -1;
      } else if (!seriesAudioPlayer.isActive()) {
        clearMedia(false);
        clearMediaSession();
      }
      setHighlight(null);
      pausedBrowserHighlightRef.current = null;
      lastPositionSecondRef.current = -1;
    },
    [clearMedia, contentId, setHighlight],
  );

  const requestCloudAudio = useCallback(
    (pageIndex: number, mode: BrowserNarrationMode, signal: AbortSignal) => {
      const page = pages[pageIndex];
      const segments = page ? getBrowserNarrationSegments([page], mode) : [];
      if (!segments.length) {
        return Promise.reject(
          new Error("当前页面在这个语言模式下没有可朗读文本。"),
        );
      }

      const memoryKey = `${storyKey}:${pageIndex}:${mode}`;
      const existing = cloudAudioCacheRef.current.get(memoryKey);
      if (existing) return existing;

      const text = segments.map((segment) => segment.text).join("\n\n");
      const request = (async () => {
        const pageStoryId = `${storyKey}:${pageIndex}`;
        const { key, textHash } = await createNarrationCacheKey(
          pageStoryId,
          mode,
          "qwen-audio-3.0-tts-plus",
          text,
        );
        const cached = await getCachedNarrationAudio(key);
        if (cached?.model === "qwen-audio-3.0-tts-plus" && cachedAudioIsUsable(cached)) {
          const normalizedCached = {
            audioUrl: cached.audioUrl,
            cacheKey: key,
            model: cached.model,
            voice: cached.voice,
            format: cached.format,
            bytes: cached.bytes,
            cached: true,
            signedUrlExpiresAt: cached.signedUrlExpiresAt,
          } satisfies CloudNarrationResult;
          resolvedCloudAudioRef.current.set(memoryKey, normalizedCached);
          return normalizedCached;
        }

        const requestController = new AbortController();
        let timedOut = false;
        const abortRequest = () => requestController.abort();
        signal.addEventListener("abort", abortRequest, { once: true });
        const timeout = window.setTimeout(() => {
          timedOut = true;
          requestController.abort();
        }, CLOUD_REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch("/api/audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, mode, model: "qwen-audio-3.0-tts-plus", sampleRate: 24000 }),
            signal: requestController.signal,
          });
          const result = (await response.json().catch(() => null)) as {
            audioUrl?: string;
            model?: string;
            voice?: string;
            format?: string;
            bytes?: number;
            cached?: boolean;
            signedUrlExpiresAt?: string;
            error?: string;
          } | null;
          if (!response.ok || !result?.audioUrl) {
            throw new Error(result?.error || "云端朗读暂时不可用。");
          }
          if (result.model !== "qwen-audio-3.0-tts-plus") {
            throw new Error("百炼朗读返回异常，请重试。");
          }
          const normalized = {
            audioUrl: result.audioUrl,
            cacheKey: key,
            model: result.model,
            voice: result.voice,
            format: result.format,
            bytes: result.bytes,
            cached: result.cached,
            signedUrlExpiresAt: result.signedUrlExpiresAt,
          } satisfies CloudNarrationResult;
          void setCachedNarrationAudio({
            key,
            storyId: pageStoryId,
            mode,
            voice: "configured",
            textHash,
            audioUrl: normalized.audioUrl,
            model: normalized.model,
            format: normalized.format,
            bytes: normalized.bytes,
            signedUrlExpiresAt: normalized.signedUrlExpiresAt,
            updatedAt: Date.now(),
          });
          resolvedCloudAudioRef.current.set(memoryKey, normalized);
          return normalized;
        } catch (error) {
          if (timedOut) throw new AudioRequestTimeoutError();
          throw error;
        } finally {
          window.clearTimeout(timeout);
          signal.removeEventListener("abort", abortRequest);
        }
      })();

      cloudAudioCacheRef.current.set(memoryKey, request);
      void request.catch(() => {
        if (cloudAudioCacheRef.current.get(memoryKey) === request) {
          cloudAudioCacheRef.current.delete(memoryKey);
        }
      });
      return request;
    },
    [pages, storyKey],
  );

  const speakSegment = useCallback((segment: BrowserNarrationSegment) => {
    return new Promise<void>((resolve, reject) => {
      if (
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        reject(new Error("当前浏览器不支持本机语音朗读。"));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      utterance.rate = segment.lang === "zh-CN" ? 0.88 : 0.92;
      utterance.pitch = 1;
      utterance.voice = pickBrowserVoice(
        window.speechSynthesis.getVoices(),
        segment.lang,
      );

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (browserCancelRef.current === finish) {
          browserCancelRef.current = null;
        }
        resolve();
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        if (browserCancelRef.current === finish) {
          browserCancelRef.current = null;
        }
        reject(new Error("本机语音朗读失败，请检查浏览器语音设置。"));
      };

      browserCancelRef.current = finish;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") {
          finish();
          return;
        }
        fail();
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const finishPage = useCallback(
    (runId: number, pageIndex: number) => {
      if (runRef.current !== runId) return;
      setHighlight(null);
      if (stateRef.current.autoAdvance && pageIndex < pages.length - 1) {
        const nextPageIndex = pageIndex + 1;
        dispatch({ type: "PAGE_ENDED", nextPageIndex });
        onPageIndexChange(nextPageIndex);
        return;
      }
      if (pageIndex === pages.length - 1) {
        const handedOff = onBookFinished?.() ?? false;
        if (!handedOff) {
          clearMediaSession();
        }
        dispatch({ type: "BOOK_ENDED" });
        return;
      }
      clearMediaSession();
      dispatch({
        type: "PAGE_ENDED",
        message: "当前页已播放完毕；自动翻页已关闭。",
      });
    },
    [onBookFinished, onPageIndexChange, pages.length, setHighlight],
  );

  const failPlayback = useCallback(
    (error: unknown) => {
      cancelCurrentSession();
      const playbackError = toPlaybackError(error);
      if (playbackError.code === "audio_aborted") return;
      dispatch({ type: "FAILED", error: playbackError });
    },
    [cancelCurrentSession],
  );

  const playBrowserFallback = useCallback(
    async (
      runId: number,
      pageIndex: number,
      mode: BrowserNarrationMode,
      segments: BrowserNarrationSegment[],
      reason: string,
      cloudAttempted = true,
    ) => {
      if (runRef.current !== runId) return;
      dispatch({
        type: "PLAY_STARTED",
        source: "browser",
        message: cloudAttempted
          ? `${reason}，已切换本机系统语音。`
          : "本机系统语音 · 不调用付费 TTS。",
      });
      for (const segment of segments) {
        if (runRef.current !== runId) return;
        setHighlight(segment.lang === "zh-CN" ? "zh" : "en");
        await speakSegment(segment);
      }
      if (runRef.current === runId) {
        finishPage(runId, pageIndex);
      }
    },
    [finishPage, setHighlight, speakSegment],
  );

  const playResolvedCloudPageRef = useRef<
    (
      runId: number,
      targetPageIndex: number,
      mode: BrowserNarrationMode,
      result: CloudNarrationResult,
      resumeFromMs: number,
      signal: AbortSignal,
    ) => void
  >(() => undefined);

  const playResolvedCloudPage = useCallback(
    (
      runId: number,
      targetPageIndex: number,
      mode: BrowserNarrationMode,
      result: CloudNarrationResult,
      resumeFromMs: number,
      signal: AbortSignal,
    ) => {
      if (runRef.current !== runId) return;
      const audio = getAudioElement();
      if (!audio) {
        failPlayback(new Error("浏览器音频播放器未准备好。"));
        return;
      }

      const label = providerLabel(result.model);
      lastPositionSecondRef.current = -1;
      clearAudioElementHandlers(audio);
      audio.src = result.audioUrl;
      audio.preload = "auto";
      audio.onloadedmetadata = () => {
        if (runRef.current !== runId) return;
        const durationMs = Number.isFinite(audio.duration)
          ? audio.duration * 1000
          : 0;
        if (
          resumeFromMs > 0 &&
          Number.isFinite(audio.duration) &&
          resumeFromMs < durationMs - 500
        ) {
          audio.currentTime = resumeFromMs / 1000;
        }
        dispatch({
          type: "POSITION_CHANGED",
          positionMs: audio.currentTime * 1000,
          durationMs,
        });
      };
      audio.ontimeupdate = () => {
        if (runRef.current !== runId) return;
        const positionSecond = Math.floor(audio.currentTime);
        if (positionSecond === lastPositionSecondRef.current) return;
        lastPositionSecondRef.current = positionSecond;
        dispatch({
          type: "POSITION_CHANGED",
          positionMs: audio.currentTime * 1000,
          durationMs: Number.isFinite(audio.duration)
            ? audio.duration * 1000
            : 0,
        });
      };
      audio.onplay = () => {
        if (runRef.current !== runId) return;
        dispatch({
          type: "PLAY_STARTED",
          source: "cloud",
          message: `第 ${targetPageIndex + 1} 页 · ${label}${
            result.cached ? " · 已复用音频" : ""
          }`,
        });
        setHighlight(mode);
        if (bookTitle) {
          updateMediaSession({
            title: bookTitle,
            artist: seriesTitle || "StoryBloom 绘本馆",
            album: "StoryBloom 绘本馆",
            cover: bookCover,
            playbackState: "playing",
            handlers: {
              play: () => {
                void audio.play().catch(() => undefined);
              },
              pause: () => audio.pause(),
              stop: () => {
                cancelCurrentSession();
                dispatch({ type: "STOPPED" });
              },
            },
          });
        }
      };
      audio.onpause = () => {
        if (
          runRef.current === runId &&
          !audio.ended &&
          stateRef.current.status === "playing"
        ) {
          dispatch({
            type: "PAUSED",
            positionMs: audio.currentTime * 1000,
          });
          setHighlight(null);
          if (bookTitle) {
            updateMediaSession({
              title: bookTitle,
              artist: seriesTitle || "StoryBloom 绘本馆",
              album: "StoryBloom 绘本馆",
              cover: bookCover,
              playbackState: "paused",
            });
          }
        }
      };
      audio.onended = () => {
        if (runRef.current !== runId) return;
        if (stateRef.current.autoAdvance && targetPageIndex < pages.length - 1) {
          const nextPageIndex = targetPageIndex + 1;
          const nextResolved = resolvedCloudAudioRef.current.get(
            `${storyKey}:${nextPageIndex}:${mode}`,
          );
          if (nextResolved) {
            // Chain synchronously inside `onended` on the same unlocked <audio>
            // element so mobile screen-off playback keeps its OS audio session.
            previousPageIndexRef.current = nextPageIndex;
            dispatch({ type: "PAGE_ENDED", nextPageIndex });
            onPageIndexChange(nextPageIndex);
            playResolvedCloudPageRef.current(
              runId,
              nextPageIndex,
              mode,
              nextResolved,
              0,
              signal,
            );
            return;
          }
        }
        finishPage(runId, targetPageIndex);
      };
      audio.onerror = () => {
        if (runRef.current !== runId) return;
        audio.onerror = null;
        audio.pause();
        const failedKey = `${storyKey}:${targetPageIndex}:${mode}`;
        cloudAudioCacheRef.current.delete(failedKey);
        resolvedCloudAudioRef.current.delete(failedKey);
        void deleteCachedNarrationAudio(result.cacheKey);
        failPlayback(new Error("百炼音频加载失败，请重试。"));
      };
      audio.load();

      const nextPageIndex = targetPageIndex + 1;
      if (nextPageIndex < pages.length) {
        void requestCloudAudio(nextPageIndex, mode, signal).catch(() => undefined);
      }
      if (continuousActive && contentId && playlist.length > 0 && preferCloudTts) {
        const upcoming = nextSeriesBook(playlist, contentId);
        if (upcoming) {
          void prefetchAnnouncementAudio(upcoming, mode, { signal });
        }
      }

      void audio.play().catch(() => {
        if (runRef.current !== runId) return;
        dispatch({
          type: "AUTOPLAY_BLOCKED",
          source: "cloud",
          message: `第 ${targetPageIndex + 1} 页 · ${label} 已准备好，请再次点击继续播放。`,
        });
        setHighlight(null);
      });
    },
    [
      bookCover,
      bookTitle,
      cancelCurrentSession,
      contentId,
      continuousActive,
      failPlayback,
      finishPage,
      getAudioElement,
      onPageIndexChange,
      pages.length,
      playlist,
      preferCloudTts,
      requestCloudAudio,
      seriesTitle,
      setHighlight,
      storyKey,
    ],
  );
  playResolvedCloudPageRef.current = playResolvedCloudPage;

  const startPagePlayback = useCallback(
    async (resumeFromMs = 0) => {
      const pageIndex = currentPageIndex;
      const mode = languageMode;
      const page = pages[pageIndex];
      const segments = page ? getBrowserNarrationSegments([page], mode) : [];
      if (!segments.length) {
        failPlayback(new Error("当前页面在这个语言模式下没有可朗读文本。"));
        return;
      }

      if (usesSeriesPlayer && contentId) {
        runRef.current += 1;
        sessionAbortRef.current?.abort();
        sessionAbortRef.current = null;
        handoffUnsubRef.current?.();
        handoffUnsubRef.current = null;
        browserCancelRef.current?.();
        browserCancelRef.current = null;
        lastSeriesPhaseRef.current = null;
        lastSeriesPositionSecondRef.current = -1;
        lastSeriesPageRef.current = -1;
        const currentBook: SeriesPlaylistItem =
          playlist.find((item) => item.id === contentId) ?? {
            id: contentId,
            title: bookTitle || storyKey,
            href: bookHref || "",
            cover: bookCover,
            chineseAudio,
          };
        if (mode === "zh" && chineseAudio) {
          const bookWithAudio = currentBook.chineseAudio
            ? currentBook
            : { ...currentBook, chineseAudio };
          seriesAudioPlayer.startBook({
            book: bookWithAudio,
            playlist,
            seriesTitle,
            pageIndex,
            resumeFromMs,
            autoAdvance: stateRef.current.autoAdvance,
            continuousPlayback: continuousActive,
            preferCloudTts,
          });
          return;
        }
        seriesAudioPlayer.startPerPageBook({
          book: currentBook,
          pages,
          storyKey,
          mode,
          playlist,
          seriesTitle,
          pageIndex,
          resumeFromMs,
          autoAdvance: stateRef.current.autoAdvance,
          continuousPlayback: continuousActive,
          preferCloudTts,
          onBookFinished,
        });
        return;
      }

      if (seriesAudioPlayer.isActive()) {
        seriesAudioPlayer.stop();
      }
      cancelCurrentSession();
      const controller = new AbortController();
      sessionAbortRef.current = controller;
      const runId = runRef.current + 1;
      runRef.current = runId;
      dispatch({
        type: "PLAY_REQUESTED",
        message: `正在准备第 ${pageIndex + 1} 页…`,
      });

      if (preferCloudTts && mode === "zh" && chineseAudio) {
        const audio = getAudioElement();
        if (!audio) { failPlayback(new Error("浏览器音频播放器未准备好。")); return; }
        bookTransportRef.current = new BookAudioTransport(audio, chineseAudio, pageIndex, resumeFromMs, {
          autoAdvance: () => stateRef.current.autoAdvance,
          position: (index, positionMs, durationMs) => {
            if (runRef.current !== runId) return;
            dispatch({ type: "TIMELINE_POSITION", pageIndex: index, positionMs, durationMs });
            if (previousPageIndexRef.current !== index) onPageIndexChange(index);
          },
          playing: () => {
            if (runRef.current !== runId) return;
            dispatch({ type: "PLAY_STARTED", source: "cloud", message: "中文连续朗读 · 已准备好" });
            setHighlight("zh");
          },
          paused: positionMs => {
            if (runRef.current !== runId) return;
            dispatch({ type: "PAUSED", positionMs }); setHighlight(null);
          },
          ended: index => finishPage(runId, index),
          error: () => { if (runRef.current === runId) failPlayback(new Error("中文音频加载失败，请检查网络后重试。")); },
        });
        try { await audio.play(); }
        catch {
          if (runRef.current === runId) {
            dispatch({ type: "AUTOPLAY_BLOCKED", source: "cloud", message: "音频已准备好，请点击继续播放。" });
            setHighlight(null);
          }
        }
        return;
      }

      if (!preferCloudTts) {
        try {
          await playBrowserFallback(
            runId,
            pageIndex,
            mode,
            segments,
            "本机系统语音",
            false,
          );
        } catch (error) {
          if (runRef.current === runId) failPlayback(error);
        }
        return;
      }

      const memoryKey = `${storyKey}:${pageIndex}:${mode}`;
      const preResolved = resolvedCloudAudioRef.current.get(memoryKey);
      if (preResolved) {
        playResolvedCloudPage(
          runId,
          pageIndex,
          mode,
          preResolved,
          resumeFromMs,
          controller.signal,
        );
        return;
      }

      try {
        const result = await requestCloudAudio(pageIndex, mode, controller.signal);
        if (runRef.current !== runId) return;
        playResolvedCloudPage(
          runId,
          pageIndex,
          mode,
          result,
          resumeFromMs,
          controller.signal,
        );
      } catch (error) {
        if (runRef.current !== runId || isAbortError(error)) return;
        const reason =
          error instanceof AudioRequestTimeoutError
            ? "云端朗读准备超时"
            : "云端朗读暂不可用";
        failPlayback(new Error(`${reason}，请重试。`));
      }
    },
    [
      bookCover,
      bookHref,
      bookTitle,
      cancelCurrentSession,
      chineseAudio,
      contentId,
      continuousActive,
      currentPageIndex,
      failPlayback,
      finishPage,
      getAudioElement,
      languageMode,
      onBookFinished,
      onPageIndexChange,
      pages,
      playBrowserFallback,
      playResolvedCloudPage,
      playlist,
      preferCloudTts,
      requestCloudAudio,
      seriesTitle,
      setHighlight,
      storyKey,
      usesSeriesPlayer,
    ],
  );

  const pausePlayback = useCallback(() => {
    if (usesSeriesPlayer && contentId && seriesAudioPlayer.getActiveStateForBook(contentId)) {
      seriesAudioPlayer.pause();
      return;
    }
    const current = stateRef.current;
    if (current.status !== "playing") return;
    if (current.source === "cloud") {
      const audio = getAudioElement();
      if (!audio) return;
      audio.pause();
      return;
    }
    if (current.source === "browser" && "speechSynthesis" in window) {
      pausedBrowserHighlightRef.current = browserHighlightRef.current;
      window.speechSynthesis.pause();
      dispatch({ type: "PAUSED" });
      setHighlight(null);
    }
  }, [contentId, getAudioElement, setHighlight, usesSeriesPlayer]);

  const resumePlayback = useCallback(async () => {
    if (usesSeriesPlayer && contentId && seriesAudioPlayer.getActiveStateForBook(contentId)) {
      await seriesAudioPlayer.resume();
      return;
    }
    const current = stateRef.current;
    if (current.status !== "paused") return;
    if (current.source === "cloud") {
      const audio = getAudioElement();
      if (!audio?.src) {
        await startPagePlayback(0);
        return;
      }
      try {
        await audio.play();
      } catch {
        dispatch({
          type: "FAILED",
          error: {
            code: "autoplay_blocked",
            message: "浏览器阻止了音频播放，请再次点击重试。",
            retryable: true,
          },
        });
      }
      return;
    }
    if (current.source === "browser" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      dispatch({ type: "RESUMED" });
      setHighlight(pausedBrowserHighlightRef.current || languageMode);
      pausedBrowserHighlightRef.current = null;
      return;
    }
    await startPagePlayback(0);
  }, [contentId, getAudioElement, languageMode, setHighlight, startPagePlayback, usesSeriesPlayer]);

  const stopPlayback = useCallback(() => {
    cancelCurrentSession();
    dispatch({ type: "STOPPED" });
  }, [cancelCurrentSession]);

  const replayCurrentPage = useCallback(() => {
    initialPositionConsumedRef.current = true;
    void startPagePlayback(0);
  }, [startPagePlayback]);

  const restartBook = useCallback(() => {
    cancelCurrentSession();
    initialPositionConsumedRef.current = true;
    restartBookPendingRef.current = true;
    dispatch({ type: "PAGE_SELECTED", pageIndex: 0, continuePlayback: false });
    onRequestTurnMode();
    onPageIndexChange(0);
  }, [cancelCurrentSession, onPageIndexChange, onRequestTurnMode]);

  const handlePrimaryAction = useCallback(() => {
    if (!turnModeActive) onRequestTurnMode();
    switch (stateRef.current.status) {
      case "loading":
        return;
      case "playing":
        pausePlayback();
        return;
      case "paused":
        void resumePlayback();
        return;
      case "ended":
        restartBook();
        return;
      case "error":
        replayCurrentPage();
        return;
      case "idle":
      default: {
        const position = initialPositionConsumedRef.current
          ? 0
          : initialPositionMs;
        initialPositionConsumedRef.current = true;
        void startPagePlayback(position);
      }
    }
  }, [
    initialPositionMs,
    onRequestTurnMode,
    pausePlayback,
    replayCurrentPage,
    restartBook,
    resumePlayback,
    startPagePlayback,
    turnModeActive,
  ]);

  const handleLanguageModeChange = useCallback(
    (nextMode: BrowserNarrationMode) => {
      if (nextMode === languageMode) return;
      languageRestartRef.current =
        stateRef.current.status === "loading" ||
        stateRef.current.status === "playing" ||
        stateRef.current.status === "paused";
      cancelCurrentSession();
      onLanguageModeChange(nextMode);
    }, [cancelCurrentSession, languageMode, onLanguageModeChange],
  );

  const applySeriesSnapshot = useCallback(
    (snapshot: SeriesPlayerState) => {
      if (!contentId) return;
      if (snapshot.phase === "idle") {
        if (attachedToSeriesRef.current) {
          attachedToSeriesRef.current = false;
          lastSeriesPhaseRef.current = null;
          lastSeriesPositionSecondRef.current = -1;
          lastSeriesPageRef.current = -1;
          dispatch({ type: "STOPPED" });
          setHighlight(null);
        }
        return;
      }
      if (snapshot.bookId !== contentId || snapshot.handoffOnly) {
        return;
      }
      attachedToSeriesRef.current = true;
      if (snapshot.pageIndex !== lastSeriesPageRef.current) {
        lastSeriesPageRef.current = snapshot.pageIndex;
        if (snapshot.pageIndex !== currentPageIndexRef.current) {
          previousPageIndexRef.current = snapshot.pageIndex;
          onPageIndexChange(snapshot.pageIndex);
        }
      }
      const posSecond = Math.floor(snapshot.positionMs / 1000);
      if (
        posSecond !== lastSeriesPositionSecondRef.current ||
        stateRef.current.pageIndex !== snapshot.pageIndex ||
        stateRef.current.durationMs !== snapshot.durationMs
      ) {
        lastSeriesPositionSecondRef.current = posSecond;
        dispatch({
          type: "TIMELINE_POSITION",
          pageIndex: snapshot.pageIndex,
          positionMs: snapshot.positionMs,
          durationMs: snapshot.durationMs,
        });
      }
      const phaseKey = `${snapshot.phase}:${snapshot.message ?? ""}:${snapshot.error?.message ?? ""}`;
      if (phaseKey === lastSeriesPhaseRef.current) return;
      lastSeriesPhaseRef.current = phaseKey;

      switch (snapshot.phase) {
        case "loading":
          dispatch({
            type: "PLAY_REQUESTED",
            message: snapshot.message ?? `正在准备第 ${snapshot.pageIndex + 1} 页…`,
          });
          setHighlight(null);
          break;
        case "playing":
          dispatch({
            type: "PLAY_STARTED",
            source: "cloud",
            message: snapshot.message ?? "中文连续朗读 · 已准备好",
          });
          setHighlight(snapshot.languageMode);
          break;
        case "paused":
          if (snapshot.message?.includes("请点击继续播放")) {
            dispatch({
              type: "AUTOPLAY_BLOCKED",
              source: "cloud",
              message: snapshot.message,
            });
          } else {
            dispatch({
              type: "PAUSED",
              positionMs: snapshot.positionMs,
            });
          }
          setHighlight(null);
          break;
        case "announcing":
          dispatch({
            type: "BOOK_ENDED",
            message: snapshot.message ?? "即将播放下一本故事",
          });
          setHighlight(null);
          break;
        case "ended":
          if (snapshot.pageIndex === pages.length - 1) {
            dispatch({
              type: "BOOK_ENDED",
              message: snapshot.message ?? "整本绘本已播放完毕",
            });
          } else {
            dispatch({
              type: "PAGE_ENDED",
              message: snapshot.message ?? "当前页已播放完毕；自动翻页已关闭。",
            });
          }
          setHighlight(null);
          break;
        case "error":
          dispatch({
            type: "FAILED",
            error: snapshot.error ?? {
              code: "audio_failed",
              message: "播放失败，点击重试。",
              retryable: true,
            },
          });
          setHighlight(null);
          break;
        default:
          dispatch({ type: "STOPPED" });
          setHighlight(null);
          break;
      }
    },
    [contentId, onPageIndexChange, pages.length, setHighlight],
  );

  useEffect(() => {
    if (!usesSeriesPlayer || !contentId) return;
    const active = seriesAudioPlayer.getActiveStateForBook(contentId);
    if (active) {
      initialPositionConsumedRef.current = true;
      autoStartedRef.current = true;
      applySeriesSnapshot(active);
    }
    return seriesAudioPlayer.subscribe((snapshot) => {
      applySeriesSnapshot(snapshot);
    });
  }, [applySeriesSnapshot, contentId, usesSeriesPlayer]);

  useEffect(() => {
    if (!contentId) return;
    seriesAudioPlayer.syncSettings(contentId, {
      continuousPlayback: continuousActive,
      autoAdvance,
      playlist,
      seriesTitle,
      preferCloudTts,
      onPerPageBookFinished: onBookFinished,
    });
  }, [autoAdvance, contentId, continuousActive, onBookFinished, playlist, preferCloudTts, seriesTitle]);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") {
        seriesAudioPlayer.syncVisibility();
        bookTransportRef.current?.sync();
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    return () => { document.removeEventListener("visibilitychange", sync); window.removeEventListener("pageshow", sync); };
  }, []);

  useEffect(() => {
    onPlaybackStateChange?.(state);
  }, [onPlaybackStateChange, state]);

  useEffect(() => {
    const activeSeries =
      contentId && usesSeriesPlayer
        ? seriesAudioPlayer.getActiveStateForBook(contentId)
        : null;
    const activeHandoff = Boolean(
      contentId && seriesAudioPlayer.isPlayingHandoffFor(contentId),
    );
    cloudAudioCacheRef.current.clear();
    resolvedCloudAudioRef.current.clear();
    lastSeriesPhaseRef.current = null;
    lastSeriesPositionSecondRef.current = -1;
    lastSeriesPageRef.current = -1;

    if (activeSeries) {
      previousPageIndexRef.current = activeSeries.pageIndex;
      previousLanguageModeRef.current = languageMode;
      initialPositionConsumedRef.current = true;
      autoStartedRef.current = true;
      applySeriesSnapshot(activeSeries);
      return;
    }

    if (!activeHandoff) {
      cancelCurrentSession(false);
    }
    previousPageIndexRef.current = currentPageIndex;
    previousLanguageModeRef.current = languageMode;
    initialPositionConsumedRef.current = false;
    dispatch({
      type: "RESET",
      pageIndex: currentPageIndex,
      languageMode,
      autoAdvance,
      positionMs: initialPositionMs,
    });
    // Story changes are the only hard reset boundary. Page, language and
    // playback-setting changes are handled by the focused effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyKey]);

  useEffect(() => {
    const previousPageIndex = previousPageIndexRef.current;
    if (previousPageIndex === currentPageIndex) return;
    previousPageIndexRef.current = currentPageIndex;
    if (usesSeriesPlayer && contentId && seriesAudioPlayer.getActiveStateForBook(contentId)) {
      seriesAudioPlayer.selectPage(currentPageIndex);
      return;
    }
    if (languageMode === "zh" && bookTransportRef.current) {
      if (bookTransportRef.current.pageIndex !== currentPageIndex) bookTransportRef.current.selectPage(currentPageIndex);
      return;
    }
    const continuePlayback =
      stateRef.current.status === "playing" ||
      stateRef.current.status === "loading";
    cancelCurrentSession();
    dispatch({
      type: "PAGE_SELECTED",
      pageIndex: currentPageIndex,
      continuePlayback,
    });
    if (continuePlayback) {
      const timer = window.setTimeout(() => void startPagePlayback(0), 0);
      return () => window.clearTimeout(timer);
    }
  }, [cancelCurrentSession, contentId, currentPageIndex, languageMode, startPagePlayback, usesSeriesPlayer]);

  useEffect(() => {
    const previousMode = previousLanguageModeRef.current;
    if (previousMode === languageMode) return;
    previousLanguageModeRef.current = languageMode;
    const restart = languageRestartRef.current;
    languageRestartRef.current = false;
    dispatch({ type: "LANGUAGE_CHANGED", languageMode, restart });
    if (restart) {
      const timer = window.setTimeout(() => void startPagePlayback(0), 0);
      return () => window.clearTimeout(timer);
    }
  }, [languageMode, startPagePlayback]);

  useEffect(() => {
    dispatch({ type: "AUTO_ADVANCE_CHANGED", autoAdvance });
  }, [autoAdvance]);

  useEffect(() => {
    if (!turnModeActive && stateRef.current.status !== "idle") {
      stopPlayback();
    }
  }, [stopPlayback, turnModeActive]);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      sessionAbortRef.current?.abort();
      handoffUnsubRef.current?.();
      handoffUnsubRef.current = null;
      if (!seriesAudioPlayer.isActive()) {
        clearMedia(false);
        clearMediaSession();
      }
      onHighlightChange(null);
    };
  }, [clearMedia, onHighlightChange]);

  // Wait for the controlled page and reading mode before starting page one.
  useEffect(() => {
    if (!restartBookPendingRef.current || currentPageIndex !== 0 || !turnModeActive) return;
    restartBookPendingRef.current = false;
    void startPagePlayback(0);
  });

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || currentPageIndex !== 0 || !turnModeActive) return;
    autoStartedRef.current = true;
    initialPositionConsumedRef.current = true;
    if (contentId && seriesAudioPlayer.isPlayingHandoffFor(contentId)) {
      if (preferCloudTts && languageMode !== "zh") {
        const prefetchController = new AbortController();
        sessionAbortRef.current = prefetchController;
        void requestCloudAudio(0, languageMode, prefetchController.signal).catch(
          () => undefined,
        );
      }
      handoffUnsubRef.current = seriesAudioPlayer.whenHandoffAnnouncementEnds(
        contentId,
        () => {
          handoffUnsubRef.current = null;
          void startPagePlayback(0);
        },
      );
      return;
    }
    void startPagePlayback(0);
  }, [
    autoStart,
    contentId,
    currentPageIndex,
    languageMode,
    preferCloudTts,
    requestCloudAudio,
    startPagePlayback,
    turnModeActive,
  ]);

  const continuousControl = onContinuousPlaybackChange ? (
    <label className="library-auto-advance-toggle">
      <input type="checkbox" checked={continuousPlayback} onChange={event => onContinuousPlaybackChange(event.target.checked)} />
      <span>连续播放：听完后语音提示并播放同系列下一本</span>
    </label>
  ) : null;

  const primaryLabel =
    state.status === "loading"
      ? "正在准备…"
      : state.status === "playing"
        ? "暂停"
        : state.status === "paused"
          ? "继续播放"
          : state.status === "ended"
            ? "重新听"
            : state.status === "error"
              ? "重试播放"
              : resumeLabel || "播放故事";

  const playbackStatusLabel =
    state.status === "loading"
      ? "正在准备"
      : state.status === "playing"
        ? "播放中"
        : state.status === "paused"
          ? "已暂停"
          : state.status === "ended"
            ? "已播放完"
            : state.status === "error"
              ? "播放失败"
              : "等待播放";

  if (compactControls) {
    return (
      <div
        className="library-reader-control-bar"
        data-playback-status={state.status}
      >
        {onEnterBedtimeMode ? (
          <button
            type="button"
            className="library-reader-bedtime-btn"
            aria-label="进入睡前模式"
            title="进入睡前模式"
            onClick={onEnterBedtimeMode}
          >
            <MoonStars aria-hidden="true" weight="fill" />
            <span>睡前</span>
          </button>
        ) : (
          <span className="library-reader-control-spacer" aria-hidden="true" />
        )}

        <div
          className="library-reader-mode-switch"
          role="group"
          aria-label="切换阅读方式"
        >
          <button
            type="button"
            className={`library-reader-mode-btn ${
              readerMode === "turn" ? "library-reader-mode-btn-active" : ""
            }`}
            aria-pressed={readerMode === "turn"}
            onClick={() => onReaderModeChange?.("turn")}
          >
            翻页阅读
          </button>
          <button
            type="button"
            className={`library-reader-mode-btn ${
              readerMode === "grid" ? "library-reader-mode-btn-active" : ""
            }`}
            aria-pressed={readerMode === "grid"}
            onClick={() => onReaderModeChange?.("grid")}
          >
            平铺查看
          </button>
        </div>

        <div className="library-reader-control-actions">
          {favoriteControl}
          <button type="button" className="library-reader-icon-btn" onClick={restartBook} aria-label="重新听" title="重新听">
            <ArrowClockwise aria-hidden="true" />
          </button>
          <span className="library-reader-control-status" aria-live="polite">
            {playbackStatusLabel}
          </span>
          <button
            type="button"
            className="library-reader-icon-btn library-reader-play-btn"
            aria-label={primaryLabel}
            title={primaryLabel}
            onClick={handlePrimaryAction}
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? (
              <SpinnerGap
                aria-hidden="true"
                className="library-reader-control-spinner"
              />
            ) : state.status === "playing" ? (
              <Pause aria-hidden="true" weight="fill" />
            ) : (
              <Play aria-hidden="true" weight="fill" />
            )}
          </button>

          {playlistControl}

          <details className="library-reader-settings-menu">
            <summary
              className="library-reader-icon-btn library-reader-settings-btn"
              aria-label="语言与播放设置"
              title="语言与播放设置"
            >
              <GearSix aria-hidden="true" />
            </summary>
            <div className="library-reader-settings-popover">
              <strong>语言与播放设置</strong>
              <div className="segmented-buttons" role="group" aria-label="朗读语言">
                {NARRATION_OPTIONS.map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    className={`secondary-btn ${
                      languageMode === item.mode ? "secondary-btn-active" : ""
                    }`}
                    aria-pressed={languageMode === item.mode}
                    onClick={() => handleLanguageModeChange(item.mode)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="library-auto-advance-toggle">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(event) => onAutoAdvanceChange(event.target.checked)}
                />
                <span>播放完成后自动翻到下一页</span>
              </label>
              <div className="library-reader-settings-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={replayCurrentPage}
                  disabled={state.status === "loading"}
                >
                  <ArrowClockwise aria-hidden="true" />
                  重播当前页
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={stopPlayback}
                  disabled={state.status === "idle"}
                >
                  <Stop aria-hidden="true" weight="fill" />
                  停止
                </button>
              </div>
              {continuousControl}
              <p>{continuousPlayback && onContinuousPlaybackChange ? "按播放列表顺序播放，切换下一本前会先语音提示，到系列最后一本停止。" : "听完当前绘本后停止。"}</p>
              {state.message ? <p aria-live="polite">{state.message}</p> : null}
            </div>
          </details>
        </div>

        <audio ref={audioRef} preload="metadata" hidden />

        {state.error ? (
          <div
            className="tool-error library-playback-error library-reader-control-error"
            role="alert"
          >
            <span>{state.error.message || "播放失败，点击重试。"}</span>
            {state.error.retryable ? (
              <button type="button" onClick={replayCurrentPage}>
                点击重试
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="tool-panel library-narration-panel" data-playback-status={state.status}>
      <div className="library-narration-heading">
        <div>
          <h3>有声阅读</h3>
          <p>打开即可播放；不需要录音，也不会请求麦克风权限。</p>
        </div>
        <span className="library-playback-state" aria-live="polite">
          {playbackStatusLabel}
        </span>
      </div>

      <div className="library-playback-main-actions">
      {favoriteControl}
      <button type="button" className="library-reader-icon-btn" onClick={restartBook} aria-label="重新听" title="重新听">
        <ArrowClockwise aria-hidden="true" />
      </button>
      <button
        type="button"
        className="library-playback-primary"
        onClick={handlePrimaryAction}
        disabled={state.status === "loading"}
      >
        {state.status === "playing" ? (
          <Pause aria-hidden="true" weight="fill" />
        ) : (
          <Play aria-hidden="true" weight="fill" />
        )}
        {primaryLabel}
      </button>
      {playlistControl}
      </div>

      <div className="library-playback-secondary-actions">
        <button
          type="button"
          className="secondary-btn"
          onClick={replayCurrentPage}
          disabled={state.status === "loading"}
        >
          <ArrowClockwise aria-hidden="true" />
          重播当前页
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={stopPlayback}
          disabled={state.status === "idle"}
        >
          <Stop aria-hidden="true" weight="fill" />
          停止
        </button>
      </div>

      <details className="library-playback-settings">
        <summary>语言与播放设置</summary>
        <div className="segmented-buttons" role="group" aria-label="朗读语言">
          {NARRATION_OPTIONS.map((item) => (
            <button
              key={item.mode}
              type="button"
              className={`secondary-btn ${
                languageMode === item.mode ? "secondary-btn-active" : ""
              }`}
              aria-pressed={languageMode === item.mode}
              onClick={() => handleLanguageModeChange(item.mode)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="library-auto-advance-toggle">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(event) => onAutoAdvanceChange(event.target.checked)}
          />
          <span>当前页播放完成后自动翻到下一页</span>
        </label>
        {continuousControl}
              <p>{continuousPlayback && onContinuousPlaybackChange ? "按播放列表顺序播放，切换下一本前会先语音提示，到系列最后一本停止。" : "听完当前绘本后停止。"}</p>
      </details>

      <audio ref={audioRef} preload="metadata" hidden />

      {state.message ? (
        <p className="tool-meta" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <div className="tool-error library-playback-error" role="alert">
          <span>{state.error.message || "播放失败，点击重试。"}</span>
          {state.error.retryable ? (
            <button type="button" onClick={replayCurrentPage}>
              点击重试
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
