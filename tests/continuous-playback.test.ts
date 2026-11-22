import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatNextBookAnnouncement,
  nextSeriesBook,
  parseContinuousPlaybackPreference,
  parsePlaybackHandoff,
  previousSeriesBook,
  startNextBookCountdown,
} from "@/lib/reader/continuous-playback";

describe("series continuous playback", () => {
  const books = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("defaults continuous playback to enabled unless explicitly turned off", () => {
    expect(parseContinuousPlaybackPreference(null)).toBe(true);
    expect(parseContinuousPlaybackPreference("true")).toBe(true);
    expect(parseContinuousPlaybackPreference("false")).toBe(false);
    const experienceSource = readFileSync(
      "src/components/library/LibraryBookExperience.tsx",
      "utf8",
    );
    expect(experienceSource).toContain("useState(true)");
    expect(experienceSource).toContain("parseContinuousPlaybackPreference");
  });
  it("follows playlist order and stops after the last book", () => {
    expect(nextSeriesBook(books, "a")).toEqual({ id: "b" });
    expect(nextSeriesBook(books, "c")).toBeUndefined();
    expect(nextSeriesBook(books, "missing")).toBeUndefined();
    expect(nextSeriesBook([], "a")).toBeUndefined();
    expect(previousSeriesBook(books, "a")).toBeUndefined();
    expect(previousSeriesBook(books, "b")).toEqual({ id: "a" });
    expect(previousSeriesBook(books, "missing")).toBeUndefined();
  });
  it("formats warm spoken next-book announcements without duplicate punctuation", () => {
    expect(formatNextBookAnnouncement({ title: "守株待兔" }, "zh")).toEqual({
      text: "接下来播放下一本故事，守株待兔。",
      ttsMode: "zh",
      lang: "zh-CN",
    });
    expect(
      formatNextBookAnnouncement({ title: "我想去洗手间，可以举手吗？" }, "zh-en"),
    ).toEqual({
      text: "接下来播放下一本故事，我想去洗手间，可以举手吗？",
      ttsMode: "zh",
      lang: "zh-CN",
    });
    expect(
      formatNextBookAnnouncement(
        { title: "守株待兔", englishTitle: "Waiting by the Stump for a Hare" },
        "en",
      ),
    ).toEqual({
      text: "Next story: Waiting by the Stump for a Hare.",
      ttsMode: "en",
      lang: "en-US",
    });
    expect(
      formatNextBookAnnouncement({ title: "守株待兔" }, "en"),
    ).toEqual({
      text: "接下来播放下一本故事，守株待兔。",
      ttsMode: "zh",
      lang: "zh-CN",
    });
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
