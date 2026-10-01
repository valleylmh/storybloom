import type { LibraryBook, LibrarySeries } from "@/types/library";
import apple from "../../../content-drafts/richang/lan-ping-guo.json";
import shoes from "../../../content-drafts/richang/she-bu-de-chuan-de-xin-xie.json";
import special from "../../../content-drafts/richang/te-bie-de-ri-zi-shi-na-tian.json";
import toys from "../../../content-drafts/richang/wan-ju-shan-li-zhao-xiao-che.json";
import time from "../../../content-drafts/richang/zai-wan-wu-fen-zhong.json";
import cookie from "../../../content-drafts/richang/wo-de-bing-gan-zen-me-geng-xiao.json";
import milk from "../../../content-drafts/richang/yi-bei-da-fan-de-niu-nai.json";
import apology from "../../../content-drafts/richang/deng-wo-xin-qing-hao-le-zai-shuo.json";
import chores from "../../../content-drafts/richang/zen-me-zhi-you-wo-zai-shou-shi.json";
import picnic from "../../../content-drafts/richang/bu-tai-wan-mei-de-ye-can.json";

type EverydayDraft = {
  book: Omit<LibraryBook, "pages"> & {
    pages: Array<Pick<LibraryBook["pages"][number], "page" | "zhText" | "enText" | "illustrationPrompt"> & { imageStatus?: "complete" | "pending"; generationPrompt?: string }>;
  };
  imagePromptKit: { globalStyle: string; characterConsistency: string; negative: string };
};

export const RICHANG_BOOKS: LibraryBook[] = [
  apple, shoes, special, toys, time, cookie, milk, apology, chores, picnic,
].map((source) => {
  const draft = source as EverydayDraft;
  return {
    ...draft.book,
    metadata: { ...draft.book.metadata, category: "family-growth", personalizationEnabled: false },
    pages: draft.book.pages.map((page) => ({
      page: page.page,
      zhText: page.zhText,
      enText: page.enText,
      illustrationPrompt: page.generationPrompt ?? [draft.imagePromptKit.globalStyle, draft.imagePromptKit.characterConsistency, page.illustrationPrompt, `Avoid: ${draft.imagePromptKit.negative}`].join("\n"),
      imageUrl: page.imageStatus === "complete" ? `/library/richang/${draft.book.id}/${page.page}.webp` : undefined,
      imageStatus: page.imageStatus ?? "pending",
    })),
  };
});

export const RICHANG_SERIES: LibrarySeries = {
  id: "richang",
  title: "日常系列",
  subtitle: "小日子里的大发现",
  description: "跟着安安和家人、朋友，走进餐桌、玩具角、小区和公园。从一篮苹果到一次不太完美的野餐，在熟悉的生活小事里感受分享、约定、补救与陪伴。每本 12–20 页中英双语故事，配有中文旁白和亲子共读提示。",
  coverImage: "/library/richang/lan-ping-guo/1.webp",
  accent: "#cc7a45",
  ageRange: "4–8 岁",
  bookCount: RICHANG_BOOKS.filter((book) => !book.comingSoon).length,
};
