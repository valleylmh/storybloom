import {
  getBrowserNarrationSegments,
  type BrowserNarrationMode,
} from "@/lib/browser-narration";
import {
  createNarrationCacheKey,
  deleteCachedNarrationAudio,
  getCachedNarrationAudio,
  setCachedNarrationAudio,
} from "@/lib/client-audio-cache";
import {
  calculateReadingProgressPercent,
  getReadingProgress,
  saveReadingProgress,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";
import { BookAudioTransport } from "@/lib/reader/book-audio-transport";
import {
  formatNextBookAnnouncement,
  nextSeriesBook,
  previousSeriesBook,
  type SeriesPlaylistItem,
} from "@/lib/reader/continuous-playback";
import {
  getReadyAnnouncementUrl,
  invalidateAnnouncementAudio,
  prefetchAnnouncementAudio,
} from "@/lib/reader/next-book-announcement";
import type { PlaybackError } from "@/lib/reader/playback-machine";
import {
  clearAudioElementHandlers,
  clearMediaSession,
  getSharedAudioElement,
  updateMediaSession,
  updateMediaSessionPosition,
} from "@/lib/reader/shared-audio-element";
import type { StoryPage } from "@/types";

const CLOUD_REQUEST_TIMEOUT_MS = 45_000;
const INLINE_AUDIO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PerPageCloudResult = {
  audioUrl: string;
  cacheKey: string;
  model?: string;
  voice?: string;
  format?: string;
  bytes?: number;
  cached?: boolean;
  signedUrlExpiresAt?: string;
};

function cachedPerPageAudioUsable(input: {
  audioUrl: string;
  signedUrlExpiresAt?: string;
  updatedAt: number;
}) {
  if (input.audioUrl.startsWith("data:audio/")) {
    return Date.now() - input.updatedAt < INLINE_AUDIO_CACHE_TTL_MS;
  }
  if (input.signedUrlExpiresAt) {
    return new Date(input.signedUrlExpiresAt).getTime() > Date.now() + 60_000;
  }
  return input.audioUrl.startsWith("/") && Date.now() - input.updatedAt < 86_400_000;
}

export type SeriesPlayerPhase =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "announcing"
  | "ended"
  | "error";

export type SeriesPlayerState = {
  bookId: string | null;
  bookTitle: string;
  bookHref: string;
  bookCover?: string;
  seriesTitle?: string;
  languageMode: BrowserNarrationMode;
  pageIndex: number;
  totalPages: number;
  positionMs: number;
  durationMs: number;
  bookProgressRatio: number;
  hasPreviousBook: boolean;
  hasNextBook: boolean;
  playlist: SeriesPlaylistItem[];
  phase: SeriesPlayerPhase;
  autoAdvance: boolean;
  continuousPlayback: boolean;
  pendingTarget: SeriesPlaylistItem | null;
  announcementText: string | null;
  announcementPlaying: boolean;
  announcementMode: BrowserNarrationMode;
  handoffOnly: boolean;
  message: string | null;
  error: PlaybackError | null;
};

export type SeriesAudioPlayerDeps = {
  getAudio: () => HTMLAudioElement | null;
  isDocumentHidden: () => boolean;
  getReadyAnnouncementUrl: typeof getReadyAnnouncementUrl;
  prefetchAnnouncement: (
    book: { title: string; englishTitle?: string },
    mode: BrowserNarrationMode,
  ) => Promise<string | null>;
  invalidateAnnouncement: typeof invalidateAnnouncementAudio;
  updateMediaSession: typeof updateMediaSession;
  updateMediaSessionPosition: typeof updateMediaSessionPosition;
  clearMediaSession: typeof clearMediaSession;
  getProgress: (
    contentType: "library" | "personalized",
    contentId: string,
  ) => Promise<ReadingProgressRecord | null>;
  saveProgress: (record: ReadingProgressRecord) => Promise<unknown>;
  fetchImpl?: typeof fetch;
  announcementWatchdogMs: number;
};

const INITIAL_STATE: SeriesPlayerState = {
  bookId: null,
  bookTitle: "",
  bookHref: "",
  bookCover: undefined,
  seriesTitle: undefined,
  languageMode: "zh",
  pageIndex: 0,
  totalPages: 0,
  positionMs: 0,
  durationMs: 0,
  bookProgressRatio: 0,
  hasPreviousBook: false,
  hasNextBook: false,
  playlist: [],
  phase: "idle",
  autoAdvance: true,
  continuousPlayback: true,
  pendingTarget: null,
  announcementText: null,
  announcementPlaying: false,
  announcementMode: "zh",
  handoffOnly: false,
  message: null,
  error: null,
};

const DEFAULT_DEPS: SeriesAudioPlayerDeps = {
  getAudio: getSharedAudioElement,
  isDocumentHidden: () =>
    typeof document !== "undefined" && document.visibilityState === "hidden",
  getReadyAnnouncementUrl,
  prefetchAnnouncement: (book, mode) => prefetchAnnouncementAudio(book, mode),
  invalidateAnnouncement: invalidateAnnouncementAudio,
  updateMediaSession,
  updateMediaSessionPosition,
  clearMediaSession,
  getProgress: getReadingProgress,
  saveProgress: saveReadingProgress,
  announcementWatchdogMs: 6_000,
};

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizePathname(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || "/";
}

export function shouldShowMiniAudioPlayer(
  state: Pick<SeriesPlayerState, "phase" | "bookId" | "bookHref" | "handoffOnly">,
  pathname: string,
): boolean {
  if (
    state.phase === "idle" ||
    state.handoffOnly ||
    !state.bookId ||
    !state.bookHref
  ) {
    return false;
  }
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === "/login" || normalizedPath.startsWith("/auth/")) {
    return false;
  }
  if (normalizedPath === normalizePathname(state.bookHref)) {
    return false;
  }
  return true;
}

