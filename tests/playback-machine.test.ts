import { describe, expect, it } from "vitest";
import {
  createInitialPlaybackState,
  playbackReducer,
} from "@/lib/reader/playback-machine";

describe("storybook playback state machine", () => {
  it("moves through loading, playing, paused, resumed, and stopped states", () => {
    let state = createInitialPlaybackState();
    state = playbackReducer(state, { type: "PLAY_REQUESTED" });
    expect(state.status).toBe("loading");

    state = playbackReducer(state, {
      type: "PLAY_STARTED",
      source: "cloud",
    });
    expect(state).toMatchObject({ status: "playing", source: "cloud" });

    state = playbackReducer(state, { type: "PAUSED", positionMs: 4_200 });
    expect(state).toMatchObject({ status: "paused", positionMs: 4_200 });

    state = playbackReducer(state, { type: "RESUMED" });
    expect(state.status).toBe("playing");

    state = playbackReducer(state, { type: "STOPPED" });
    expect(state).toMatchObject({
      status: "idle",
      source: null,
      positionMs: 0,
      highlight: null,
    });
  });

  it("advances only when the page completion event includes a next page", () => {
    const playing = playbackReducer(createInitialPlaybackState(), {
      type: "PLAY_STARTED",
      source: "browser",
    });
    const advancing = playbackReducer(playing, {
      type: "PAGE_ENDED",
      nextPageIndex: 1,
    });
    expect(advancing).toMatchObject({ status: "loading", pageIndex: 1 });

    const stoppedAtPage = playbackReducer(playing, { type: "PAGE_ENDED" });
    expect(stoppedAtPage).toMatchObject({ status: "ended", pageIndex: 0 });
  });

  it("stops at the final page and keeps retryable errors explicit", () => {
    const finalPage = createInitialPlaybackState({ pageIndex: 7 });
    const ended = playbackReducer(finalPage, { type: "BOOK_ENDED" });
    expect(ended).toMatchObject({ status: "ended", pageIndex: 7 });

    const failed = playbackReducer(ended, {
      type: "FAILED",
      error: {
        code: "network",
        message: "播放失败，点击重试。",
        retryable: true,
      },
    });
    expect(failed).toMatchObject({
      status: "error",
      error: { code: "network", retryable: true },
    });

    const retrying = playbackReducer(failed, { type: "RETRY_REQUESTED" });
    expect(retrying).toMatchObject({ status: "loading", error: null });
  });

  it("cancels the previous mode state before restarting in a new language", () => {
    const playing = playbackReducer(createInitialPlaybackState(), {
      type: "PLAY_STARTED",
      source: "cloud",
    });
    const changed = playbackReducer(playing, {
      type: "LANGUAGE_CHANGED",
      languageMode: "zh-en",
      restart: true,
    });
    expect(changed).toMatchObject({
      status: "loading",
      languageMode: "zh-en",
      source: null,
      highlight: null,
      positionMs: 0,
    });
  });
});
