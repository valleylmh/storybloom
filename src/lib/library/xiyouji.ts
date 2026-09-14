import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";
import { expandXiyoujiIllustrationPrompt } from "@/lib/library/xiyouji-visual-locks";
import baiLongMaDraft from "../../../content-drafts/xiyouji/bai-long-ma/draft.json";
import baoXiangGuoJiuGongZhuDraft from "../../../content-drafts/xiyouji/bao-xiang-guo-jiu-gong-zhu/draft.json";
import baoLinSiJieYeXinDraft from "../../../content-drafts/xiyouji/bao-lin-si-jie-ye-xin/draft.json";
import biQiuGuoHuTongXinDraft from "../../../content-drafts/xiyouji/bi-qiu-guo-hu-tong-xin/draft.json";
import changAnGongDeYuanManDraft from "../../../content-drafts/xiyouji/chang-an-gong-de-yuan-man/draft.json";
import cheChiGuoSanChangBiShiDraft from "../../../content-drafts/xiyouji/che-chi-guo-san-chang-bi-shi/draft.json";
import daNaoTianGongDraft from "../../../content-drafts/xiyouji/da-nao-tian-gong/draft.json";
import fengXianJunQiuGanYuDraft from "../../../content-drafts/xiyouji/feng-xian-jun-qiu-gan-yu/draft.json";
import gaoLaoZhuangYuBaJieDraft from "../../../content-drafts/xiyouji/gao-lao-zhuang-yu-ba-jie/draft.json";
import gaoLaoZhuangFenXingLiDraft from "../../../content-drafts/xiyouji/gao-lao-zhuang-fen-xing-li/draft.json";
import huangHuaGuanJieCaiChaDraft from "../../../content-drafts/xiyouji/huang-hua-guan-jie-cai-cha/draft.json";
import huoYunDongShouHongHaiErDraft from "../../../content-drafts/xiyouji/huo-yun-dong-shou-hong-hai-er/draft.json";
import heiFengShanHuJiaShaDraft from "../../../content-drafts/xiyouji/hei-feng-shan-hu-jia-sha/draft.json";
import heiShuiHeBianTuoLongDraft from "../../../content-drafts/xiyouji/hei-shui-he-bian-tuo-long/draft.json";
import kouFuCiBieDraft from "../../../content-drafts/xiyouji/kou-fu-ci-bie/draft.json";
import kouZhaiShiBaoDraft from "../../../content-drafts/xiyouji/kou-zhai-shi-bao/draft.json";
import laoYuanWenJiuNuoDraft from "../../../content-drafts/xiyouji/lao-yuan-wen-jiu-nuo/draft.json";
import lingYunDuGuoQiaoDraft from "../../../content-drafts/xiyouji/ling-yun-du-guo-qiao/draft.json";
import liuShaHeShouShaSengDraft from "../../../content-drafts/xiyouji/liu-sha-he-shou-sha-seng/draft.json";
import longGongShiSanBaoDraft from "../../../content-drafts/xiyouji/long-gong-shi-san-bao/draft.json";
import huangFengLingDingFengZhuDraft from "../../../content-drafts/xiyouji/huang-feng-ling-ding-feng-zhu/draft.json";
import jiSaiGuoSaoBaoTaDraft from "../../../content-drafts/xiyouji/ji-sai-guo-sao-bao-ta/draft.json";
import jingJiLingKaiLuDraft from "../../../content-drafts/xiyouji/jing-ji-ling-kai-lu/draft.json";
import jinDouDongShouQingNiuDraft from "../../../content-drafts/xiyouji/jin-dou-dong-shou-qing-niu/draft.json";
import jinPingFuShouHuaDengDraft from "../../../content-drafts/xiyouji/jin-ping-fu-shou-hua-deng/draft.json";
import mieFaGuoHuanXinYiDraft from "../../../content-drafts/xiyouji/mie-fa-guo-huan-xin-yi/draft.json";
import muXianAnShiHuiDraft from "../../../content-drafts/xiyouji/mu-xian-an-shi-hui/draft.json";
import muFaDuDongHaiDraft from "../../../content-drafts/xiyouji/mu-fa-du-dong-hai/draft.json";
import nuErGuoCiBieDraft from "../../../content-drafts/xiyouji/nu-er-guo-ci-bie/draft.json";
import panSiDongQiaoTuoXianDraft from "../../../content-drafts/xiyouji/pan-si-dong-qiao-tuo-xian/draft.json";
import panTaoYuanDeQingTieDraft from "../../../content-drafts/xiyouji/pan-tao-yuan-de-qing-tie/draft.json";
import qiJueShanQingGuoXiangDraft from "../../../content-drafts/xiyouji/qi-jue-shan-qing-guo-xiang/draft.json";
import qiShiErBianLianXiDraft from "../../../content-drafts/xiyouji/qi-shi-er-bian-lian-xi/draft.json";
import sanJieBaJiaoShanDraft from "../../../content-drafts/xiyouji/san-jie-ba-jiao-shan/draft.json";
import sanDaBaiGuJingDraft from "../../../content-drafts/xiyouji/san-da-bai-gu-jing/draft.json";
import sanGengWuAnHaoDraft from "../../../content-drafts/xiyouji/san-geng-wu-an-hao/draft.json";
import shaiJingShiLiuHenDraft from "../../../content-drafts/xiyouji/shai-jing-shi-liu-hen/draft.json";
import shuangChaLingRenLuDraft from "../../../content-drafts/xiyouji/shuang-cha-ling-ren-lu/draft.json";
import shiTuXiangYuDraft from "../../../content-drafts/xiyouji/shi-tu-xiang-yu/draft.json";
import shiTuoLingSanGuanDraft from "../../../content-drafts/xiyouji/shi-tuo-ling-san-guan/draft.json";
import siShengShiChanXinDraft from "../../../content-drafts/xiyouji/si-sheng-shi-chan-xin/draft.json";
import tianZhuGuoBianYuTuDraft from "../../../content-drafts/xiyouji/tian-zhu-guo-bian-yu-tu/draft.json";
import tongTaiFuJieShanYuanDraft from "../../../content-drafts/xiyouji/tong-tai-fu-jie-shan-yuan/draft.json";
import tongTianHeJiuTongZiDraft from "../../../content-drafts/xiyouji/tong-tian-he-jiu-tong-zi/draft.json";
import tongTianHeAnQuanLuDraft from "../../../content-drafts/xiyouji/tong-tian-he-an-quan-lu/draft.json";
import tianMaYuanZhiBanBiaoDraft from "../../../content-drafts/xiyouji/tian-ma-yuan-zhi-ban-biao/draft.json";
import wuDiDongZhaoShiFuDraft from "../../../content-drafts/xiyouji/wu-di-dong-zhao-shi-fu/draft.json";
import wuXingShanXiaDraft from "../../../content-drafts/xiyouji/wu-xing-shan-xia/draft.json";
import wuJiGuoBianZhenWangDraft from "../../../content-drafts/xiyouji/wu-ji-guo-bian-zhen-wang/draft.json";
import wuKongXunZhenZhengDraft from "../../../content-drafts/xiyouji/wu-kong-xun-zhen-zheng/draft.json";
import wuZiJingShuDraft from "../../../content-drafts/xiyouji/wu-zi-jing-shu/draft.json";
import wuZhuangGuanRenShenGuoDraft from "../../../content-drafts/xiyouji/wu-zhuang-guan-ren-shen-guo/draft.json";
import xiaoLeiYinSiShiJiaFoDraft from "../../../content-drafts/xiyouji/xiao-lei-yin-si-shi-jia-fo/draft.json";
import yinWuShanBianZhenYingDraft from "../../../content-drafts/xiyouji/yin-wu-shan-bian-zhen-ying/draft.json";
import yuHuaZhouShouXinTuDraft from "../../../content-drafts/xiyouji/yu-hua-zhou-shou-xin-tu/draft.json";
import yuHuaZhouZhaoGongJuDraft from "../../../content-drafts/xiyouji/yu-hua-zhou-zhao-gong-ju/draft.json";
import huaGuoShanQingShiXiongDraft from "../../../content-drafts/xiyouji/hua-guo-shan-qing-shi-xiong/draft.json";
import zhenJingDaoShouDraft from "../../../content-drafts/xiyouji/zhen-jing-dao-shou/draft.json";
import zhenJiaMeiHouWangDraft from "../../../content-drafts/xiyouji/zhen-jia-mei-hou-wang/draft.json";
import zhiDouJinJiaoYinJiaoDraft from "../../../content-drafts/xiyouji/zhi-dou-jin-jiao-yin-jiao/draft.json";
import zhuZiGuoJieXinJieDraft from "../../../content-drafts/xiyouji/zhu-zi-guo-jie-xin-jie/draft.json";
import zhuZiGuoWenWenZhenDraft from "../../../content-drafts/xiyouji/zhu-zi-guo-wen-wen-zhen/draft.json";
import dingHaiShenZhenRenZhuDraft from "../../../content-drafts/xiyouji/ding-hai-shen-zhen-ren-zhu/draft.json";

