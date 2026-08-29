import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";
import caiLianQuDraft from "../../../content-drafts/tangshi/cai-lian-qu.json";
import chiShangDraft from "../../../content-drafts/tangshi/chi-shang.json";
import chunXiaoDraft from "../../../content-drafts/tangshi/chun-xiao.json";
import chunYeXiYuDraft from "../../../content-drafts/tangshi/chun-ye-xi-yu.json";
import chuZhouXiJianDraft from "../../../content-drafts/tangshi/chu-zhou-xi-jian.json";
import daLinSiTaoHuaDraft from "../../../content-drafts/tangshi/da-lin-si-tao-hua.json";
import dengGuanQueLouDraft from "../../../content-drafts/tangshi/deng-guan-que-lou.json";
import duZuoJingTingShanDraft from "../../../content-drafts/tangshi/du-zuo-jing-ting-shan.json";
import fengQiaoYeBoDraft from "../../../content-drafts/tangshi/feng-qiao-ye-bo.json";
import fengDraft from "../../../content-drafts/tangshi/feng.json";
import fengXueSuFuRongShanZhuRenDraft from "../../../content-drafts/tangshi/feng-xue-su-fu-rong-shan-zhu-ren.json";
import guLangYueXingDraft from "../../../content-drafts/tangshi/gu-lang-yue-xing.json";
import huangHeLouSongMengHaoRanZhiGuangLingDraft from "../../../content-drafts/tangshi/huang-he-lou-song-meng-hao-ran-zhi-guang-ling.json";
import huiXiangOuShuQiYiDraft from "../../../content-drafts/tangshi/hui-xiang-ou-shu-qi-yi.json";
import jiangXueDraft from "../../../content-drafts/tangshi/jiang-xue.json";
import jiangNanChunDraft from "../../../content-drafts/tangshi/jiang-nan-chun.json";
import jiangPanDuBuXunHuaQiLiuDraft from "../../../content-drafts/tangshi/jiang-pan-du-bu-xun-hua-qi-liu.json";
import jingYeSiDraft from "../../../content-drafts/tangshi/jing-ye-si.json";
import jiuYueJiuRiYiShanDongXiongDiDraft from "../../../content-drafts/tangshi/jiu-yue-jiu-ri-yi-shan-dong-xiong-di.json";
import jueJuLiangGeHuangLiDraft from "../../../content-drafts/tangshi/jue-ju-liang-ge-huang-li.json";
import jueJuChiRiJiangShanLiDraft from "../../../content-drafts/tangshi/jue-ju-chi-ri-jiang-shan-li.json";
import luChaiDraft from "../../../content-drafts/tangshi/lu-chai.json";
import langTaoShaQiYiDraft from "../../../content-drafts/tangshi/lang-tao-sha-qi-yi.json";
import minNongQiErDraft from "../../../content-drafts/tangshi/min-nong-qi-er.json";
import muJiangYinDraft from "../../../content-drafts/tangshi/mu-jiang-yin.json";
import shanXingDraft from "../../../content-drafts/tangshi/shan-xing.json";
import shiZhiSaiShangDraft from "../../../content-drafts/tangshi/shi-zhi-sai-shang.json";
import wangLuShanPuBuDraft from "../../../content-drafts/tangshi/wang-lu-shan-pu-bu.json";
import wangDongTingDraft from "../../../content-drafts/tangshi/wang-dong-ting.json";
import wangTianMenShanDraft from "../../../content-drafts/tangshi/wang-tian-men-shan.json";
import xiangSiDraft from "../../../content-drafts/tangshi/xiang-si.json";
import xiaoErChuiDiaoDraft from "../../../content-drafts/tangshi/xiao-er-chui-diao.json";
import xunYinZheBuYuDraft from "../../../content-drafts/tangshi/xun-yin-zhe-bu-yu.json";
import fuDeGuYuanCaoSongBieDraft from "../../../content-drafts/tangshi/fu-de-gu-yuan-cao-song-bie.json";
import yiJiangNanJiangNanHaoDraft from "../../../content-drafts/tangshi/yi-jiang-nan-jiang-nan-hao.json";
import yeSuShanSiDraft from "../../../content-drafts/tangshi/ye-su-shan-si.json";
import yongLiuDraft from "../../../content-drafts/tangshi/yong-liu.json";
import youZiYinDraft from "../../../content-drafts/tangshi/you-zi-yin.json";
import yuGeZiXiSaiShanQianBaiLuFeiDraft from "../../../content-drafts/tangshi/yu-ge-zi-xi-sai-shan-qian-bai-lu-fei.json";
import yongEDraft from "../../../content-drafts/tangshi/yong-e.json";
import zaoFaBaiDiChengDraft from "../../../content-drafts/tangshi/zao-fa-bai-di-cheng.json";
import zaoChunChengShuiBuZhangShiBaYuanWaiDraft from "../../../content-drafts/tangshi/zao-chun-cheng-shui-bu-zhang-shi-ba-yuan-wai.json";
import zengWangLunDraft from "../../../content-drafts/tangshi/zeng-wang-lun.json";
import zhuLiGuanDraft from "../../../content-drafts/tangshi/zhu-li-guan.json";

