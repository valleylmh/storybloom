import { describe, expect, it } from "vitest";
import { nextSeriesBook, parsePlaybackHandoff } from "@/lib/reader/continuous-playback";

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
