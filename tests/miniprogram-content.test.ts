import { describe, expect, it } from "vitest";
import { getAllSeries, getSeriesBooks } from "../src/lib/library";
import { exportMiniContent, normalizeMediaBase, publicMediaPath } from "../scripts/lib/miniprogram-content";
import type { LibraryBook } from "../src/types/library";
import { existsSync } from "node:fs";
import path from "node:path";

const series = getAllSeries();
const fixture = structuredClone(getSeriesBooks(series[0].id)[0]);
const exportFixture = (books: LibraryBook[]) => exportMiniContent([series[0]], () => books, "https://media.example.com");

describe("mini program public content boundary", () => {
  it("exports complete published books in existing series order with real variable page counts", () => {
    const output = exportMiniContent(series, getSeriesBooks, "https://media.example.com/");
    const expected = series.flatMap(item => getSeriesBooks(item.id).filter(book => !book.comingSoon && book.pages.length && book.pages.every(p => p.imageStatus === "complete" && p.imageUrl)));
    expect(output.catalog.books).toHaveLength(expected.length);
    expect(output.catalog.series.map(item => item.id)).toEqual(series.map(item => item.id));
    for (const book of expected) {
      const id = `${book.seriesId}/${book.id}`;
      expect(output.books[id].pages).toHaveLength(book.pages.length);
      expect(output.books[id].pages[0].zh).toBe(book.pages[0].zhText);
      expect(output.books[id].pages[0].en).toBe(book.pages[0].enText);
    }
    expect(new Set(output.catalog.books.map(book => book.pageCount)).size).toBeGreaterThan(1);
    expect(output.images.every(image => existsSync(path.resolve(image.source)))).toBe(true);
  });
  it("excludes upcoming, empty and incomplete books", () => {
    const draft = { ...fixture, comingSoon: true };
    const empty = { ...fixture, pages: [] };
    const failed = structuredClone(fixture);
    failed.pages[0].imageStatus = "failed";
    expect(exportFixture([draft, empty, failed]).catalog.books).toEqual([]);
  });
  it("whitelists public fields instead of copying prompts and job metadata", () => {
    const output = exportFixture([fixture]);
    const page = output.books[`${fixture.seriesId}/${fixture.id}`].pages[0];
    expect(Object.keys(page).sort()).toEqual(["audio", "en", "image", "zh"]);
    expect(JSON.stringify(output)).not.toContain("illustrationPrompt");
    expect(JSON.stringify(output)).not.toContain("imageAttemptId");
  });
  it("retains poem line breaks and caregiver context", () => {
    const output = exportMiniContent(series, getSeriesBooks);
    const poem = Object.values(output.books).find(book => book.guide.some(section => section.title === "原诗"));
    expect(poem?.guide.find(section => section.title === "原诗")?.body).toContain("\n\n");
    const classic = Object.values(output.books).find(book => book.guide.some(section => section.title === "经典原文"));
    expect(classic?.guide.map(section => section.title)).toEqual(expect.arrayContaining(["理解古今的不同", "不同年龄怎么读", "一起聊一聊"]));
  });
  it("retains 西游记 original episode labels", () => {
    const output = exportMiniContent(series, getSeriesBooks);
    const original = getSeriesBooks("xiyouji").find(book => book.episodeNumber && !book.comingSoon)!;
    expect(output.catalog.books.find(book => book.id === `xiyouji/${original.id}`)?.title).toContain(`第 ${original.episodeNumber} 回`);
  });
  it("leaves unavailable audio empty and maps only declared static MP3 paths", () => {
    const id = `${fixture.seriesId}/${fixture.id}`;
    const manifest = { [id]: fixture.pages.map((_, index) => index === 0 ? { zh: "audio/book/v1/01.zh.mp3" } : {}) };
    const output = exportMiniContent([series[0]], () => [fixture], "https://media.example.com", manifest);
    expect(output.books[id].pages[0].audio).toEqual({ zh: "https://media.example.com/audio/book/v1/01.zh.mp3", en: "" });
    expect(output.audioSegments).toBe(1);
    expect(output.books[id].pages[1].audio.zh).toBe("");
  });
  it("rejects stale audio manifests rather than assigning tracks to wrong books", () => {
    expect(() => exportMiniContent([series[0]], () => [fixture], "", { missing: [] })).toThrow("不匹配");
  });
  it.each(["http://media.example.com", "https://key:secret@example.com", "https://example.com/?token=secret", "https://example.com/#secret"])("rejects unsafe media base %s", value => {
    expect(() => normalizeMediaBase(value)).toThrow();
  });
  it.each(["https://provider.example.com/signed.mp3?token=x", "audio/../key.mp3", "audio/%2e%2e/key.mp3", "audio//key.mp3", "/.env"])("rejects unsafe object path %s", value => {
    expect(() => publicMediaPath(value)).toThrow();
  });
});
