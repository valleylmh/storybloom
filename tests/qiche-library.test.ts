import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import { filterLibraryBooks } from "@/lib/library/discovery";
import {
  getBook,
  getPublishedBooks,
  getSeries,
} from "@/lib/library";
import { getLibraryStorySpecByContentId } from "@/lib/library/personalization";

const EXPECTED_BOOKS = [
  { id: "hong-lu-deng-wei-shen-me-hui-bian-se", pages: 12 },
  { id: "gong-jiao-che-zen-me-zhi-dao-xia-yi-zhan", pages: 12 },
  { id: "di-tie-wei-shen-me-pao-de-kuai", pages: 12 },
  { id: "xiao-fang-che-wei-shen-me-yao-ming-di", pages: 12 },
  { id: "jiu-hu-che-zen-yang-zheng-fen-duo-miao", pages: 12 },
  { id: "la-ji-che-ba-la-ji-song-dao-na-li", pages: 12 },
  { id: "sa-shui-che-wei-shen-me-yi-lu-pen-shui", pages: 10 },
  { id: "xiao-che-wei-shen-me-yao-ting-wen-zai-xia-che", pages: 12 },
  { id: "an-quan-dai-bao-hu-shui", pages: 10 },
  { id: "dian-dong-qi-che-zen-me-chong-dian", pages: 12 },
  { id: "chu-zu-che-wei-shen-me-you-ding-deng", pages: 12 },
  { id: "chu-zu-che-zen-yang-zhao-dao-mu-de-di", pages: 12 },
  { id: "shan-dian-chu-zu-che-he-yu-tian-de-xiao-cheng-ke", pages: 16 },
  { id: "shan-dian-chu-zu-che-song-xiao-xiong-hui-jia", pages: 16 },
  { id: "da-zhong-pi-ka-song-xiao-shu-miao", pages: 16 },
  { id: "da-zhong-pi-ka-he-mu-ou-xi-de-da-ban-jia", pages: 16 },
  { id: "gao-tie-wei-shen-me-pao-de-kuai", pages: 12 },
  { id: "dong-che-zu-zen-yang-yi-qi-pao", pages: 12 },
  { id: "fei-ji-wei-shen-me-neng-fei", pages: 12 },
  { id: "fei-ji-zen-yang-an-quan-qi-fei-he-jiang-luo", pages: 12 },
  { id: "wa-jue-ji-de-da-chan-zi-you-shen-me-ben-ling", pages: 18 },
  { id: "zhuang-zai-ji-ba-sha-zi-song-shang-che", pages: 16 },
  { id: "tui-tu-ji-gei-tu-di-pu-bei-zi", pages: 16 },
  { id: "zi-xie-che-de-che-xiang-tai-qi-lai-le", pages: 18 },
  { id: "jiao-ban-che-de-du-zi-wei-shen-me-yi-zhi-zhuan", pages: 18 },
  { id: "beng-che-de-chang-ge-bo-shen-dao-na-li", pages: 18 },
  { id: "qi-zhong-ji-zen-yang-diao-qi-da-dong-xi", pages: 20 },
  { id: "ya-lu-ji-man-man-zou-lu-mian-bian-jie-shi", pages: 16 },
  { id: "tan-pu-ji-pu-chu-yi-tiao-xin-ma-lu", pages: 20 },
  { id: "gong-cheng-che-xiao-dui-jian-hao-xin-gong-yuan", pages: 20 },
  { id: "shan-dian-chu-zu-che-song-wo-men-qu-zuo-chuan", pages: 20 },
  { id: "da-zhong-pi-ka-zuo-lun-chuan-mu-ou-xi-qu-xiao-dao", pages: 20 },
  { id: "xiao-qi-che-shang-gao-su-qu-kan-pao-che-la", pages: 20 },
  { id: "qi-che-kai-dao-tian-shang-qu-le-ma", pages: 20 },
  { id: "lv-deng-liang-le-wei-shen-me-hai-yao-deng-yi-deng", pages: 16 },
  { id: "xiao-qi-che-zhao-dao-le-ting-che-wei", pages: 16 },
  { id: "hong-se-pao-che-wei-shen-me-pa-de-di-di-de", pages: 20 },
  { id: "hong-se-pao-che-zen-me-zuo-shang-le-da-ka-che", pages: 20 },
  { id: "xiao-qi-che-de-deng-hui-shuo-hua-ma", pages: 16 },
  { id: "xiao-qi-che-zuan-jin-shan-li-le-ma", pages: 20 },
  { id: "lun-tai-shang-de-hua-wen-cang-zhe-shen-me-mi-mi", pages: 16 },
  { id: "xiao-qi-che-xi-zao-la", pages: 16 },
  { id: "wu-ren-ji-ba-kuai-di-song-shang-tian-le-ma", pages: 16 },
  { id: "gao-tie-xiao-fei-long-zen-yang-ping-wen-pao-de-kuai", pages: 20 },
  { id: "da-fei-ji-zai-pao-dao-shang-pai-dui-ma", pages: 20 },
  { id: "tian-shang-de-wei-xing-zen-me-gei-qi-che-yin-lu", pages: 16 },
  { id: "kong-zhong-chu-zu-che-zhen-de-neng-fei-qi-lai-ma", pages: 16 },
  { id: "kuai-di-che-zen-me-zhao-dao-wo-de-bao-guo", pages: 16 },
  { id: "leng-cang-che-du-zi-li-cang-zhe-dong-tian-ma", pages: 16 },
  { id: "xiao-qi-che-zou-bu-dong-shui-lai-bang-bang-ta", pages: 20 },
  { id: "gong-jiao-che-zen-me-fang-xia-yi-zuo-xiao-qiao", pages: 16 },
  { id: "zhuang-man-gu-shi-de-qi-che-kai-dao-na-er-qu", pages: 20 },
] as const;