// 篇章沿原著事件顺序编排；本次图文核对范围见 docs/content-audits。全系列复用
// docs/library-prompts/xiyouji/characters.md 的角色锚点与低龄改编原则。

const XIYOUJI_STYLE_LOCK =
  "premium polished 3D clay-like animated-film children's picture-book illustration, warm cinematic light, tactile handmade textures, expressive rounded characters, mythical ancient China setting, square 1:1 composition; no image text, letters, speech bubbles, logos, watermark, modern objects, weapons pointed at anyone, injury, blood, fear, or scary imagery.";

const BARE_STONE_MONKEY_LOCK =
  "Character lock — the stone monkey is a small lively monkey with warm golden-brown fur, a bare tan face and chest, big bright amber eyes, round ears, and a long expressive tail; he wears no clothes or accessories yet, and has cheerful, curious, never-menacing expressions with child-friendly rounded animated-film proportions.";

const MONKEY_KING_LOCK =
  "Character lock — Sun Wukong is a small lively monkey with warm golden-brown fur, a bare tan face and chest, big bright amber eyes, round ears, and a long expressive tail; from his coronation onward he wears the same golden-yellow sleeveless tunic, vermilion sash, and dark red trousers, with no crown, circlet, armor, or staff; cheerful, curious, never menacing, with child-friendly rounded animated-film proportions.";

