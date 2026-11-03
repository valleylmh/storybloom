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
import batch5Plan from "../content-drafts/richang/batch-41-50/plan.json";
import batch6Plan from "../content-drafts/richang/batch-51-51/plan.json";
import batch7Plan from "../content-drafts/richang/batch-52-52/plan.json";

const FIRST_IDS = ["lan-ping-guo", "she-bu-de-chuan-de-xin-xie", "te-bie-de-ri-zi-shi-na-tian", "wan-ju-shan-li-zhao-xiao-che", "zai-wan-wu-fen-zhong", "wo-de-bing-gan-zen-me-geng-xiao", "yi-bei-da-fan-de-niu-nai", "deng-wo-xin-qing-hao-le-zai-shuo", "zen-me-zhi-you-wo-zai-shou-shi", "bu-tai-wan-mei-de-ye-can"];
const expandedBooks = [...batch2Plan.books, ...batch3Plan.books, ...batch4Plan.books, ...batch5Plan.books, ...batch6Plan.books, ...batch7Plan.books];
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
        expect(source.generatedSource).toMatch(/\/[^/]+\.png$/);
        if (["scene-only-legacy", "partial-legacy"].includes(source.generationPromptScope)) {
          // Earlier imports did not retain the complete provider prompt.
          expect(book.order).toBeGreaterThanOrEqual(41);
          expect(book.order).toBeLessThanOrEqual(50);
          expect(source.generationPrompt.trim().length).toBeGreaterThan(30);
          expect(source.provenanceNote).toBeTruthy();
          if (source.generationPromptScope === "partial-legacy") {
            expect(source.generationPrompt).toContain("...");
          } else {
            expect(source.generationPrompt).not.toMatch(/^Use case:/);
          }
        } else {
          expect(source.generationPrompt).toMatch(/THIS PAGE'S SCENE|Image 1 is the EDIT TARGET|Use the referenced image for exact character identity/);
        }
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
      if (book.order >= 41) {
        for (const [index, start] of audio.pageStarts.entries()) {
          const end = audio.pageStarts[index + 1] ?? audio.duration;
          let squared = 0, count = 0;
          for (let offset = Math.floor(start * 24000) * 2; offset + 1 < Math.min(pcm.length, Math.floor(end * 24000) * 2); offset += 2) {
            squared += (pcm.readInt16LE(offset) / 32768) ** 2;
            count++;
          }
          expect(Math.sqrt(squared / count), `${book.id} page ${index + 1} RMS`).toBeGreaterThan(0.001);
        }
      }
      const modified = book.pages.map((page, i) => i === 0 ? { ...page, zhText: page.zhText + "修改" } : page);
      expect(getLibraryChineseAudio("richang", book.id, modified)).toBeUndefined();
    }
  }, 30_000);

  it("keeps batch 5 focused on optional learning and supported kindergarten routines", () => {
    expect(batch5Plan.approved).toBe(true);
    expect(batch5Plan.books).toHaveLength(10);
    expect(batch5Plan.totalPages).toBe(180);
    const books = getPublishedBooks("richang").filter((book) => book.order >= 41 && book.order <= 50);
    expect(books.map((book) => book.id)).toEqual(batch5Plan.books.map((book) => book.id));
    const pinyin = books.find((book) => book.order === 43)!;
    expect(pinyin.parentGuide?.reminder).toContain("不是大班必学");
    expect(pinyin.pages[11].zhText).toContain("朝同一个方向");
    expect(pinyin.pages[11].zhText).toContain("手心转向自己");
    expect(pinyin.pages[15].zhText).toContain("红铅笔先放在纸上");
    const tooth = books.find((book) => book.order === 42)!;
    expect(tooth.pages[10].zhText).toContain("牙根会慢慢被吸收");
    expect(tooth.pages[11].zhText).toContain("每个人换牙的时间都不一样");
    expect(tooth.pages[13].zhText).toContain("不要用力拔");
    const bathroom = books.find((book) => book.order === 45)!;
    expect(bathroom.pages[14].zhText).toContain("林老师留意着");
    expect(books.every((book) => book.metadata?.tags?.includes("大班生活"))).toBe(true);
  });

  it("keeps book 51 on the Wednesday helper and parent volunteer gate duty", () => {
    expect(batch6Plan.approved).toBe(true);
    expect(batch6Plan.books).toEqual([{ id: "ma-ma-zai-xiao-men-kou-zhan-gang", title: "今天妈妈在校门口站岗", pages: 18, order: 51 }]);
    const book = getPublishedBooks("richang").find((entry) => entry.order === 51)!;
    expect(book.id).toBe("ma-ma-zai-xiao-men-kou-zhan-gang");
    expect(book.pages).toHaveLength(18);
    expect(book.metadata?.tags).toEqual(expect.arrayContaining(["大班生活", "值日服务", "家长志愿者"]));
    expect(book.parentGuide?.reminder).toContain("不把站岗说成“妈妈在看着你”");
    expect(book.pages[0].zhText).toContain("星期三");
    expect(book.pages[3].zhText).toContain("值日");
    expect(book.pages[9].zhText).toContain("站岗");
    // The child stays with the class instead of leaving the group to reach Mom.
    expect(book.pages[11].zhText).toContain("牵着一个小朋友走过通道");
    expect(book.pages[12].zhText).toContain("又停住了");
    expect(book.pages[13].zhText).toContain("不离开队伍");
    expect(book.pages[15].zhText).toContain("没有走上来抱她");
    expect(book.pages[17].zhText).toContain("都在自己的位置上帮了忙");
  });

  it("supports family-growth discovery, adjacency and public sitemap routes", () => {
    const series = getSeries("richang")!;
    const books = getPublishedBooks("richang");
    const summaries = books.map((book) => createLibraryBookSummary(series, book));
    expect(filterLibraryBooks(summaries, { query: "烂苹果", filters: { category: "family-growth", seriesId: "richang", language: "bilingual" } }).map((book) => book.id)).toEqual([IDS[0]]);
    const urls = sitemap().filter((entry) => !new URL(entry.url).pathname.startsWith("/en/")).map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/library/richang"))).toBe(true);
    for (const [index, id] of IDS.entries()) {
      expect(urls.some((url) => url.endsWith(`/library/richang/${id}`))).toBe(true);
      expect(getAdjacentBooks("richang", id).previous?.id ?? null).toBe(IDS[index - 1] ?? null);
      expect(getAdjacentBooks("richang", id).next?.id ?? null).toBe(IDS[index + 1] ?? null);
    }
  });
});