type TangshiDraft = {
  book: Omit<LibraryBook, "pages"> & {
    pages: Array<Pick<StoryPage, "page" | "zhText" | "enText" | "illustrationPrompt">>;
  };
  imagePromptKit: {
    globalStyle: string;
    characterConsistency: string;
    negative: string;
  };
};

function draftToLibraryBook(draft: TangshiDraft): LibraryBook {
  return {
    ...draft.book,
    comingSoon: false,
    metadata: {
      ...draft.book.metadata,
      category: "poetry",
      personalizationEnabled: false,
      bedtimeSuitable: true,
      tags: ["唐诗", "古诗", "传统文化", "意境启蒙"],
    },
    pages: draft.book.pages.map((page) => ({
      ...page,
      illustrationPrompt: [
        draft.imagePromptKit.globalStyle,
        draft.imagePromptKit.characterConsistency,
        page.illustrationPrompt,
        `Avoid: ${draft.imagePromptKit.negative}`,
      ].join(" "),
      imageUrl: `/library/tangshi/${draft.book.id}/${page.page}.webp`,
      imageStatus: "complete",
    })),
  };
}

export const TANGSHI_BOOKS: LibraryBook[] = [
  yongEDraft,
  jingYeSiDraft,
  chunXiaoDraft,
  dengGuanQueLouDraft,
  luChaiDraft,
  wangLuShanPuBuDraft,
  jueJuLiangGeHuangLiDraft,
  jiangXueDraft,
  minNongQiErDraft,
  chiShangDraft,
  xiangSiDraft,
  zengWangLunDraft,
  zaoFaBaiDiChengDraft,
  huangHeLouSongMengHaoRanZhiGuangLingDraft,
  jiuYueJiuRiYiShanDongXiongDiDraft,
  zhuLiGuanDraft,
  xunYinZheBuYuDraft,
  xiaoErChuiDiaoDraft,
  shanXingDraft,
  fengQiaoYeBoDraft,
  muJiangYinDraft,
  daLinSiTaoHuaDraft,
  fuDeGuYuanCaoSongBieDraft,
  yiJiangNanJiangNanHaoDraft,
  shiZhiSaiShangDraft,
  yongLiuDraft,
  jueJuChiRiJiangShanLiDraft,
  chunYeXiYuDraft,
  youZiYinDraft,
  fengDraft,
  huiXiangOuShuQiYiDraft,
  wangTianMenShanDraft,
  fengXueSuFuRongShanZhuRenDraft,
  wangDongTingDraft,
  guLangYueXingDraft,
  yeSuShanSiDraft,
  caiLianQuDraft,
  chuZhouXiJianDraft,
  jiangPanDuBuXunHuaQiLiuDraft,
  duZuoJingTingShanDraft,
  yuGeZiXiSaiShanQianBaiLuFeiDraft,
  langTaoShaQiYiDraft,
  jiangNanChunDraft,
  zaoChunChengShuiBuZhangShiBaYuanWaiDraft,
].map((draft) => draftToLibraryBook(draft as TangshiDraft));

export const TANGSHI_SERIES: LibrarySeries = {
  id: "tangshi",
  title: "唐诗入画",
  subtitle: "一首诗，一幅会呼吸的画",
  description:
    "把熟悉的唐诗变成完整的中英双语意境绘本：先完整读诗，再逐句看画，听见诗里的声音，也看见诗人的心情。",
  accent: "#47677a",
  ageRange: "4-8 岁",
  bookCount: TANGSHI_BOOKS.length,
};