interface XiyoujiBookDraft {
  id: string;
  title: string;
  subtitle: string;
  origin: string;
  moral: { zh: string; en: string };
  ageLabel: string;
  publishedAt: string;
  order: number;
  episodeNumber: number;
  pages: Array<{ zh: string; en: string; prompt: string }>;
}

interface XiyoujiDraftSpec {
  draft: XiyoujiBookDraft;
  title?: string;
  episodeNumber?: number;
}

const SHI_HOU_CHU_SHI_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "东海之上有座花果山，山顶立着一块吸收了日月光华的仙石。",
    en: "In the Eastern Sea rose the Mountain of Flowers and Fruit, where a magic stone drank in the light of sun and moon.",
    prompt:
      "Mythical Mountain of Flowers and Fruit rising from a sparkling eastern sea at dawn; a smooth egg-shaped magic stone glows warmly on the peak, wrapped in soft sun-and-moon light; waterfalls, peach trees, and drifting clouds; wide establishing scene; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "轰的一声，仙石裂开，蹦出一只灵巧的小石猴，眼睛亮晶晶。",
    en: "With a great crack, the stone split open — and out sprang a nimble little stone monkey with bright shining eyes.",
    prompt: `${BARE_STONE_MONKEY_LOCK} The magic stone splits with sparkling light as the stone monkey leaps out joyfully mid-air; petals and light motes swirl, and delighted birds watch. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "小石猴很快和山里的猴群玩到了一起，爬树、摘桃、捉迷藏。",
    en: "The little stone monkey soon joined the mountain monkeys — climbing trees, picking peaches, playing hide-and-seek.",
    prompt: `${BARE_STONE_MONKEY_LOCK} The stone monkey plays happily with a troop of smaller gray-brown monkeys with cream faces among peach trees; one hangs upside down and one shares a peach; playful chase energy in warm afternoon light. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "一天，猴子们发现一道大瀑布：“谁敢钻进去，我们就拜他为王！”",
    en: "One day the monkeys found a great waterfall. \"Whoever dares to leap through shall be our king!\"",
    prompt: `${BARE_STONE_MONKEY_LOCK} A grand silver waterfall pours down mossy cliffs; excited smaller gray-brown monkeys with cream faces gather on the rocks below and gesture at the rushing water, while the stone monkey stands forward on a boulder, curious and brave. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "小石猴闭上眼睛，纵身一跳，穿过水帘，稳稳落在了石桥上。",
    en: "The stone monkey shut his eyes and leapt — through the curtain of water, landing safely on a stone bridge.",
    prompt: `${BARE_STONE_MONKEY_LOCK} Mid-leap moment: the stone monkey springs through the shimmering water curtain with arms spread and a determined smile, droplets scattering like pearls; behind the falls a hidden stone bridge appears; dynamic but safe motion. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "水帘后面藏着一座石头洞府，锅碗桌椅样样齐全，正好安家！",
    en: "Behind the waterfall lay a stone cave home — with stone pots, bowls, tables and chairs, all ready for a family!",
    prompt: `${BARE_STONE_MONKEY_LOCK} Inside the Water Curtain Cave, a cozy stone hall holds stone tables, bowls, and little beds, softly lit by light filtering through the waterfall; the stone monkey explores with delight and touches a stone chair; wonder and warmth. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "猴子们欢呼着涌进洞府，齐声说：“美猴王！美猴王！”",
    en: "The monkeys poured in, cheering together: \"Handsome Monkey King! Handsome Monkey King!\"",
    prompt: `${MONKEY_KING_LOCK} Celebration and coronation in the Water Curtain Cave: the troop of smaller gray-brown monkeys with cream faces joyfully surrounds the newly named Monkey King, who has just received his golden-yellow tunic, vermilion sash, and dark red trousers and now sits laughing on a smooth stone seat; they offer peaches and flowers; festive, warm, communal happiness. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "从此，花果山有了自己的猴王。而小猴王心里，还装着更大的世界。",
    en: "And so the mountain had its Monkey King — whose bright eyes already dreamed of a wider world.",
    prompt: `${MONKEY_KING_LOCK} Quiet reflective ending at dusk: the Monkey King sits atop the mountain peak beside the old cracked stone, gazing at the glowing horizon over the sea where distant lands shimmer; peaceful wonder and gentle ambition. ${XIYOUJI_STYLE_LOCK}`,
  },
];

