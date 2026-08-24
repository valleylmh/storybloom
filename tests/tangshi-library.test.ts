import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  getAllSeries,
  getBook,
  getPublishedBooks,
  getSeries,
  getSeriesBooks,
} from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import {
  filterLibraryBooks,
  getLibraryRecommendations,
} from "@/lib/library/discovery";
import { resolveLibraryBookMetadata } from "@/lib/library/metadata";
import { getLibraryStorySpecByContentId } from "@/lib/library/personalization";

const TANGSHI_BOOKS = [
  {
    id: "yong-e",
    title: "咏鹅",
    author: "骆宾王",
    lines: ["鹅，鹅，鹅，", "曲项向天歌。", "白毛浮绿水，", "红掌拨清波。"],
  },
  {
    id: "jing-ye-si",
    title: "静夜思",
    author: "李白",
    lines: ["床前明月光，", "疑是地上霜。", "举头望明月，", "低头思故乡。"],
  },
  {
    id: "chun-xiao",
    title: "春晓",
    author: "孟浩然",
    lines: ["春眠不觉晓，", "处处闻啼鸟。", "夜来风雨声，", "花落知多少。"],
  },
  {
    id: "deng-guan-que-lou",
    title: "登鹳雀楼",
    author: "王之涣",
    lines: ["白日依山尽，", "黄河入海流。", "欲穷千里目，", "更上一层楼。"],
  },
  {
    id: "lu-chai",
    title: "鹿柴",
    author: "王维",
    lines: ["空山不见人，", "但闻人语响。", "返景入深林，", "复照青苔上。"],
  },
  {
    id: "wang-lu-shan-pu-bu",
    title: "望庐山瀑布",
    author: "李白",
    lines: ["日照香炉生紫烟，", "遥看瀑布挂前川。", "飞流直下三千尺，", "疑是银河落九天。"],
  },
  {
    id: "jue-ju-liang-ge-huang-li",
    title: "绝句·两个黄鹂鸣翠柳",
    author: "杜甫",
    lines: ["两个黄鹂鸣翠柳，", "一行白鹭上青天。", "窗含西岭千秋雪，", "门泊东吴万里船。"],
  },
  {
    id: "jiang-xue",
    title: "江雪",
    author: "柳宗元",
    lines: ["千山鸟飞绝，", "万径人踪灭。", "孤舟蓑笠翁，", "独钓寒江雪。"],
  },
  {
    id: "min-nong-qi-er",
    title: "悯农·其二",
    author: "李绅",
    lines: ["锄禾日当午，", "汗滴禾下土。", "谁知盘中餐，", "粒粒皆辛苦。"],
  },
  {
    id: "chi-shang",
    title: "池上",
    author: "白居易",
    lines: ["小娃撑小艇，", "偷采白莲回。", "不解藏踪迹，", "浮萍一道开。"],
  },
  {
    id: "xiang-si",
    title: "相思",
    author: "王维",
    lines: ["红豆生南国，", "春来发几枝。", "愿君多采撷，", "此物最相思。"],
  },
  {
    id: "zeng-wang-lun",
    title: "赠汪伦",
    author: "李白",
    lines: [
      "李白乘舟将欲行，",
      "忽闻岸上踏歌声。",
      "桃花潭水深千尺，",
      "不及汪伦送我情。",
    ],
  },
  {
    id: "zao-fa-bai-di-cheng",
    title: "早发白帝城",
    author: "李白",
    lines: [
      "朝辞白帝彩云间，",
      "千里江陵一日还。",
      "两岸猿声啼不住，",
      "轻舟已过万重山。",
    ],
  },
  {
    id: "huang-he-lou-song-meng-hao-ran-zhi-guang-ling",
    title: "黄鹤楼送孟浩然之广陵",
    author: "李白",
    lines: [
      "故人西辞黄鹤楼，",
      "烟花三月下扬州。",
      "孤帆远影碧空尽，",
      "唯见长江天际流。",
    ],
  },
  {
    id: "jiu-yue-jiu-ri-yi-shan-dong-xiong-di",
    title: "九月九日忆山东兄弟",
    author: "王维",
    lines: [
      "独在异乡为异客，",
      "每逢佳节倍思亲。",
      "遥知兄弟登高处，",
      "遍插茱萸少一人。",
    ],
  },
  {
    id: "zhu-li-guan",
    title: "竹里馆",
    author: "王维",
    lines: ["独坐幽篁里，", "弹琴复长啸。", "深林人不知，", "明月来相照。"],
  },
  {
    id: "xun-yin-zhe-bu-yu",
    title: "寻隐者不遇",
    author: "贾岛",
    lines: ["松下问童子，", "言师采药去。", "只在此山中，", "云深不知处。"],
  },
  {
    id: "xiao-er-chui-diao",
    title: "小儿垂钓",
    author: "胡令能",
    lines: [
      "蓬头稚子学垂纶，",
      "侧坐莓苔草映身。",
      "路人借问遥招手，",
      "怕得鱼惊不应人。",
    ],
  },
  {
    id: "shan-xing",
    title: "山行",
    author: "杜牧",
    lines: [
      "远上寒山石径斜，",
      "白云生处有人家。",
      "停车坐爱枫林晚，",
      "霜叶红于二月花。",
    ],
  },
  {
    id: "feng-qiao-ye-bo",
    title: "枫桥夜泊",
    author: "张继",
    lines: [
      "月落乌啼霜满天，",
      "江枫渔火对愁眠。",
      "姑苏城外寒山寺，",
      "夜半钟声到客船。",
    ],
  },
] as const;

