import type { BrowserNarrationMode } from "@/lib/browser-narration";

export type PlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type PlaybackSource = "cloud" | "browser" | null;

export type PlaybackError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type PlaybackState = {
  status: PlaybackStatus;
  pageIndex: number;
  languageMode: BrowserNarrationMode;
  source: PlaybackSource;
  autoAdvance: boolean;
  highlight: BrowserNarrationMode | null;
  positionMs: number;
  durationMs: number;
  message: string | null;
  error: PlaybackError | null;
};

export type PlaybackEvent =
  | {
      type: "RESET";
      pageIndex: number;
      languageMode: BrowserNarrationMode;
      autoAdvance: boolean;
      positionMs?: number;
    }
  | { type: "PLAY_REQUESTED"; message?: string }
  | { type: "PLAY_STARTED"; source: Exclude<PlaybackSource, null>; message?: string }
  | { type: "AUTOPLAY_BLOCKED"; source: Exclude<PlaybackSource, null>; message: string }
  | { type: "PAUSED"; positionMs?: number }
  | { type: "RESUMED" }
  | { type: "STOPPED" }
  | { type: "PAGE_SELECTED"; pageIndex: number; continuePlayback: boolean }
  | { type: "LANGUAGE_CHANGED"; languageMode: BrowserNarrationMode; restart: boolean }
  | { type: "AUTO_ADVANCE_CHANGED"; autoAdvance: boolean }
  | { type: "HIGHLIGHT_CHANGED"; highlight: BrowserNarrationMode | null }
  | { type: "POSITION_CHANGED"; positionMs: number; durationMs?: number }
  | { type: "PAGE_ENDED"; nextPageIndex?: number; message?: string }
  | { type: "BOOK_ENDED"; message?: string }
  | { type: "FAILED"; error: PlaybackError }
  | { type: "RETRY_REQUESTED" };

export function createInitialPlaybackState(input?: {
  pageIndex?: number;
  languageMode?: BrowserNarrationMode;
  autoAdvance?: boolean;
  positionMs?: number;
}): PlaybackState {
  return {
    status: "idle",
    pageIndex: input?.pageIndex ?? 0,
    languageMode: input?.languageMode ?? "zh",
    source: null,
    autoAdvance: input?.autoAdvance ?? true,
    highlight: null,
    positionMs: Math.max(0, input?.positionMs ?? 0),
    durationMs: 0,
    message: null,
    error: null,
  };
}

export function playbackReducer(
  state: PlaybackState,
  event: PlaybackEvent,
): PlaybackState {
  switch (event.type) {
    case "RESET":
      return createInitialPlaybackState(event);
    case "PLAY_REQUESTED":
    case "RETRY_REQUESTED":
      return {
        ...state,
        status: "loading",
        source: null,
        highlight: null,
        message:
          event.type === "PLAY_REQUESTED"
            ? event.message ?? state.message
            : "正在重新准备当前页…",
        error: null,
      };
    case "PLAY_STARTED":
      return {
        ...state,
        status: "playing",
        source: event.source,
        message: event.message ?? state.message,
        error: null,
      };
    case "AUTOPLAY_BLOCKED":
      return {
        ...state,
        status: "paused",
        source: event.source,
        highlight: null,
        message: event.message,
        error: null,
      };
    case "PAUSED":
      return {
        ...state,
        status: "paused",
        highlight: null,
        positionMs: Math.max(0, event.positionMs ?? state.positionMs),
      };
    case "RESUMED":
      return {
        ...state,
        status: "playing",
        error: null,
      };
    case "STOPPED":
      return {
        ...state,
        status: "idle",
        source: null,
        highlight: null,
        positionMs: 0,
        durationMs: 0,
        message: null,
        error: null,
      };
    case "PAGE_SELECTED":
      return {
        ...state,
        status: event.continuePlayback ? "loading" : "idle",
        pageIndex: event.pageIndex,
        source: null,
        highlight: null,
        positionMs: 0,
        durationMs: 0,
        message: event.continuePlayback
          ? `正在准备第 ${event.pageIndex + 1} 页…`
          : null,
        error: null,
      };
    case "LANGUAGE_CHANGED":
      return {
        ...state,
        status: event.restart ? "loading" : "idle",
        languageMode: event.languageMode,
        source: null,
        highlight: null,
        positionMs: 0,
        durationMs: 0,
        message: event.restart ? "正在按新的语言模式重新准备当前页…" : null,
        error: null,
      };
    case "AUTO_ADVANCE_CHANGED":
      return { ...state, autoAdvance: event.autoAdvance };
    case "HIGHLIGHT_CHANGED":
      return { ...state, highlight: event.highlight };
    case "POSITION_CHANGED":
      return {
        ...state,
        positionMs: Math.max(0, event.positionMs),
        durationMs: Math.max(0, event.durationMs ?? state.durationMs),
      };
    case "PAGE_ENDED":
      if (event.nextPageIndex !== undefined) {
        return {
          ...state,
          status: "loading",
          pageIndex: event.nextPageIndex,
          source: null,
          highlight: null,
          positionMs: 0,
          durationMs: 0,
          message:
            event.message ?? `正在准备第 ${event.nextPageIndex + 1} 页…`,
          error: null,
        };
      }
      return {
        ...state,
        status: "ended",
        source: null,
        highlight: null,
        positionMs: 0,
        durationMs: 0,
        message: event.message ?? "当前页已播放完毕",
        error: null,
      };
    case "BOOK_ENDED":
      return {
        ...state,
        status: "ended",
        source: null,
        highlight: null,
        positionMs: 0,
        durationMs: 0,
        message: event.message ?? "整本绘本已播放完毕",
        error: null,
      };
    case "FAILED":
      return {
        ...state,
        status: "error",
        source: null,
        highlight: null,
        message: null,
        error: event.error,
      };
    default:
      return state;
  }
}

export function isPlaybackActive(status: PlaybackStatus) {
  return status === "loading" || status === "playing" || status === "paused";
}