describe("Qiche city vehicle library", () => {
  it("places pickups after the intact taxi group without classifying pickups as taxis", () => {
    const books = getPublishedBooks("qiche");
    const pickups = books.slice(14, 16);
    expect(pickups.map((book) => book.id)).toEqual([
      "da-zhong-pi-ka-song-xiao-shu-miao",
      "da-zhong-pi-ka-he-mu-ou-xi-de-da-ban-jia",
    ]);
    for (const book of pickups) {
      expect(book.metadata?.tags).toContain("皮卡");
      expect(book.metadata?.tags).not.toContain("出租车");
      expect(book.pages).toHaveLength(16);
      expect(book.parentGuide?.goal).toBeTruthy();
      expect(book.pages.every((page) => page.illustrationPrompt.includes("RED Volkswagen"))).toBe(true);
    }
    const summaries = books.map((book) => createLibraryBookSummary(getSeries("qiche")!, book));
    expect(filterLibraryBooks(summaries, { query: "大众皮卡" }).filter(book => pickups.some(p => p.id === book.id)).map((book) => book.id)).toEqual(
      pickups.map((book) => book.id),
    );
  });

  it("groups both green Lightning Taxi stories immediately after the existing taxis", () => {
    const books = getPublishedBooks("qiche");
    expect(books.slice(10, 14).map((book) => book.id)).toEqual([
      "chu-zu-che-wei-shen-me-you-ding-deng",
      "chu-zu-che-zen-yang-zhao-dao-mu-de-di",
      "shan-dian-chu-zu-che-he-yu-tian-de-xiao-cheng-ke",
      "shan-dian-chu-zu-che-song-xiao-xiong-hui-jia",
    ]);
    const summaries = books.map((book) => createLibraryBookSummary(getSeries("qiche")!, book));
    expect(filterLibraryBooks(summaries, { query: "闪电出租车" }).filter(book => books.slice(12, 14).some(p => p.id === book.id)).map((book) => book.id)).toEqual(
      books.slice(12, 14).map((book) => book.id),
    );
    for (const book of books.slice(12, 14)) {
      expect(book.pages).toHaveLength(16);
      expect(book.parentGuide?.goal).toBeTruthy();
      expect(book.parentGuide?.reminder).toBeTruthy();
      expect(book.pages.every((page) => page.illustrationPrompt.includes("GREEN"))).toBe(true);
    }
    expect(books.every((book) => book.metadata?.seriesOrder === book.order)).toBe(true);
  });

  it("publishes fifty-two ordered variable-length bilingual books", () => {
    const series = getSeries("qiche");
    const books = getPublishedBooks("qiche");

    expect(series).toMatchObject({
      title: "城市汽车小队",
      bookCount: 52,
      ageRange: "4–8 岁",
    });
    expect(books.map(({ id, pages }) => ({ id, pages: pages.length }))).toEqual(
      EXPECTED_BOOKS,
    );

    for (const [index, book] of books.entries()) {
      expect(book.order).toBe(index + 1);
      expect(book.comingSoon).toBe(false);
      expect(book.pages.map((page) => page.page)).toEqual(
        Array.from({ length: book.pages.length }, (_, pageIndex) => pageIndex + 1),
      );
      expect(book.pages.every((page) => page.zhText.trim() && page.enText.trim())).toBe(
        true,
      );
      expect(
        book.pages.every(
          (page) =>
            page.illustrationPrompt.includes("安安") &&
            page.illustrationPrompt.includes("Avoid:") &&
            page.imageStatus === "complete",
        ),
      ).toBe(true);
      expect(book.metadata?.personalizationEnabled).toBe(false);
    }
  });

  it("makes vehicle topics searchable and keeps page text out of the index corpus", () => {
    const series = getSeries("qiche");
    expect(series).not.toBeNull();
    if (!series) return;
    const summaries = getPublishedBooks("qiche").map((book) =>
      createLibraryBookSummary(series, book),
    );

    expect(filterLibraryBooks(summaries, { query: "消防车 鸣笛" }).map((book) => book.id)).toEqual([
      "xiao-fang-che-wei-shen-me-yao-ming-di",
    ]);
    expect(filterLibraryBooks(summaries, { query: "电动汽车 充电" }).map((book) => book.id)).toEqual([
      "dian-dong-qi-che-zen-me-chong-dian",
    ]);
    expect(filterLibraryBooks(summaries, { query: "出租车 顶灯" }).map((book) => book.id)).toEqual([
      "chu-zu-che-wei-shen-me-you-ding-deng",
    ]);
    expect(filterLibraryBooks(summaries, { query: "出租车 目的地" }).map((book) => book.id)).toEqual([
      "chu-zu-che-zen-yang-zhao-dao-mu-de-di",
    ]);
    expect(filterLibraryBooks(summaries, { query: "高铁 空气阻力" }).map((book) => book.id)).toEqual([
      "gao-tie-wei-shen-me-pao-de-kuai",
      "gao-tie-xiao-fei-long-zen-yang-ping-wen-pao-de-kuai",
    ]);
    expect(filterLibraryBooks(summaries, { query: "动车组 车厢连接" }).map((book) => book.id)).toEqual([
      "dong-che-zu-zen-yang-yi-qi-pao",
    ]);
    expect(filterLibraryBooks(summaries, { query: "飞机 升力" }).map((book) => book.id)).toEqual([
      "fei-ji-wei-shen-me-neng-fei",
      "da-fei-ji-zai-pao-dao-shang-pai-dui-ma",
    ]);
    expect(filterLibraryBooks(summaries, { query: "飞机 起飞 降落" }).map((book) => book.id)).toEqual([
      "fei-ji-zen-yang-an-quan-qi-fei-he-jiang-luo",
    ]);
    const firstPageText = getPublishedBooks("qiche")[0].pages[0].zhText;
    expect(summaries[0].searchText).not.toContain(firstPageText);
  });

  it("does not expose the fixed-eight-page personalization flow", () => {
    for (const { id } of EXPECTED_BOOKS) {
      expect(getLibraryStorySpecByContentId(`qiche/${id}`)).toBeNull();
    }
  });

  it("provides 180 engineering pages with distinct topics and caregiver guidance", () => {
    const books = getPublishedBooks("qiche").filter((book) => book.order >= 21 && book.order <= 30);
    expect(books).toHaveLength(10);
    expect(books.reduce((count, book) => count + book.pages.length, 0)).toBe(180);
    for (const book of books) {
      expect(book.parentGuide?.questions).toHaveLength(2);
      expect(book.parentGuide?.activity).toBeTruthy();
      expect(book.parentGuide?.ageTips.age4to5).toBeTruthy();
      expect(book.parentGuide?.ageTips.age6to8).toBeTruthy();
      expect(new Set(book.pages.map((page) => page.zhText)).size).toBe(book.pages.length);
    }
    const series = getSeries("qiche")!;
    const summaries = books.map((book) => createLibraryBookSummary(series, book));
    for (const [query, id] of [
      ["挖掘机 液压", "wa-jue-ji-de-da-chan-zi-you-shen-me-ben-ling"],
      ["搅拌车 水泥", "jiao-ban-che-de-du-zi-wei-shen-me-yi-zhi-zhuan"],
      ["起重机 配重", "qi-zhong-ji-zen-yang-diao-qi-da-dong-xi"],
      ["摊铺机 沥青", "tan-pu-ji-pu-chu-yi-tiao-xin-ma-lu"],
    ]) {
      expect(filterLibraryBooks(summaries, { query }).map((book) => book.id)).toEqual([id]);
    }
  });

  it("connects the five urban car-show books across expressway, elevated road, traffic lights, parking, and sports car topics", () => {
    const books = getPublishedBooks("qiche").filter((book) => book.order >= 33 && book.order <= 37);
    expect(books.map((book) => ({ id: book.id, pages: book.pages.length }))).toEqual([
      { id: "xiao-qi-che-shang-gao-su-qu-kan-pao-che-la", pages: 20 },
      { id: "qi-che-kai-dao-tian-shang-qu-le-ma", pages: 20 },
      { id: "lv-deng-liang-le-wei-shen-me-hai-yao-deng-yi-deng", pages: 16 },
      { id: "xiao-qi-che-zhao-dao-le-ting-che-wei", pages: 16 },
      { id: "hong-se-pao-che-wei-shen-me-pa-de-di-di-de", pages: 20 },
    ]);
    expect(books.reduce((count, book) => count + book.pages.length, 0)).toBe(92);
    const series = getSeries("qiche")!;
    const summaries = books.map((book) => createLibraryBookSummary(series, book));
    for (const [query, id] of [
      ["高速公路 服务区", "xiao-qi-che-shang-gao-su-qu-kan-pao-che-la"],
      ["高架 匝道", "qi-che-kai-dao-tian-shang-qu-le-ma"],
      ["红绿灯 礼让", "lv-deng-liang-le-wei-shen-me-hai-yao-deng-yi-deng"],
      ["停车场 无障碍车位", "xiao-qi-che-zhao-dao-le-ting-che-wei"],
      ["红色跑车 重心", "hong-se-pao-che-wei-shen-me-pa-de-di-di-de"],
    ] as const) {
      expect(filterLibraryBooks(summaries, { query }).map((book) => book.id)).toEqual([id]);
    }
  });

  it("connects the five car-care journey books across car carrier, vehicle lights, mountain tunnel, tire tread, and car wash topics", () => {
    const books = getPublishedBooks("qiche").filter((book) => book.order >= 38 && book.order <= 42);
    expect(books.map((book) => ({ id: book.id, pages: book.pages.length }))).toEqual([
      { id: "hong-se-pao-che-zen-me-zuo-shang-le-da-ka-che", pages: 20 },
      { id: "xiao-qi-che-de-deng-hui-shuo-hua-ma", pages: 16 },
      { id: "xiao-qi-che-zuan-jin-shan-li-le-ma", pages: 20 },
      { id: "lun-tai-shang-de-hua-wen-cang-zhe-shen-me-mi-mi", pages: 16 },
      { id: "xiao-qi-che-xi-zao-la", pages: 16 },
    ]);
    expect(books.reduce((count, book) => count + book.pages.length, 0)).toBe(88);
    const series = getSeries("qiche")!;
    const summaries = books.map((book) => createLibraryBookSummary(series, book));
    for (const [query, id] of [
      ["汽车运输车 车辆固定", "hong-se-pao-che-zen-me-zuo-shang-le-da-ka-che"],
      ["转向灯 刹车灯", "xiao-qi-che-de-deng-hui-shuo-hua-ma"],
      ["道路隧道 通风设备", "xiao-qi-che-zuan-jin-shan-li-le-ma"],
      ["轮胎花纹 轮胎与轮毂", "lun-tai-shang-de-hua-wen-cang-zhe-shen-me-mi-mi"],
      ["洗车流程 废水处理", "xiao-qi-che-xi-zao-la"],
    ] as const) {
      expect(filterLibraryBooks(summaries, { query }).map((book) => book.id)).toEqual([id]);
    }
  });

  it("ships every square WebP illustration within the library budget", async () => {
    for (const { id, pages } of EXPECTED_BOOKS) {
      const book = getBook("qiche", id);
      expect(book).not.toBeNull();
      for (let page = 1; page <= pages; page += 1) {
        const imagePath = join(
          process.cwd(),
          "public",
          "library",
          "qiche",
          id,
          `${page}.webp`,
        );
        expect(existsSync(imagePath), imagePath).toBe(true);
        if (!existsSync(imagePath)) continue;
        expect(statSync(imagePath).size).toBeLessThanOrEqual(300 * 1024);
        const metadata = await sharp(imagePath).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(1200);
        expect(metadata.height).toBe(1200);
        expect(book?.pages[page - 1]?.imageUrl).toBe(
          `/library/qiche/${id}/${page}.webp`,
        );
      }
    }
  });

  it("includes the series and all fifty-two books in the sitemap", () => {
    const urls = sitemap().filter((entry) => !new URL(entry.url).pathname.startsWith("/en/")).map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/library/qiche"))).toBe(true);
    for (const { id } of EXPECTED_BOOKS) {
      expect(urls.some((url) => url.endsWith(`/library/qiche/${id}`))).toBe(true);
    }
  });

  it("keeps the maintained visual lock document reviewable", () => {
    const lock = readFileSync(
      join(process.cwd(), "docs", "library-prompts", "qiche", "characters.md"),
      "utf8",
    );
    expect(lock).toContain("安安");
    expect(lock).toContain("连续性验收");
    expect(lock).toContain("No text");
  });
});
