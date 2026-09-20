import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";
import ferryTaxiDraft from "../../../content-drafts/qiche/shan-dian-chu-zu-che-song-wo-men-qu-zuo-chuan.json";
import ferryPickupDraft from "../../../content-drafts/qiche/da-zhong-pi-ka-zuo-lun-chuan-mu-ou-xi-qu-xiao-dao.json";
import piKaShuMiaoDraft from "../../../content-drafts/qiche/da-zhong-pi-ka-song-xiao-shu-miao.json";
import piKaMuOuDraft from "../../../content-drafts/qiche/da-zhong-pi-ka-he-mu-ou-xi-de-da-ban-jia.json";
import anQuanDaiDraft from "../../../content-drafts/qiche/an-quan-dai-bao-hu-shui.json";
import chuZuCheDingDengDraft from "../../../content-drafts/qiche/chu-zu-che-wei-shen-me-you-ding-deng.json";
import chuZuCheMuDiDraft from "../../../content-drafts/qiche/chu-zu-che-zen-yang-zhao-dao-mu-de-di.json";
import shanDianYuTianDraft from "../../../content-drafts/qiche/shan-dian-chu-zu-che-he-yu-tian-de-xiao-cheng-ke.json";
import shanDianXiaoXiongDraft from "../../../content-drafts/qiche/shan-dian-chu-zu-che-song-xiao-xiong-hui-jia.json";
import dianDongQiCheDraft from "../../../content-drafts/qiche/dian-dong-qi-che-zen-me-chong-dian.json";
import diTieDraft from "../../../content-drafts/qiche/di-tie-wei-shen-me-pao-de-kuai.json";
import dongCheZuDraft from "../../../content-drafts/qiche/dong-che-zu-zen-yang-yi-qi-pao.json";
import feiJiAnQuanDraft from "../../../content-drafts/qiche/fei-ji-zen-yang-an-quan-qi-fei-he-jiang-luo.json";
import feiJiWeiShenMeDraft from "../../../content-drafts/qiche/fei-ji-wei-shen-me-neng-fei.json";
import gaoTieDraft from "../../../content-drafts/qiche/gao-tie-wei-shen-me-pao-de-kuai.json";
import gongJiaoCheDraft from "../../../content-drafts/qiche/gong-jiao-che-zen-me-zhi-dao-xia-yi-zhan.json";
import hongLuDengDraft from "../../../content-drafts/qiche/hong-lu-deng-wei-shen-me-hui-bian-se.json";
import jiuHuCheDraft from "../../../content-drafts/qiche/jiu-hu-che-zen-yang-zheng-fen-duo-miao.json";
import laJiCheDraft from "../../../content-drafts/qiche/la-ji-che-ba-la-ji-song-dao-na-li.json";
import saShuiCheDraft from "../../../content-drafts/qiche/sa-shui-che-wei-shen-me-yi-lu-pen-shui.json";
import xiaoFangCheDraft from "../../../content-drafts/qiche/xiao-fang-che-wei-shen-me-yao-ming-di.json";
import xiaoCheDraft from "../../../content-drafts/qiche/xiao-che-wei-shen-me-yao-ting-wen-zai-xia-che.json";
import waJueJiDraft from "../../../content-drafts/qiche/wa-jue-ji-de-da-chan-zi-you-shen-me-ben-ling.json";
import zhuangZaiJiDraft from "../../../content-drafts/qiche/zhuang-zai-ji-ba-sha-zi-song-shang-che.json";
import tuiTuJiDraft from "../../../content-drafts/qiche/tui-tu-ji-gei-tu-di-pu-bei-zi.json";
import ziXieCheDraft from "../../../content-drafts/qiche/zi-xie-che-de-che-xiang-tai-qi-lai-le.json";
import jiaoBanCheDraft from "../../../content-drafts/qiche/jiao-ban-che-de-du-zi-wei-shen-me-yi-zhi-zhuan.json";
import bengCheDraft from "../../../content-drafts/qiche/beng-che-de-chang-ge-bo-shen-dao-na-li.json";
import qiZhongJiDraft from "../../../content-drafts/qiche/qi-zhong-ji-zen-yang-diao-qi-da-dong-xi.json";
import yaLuJiDraft from "../../../content-drafts/qiche/ya-lu-ji-man-man-zou-lu-mian-bian-jie-shi.json";
import tanPuJiDraft from "../../../content-drafts/qiche/tan-pu-ji-pu-chu-yi-tiao-xin-ma-lu.json";
import gongChengCheDraft from "../../../content-drafts/qiche/gong-cheng-che-xiao-dui-jian-hao-xin-gong-yuan.json";

