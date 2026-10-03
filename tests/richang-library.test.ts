import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getAllSeries, getSeries, getPublishedBooks, getAdjacentBooks } from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import { filterLibraryBooks } from "@/lib/library/discovery";
import { getLibraryChineseAudio } from "@/lib/library-book-audio";
import { getLibraryStorySpecByContentId } from "@/lib/library/personalization";
import sitemap from "@/app/sitemap";
import batch2Plan from "../content-drafts/richang/batch-11-20/plan.json";
import batch3Plan from "../content-drafts/richang/batch-21-30/plan.json";
import batch4Plan from "../content-drafts/richang/batch-31-40/plan.json";

const FIRST_IDS = ["lan-ping-guo", "she-bu-de-chuan-de-xin-xie", "te-bie-de-ri-zi-shi-na-tian", "wan-ju-shan-li-zhao-xiao-che", "zai-wan-wu-fen-zhong", "wo-de-bing-gan-zen-me-geng-xiao", "yi-bei-da-fan-de-niu-nai", "deng-wo-xin-qing-hao-le-zai-shuo", "zen-me-zhi-you-wo-zai-shou-shi", "bu-tai-wan-mei-de-ye-can"];
const expandedBooks = [...batch2Plan.books, ...batch3Plan.books, ...batch4Plan.books];
const IDS = [...FIRST_IDS, ...expandedBooks.map(({ id }) => id)];
const PAGE_COUNTS = [16, 12, 12, 12, 12, 12, 12, 12, 12, 12, ...expandedBooks.map(({ pages }) => pages)];

describe("Everyday human-character library", () => {
  it("exposes only completed ordered bilingual books of 12–20 pages with caregiver guidance", () => {
    expect(getAllSeries().some((series) => series.id === "richang")).toBe(true);
    expect(getSeries("richang")).toMatchObject({ title: "日常系列", bookCount: IDS.length, ageRange: "4–8 岁" });
    const books = getPublishedBooks("richang");
    expect(books.map((book) => book.id)).toEqual(IDS);
    expect(books.map((book) => book.pages.length)).toEqual(PAGE_COUNTS);
    for (const [index, book] of books.entries()) {
      expect(book.order).toBe(index + 1);
      expect(book.pages.map((page) => page.page)).toEqual(Array.from({ length: book.pages.length }, (_, i) => i + 1));
      expect(book.pages.every((page) => page.zhText.trim() && page.enText.trim())).toBe(true);
      expect(new Set(book.pages.map((page) => page.zhText)).size).toBe(book.pages.length);
      expect(book.parentGuide?.questions).toHaveLength(2);
      expect(book.parentGuide?.reminder).toBeTruthy();
      expect(book.parentGuide?.activity).toBeTruthy();
      expect(book.metadata?.category).toBe("family-growth");
      expect(getLibraryStorySpecByContentId(`richang/${book.id}`)).toBeNull();
    }
  });

  it("serves distinct builtin illustrations as bounded square WebP files", async () => {
    const hashes = new Set<string>();
    for (const book of getPublishedBooks("richang")) {
      const draft = JSON.parse(readFileSync(path.resolve("content-drafts/richang", `${book.id}.json`), "utf8"));
      for (const page of book.pages) {
        expect(page.imageStatus).toBe("complete");
        expect(page.imageUrl).toBe(`/library/richang/${book.id}/${page.page}.webp`);
        const file = path.resolve(`public${page.imageUrl}`);
        expect(statSync(file).size).toBeGreaterThan(1000);
        expect(statSync(file).size).toBeLessThanOrEqual(300 * 1024);
        expect(await sharp(file).metadata()).toMatchObject({ width: 1200, height: 1200, format: "webp" });
        const source = draft.book.pages[page.page - 1];
        expect(source.generatedWith).toBe("builtin-imagegen");
        expect(source.generationPrompt).toMatch(/THIS PAGE'S SCENE|Image 1 is the EDIT TARGET/);
        hashes.add(createHash("sha256").update(readFileSync(file)).digest("hex"));
      }
    }
    expect(hashes.size).toBe(PAGE_COUNTS.reduce((total, pages) => total + pages, 0));
  });

  it("resolves current bundled Bailian narration with complete timing and rejects stale text", () => {
    for (const book of getPublishedBooks("richang")) {
      const audio = getLibraryChineseAudio("richang", book.id, book.pages);
      expect(audio, book.id).toBeDefined();
      if (!audio) continue;
      expect(audio.url).toMatch(/^\/library\/richang\/[^/]+\/zh-[a-f0-9]{16}\.mp3$/);
      expect(audio.pageStarts).toHaveLength(book.pages.length);
      expect(audio.pageStarts[0]).toBe(0);
      expect(audio.pageStarts.every((value, i) => i === 0 || value > audio.pageStarts[i - 1])).toBe(true);
      expect(audio.duration).toBeGreaterThan(audio.pageStarts.at(-1)!);
      const file = path.resolve(`public${audio.url}`);
      expect(statSync(file).size).toBeGreaterThan(1000);
      const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 });
      expect(Math.abs(pcm.length / 48000 - audio.duration)).toBeLessThan(0.05);
      const modified = book.pages.map((page, i) => i === 0 ? { ...page, zhText: page.zhText + "修改" } : page);
      expect(getLibraryChineseAudio("richang", book.id, modified)).toBeUndefined();
    }
  });

  it("supports family-growth discovery, adjacency and public sitemap routes", () => {
    const series = getSeries("richang")!;
    const books = getPublishedBooks("richang");
    const summaries = books.map((book) => createLibraryBookSummary(series, book));
    expect(filterLibraryBooks(summaries, { query: "烂苹果", filters: { category: "family-growth", seriesId: "richang", language: "bilingual" } }).map((book) => book.id)).toEqual([IDS[0]]);
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/library/richang"))).toBe(true);
    for (const [index, id] of IDS.entries()) {
      expect(urls.some((url) => url.endsWith(`/library/richang/${id}`))).toBe(true);
      expect(getAdjacentBooks("richang", id).previous?.id ?? null).toBe(IDS[index - 1] ?? null);
      expect(getAdjacentBooks("richang", id).next?.id ?? null).toBe(IDS[index + 1] ?? null);
    }
  });
});
