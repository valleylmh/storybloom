import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";
import anQuanDaiDraft from "../../../content-drafts/qiche/an-quan-dai-bao-hu-shui.json";
import chuZuCheDingDengDraft from "../../../content-drafts/qiche/chu-zu-che-wei-shen-me-you-ding-deng.json";
import chuZuCheMuDiDraft from "../../../content-drafts/qiche/chu-zu-che-zen-yang-zhao-dao-mu-de-di.json";
import dianDongQiCheDraft from "../../../content-drafts/qiche/dian-dong-qi-che-zen-me-chong-dian.json";
import diTieDraft from "../../../content-drafts/qiche/di-tie-wei-shen-me-pao-de-kuai.json";
import dongCheZuDraft from "../../../content-drafts/qiche/dong-che-zu-zen-yang-yi-qi-pao.json";
import gaoTieDraft from "../../../content-drafts/qiche/gao-tie-wei-shen-me-pao-de-kuai.json";
import gongJiaoCheDraft from "../../../content-drafts/qiche/gong-jiao-che-zen-me-zhi-dao-xia-yi-zhan.json";
import hongLuDengDraft from "../../../content-drafts/qiche/hong-lu-deng-wei-shen-me-hui-bian-se.json";
import jiuHuCheDraft from "../../../content-drafts/qiche/jiu-hu-che-zen-yang-zheng-fen-duo-miao.json";
import laJiCheDraft from "../../../content-drafts/qiche/la-ji-che-ba-la-ji-song-dao-na-li.json";
import saShuiCheDraft from "../../../content-drafts/qiche/sa-shui-che-wei-shen-me-yi-lu-pen-shui.json";
import xiaoFangCheDraft from "../../../content-drafts/qiche/xiao-fang-che-wei-shen-me-yao-ming-di.json";
import xiaoCheDraft from "../../../content-drafts/qiche/xiao-che-wei-shen-me-yao-ting-wen-zai-xia-che.json";

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
  gaoTieDraft,
  dongCheZuDraft,
].map((draft) => draftToLibraryBook(draft as QicheDraft));

export const QICHE_SERIES: LibrarySeries = {
  id: "qiche",
  title: "城市汽车小队",
  subtitle: "跟着安安逛城市，发现车轮里的小秘密",
  description:
    "安安带孩子走过街区、车站、医院、出租车候车点、充电站和高铁站，在一段段有趣的城市任务里观察公交车、出租车、消防车、垃圾车、电动汽车和高铁动车怎样工作。每本都是完整的中英双语科普绘本，页数按故事需要展开，简化但不错误。",
  accent: "#2f7180",
  ageRange: "4–8 岁",
  bookCount: QICHE_BOOKS.length,
};