function allSummaries() {
  return getAllSeries().flatMap((series) =>
    getSeriesBooks(series.id).map((book) =>
      createLibraryBookSummary(series, book),
    ),
  );
}

describe("Tang poetry library series", () => {
  it("registers the twenty-book 唐诗入画 series in the requested order", () => {
    const series = getSeries("tangshi");
    expect(series).toMatchObject({
      title: "唐诗入画",
      subtitle: "一首诗，一幅会呼吸的画",
      accent: "#47677a",
      ageRange: "4-8 岁",
      bookCount: 20,
    });
    expect(getPublishedBooks("tangshi").map((book) => book.id)).toEqual(
      TANGSHI_BOOKS.map((book) => book.id),
    );
  });

  it("preserves every original poem and follows the eight-page reading map", () => {
    for (const [index, expected] of TANGSHI_BOOKS.entries()) {
      const book = getBook("tangshi", expected.id);
      expect(book).toMatchObject({
        title: expected.title,
        seriesId: "tangshi",
        order: index + 1,
        publishedAt: "2026-08-24",
        comingSoon: false,
        poem: {
          dynasty: "唐",
          author: expected.author,
          originalLines: expected.lines,
        },
      });
      expect(book?.poem?.englishLines).toHaveLength(4);
      expect(book?.poem?.appreciation.zh).toBeTruthy();
      expect(book?.poem?.appreciation.en).toBeTruthy();
      expect(book?.pages).toHaveLength(8);
      expect(book?.pages.map((page) => page.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      const completePoem = expected.lines.join("\n");
      expect(book?.pages[0].zhText.startsWith(completePoem)).toBe(true);
      expect(book?.pages[7].zhText.startsWith(completePoem)).toBe(true);
      for (let lineIndex = 0; lineIndex < 4; lineIndex += 1) {
        expect(book?.pages[lineIndex + 1].zhText.startsWith(expected.lines[lineIndex])).toBe(true);
      }
    }
  });

  it("publishes one hundred and sixty optimized square WebP illustrations", async () => {
    let imageCount = 0;
    for (const expected of TANGSHI_BOOKS) {
      const book = getBook("tangshi", expected.id);
      expect(book).not.toBeNull();
      for (const page of book?.pages ?? []) {
        const expectedUrl = `/library/tangshi/${expected.id}/${page.page}.webp`;
        expect(page).toMatchObject({
          imageUrl: expectedUrl,
          imageStatus: "complete",
        });
        const imagePath = join(process.cwd(), "public", expectedUrl);
        expect(existsSync(imagePath), `${imagePath} should exist`).toBe(true);
        const stats = statSync(imagePath);
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.size).toBeLessThanOrEqual(300 * 1024);
        const metadata = await sharp(imagePath).metadata();
        expect(metadata).toMatchObject({ width: 1024, height: 1024, format: "webp" });
        imageCount += 1;
      }
    }
    expect(imageCount).toBe(160);
  });

  it("adds poetry discovery metadata and searches author plus imagery", () => {
    const book = getBook("tangshi", "jing-ye-si");
    expect(book).not.toBeNull();
    if (!book) return;

    expect(resolveLibraryBookMetadata(book)).toMatchObject({
      category: "poetry",
      personalizationEnabled: false,
      bedtimeSuitable: true,
      tags: ["唐诗", "古诗", "传统文化", "意境启蒙"],
    });
    expect(
      filterLibraryBooks(allSummaries(), { query: "李白 月亮" }).map(
        (item) => item.contentId,
      ),
    ).toContain("tangshi/jing-ye-si");
    expect(
      filterLibraryBooks(allSummaries(), { query: "王维 红豆" }).map(
        (item) => item.contentId,
      ),
    ).toContain("tangshi/xiang-si");
    expect(
      filterLibraryBooks(allSummaries(), { query: "张继 钟声" }).map(
        (item) => item.contentId,
      ),
    ).toContain("tangshi/feng-qiao-ye-bo");
    expect(
      filterLibraryBooks(allSummaries(), {
        filters: { category: "poetry", seriesId: "tangshi" },
      }).map((item) => item.contentId),
    ).toEqual(TANGSHI_BOOKS.map((item) => `tangshi/${item.id}`));
  });

  it("recommends the next poem and disables personalized adaptations", () => {
    const series = getSeries("tangshi");
    const current = getBook("tangshi", "yong-e");
    expect(series && current).toBeTruthy();
    if (!series || !current) return;

    const recommendation = getLibraryRecommendations(
      createLibraryBookSummary(series, current),
      allSummaries(),
    )[0];
    expect(recommendation).toMatchObject({
      book: { contentId: "tangshi/jing-ye-si" },
      reason: "同系列下一本",
    });
    expect(getLibraryStorySpecByContentId("tangshi/yong-e")).toBeNull();
  });

  it("includes the series and all twenty books in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/library/tangshi"))).toBe(true);
    expect(
      urls.filter((url) => url.includes("/library/tangshi/")),
    ).toHaveLength(20);
    for (const book of TANGSHI_BOOKS) {
      expect(urls.some((url) => url.endsWith(`/library/tangshi/${book.id}`))).toBe(true);
    }
  });
});