type QicheDraft = {
  book: Omit<LibraryBook, "pages"> & {
    pages: Array<
      Pick<StoryPage, "page" | "zhText" | "enText" | "illustrationPrompt">
    >;
  };
  imagePromptKit: {
    globalStyle: string;
    characterConsistency: string;
    negative: string;
  };
};

function draftToLibraryBook(draft: QicheDraft): LibraryBook {
  return {
    ...draft.book,
    seriesId: "qiche",
    ageLabel: draft.book.ageLabel || "4–8 岁",
    publishedAt: draft.book.publishedAt || "2026-08-30",
    comingSoon: false,
    metadata: {
      ...draft.book.metadata,
      category: "science",
      ageRange: { min: 4, max: 8 },
      languages: ["zh", "en"],
      personalizationEnabled: false,
      bedtimeSuitable: false,
      tags: Array.from(
        new Set([
          "城市交通",
          "汽车科普",
          "工程启蒙",
          "安全教育",
          ...(draft.book.metadata?.tags ?? []),
        ]),
      ),
    },
    pages: draft.book.pages.map((page) => ({
      ...page,
      illustrationPrompt: [
        draft.imagePromptKit.globalStyle,
        // Keep the bilingual name in the composed prompt so the visual lock
        // is explicit to both reviewers and the image model.
        "Character anchor: 安安 (An'an), the same six-year-old Chinese girl on every page.",
        draft.imagePromptKit.characterConsistency,
        page.illustrationPrompt,
        `Avoid: ${draft.imagePromptKit.negative}`,
      ].join(" "),
      imageUrl: `/library/qiche/${draft.book.id}/${page.page}.webp`,
      imageStatus: "complete",
    })),
  };
}

export const QICHE_BOOKS: LibraryBook[] = [
  hongLuDengDraft,
  gongJiaoCheDraft,
  diTieDraft,
  xiaoFangCheDraft,
  jiuHuCheDraft,
  laJiCheDraft,
  saShuiCheDraft,
  xiaoCheDraft,
  anQuanDaiDraft,
  dianDongQiCheDraft,
  chuZuCheDingDengDraft,
  chuZuCheMuDiDraft,
  shanDianYuTianDraft,
  shanDianXiaoXiongDraft,
  piKaShuMiaoDraft,
  piKaMuOuDraft,
  gaoTieDraft,
  dongCheZuDraft,
  feiJiWeiShenMeDraft,
  feiJiAnQuanDraft,
  waJueJiDraft,
  zhuangZaiJiDraft,
  tuiTuJiDraft,
  ziXieCheDraft,
  jiaoBanCheDraft,
  bengCheDraft,
  qiZhongJiDraft,
  yaLuJiDraft,
  tanPuJiDraft,
  gongChengCheDraft,
  ferryTaxiDraft,
  ferryPickupDraft,
].map((draft) => draftToLibraryBook(draft as QicheDraft));

export const QICHE_SERIES: LibrarySeries = {
  id: "qiche",
  title: "城市汽车小队",
  subtitle: "跟着交通工具伙伴，探索城市与远方",
  description:
    "安安带孩子走过街区、车站和机场，再到安全参观区看工程车建公园。从公交车、出租车、高铁动车和飞机，到挖掘机、装载机、推土机、自卸车、搅拌车、泵车、起重机、压路机和摊铺机，在有任务、有困难、有合作的故事里发现它们的本领。每本都是完整的中英双语科普绘本，工程车篇每本 16–20 页，配有找一找、动作配音与亲子共读提示。",
  accent: "#2f7180",
  ageRange: "4–8 岁",
  bookCount: QICHE_BOOKS.length,
};