export class SeriesAudioPlayer {
  private deps: SeriesAudioPlayerDeps;
  private state: SeriesPlayerState = { ...INITIAL_STATE };
  private playlist: SeriesPlaylistItem[] = [];
  private currentBookItem: SeriesPlaylistItem | null = null;
  private activePages: StoryPage[] | null = null;
  private activeStoryKey = "";
  private preferCloudTts = true;
  private transport: BookAudioTransport | null = null;
  private perPageAbort: AbortController | null = null;
  private perPageCache = new Map<string, Promise<PerPageCloudResult>>();
  private resolvedPerPageCache = new Map<string, PerPageCloudResult>();
  private perPageFinishedHandler: (() => boolean) | null = null;
  private sessionId = 0;
  private listeners = new Set<(state: SeriesPlayerState) => void>();
  private claimedBookId: string | null = null;
  private announcementWatchdog: ReturnType<typeof setTimeout> | null = null;
  private resumingAnnouncement = false;
  private handoffTargetId: string | null = null;
  private handoffListeners = new Set<() => void>();
  private lastSavedPageByBook = new Map<string, string>();
  private lastPerPageSecond = -1;
  private perPageAudioDirty = false;

  constructor(deps: Partial<SeriesAudioPlayerDeps> = {}) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  getState(): SeriesPlayerState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.phase !== "idle";
  }

  ownsBook(bookId: string): boolean {
    if (this.state.phase === "idle") return false;
    return (
      this.state.bookId === bookId ||
      this.state.pendingTarget?.id === bookId ||
      this.handoffTargetId === bookId
    );
  }

  getActiveStateForBook(bookId: string): SeriesPlayerState | null {
    if (this.state.phase === "idle" || this.state.handoffOnly) return null;
    if (this.state.bookId !== bookId) return null;
    return this.getState();
  }

  isPlayingHandoffFor(targetBookId: string): boolean {
    return (
      this.state.handoffOnly &&
      this.state.phase === "announcing" &&
      this.handoffTargetId === targetBookId
    );
  }

  subscribe(listener: (state: SeriesPlayerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private clearAnnouncementWatchdog() {
    if (this.announcementWatchdog !== null) {
      clearTimeout(this.announcementWatchdog);
      this.announcementWatchdog = null;
    }
  }

  private abortPerPageSession() {
    this.perPageAbort?.abort();
    this.perPageAbort = null;
    this.lastPerPageSecond = -1;
  }

  private detachTransport() {
    this.transport?.destroy();
    this.transport = null;
    this.abortPerPageSession();
    const audio = this.deps.getAudio();
    if (audio) clearAudioElementHandlers(audio);
  }

  private refreshAdjacentFlags(bookId: string | null) {
    this.state.playlist = [...this.playlist];
    if (!bookId) {
      this.state.hasPreviousBook = false;
      this.state.hasNextBook = false;
      return;
    }
    this.state.hasPreviousBook = Boolean(
      previousSeriesBook(this.playlist, bookId)?.chineseAudio,
    );
    this.state.hasNextBook = Boolean(
      nextSeriesBook(this.playlist, bookId)?.chineseAudio,
    );
  }

  /**
   * Records which book detail page is currently mounted. Never stops playback
   * of another book so users can browse freely while listening via the bottom
   * mini player.
   */
  claimBook(bookId: string) {
    this.claimedBookId = bookId;
  }

  /**
   * Detaches the unmounting book detail page while keeping the player session
   * alive (including paused and ended states) so the bottom mini player or
   * floating bubble remains available for resuming, replaying, or picking
   * another book from the playlist.
   */
  releaseBook(bookId: string) {
    if (this.claimedBookId === bookId) {
      this.claimedBookId = null;
    }
  }

  syncSettings(
    bookId: string,
    settings: {
      continuousPlayback: boolean;
      autoAdvance: boolean;
      playlist?: SeriesPlaylistItem[];
      seriesTitle?: string;
      preferCloudTts?: boolean;
      onPerPageBookFinished?: () => boolean;
    },
  ) {
    if (this.state.bookId !== bookId || this.state.handoffOnly) return;
    this.state.continuousPlayback = settings.continuousPlayback;
    this.state.autoAdvance = settings.autoAdvance;
    if (settings.playlist) {
      this.playlist = settings.playlist;
      this.refreshAdjacentFlags(bookId);
    }
    if (settings.seriesTitle !== undefined) {
      this.state.seriesTitle = settings.seriesTitle;
    }
    if (settings.preferCloudTts !== undefined) {
      this.preferCloudTts = settings.preferCloudTts;
    }
    if (settings.onPerPageBookFinished !== undefined) {
      this.perPageFinishedHandler = settings.onPerPageBookFinished;
    }
    if (
      settings.continuousPlayback &&
      (this.state.phase === "playing" || this.state.phase === "loading")
    ) {
      this.prefetchUpcomingAnnouncement();
    }
  }

  syncVisibility() {
    this.transport?.sync();
  }

  startBook(input: {
    book: SeriesPlaylistItem;
    playlist: SeriesPlaylistItem[];
    seriesTitle?: string;
    pageIndex: number;
    resumeFromMs: number;
    autoAdvance: boolean;
    continuousPlayback: boolean;
    preferCloudTts?: boolean;
  }): boolean {
    if (!input.book.chineseAudio) return false;
    this.playlist = input.playlist;
    this.preferCloudTts = input.preferCloudTts ?? true;
    this.activePages = null;
    this.activeStoryKey = "";
    this.perPageFinishedHandler = null;
    this.state.seriesTitle = input.seriesTitle;
    this.state.autoAdvance = input.autoAdvance;
    this.state.continuousPlayback = input.continuousPlayback;
    return this.startBookInternal(input.book, input.pageIndex, input.resumeFromMs);
  }

  startPerPageBook(input: {
    book: SeriesPlaylistItem;
    pages: StoryPage[];
    storyKey: string;
    mode: BrowserNarrationMode;
    playlist: SeriesPlaylistItem[];
    seriesTitle?: string;
    pageIndex: number;
    resumeFromMs: number;
    autoAdvance: boolean;
    continuousPlayback: boolean;
    preferCloudTts?: boolean;
    onBookFinished?: () => boolean;
  }): boolean {
    if (!input.pages.length) return false;
    this.playlist = input.playlist;
    this.currentBookItem = input.book;
    this.activePages = input.pages;
    if (this.activeStoryKey !== input.storyKey) {
      this.activeStoryKey = input.storyKey;
      this.perPageCache.clear();
      this.resolvedPerPageCache.clear();
    }
    this.preferCloudTts = input.preferCloudTts ?? true;
    this.perPageFinishedHandler = input.onBookFinished ?? null;
    this.state.seriesTitle = input.seriesTitle;
    this.state.autoAdvance = input.autoAdvance;
    this.state.continuousPlayback = input.continuousPlayback;
    this.state.languageMode = input.mode;
    return this.startPerPageInternal(
      input.book,
      input.pages,
      input.storyKey,
      input.mode,
      input.pageIndex,
      input.resumeFromMs,
    );
  }

  private startBookInternal(
    book: SeriesPlaylistItem,
    pageIndex: number,
    resumeFromMs: number,
  ): boolean {
    const asset = book.chineseAudio;
    const audio = this.deps.getAudio();
    if (!asset || !audio) {
      this.state = {
        ...this.state,
        phase: "error",
        error: {
          code: "audio_failed",
          message: "浏览器音频播放器未准备好。",
          retryable: true,
        },
      };
      this.emit();
      return false;
    }

    this.sessionId += 1;
    const currentSession = this.sessionId;
    this.clearAnnouncementWatchdog();
    this.resumingAnnouncement = false;
    this.perPageAudioDirty = false;
    this.handoffTargetId = null;
    this.handoffListeners.clear();
    this.detachTransport();
    this.currentBookItem = book;
    this.activePages = null;
    this.perPageFinishedHandler = null;

    const totalPages = asset.pageStarts.length;
    const safePageIndex = Math.min(
      Math.max(0, pageIndex),
      Math.max(0, totalPages - 1),
    );

    this.state = {
      ...this.state,
      bookId: book.id,
      bookTitle: book.title,
      bookHref: book.href,
      bookCover: book.cover,
      languageMode: "zh",
      pageIndex: safePageIndex,
      totalPages,
      positionMs: resumeFromMs,
      durationMs: 0,
      bookProgressRatio:
        asset.duration > 0
          ? clampRatio(
              (asset.pageStarts[safePageIndex] + resumeFromMs / 1000) /
                asset.duration,
            )
          : 0,
      phase: "loading",
      pendingTarget: null,
      announcementText: null,
      announcementPlaying: false,
      announcementMode: "zh",
      handoffOnly: false,
      message: `正在准备第 ${safePageIndex + 1} 页…`,
      error: null,
    };
    this.refreshAdjacentFlags(book.id);

    this.syncBookMediaSession(book, "playing");
    this.emit();

    this.transport = new BookAudioTransport(
      audio,
      asset,
      safePageIndex,
      resumeFromMs,
      {
        autoAdvance: () => this.state.autoAdvance,
        position: (index, positionMs, durationMs) => {
          if (this.sessionId !== currentSession) return;
          const pageChanged = this.state.pageIndex !== index;
          this.state.pageIndex = index;
          this.state.positionMs = positionMs;
          this.state.durationMs = durationMs;
          if (Number.isFinite(audio.currentTime) && asset.duration > 0) {
            this.state.bookProgressRatio = clampRatio(
              audio.currentTime / asset.duration,
            );
            this.deps.updateMediaSessionPosition(asset.duration, audio.currentTime);
          } else if (totalPages > 0) {
            const pageFraction = durationMs > 0 ? positionMs / durationMs : 0;
            this.state.bookProgressRatio = clampRatio(
              (index + pageFraction) / totalPages,
            );
          }
          if (pageChanged) {
            this.persistBookProgress(book.id, index, totalPages, positionMs, false, "zh");
          }
          this.emit();
        },
        playing: () => {
          if (this.sessionId !== currentSession) return;
          this.state.phase = "playing";
          this.state.message = "中文连续朗读 · 已准备好";
          this.state.error = null;
          this.syncBookMediaSession(book, "playing");
          this.emit();
        },
        paused: (positionMs) => {
          if (this.sessionId !== currentSession) return;
          this.state.phase = "paused";
          this.state.positionMs = positionMs;
          this.syncBookMediaSession(book, "paused");
          this.emit();
        },
        ended: (endedPageIndex) => {
          if (this.sessionId !== currentSession) return;
          this.handleBookTransportEnded(currentSession, book, totalPages, endedPageIndex);
        },
        error: () => {
          if (this.sessionId !== currentSession) return;
          this.detachTransport();
          this.state.phase = "error";
          this.state.message = null;
          this.state.error = {
            code: "audio_failed",
            message: "中文音频加载失败，请检查网络后重试。",
            retryable: true,
          };
          this.deps.clearMediaSession();
          this.emit();
        },
      },
    );

    this.persistBookProgress(book.id, safePageIndex, totalPages, resumeFromMs, false, "zh");
    this.prefetchUpcomingAnnouncement();

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => {
          if (this.sessionId !== currentSession) return;
          this.state.phase = "paused";
          this.state.message = "音频已准备好，请点击继续播放。";
          this.syncBookMediaSession(book, "paused");
          this.emit();
        });
      }
    } catch {
      if (this.sessionId === currentSession) {
        this.state.phase = "paused";
        this.state.message = "音频已准备好，请点击继续播放。";
        this.syncBookMediaSession(book, "paused");
        this.emit();
      }
    }
    return true;
  }

  private requestPerPageAudio(
    pages: StoryPage[],
    storyKey: string,
    pageIndex: number,
    mode: BrowserNarrationMode,
    signal: AbortSignal,
  ): Promise<PerPageCloudResult> {
    const page = pages[pageIndex];
    const segments = page ? getBrowserNarrationSegments([page], mode) : [];
    if (!segments.length) {
      return Promise.reject(
        new Error("当前页面在这个语言模式下没有可朗读文本。"),
      );
    }

    const memoryKey = `${storyKey}:${pageIndex}:${mode}`;
    const existing = this.perPageCache.get(memoryKey);
    if (existing) return existing;

    const text = segments.map((segment) => segment.text).join("\n\n");
    const fetchImpl = this.deps.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
    const request = (async (): Promise<PerPageCloudResult> => {
      const pageStoryId = `${storyKey}:${pageIndex}`;
      const { key, textHash } = await createNarrationCacheKey(
        pageStoryId,
        mode,
        "qwen-audio-3.0-tts-plus",
        text,
      );
      const cached = await getCachedNarrationAudio(key);
      if (cached?.model === "qwen-audio-3.0-tts-plus" && cachedPerPageAudioUsable(cached)) {
        const normalizedCached: PerPageCloudResult = {
          audioUrl: cached.audioUrl,
          cacheKey: key,
          model: cached.model,
          voice: cached.voice,
          format: cached.format,
          bytes: cached.bytes,
          cached: true,
          signedUrlExpiresAt: cached.signedUrlExpiresAt,
        };
        this.resolvedPerPageCache.set(memoryKey, normalizedCached);
        return normalizedCached;
      }

      if (!fetchImpl) {
        throw new Error("云端朗读暂时不可用。");
      }

      const requestController = new AbortController();
      let timedOut = false;
      const abortRequest = () => requestController.abort();
      signal.addEventListener("abort", abortRequest, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, CLOUD_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetchImpl("/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            mode,
            model: "qwen-audio-3.0-tts-plus",
            sampleRate: 24000,
          }),
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
        const normalized: PerPageCloudResult = {
          audioUrl: result.audioUrl,
          cacheKey: key,
          model: result.model,
          voice: result.voice,
          format: result.format,
          bytes: result.bytes,
          cached: result.cached,
          signedUrlExpiresAt: result.signedUrlExpiresAt,
        };
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
        this.resolvedPerPageCache.set(memoryKey, normalized);
        return normalized;
      } catch (error) {
        if (timedOut) {
          throw new Error("云端朗读准备超时，请重试。");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abortRequest);
      }
    })();

    this.perPageCache.set(memoryKey, request);
    void request.catch(() => {
      if (this.perPageCache.get(memoryKey) === request) {
        this.perPageCache.delete(memoryKey);
      }
    });
    return request;
  }

  private startPerPageInternal(
    book: SeriesPlaylistItem,
    pages: StoryPage[],
    storyKey: string,
    mode: BrowserNarrationMode,
    pageIndex: number,
    resumeFromMs: number,
  ): boolean {
    const audio = this.deps.getAudio();
    if (!audio) {
      this.state = {
        ...this.state,
        phase: "error",
        error: {
          code: "audio_failed",
          message: "浏览器音频播放器未准备好。",
          retryable: true,
        },
      };
      this.emit();
      return false;
    }

    this.sessionId += 1;
    const currentSession = this.sessionId;
    this.clearAnnouncementWatchdog();
    this.resumingAnnouncement = false;
    this.perPageAudioDirty = false;
    this.handoffTargetId = null;
    this.handoffListeners.clear();
    this.detachTransport();

    const controller = new AbortController();
    this.perPageAbort = controller;

    const totalPages = pages.length;
    const safePageIndex = Math.min(Math.max(0, pageIndex), Math.max(0, totalPages - 1));

    this.state = {
      ...this.state,
      bookId: book.id,
      bookTitle: book.title,
      bookHref: book.href,
      bookCover: book.cover,
      languageMode: mode,
      pageIndex: safePageIndex,
      totalPages,
      positionMs: resumeFromMs,
      durationMs: 0,
      bookProgressRatio: totalPages > 0 ? clampRatio(safePageIndex / totalPages) : 0,
      phase: "loading",
      pendingTarget: null,
      announcementText: null,
      announcementPlaying: false,
      announcementMode: mode,
      handoffOnly: false,
      message: `正在准备第 ${safePageIndex + 1} 页…`,
      error: null,
    };
    this.refreshAdjacentFlags(book.id);
    this.emit();

    const memoryKey = `${storyKey}:${safePageIndex}:${mode}`;
    const ready = this.resolvedPerPageCache.get(memoryKey);
    if (ready) {
      this.playPerPageResolved(
        currentSession,
        book,
        pages,
        storyKey,
        mode,
        safePageIndex,
        ready,
        resumeFromMs,
        controller.signal,
      );
      return true;
    }

    void this.requestPerPageAudio(pages, storyKey, safePageIndex, mode, controller.signal)
      .then((result) => {
        if (this.sessionId !== currentSession) return;
        this.playPerPageResolved(
          currentSession,
          book,
          pages,
          storyKey,
          mode,
          safePageIndex,
          result,
          resumeFromMs,
          controller.signal,
        );
      })
      .catch((error) => {
        if (this.sessionId !== currentSession) return;
        if (error instanceof Error && error.name === "AbortError") return;
        this.state.phase = "error";
        this.state.message = null;
        this.state.error = {
          code: "audio_failed",
          message:
            error instanceof Error && error.message
              ? error.message
              : "云端朗读暂不可用，请重试。",
          retryable: true,
        };
        this.deps.clearMediaSession();
        this.emit();
      });

    return true;
  }

  private playPerPageResolved(
    currentSession: number,
    book: SeriesPlaylistItem,
    pages: StoryPage[],
    storyKey: string,
    mode: BrowserNarrationMode,
    pageIndex: number,
    result: PerPageCloudResult,
    resumeFromMs: number,
    signal: AbortSignal,
  ) {
    if (this.sessionId !== currentSession) return;
    const audio = this.deps.getAudio();
    if (!audio) return;

    const totalPages = pages.length;
    this.lastPerPageSecond = -1;
    clearAudioElementHandlers(audio);
    this.state.pageIndex = pageIndex;
    this.state.positionMs = resumeFromMs;
    this.state.durationMs = 0;
    this.state.bookProgressRatio = totalPages > 0 ? clampRatio(pageIndex / totalPages) : 0;

    audio.onloadedmetadata = () => {
      if (this.sessionId !== currentSession) return;
      const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      if (resumeFromMs > 0 && Number.isFinite(audio.duration) && resumeFromMs < durationMs - 500) {
        audio.currentTime = resumeFromMs / 1000;
      }
      this.state.positionMs = audio.currentTime * 1000;
      this.state.durationMs = durationMs;
      this.emit();
    };
    audio.ontimeupdate = () => {
      if (this.sessionId !== currentSession) return;
      const sec = Math.floor(audio.currentTime);
      if (sec === this.lastPerPageSecond) return;
      this.lastPerPageSecond = sec;
      const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      const positionMs = audio.currentTime * 1000;
      this.state.positionMs = positionMs;
      this.state.durationMs = durationMs;
      if (totalPages > 0) {
        const pageFraction = durationMs > 0 ? positionMs / durationMs : 0;
        this.state.bookProgressRatio = clampRatio((pageIndex + pageFraction) / totalPages);
      }
      this.emit();
    };
    audio.onplay = () => {
      if (this.sessionId !== currentSession) return;
      this.state.phase = "playing";
      this.state.message = `第 ${pageIndex + 1} 页 · 百炼 TTS${result.cached ? " · 已复用音频" : ""}`;
      this.state.error = null;
      this.syncBookMediaSession(book, "playing");
      this.emit();
    };
    audio.onpause = () => {
      if (this.sessionId !== currentSession || audio.ended || this.state.phase !== "playing") {
        return;
      }
      this.state.phase = "paused";
      this.state.positionMs = audio.currentTime * 1000;
      this.syncBookMediaSession(book, "paused");
      this.emit();
    };
    audio.onended = () => {
      if (this.sessionId !== currentSession) return;
      if (this.state.autoAdvance && pageIndex < totalPages - 1) {
        const nextPageIndex = pageIndex + 1;
        this.persistBookProgress(book.id, nextPageIndex, totalPages, 0, false, mode);
        const nextReady = this.resolvedPerPageCache.get(`${storyKey}:${nextPageIndex}:${mode}`);
        if (nextReady) {
          this.playPerPageResolved(
            currentSession,
            book,
            pages,
            storyKey,
            mode,
            nextPageIndex,
            nextReady,
            0,
            signal,
          );
          return;
        }
        this.startPerPageInternal(book, pages, storyKey, mode, nextPageIndex, 0);
        return;
      }

      if (pageIndex === totalPages - 1) {
        this.persistBookProgress(book.id, pageIndex, totalPages, 0, true, mode);
        if (this.claimedBookId === book.id && this.perPageFinishedHandler) {
          const handedOff = this.perPageFinishedHandler();
          if (handedOff) return;
        }
        this.state.phase = "ended";
        this.state.positionMs = 0;
        this.state.bookProgressRatio = 1;
        this.state.message = "整本绘本已播放完毕";
        this.deps.clearMediaSession();
        this.emit();
        return;
      }

      this.state.phase = "ended";
      this.state.positionMs = 0;
      this.state.message = "当前页已播放完毕；自动翻页已关闭。";
      this.deps.clearMediaSession();
      this.emit();
    };
    audio.onerror = () => {
      if (this.sessionId !== currentSession) return;
      audio.onerror = null;
      audio.pause();
      const failedKey = `${storyKey}:${pageIndex}:${mode}`;
      this.perPageCache.delete(failedKey);
      this.resolvedPerPageCache.delete(failedKey);
      void deleteCachedNarrationAudio(result.cacheKey);
      this.state.phase = "error";
      this.state.message = null;
      this.state.error = {
        code: "audio_failed",
        message: "百炼音频加载失败，请重试。",
        retryable: true,
      };
      this.deps.clearMediaSession();
      this.emit();
    };

    audio.src = result.audioUrl;
    audio.preload = "auto";
    audio.load();

    this.persistBookProgress(book.id, pageIndex, totalPages, resumeFromMs, false, mode);

    if (pageIndex + 1 < totalPages) {
      void this.requestPerPageAudio(pages, storyKey, pageIndex + 1, mode, signal).catch(
        () => undefined,
      );
    }
    this.prefetchUpcomingAnnouncement();

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => {
          if (this.sessionId !== currentSession) return;
          this.state.phase = "paused";
          this.state.message = `第 ${pageIndex + 1} 页已准备好，请点击继续播放。`;
          this.syncBookMediaSession(book, "paused");
          this.emit();
        });
      }
    } catch {
      if (this.sessionId === currentSession) {
        this.state.phase = "paused";
        this.state.message = `第 ${pageIndex + 1} 页已准备好，请点击继续播放。`;
        this.syncBookMediaSession(book, "paused");
        this.emit();
      }
    }
  }

  private handleBookTransportEnded(
    currentSession: number,
    book: SeriesPlaylistItem,
    totalPages: number,
    endedPageIndex: number,
  ) {
    if (endedPageIndex < totalPages - 1) {
      this.state.phase = "ended";
      this.state.pageIndex = endedPageIndex;
      this.state.positionMs = 0;
      this.state.message = "当前页已播放完毕；自动翻页已关闭。";
      this.deps.clearMediaSession();
      this.emit();
      return;
    }

    this.persistBookProgress(book.id, endedPageIndex, totalPages, 0, true, "zh");

    const upcoming = this.state.continuousPlayback
      ? nextSeriesBook(this.playlist, book.id)
      : undefined;

    if (!upcoming) {
      this.state.phase = "ended";
      this.state.pageIndex = endedPageIndex;
      this.state.positionMs = 0;
      this.state.bookProgressRatio = 1;
      this.state.pendingTarget = null;
      this.state.announcementText = null;
      this.state.announcementPlaying = false;
      this.state.message = "整本绘本已播放完毕";
      this.deps.clearMediaSession();
      this.emit();
      return;
    }

    const { text: announcementText } = formatNextBookAnnouncement(upcoming, "zh");
    const announcementUrl = this.preferCloudTts
      ? this.deps.getReadyAnnouncementUrl(upcoming, "zh")
      : null;

    if (announcementUrl) {
      this.playWholeBookAnnouncement(
        currentSession,
        upcoming,
        announcementUrl,
        announcementText,
      );
      return;
    }

    // When locked OR browsing outside the book detail page (where no countdown
    // modal is mounted), chain directly into the next book without stalling.
    if (this.deps.isDocumentHidden() || this.claimedBookId !== book.id) {
      if (upcoming.chineseAudio) {
        this.startBookInternal(upcoming, 0, 0);
        return;
      }
    }

    // Foreground on the book detail page without preloaded cloud announcement:
    // show countdown dialog (with browser speechSynthesis fallback when visible).
    this.detachTransport();
    this.state.phase = "announcing";
    this.state.pageIndex = endedPageIndex;
    this.state.positionMs = 0;
    this.state.durationMs = 0;
    this.state.bookProgressRatio = 1;
    this.state.pendingTarget = upcoming;
    this.state.announcementText = announcementText;
    this.state.announcementPlaying = false;
    this.state.announcementMode = "zh";
    this.state.handoffOnly = false;
    this.state.message = announcementText;
    this.emit();
  }

  private playWholeBookAnnouncement(
    expectedSession: number,
    upcoming: SeriesPlaylistItem,
    announcementUrl: string,
    announcementText: string,
  ) {
    const audio = this.deps.getAudio();
    if (!audio) {
      if (upcoming.chineseAudio) this.startBookInternal(upcoming, 0, 0);
      return;
    }

    this.sessionId += 1;
    const announcementSession = this.sessionId;
    void expectedSession;
    this.clearAnnouncementWatchdog();
    this.resumingAnnouncement = false;
    this.detachTransport();

    this.state.phase = "announcing";
    this.state.positionMs = 0;
    this.state.durationMs = 0;
    this.state.bookProgressRatio = 1;
    this.state.pendingTarget = upcoming;
    this.state.announcementText = announcementText;
    this.state.announcementPlaying = true;
    this.state.announcementMode = "zh";
    this.state.handoffOnly = false;
    this.state.message = announcementText;
    this.state.error = null;

    this.deps.updateMediaSession({
      title: `即将播放：${upcoming.title}`,
      artist: this.state.seriesTitle || "StoryBloom 绘本馆",
      album: "StoryBloom 绘本馆",
      cover: upcoming.cover,
      playbackState: "playing",
      handlers: {
        play: () => {
          void this.resume();
        },
        pause: () => this.pause(),
        stop: () => this.stop(),
        previoustrack: () => {
          this.skipToAdjacentBook(-1);
        },
        nexttrack: () => {
          this.playPendingTargetNow();
        },
      },
    });
    this.emit();

    const finishToUpcoming = (invalidate: boolean) => {
      if (this.sessionId !== announcementSession) return;
      this.clearAnnouncementWatchdog();
      this.resumingAnnouncement = false;
      if (invalidate) {
        this.deps.invalidateAnnouncement(upcoming, "zh");
      }
      if (upcoming.chineseAudio) {
        this.startBookInternal(upcoming, 0, 0);
      } else {
        this.state.phase = "ended";
        this.state.pendingTarget = upcoming;
        this.state.announcementPlaying = false;
        this.emit();
      }
    };

    audio.onplay = () => {
      if (this.sessionId !== announcementSession) return;
      this.clearAnnouncementWatchdog();
      this.resumingAnnouncement = false;
      this.state.phase = "announcing";
      this.state.announcementPlaying = true;
      this.deps.updateMediaSession({
        title: `即将播放：${upcoming.title}`,
        artist: this.state.seriesTitle || "StoryBloom 绘本馆",
        album: "StoryBloom 绘本馆",
        cover: upcoming.cover,
        playbackState: "playing",
      });
      this.emit();
    };
    audio.onpause = () => {
      if (this.sessionId !== announcementSession || audio.ended) return;
      this.clearAnnouncementWatchdog();
      this.resumingAnnouncement = true;
      this.state.phase = "paused";
      this.deps.updateMediaSession({
        title: `即将播放：${upcoming.title}`,
        artist: this.state.seriesTitle || "StoryBloom 绘本馆",
        album: "StoryBloom 绘本馆",
        cover: upcoming.cover,
        playbackState: "paused",
      });
      this.emit();
    };
    audio.onended = () => finishToUpcoming(false);
    audio.onerror = () => finishToUpcoming(true);

    if (this.deps.announcementWatchdogMs > 0) {
      this.announcementWatchdog = setTimeout(() => {
        finishToUpcoming(false);
      }, this.deps.announcementWatchdogMs);
    }

    audio.src = announcementUrl;
    audio.preload = "auto";
    audio.load();
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => finishToUpcoming(false));
      }
    } catch {
      finishToUpcoming(false);
    }
  }

  /**
   * Starts a spoken next-book announcement on the shared <audio> element for
   * per-page modes (`en` / `zh-en`) so the announcement bridges route navigation.
   */
  startHandoffAnnouncement(input: {
    fromBookId: string;
    target: SeriesPlaylistItem;
    mode: BrowserNarrationMode;
    announcementUrl: string;
    seriesTitle?: string;
    onComplete?: () => void;
  }): boolean {
    const audio = this.deps.getAudio();
    if (!audio) return false;

    this.sessionId += 1;
    const currentSession = this.sessionId;
    this.clearAnnouncementWatchdog();
    this.resumingAnnouncement = false;
    this.detachTransport();
    this.handoffListeners.clear();
    this.handoffTargetId = input.target.id;
    if (input.onComplete) this.handoffListeners.add(input.onComplete);

    const { text: announcementText } = formatNextBookAnnouncement(
      input.target,
      input.mode,
    );

    this.state = {
      ...this.state,
      bookId: input.fromBookId,
      seriesTitle: input.seriesTitle ?? this.state.seriesTitle,
      languageMode: input.mode,
      phase: "announcing",
      pendingTarget: input.target,
      announcementText,
      announcementPlaying: true,
      announcementMode: input.mode,
      handoffOnly: true,
      positionMs: 0,
      durationMs: 0,
      bookProgressRatio: 1,
      message: announcementText,
      error: null,
    };

    this.deps.updateMediaSession({
      title: `即将播放：${input.target.title}`,
      artist: this.state.seriesTitle || "StoryBloom 绘本馆",
      album: "StoryBloom 绘本馆",
      cover: input.target.cover,
      playbackState: "playing",
      handlers: {
        play: () => {
          void this.resume();
        },
        pause: () => this.pause(),
        stop: () => this.cancelPendingTarget(),
        nexttrack: () => {
          this.playPendingTargetNow();
        },
      },
    });
    this.emit();

    const finish = (invalidate: boolean) => {
      if (this.sessionId !== currentSession) return;
      this.clearAnnouncementWatchdog();
      clearAudioElementHandlers(audio);
      if (invalidate) {
        this.deps.invalidateAnnouncement(input.target, input.mode);
      }
      const callbacks = Array.from(this.handoffListeners);
      this.handoffListeners.clear();
      this.handoffTargetId = null;
      this.state = {
        ...INITIAL_STATE,
        continuousPlayback: this.state.continuousPlayback,
        autoAdvance: this.state.autoAdvance,
      };
      this.emit();
      for (const callback of callbacks) callback();
    };

    audio.onplay = () => {
      if (this.sessionId !== currentSession) return;
      this.clearAnnouncementWatchdog();
    };
    audio.onended = () => finish(false);
    audio.onerror = () => finish(true);

    if (this.deps.announcementWatchdogMs > 0) {
      this.announcementWatchdog = setTimeout(() => {
        finish(false);
      }, this.deps.announcementWatchdogMs);
    }

    audio.src = input.announcementUrl;
    audio.preload = "auto";
    audio.load();
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => finish(false));
      }
    } catch {
      finish(false);
    }
    return true;
  }

  whenHandoffAnnouncementEnds(
    targetBookId: string,
    callback: () => void,
  ): () => void {
    if (!this.isPlayingHandoffFor(targetBookId)) {
      callback();
      return () => {};
    }
    this.handoffListeners.add(callback);
    return () => {
      this.handoffListeners.delete(callback);
    };
  }

  playPendingTargetNow(): boolean {
    const target = this.state.pendingTarget;
    if (!target) return false;
    if (this.state.handoffOnly) {
      const audio = this.deps.getAudio();
      this.sessionId += 1;
      this.clearAnnouncementWatchdog();
      if (audio) {
        clearAudioElementHandlers(audio);
        audio.pause();
      }
      const callbacks = Array.from(this.handoffListeners);
      this.handoffListeners.clear();
      this.handoffTargetId = null;
      this.state = {
        ...INITIAL_STATE,
        continuousPlayback: this.state.continuousPlayback,
        autoAdvance: this.state.autoAdvance,
      };
      this.emit();
      for (const callback of callbacks) callback();
      return true;
    }
    if (target.chineseAudio) {
      return this.startBookInternal(target, 0, 0);
    }
    return false;
  }

  cancelPendingTarget() {
    this.sessionId += 1;
    this.clearAnnouncementWatchdog();
    this.resumingAnnouncement = false;
    this.handoffTargetId = null;
    this.handoffListeners.clear();
    const audio = this.deps.getAudio();
    this.detachTransport();
    if (audio) audio.pause();
    const wasHandoff = this.state.handoffOnly;
    this.state = wasHandoff
      ? {
          ...INITIAL_STATE,
          continuousPlayback: false,
          autoAdvance: this.state.autoAdvance,
        }
      : {
          ...this.state,
          phase: "ended",
          continuousPlayback: false,
          pendingTarget: null,
          announcementText: null,
          announcementPlaying: false,
          handoffOnly: false,
          message: "整本绘本已播放完毕",
        };
    this.deps.clearMediaSession();
    this.emit();
  }

  pause() {
    if (
      this.state.phase !== "playing" &&
      this.state.phase !== "announcing" &&
      this.state.phase !== "loading"
    ) {
      return;
    }
    const audio = this.deps.getAudio();
    if (!audio) return;
    audio.pause();
    if (this.state.phase === "loading") {
      this.state.phase = "paused";
      this.emit();
    }
  }

  async resume() {
    if (this.state.phase !== "paused") return;
    const audio = this.deps.getAudio();
    if (!audio?.src || this.perPageAudioDirty) {
      this.perPageAudioDirty = false;
      this.replayCurrentBook(this.state.pageIndex, this.state.positionMs);
      return;
    }
    if (!this.resumingAnnouncement) {
      this.prefetchUpcomingAnnouncement();
    }
    try {
      await audio.play();
    } catch {
      this.state.phase = "error";
      this.state.error = {
        code: "autoplay_blocked",
        message: "浏览器阻止了音频播放，请再次点击重试。",
        retryable: true,
      };
      this.emit();
    }
  }

  replayCurrentBook(pageIndex = 0, resumeFromMs = 0): boolean {
    if (!this.currentBookItem) return false;
    if (this.state.languageMode === "zh" && this.currentBookItem.chineseAudio) {
      return this.startBookInternal(this.currentBookItem, pageIndex, resumeFromMs);
    }
    if (this.activePages?.length && this.activeStoryKey) {
      return this.startPerPageInternal(
        this.currentBookItem,
        this.activePages,
        this.activeStoryKey,
        this.state.languageMode,
        pageIndex,
        resumeFromMs,
      );
    }
    return false;
  }

  selectPage(pageIndex: number) {
    if (this.state.handoffOnly) return false;
    if (this.transport) {
      if (this.transport.pageIndex === pageIndex) return true;
      this.transport.selectPage(pageIndex);
      return true;
    }
    if (this.currentBookItem && this.activePages?.length && this.activeStoryKey) {
      if (pageIndex < 0 || pageIndex >= this.activePages.length) return false;
      const continuePlaying =
        this.state.phase === "playing" || this.state.phase === "loading";
      if (continuePlaying) {
        return this.startPerPageInternal(
          this.currentBookItem,
          this.activePages,
          this.activeStoryKey,
          this.state.languageMode,
          pageIndex,
          0,
        );
      }
      this.perPageAudioDirty = true;
      this.state.pageIndex = pageIndex;
      this.state.positionMs = 0;
      this.state.durationMs = 0;
      this.state.bookProgressRatio =
        this.activePages.length > 0
          ? clampRatio(pageIndex / this.activePages.length)
          : 0;
      this.emit();
      return true;
    }
    return false;
  }

  skipToAdjacentBook(delta: -1 | 1): boolean {
    if (!this.state.bookId || this.state.handoffOnly) return false;
    const candidate =
      delta > 0
        ? nextSeriesBook(this.playlist, this.state.bookId)
        : previousSeriesBook(this.playlist, this.state.bookId);
    if (!candidate?.chineseAudio) return false;
    return this.startBookInternal(candidate, 0, 0);
  }

  playPlaylistBook(bookId: string): boolean {
    if (!bookId) return false;
    const target = this.playlist.find((item) => item.id === bookId);
    if (!target) return false;
    if (target.id === this.state.bookId && !this.state.handoffOnly) {
      if (this.state.phase === "paused") {
        void this.resume();
        return true;
      }
      if (this.state.phase === "playing" || this.state.phase === "loading") {
        return true;
      }
      return this.replayCurrentBook(0, 0);
    }
    if (target.chineseAudio) {
      return this.startBookInternal(target, 0, 0);
    }
    return false;
  }

  setContinuousPlayback(enabled: boolean) {
    if (this.state.continuousPlayback === enabled) return;
    this.state.continuousPlayback = enabled;
    if (
      enabled &&
      (this.state.phase === "playing" || this.state.phase === "loading")
    ) {
      this.prefetchUpcomingAnnouncement();
    }
    this.emit();
  }

  stop() {
    this.clearAnnouncementWatchdog();
    this.sessionId += 1;
    this.resumingAnnouncement = false;
    this.handoffTargetId = null;
    this.handoffListeners.clear();
    this.detachTransport();
    this.currentBookItem = null;
    this.activePages = null;
    this.perPageFinishedHandler = null;
    const audio = this.deps.getAudio();
    if (audio) {
      audio.pause();
    }
    this.state = {
      ...INITIAL_STATE,
      continuousPlayback: this.state.continuousPlayback,
      autoAdvance: this.state.autoAdvance,
    };
    this.deps.clearMediaSession();
    this.emit();
  }

  private prefetchUpcomingAnnouncement() {
    if (!this.state.continuousPlayback || !this.preferCloudTts || !this.state.bookId) {
      return;
    }
    const upcoming = nextSeriesBook(this.playlist, this.state.bookId);
    if (!upcoming) return;
    void this.deps.prefetchAnnouncement(upcoming, this.state.languageMode);
  }

  private syncBookMediaSession(
    book: SeriesPlaylistItem,
    playbackState: "playing" | "paused" | "none",
  ) {
    const hasPrev = Boolean(previousSeriesBook(this.playlist, book.id)?.chineseAudio);
    const hasNext = Boolean(nextSeriesBook(this.playlist, book.id)?.chineseAudio);
    this.deps.updateMediaSession({
      title: book.title,
      artist: this.state.seriesTitle || "StoryBloom 绘本馆",
      album: "StoryBloom 绘本馆",
      cover: book.cover,
      playbackState,
      handlers: {
        play: () => {
          void this.resume();
        },
        pause: () => this.pause(),
        stop: () => this.stop(),
        previoustrack: hasPrev ? () => { this.skipToAdjacentBook(-1); } : null,
        nexttrack: hasNext ? () => { this.skipToAdjacentBook(1); } : null,
      },
    });
  }

  private persistBookProgress(
    bookId: string,
    pageIndex: number,
    totalPages: number,
    positionMs: number,
    completed: boolean,
    languageMode: BrowserNarrationMode,
  ) {
    // When the book is currently mounted, LibraryBookExperience persists
    // progress and syncs to cloud. Always persist completion or background books.
    if (!completed && bookId === this.claimedBookId) {
      return;
    }
    const fingerprint = `${bookId}:${languageMode}:${pageIndex}:${completed ? 1 : 0}`;
    if (this.lastSavedPageByBook.get(bookId) === fingerprint) {
      return;
    }
    this.lastSavedPageByBook.set(bookId, fingerprint);
    void (async () => {
      const existing = await this.deps.getProgress("library", bookId).catch(() => null);
      const now = new Date().toISOString();
      const maxPageIndex = Math.max(existing?.maxPageIndex ?? 0, pageIndex);
      const completedAt = completed ? now : existing?.completedAt;
      const record: ReadingProgressRecord = {
        contentType: "library",
        contentId: bookId,
        pageIndex,
        maxPageIndex,
        ...(positionMs > 0 && !completed ? { positionMs: Math.floor(positionMs) } : {}),
        languageMode,
        playbackMode: "page",
        autoAdvance: this.state.autoAdvance,
        progressPercent: calculateReadingProgressPercent(
          maxPageIndex,
          totalPages,
          Boolean(completedAt),
        ),
        ...(completedAt ? { completedAt } : {}),
        lastReadAt: now,
        updatedAt: now,
      };
      await this.deps.saveProgress(record);
    })().catch(() => undefined);
  }
}

export const seriesAudioPlayer = new SeriesAudioPlayer();