function toStoryPages(
  bookId: string,
  items: Array<{ zh: string; en: string; prompt: string }>,
  imageStatus: NonNullable<StoryPage["imageStatus"]>,
): StoryPage[] {
  return items.map((item, index) => ({
    page: index + 1,
    zhText: item.zh,
    enText: item.en,
    illustrationPrompt: expandXiyoujiIllustrationPrompt(item.prompt),
    imageUrl: `/library/xiyouji/${bookId}/${index + 1}.webp`,
    imageStatus,
  }));
}

function draftToLibraryBook(
  spec: XiyoujiDraftSpec,
  order: number,
): LibraryBook {
  const { draft } = spec;

  return {
    id: draft.id,
    seriesId: "xiyouji",
    title: spec.title ?? draft.title,
    subtitle: draft.subtitle,
    origin: draft.origin.replace("改编补遗", "改编"),
    moral: draft.moral,
    pages: toStoryPages(draft.id, draft.pages, "complete"),
    ageLabel: draft.ageLabel,
    publishedAt: draft.publishedAt,
    order,
    episodeNumber: spec.episodeNumber ?? draft.episodeNumber,
    comingSoon: false,
  };
}

const CURATED_XIYOUJI_DRAFTS: XiyoujiDraftSpec[] = [
  // 按原著事件顺序编排；episodeNumber 是绘本回号，原著回目见 origin。
  // 扩展篇必须插入故事发生处，不能追加在大结局后。
  { draft: muFaDuDongHaiDraft, episodeNumber: 2, title: "拜师学艺·上篇：木筏渡东海" },
  { draft: sanGengWuAnHaoDraft, episodeNumber: 2, title: "拜师学艺·中篇：三更悟暗号" },
  { draft: qiShiErBianLianXiDraft, episodeNumber: 2, title: "拜师学艺·下篇：七十二变练习" },
  { draft: longGongShiSanBaoDraft, episodeNumber: 3, title: "龙宫借宝·上篇：试三宝" },
  { draft: dingHaiShenZhenRenZhuDraft, episodeNumber: 3, title: "龙宫借宝·下篇：定海神针认主" },
  { draft: tianMaYuanZhiBanBiaoDraft, episodeNumber: 4 },
  { draft: panTaoYuanDeQingTieDraft, episodeNumber: 5 },
  { draft: daNaoTianGongDraft, episodeNumber: 6 },
  { draft: wuXingShanXiaDraft, episodeNumber: 7 },
  { draft: shuangChaLingRenLuDraft, episodeNumber: 8 },
  { draft: shiTuXiangYuDraft, episodeNumber: 9 },
  { draft: baiLongMaDraft, episodeNumber: 10 },
  { draft: heiFengShanHuJiaShaDraft, episodeNumber: 11 },
  { draft: gaoLaoZhuangYuBaJieDraft, episodeNumber: 12, title: "高老庄·上篇：遇八戒" },
  { draft: gaoLaoZhuangFenXingLiDraft, episodeNumber: 12, title: "高老庄·下篇：分行李" },
  { draft: huangFengLingDingFengZhuDraft, episodeNumber: 13 },
  { draft: liuShaHeShouShaSengDraft, episodeNumber: 14 },
  { draft: siShengShiChanXinDraft, episodeNumber: 15 },
  { draft: wuZhuangGuanRenShenGuoDraft, episodeNumber: 16 },
  { draft: sanDaBaiGuJingDraft, episodeNumber: 17 },
  { draft: huaGuoShanQingShiXiongDraft, episodeNumber: 18 },
  { draft: baoXiangGuoJiuGongZhuDraft, episodeNumber: 19 },
  { draft: zhiDouJinJiaoYinJiaoDraft, episodeNumber: 20 },
  { draft: baoLinSiJieYeXinDraft, episodeNumber: 21 },
  { draft: wuJiGuoBianZhenWangDraft, episodeNumber: 22 },
  { draft: huoYunDongShouHongHaiErDraft, episodeNumber: 23 },
  { draft: heiShuiHeBianTuoLongDraft, episodeNumber: 24 },
  { draft: cheChiGuoSanChangBiShiDraft, episodeNumber: 25 },
  { draft: tongTianHeJiuTongZiDraft, episodeNumber: 26 },
  { draft: tongTianHeAnQuanLuDraft, episodeNumber: 27 },
  { draft: jinDouDongShouQingNiuDraft, episodeNumber: 28 },
  { draft: nuErGuoCiBieDraft, episodeNumber: 29 },
  { draft: zhenJiaMeiHouWangDraft, episodeNumber: 30 },
  { draft: sanJieBaJiaoShanDraft, episodeNumber: 31 },
  { draft: jiSaiGuoSaoBaoTaDraft, episodeNumber: 32 },
  { draft: jingJiLingKaiLuDraft, episodeNumber: 33 },
  { draft: muXianAnShiHuiDraft, episodeNumber: 34 },
  { draft: xiaoLeiYinSiShiJiaFoDraft, episodeNumber: 35 },
  { draft: qiJueShanQingGuoXiangDraft, episodeNumber: 36 },
  { draft: zhuZiGuoWenWenZhenDraft, episodeNumber: 37 },
  { draft: zhuZiGuoJieXinJieDraft, episodeNumber: 38 },
  { draft: panSiDongQiaoTuoXianDraft, episodeNumber: 39 },
  { draft: huangHuaGuanJieCaiChaDraft, episodeNumber: 40 },
  { draft: shiTuoLingSanGuanDraft, episodeNumber: 41 },
  { draft: biQiuGuoHuTongXinDraft, episodeNumber: 42 },
  { draft: wuDiDongZhaoShiFuDraft, episodeNumber: 43 },
  { draft: mieFaGuoHuanXinYiDraft, episodeNumber: 44 },
  { draft: yinWuShanBianZhenYingDraft, episodeNumber: 45 },
  { draft: fengXianJunQiuGanYuDraft, episodeNumber: 46 },
  { draft: yuHuaZhouShouXinTuDraft, episodeNumber: 47 },
  { draft: yuHuaZhouZhaoGongJuDraft, episodeNumber: 48 },
  { draft: jinPingFuShouHuaDengDraft, episodeNumber: 49 },
  { draft: tianZhuGuoBianYuTuDraft, episodeNumber: 50 },
  { draft: tongTaiFuJieShanYuanDraft, episodeNumber: 51 },
  { draft: kouFuCiBieDraft, episodeNumber: 52 },
  { draft: kouZhaiShiBaoDraft, episodeNumber: 53 },
  { draft: wuKongXunZhenZhengDraft, episodeNumber: 54 },
  { draft: lingYunDuGuoQiaoDraft, episodeNumber: 55 },
  { draft: wuZiJingShuDraft, episodeNumber: 56 },
  { draft: zhenJingDaoShouDraft, episodeNumber: 57 },
  { draft: laoYuanWenJiuNuoDraft, episodeNumber: 58 },
  { draft: shaiJingShiLiuHenDraft, episodeNumber: 59 },
  { draft: changAnGongDeYuanManDraft, episodeNumber: 60, title: "大结局：取经归来·五圣成真" },
];

