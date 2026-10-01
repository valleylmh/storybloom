import { afterEach, describe, expect, it, vi } from "vitest";
import { nextSeriesBook, parsePlaybackHandoff, startNextBookCountdown } from "@/lib/reader/continuous-playback";

describe("series continuous playback", () => {
  const books = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("follows playlist order and stops after the last book", () => {
    expect(nextSeriesBook(books, "a")).toEqual({ id: "b" });
    expect(nextSeriesBook(books, "c")).toBeUndefined();
    expect(nextSeriesBook(books, "missing")).toBeUndefined();
    expect(nextSeriesBook([], "a")).toBeUndefined();
  });
  it("carries language only into the intended next book", () => {
    const raw = JSON.stringify({ id: "b", language: "zh-en", at: 1000 });
    expect(parsePlaybackHandoff(raw, "b", 2000)?.language).toBe("zh-en");
    expect(parsePlaybackHandoff(raw, "a", 2000)).toBeNull();
    expect(parsePlaybackHandoff(raw, "b", 61_000)).toBeNull();
    expect(parsePlaybackHandoff(raw, "b", 0)).toBeNull();
  });
  it("ignores malformed saved playback requests", () => {
    for (const raw of [null, "broken", "{}", JSON.stringify({ id: "b", language: "invalid", at: 1000 })]) {
      expect(parsePlaybackHandoff(raw, "b", 2000)).toBeNull();
    }
  });
});

describe("next book countdown", () => {
  afterEach(() => vi.useRealTimers());

  it("shows 3, 2, 1 and advances only after three seconds, once", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const complete = vi.fn();
    startNextBookCountdown(tick, complete);
    expect(tick.mock.calls).toEqual([[3]]);
    vi.advanceTimersByTime(1000);
    expect(tick.mock.calls).toEqual([[3], [2]]);
    vi.advanceTimersByTime(1000);
    expect(tick.mock.calls).toEqual([[3], [2], [1]]);
    vi.advanceTimersByTime(999);
    expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(complete).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("stops ticking and never advances after cancellation or unmount", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const complete = vi.fn();
    const stop = startNextBookCountdown(tick, complete);
    vi.advanceTimersByTime(1000);
    stop();
    stop();
    vi.advanceTimersByTime(5000);
    expect(tick.mock.calls).toEqual([[3], [2]]);
    expect(complete).not.toHaveBeenCalled();
  });

  it("starts a fresh three seconds for a new book after a cancelled countdown", () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    const stop = startNextBookCountdown(vi.fn(), complete);
    vi.advanceTimersByTime(2000);
    stop();
    const tick = vi.fn();
    startNextBookCountdown(tick, complete);
    expect(tick).toHaveBeenLastCalledWith(3);
    vi.advanceTimersByTime(2999);
    expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
