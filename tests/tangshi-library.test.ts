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
  {
    id: "mu-jiang-yin",
    title: "暮江吟",
    author: "白居易",
    publishedAt: "2026-08-26",
    lines: [
      "一道残阳铺水中，",
      "半江瑟瑟半江红。",
      "可怜九月初三夜，",
      "露似真珠月似弓。",
    ],
  },
  {
    id: "da-lin-si-tao-hua",
    title: "大林寺桃花",
    author: "白居易",
    publishedAt: "2026-08-26",
    lines: [
      "人间四月芳菲尽，",
      "山寺桃花始盛开。",
      "长恨春归无觅处，",
      "不知转入此中来。",
    ],
  },
  {
    id: "fu-de-gu-yuan-cao-song-bie",
    title: "赋得古原草送别",
    author: "白居易",
    publishedAt: "2026-08-26",
    lines: [
      "离离原上草，",
      "一岁一枯荣。",
      "野火烧不尽，",
      "春风吹又生。",
      "远芳侵古道，",
      "晴翠接荒城。",
      "又送王孙去，",
      "萋萋满别情。",
    ],
    pageLineGroups: [
      ["离离原上草，", "一岁一枯荣。"],
      ["野火烧不尽，", "春风吹又生。"],
      ["远芳侵古道，", "晴翠接荒城。"],
      ["又送王孙去，", "萋萋满别情。"],
    ],
  },
  {
    id: "yi-jiang-nan-jiang-nan-hao",
    title: "忆江南·江南好",
    author: "白居易",
    publishedAt: "2026-08-26",
    lines: [
      "江南好，",
      "风景旧曾谙。",
      "日出江花红胜火，",
      "春来江水绿如蓝。",
      "能不忆江南？",
    ],
    pageLineGroups: [
      ["江南好，"],
      ["风景旧曾谙。"],
      ["日出江花红胜火，", "春来江水绿如蓝。"],
      ["能不忆江南？"],
    ],
  },
  {
    id: "shi-zhi-sai-shang",
    title: "使至塞上",
    author: "王维",
    publishedAt: "2026-08-27",
    lines: [
      "单车欲问边，", "属国过居延。", "征蓬出汉塞，", "归雁入胡天。",
      "大漠孤烟直，", "长河落日圆。", "萧关逢候骑，", "都护在燕然。",
    ],
    pageLineGroups: [
      ["单车欲问边，", "属国过居延。"],
      ["征蓬出汉塞，", "归雁入胡天。"],
      ["大漠孤烟直，", "长河落日圆。"],
      ["萧关逢候骑，", "都护在燕然。"],
    ],
  },
  {
    id: "yong-liu",
    title: "咏柳",
    author: "贺知章",
    publishedAt: "2026-08-27",
    lines: ["碧玉妆成一树高，", "万条垂下绿丝绦。", "不知细叶谁裁出，", "二月春风似剪刀。"],
  },
  {
    id: "jue-ju-chi-ri-jiang-shan-li",
    title: "绝句·迟日江山丽",
    author: "杜甫",
    publishedAt: "2026-08-27",
    lines: ["迟日江山丽，", "春风花草香。", "泥融飞燕子，", "沙暖睡鸳鸯。"],
  },
  {
    id: "chun-ye-xi-yu",
    title: "春夜喜雨",
    author: "杜甫",
    publishedAt: "2026-08-27",
    lines: [
      "好雨知时节，", "当春乃发生。", "随风潜入夜，", "润物细无声。",
      "野径云俱黑，", "江船火独明。", "晓看红湿处，", "花重锦官城。",
    ],
    pageLineGroups: [
      ["好雨知时节，", "当春乃发生。"],
      ["随风潜入夜，", "润物细无声。"],
      ["野径云俱黑，", "江船火独明。"],
      ["晓看红湿处，", "花重锦官城。"],
    ],
  },
  {
    id: "you-zi-yin",
    title: "游子吟",
    author: "孟郊",
    publishedAt: "2026-08-27",
    lines: ["慈母手中线，", "游子身上衣。", "临行密密缝，", "意恐迟迟归。", "谁言寸草心，", "报得三春晖。"],
    pageLineGroups: [
      ["慈母手中线，", "游子身上衣。"],
      ["临行密密缝，"],
      ["意恐迟迟归。"],
      ["谁言寸草心，", "报得三春晖。"],
    ],
  },
  {
    id: "feng",
    title: "风",
    author: "李峤",
    publishedAt: "2026-08-27",
    lines: ["解落三秋叶，", "能开二月花。", "过江千尺浪，", "入竹万竿斜。"],
  },
  {
    id: "hui-xiang-ou-shu-qi-yi",
    title: "回乡偶书·其一",
    author: "贺知章",
    publishedAt: "2026-08-27",
    lines: ["少小离家老大回，", "乡音无改鬓毛衰。", "儿童相见不相识，", "笑问客从何处来。"],
  },
  {
    id: "wang-tian-men-shan",
    title: "望天门山",
    author: "李白",
    publishedAt: "2026-08-27",
    lines: ["天门中断楚江开，", "碧水东流至此回。", "两岸青山相对出，", "孤帆一片日边来。"],
  },
  {
    id: "feng-xue-su-fu-rong-shan-zhu-ren",
    title: "逢雪宿芙蓉山主人",
    author: "刘长卿",
    publishedAt: "2026-08-27",
    lines: ["日暮苍山远，", "天寒白屋贫。", "柴门闻犬吠，", "风雪夜归人。"],
  },
  {
    id: "wang-dong-ting",
    title: "望洞庭",
    author: "刘禹锡",
    publishedAt: "2026-08-27",
    lines: ["湖光秋月两相和，", "潭面无风镜未磨。", "遥望洞庭山水翠，", "白银盘里一青螺。"],
  },
  {
    id: "gu-lang-yue-xing",
    title: "古朗月行（节选）",
    author: "李白",
    publishedAt: "2026-08-29",
    pages: 9,
    lines: ["小时不识月，", "呼作白玉盘。", "又疑瑶台镜，", "飞在青云端。"],
  },
  {
    id: "ye-su-shan-si",
    title: "夜宿山寺",
    author: "李白",
    publishedAt: "2026-08-29",
    pages: 9,
    lines: ["危楼高百尺，", "手可摘星辰。", "不敢高声语，", "恐惊天上人。"],
  },
  {
    id: "cai-lian-qu",
    title: "采莲曲",
    author: "王昌龄",
    publishedAt: "2026-08-29",
    pages: 10,
    lines: ["荷叶罗裙一色裁，", "芙蓉向脸两边开。", "乱入池中看不见，", "闻歌始觉有人来。"],
  },
  {
    id: "chu-zhou-xi-jian",
    title: "滁州西涧",
    author: "韦应物",
    publishedAt: "2026-08-29",
    pages: 9,
    lines: ["独怜幽草涧边生，", "上有黄鹂深树鸣。", "春潮带雨晚来急，", "野渡无人舟自横。"],
  },
  {
    id: "jiang-pan-du-bu-xun-hua-qi-liu",
    title: "江畔独步寻花·其六",
    author: "杜甫",
    publishedAt: "2026-08-29",
    pages: 9,
    lines: ["黄四娘家花满蹊，", "千朵万朵压枝低。", "留连戏蝶时时舞，", "自在娇莺恰恰啼。"],
  },
  {
    id: "du-zuo-jing-ting-shan",
    title: "独坐敬亭山",
    author: "李白",
    publishedAt: "2026-08-29",
    pages: 9,
    lines: ["众鸟高飞尽，", "孤云独去闲。", "相看两不厌，", "只有敬亭山。"],
  },
  {
    id: "yu-ge-zi-xi-sai-shan-qian-bai-lu-fei",
    title: "渔歌子·西塞山前白鹭飞",
    author: "张志和",
    publishedAt: "2026-08-29",
    pages: 10,
    lines: ["西塞山前白鹭飞，", "桃花流水鳜鱼肥。", "青箬笠，绿蓑衣，", "斜风细雨不须归。"],
  },
  {
    id: "lang-tao-sha-qi-yi",
    title: "浪淘沙·其一",
    author: "刘禹锡",
    publishedAt: "2026-08-29",
    pages: 10,
    lines: ["九曲黄河万里沙，", "浪淘风簸自天涯。", "如今直上银河去，", "同到牵牛织女家。"],
  },
  {
    id: "jiang-nan-chun",
    title: "江南春",
    author: "杜牧",
    publishedAt: "2026-08-29",
    pages: 10,
    lines: ["千里莺啼绿映红，", "水村山郭酒旗风。", "南朝四百八十寺，", "多少楼台烟雨中。"],
  },
  {
    id: "zao-chun-cheng-shui-bu-zhang-shi-ba-yuan-wai",
    title: "早春呈水部张十八员外",
    author: "韩愈",
    publishedAt: "2026-08-29",
    pages: 9,
    lines: ["天街小雨润如酥，", "草色遥看近却无。", "最是一年春好处，", "绝胜烟柳满皇都。"],
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
  it("registers the forty-four-book 唐诗入画 series in the requested order", () => {
    const series = getSeries("tangshi");
    expect(series).toMatchObject({
      title: "唐诗入画",
      subtitle: "一首诗，一幅会呼吸的画",
      accent: "#47677a",
      ageRange: "4-8 岁",
      bookCount: 44,
    });
    expect(getPublishedBooks("tangshi").map((book) => book.id)).toEqual(
      TANGSHI_BOOKS.map((book) => book.id),
    );
  });

  it("preserves every original poem and supports a complete variable-length reading map", () => {
    for (const [index, expected] of TANGSHI_BOOKS.entries()) {
      const book = getBook("tangshi", expected.id);
      expect(book).toMatchObject({
        title: expected.title,
        seriesId: "tangshi",
        order: index + 1,
        publishedAt: "publishedAt" in expected ? expected.publishedAt : "2026-08-24",
        comingSoon: false,
        poem: {
          dynasty: "唐",
          author: expected.author,
          originalLines: expected.lines,
        },
      });
      expect(book?.poem?.englishLines).toHaveLength(expected.lines.length);
      expect(book?.poem?.appreciation.zh).toBeTruthy();
      expect(book?.poem?.appreciation.en).toBeTruthy();
      const expectedPages = "pages" in expected ? expected.pages : 8;
      expect(book?.pages).toHaveLength(expectedPages);
      expect(book?.pages.map((page) => page.page)).toEqual(
        Array.from({ length: expectedPages }, (_, pageIndex) => pageIndex + 1),
      );

      const completePoem = expected.lines.join("\n");
      expect(book?.pages[0].zhText.startsWith(completePoem)).toBe(true);
      expect(book?.pages[expectedPages - 1].zhText.startsWith(completePoem)).toBe(true);
      const pageLineGroups =
        "pageLineGroups" in expected
          ? expected.pageLineGroups
          : expected.lines.map((line) => [line]);
      for (const [pageIndex, lines] of pageLineGroups.entries()) {
        expect(book?.pages[pageIndex + 1].zhText.startsWith(lines.join("\n"))).toBe(true);
      }
    }
  });

  it("publishes three hundred and sixty-six optimized square WebP illustrations", async () => {
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
    expect(imageCount).toBe(366);
  });

  it("adds complete non-preachy parent guides to the ten new variable-length books", () => {
    const newBooks = TANGSHI_BOOKS.slice(34);
    expect(
      new Set(newBooks.map((book) => ("pages" in book ? book.pages : 8))),
    ).toEqual(new Set([9, 10]));

    for (const expected of newBooks) {
      const guide = getBook("tangshi", expected.id)?.parentGuide;
      expect(guide?.goal).toBeTruthy();
      expect(guide?.reminder).toBeTruthy();
      expect(guide?.questions).toHaveLength(3);
      expect(guide?.activity).toBeTruthy();
      expect(guide?.ageTips.age4to5).toBeTruthy();
      expect(guide?.ageTips.age6to8).toBeTruthy();
    }
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
      filterLibraryBooks(allSummaries(), { query: "月亮 好奇心" }).map(
        (item) => item.contentId,
      ),
    ).toContain("tangshi/gu-lang-yue-xing");
    expect(
      filterLibraryBooks(allSummaries(), { query: "成长 节奏" }).map(
        (item) => item.contentId,
      ),
    ).toContain("tangshi/zao-chun-cheng-shui-bu-zhang-shi-ba-yuan-wai");
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

  it("includes the series and all forty-four books in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/library/tangshi"))).toBe(true);
    expect(
      urls.filter((url) => url.includes("/library/tangshi/")),
    ).toHaveLength(44);
    for (const book of TANGSHI_BOOKS) {
      expect(urls.some((url) => url.endsWith(`/library/tangshi/${book.id}`))).toBe(true);
    }
  });
});