export const XIYOUJI_BOOKS: LibraryBook[] = [
  {
    id: "shi-hou-chu-shi",
    seriesId: "xiyouji",
    title: "石猴出世",
    subtitle: "花果山上蹦出的小猴王",
    origin: "《西游记》第一回（低龄改编）",
    moral: {
      zh: "勇敢迈出第一步的人，才能发现藏在后面的新世界。",
      en: "Only those who dare the first leap discover the new world waiting behind.",
    },
    pages: toStoryPages("shi-hou-chu-shi", SHI_HOU_CHU_SHI_PAGES, "complete"),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-22",
    order: 1,
    episodeNumber: 1,
  },
  ...CURATED_XIYOUJI_DRAFTS.map((spec, index) =>
    draftToLibraryBook(spec, index + 2),
  ),
];

export const XIYOUJI_SERIES: LibrarySeries = {
  id: "xiyouji",
  title: "西游记",
  subtitle: "跟着悟空去取经",
  description:
    "从石猴出世到五圣成真，按故事顺序阅读的 60 回、64 本中英双语绘本。绘本回号不等于原著回目，部分回目分上下篇；保留西行主线，温和改编，适合亲子共读。",
  accent: "#5c7560",
  ageRange: "4-8 岁",
  bookCount: XIYOUJI_BOOKS.length,
};
