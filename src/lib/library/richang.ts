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
import watch from "../../../content-drafts/richang/da-jia-dou-you-de-xiao-shou-biao.json";
import joke from "../../../content-drafts/richang/wo-zhi-shi-kai-ge-wan-xiao.json";
import drawing from "../../../content-drafts/richang/na-zhang-bu-gan-hua-de-bai-zhi.json";
import tiredMom from "../../../content-drafts/richang/ma-ma-jin-tian-you-dian-lei.json";
import boundaries from "../../../content-drafts/richang/xiao-xiao-de-bu-yuan-yi.json";
import privacy from "../../../content-drafts/richang/wo-de-mi-mi-shei-neng-ting.json";
import alone from "../../../content-drafts/richang/yi-ge-ren-wan-de-xia-wu.json";
import cake from "../../../content-drafts/richang/zui-hou-yi-kuai-dan-gao.json";
import queue from "../../../content-drafts/richang/pai-dui-shi-de-na-yi-fen-zhong.json";
import badminton from "../../../content-drafts/richang/ba-ba-mei-you-ying.json";
import independence from "../../../content-drafts/richang/wo-xiang-zi-ji-shi-yi-shi.json";
import leafReminder from "../../../content-drafts/richang/ming-tian-yao-dai-de-na-pian-ye-zi.json";
import newFriend from "../../../content-drafts/richang/le-le-you-le-xin-peng-you.json";
import listening from "../../../content-drafts/richang/wo-ye-xiang-ba-hua-shuo-wan.json";
import similarCars from "../../../content-drafts/richang/xiao-che-zen-me-dao-le-ni-jia.json";
import lostTeddy from "../../../content-drafts/richang/zhao-bu-dao-de-xiao-xiong.json";
import giftHat from "../../../content-drafts/richang/ni-zen-me-mei-dai-wo-de-mao-zi.json";
import caregiverAgreement from "../../../content-drafts/richang/ma-ma-shuo-ke-yi-ba-ba-shuo-bu-xing.json";
import nightLight from "../../../content-drafts/richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma.json";
import cloudViews from "../../../content-drafts/richang/tong-yi-duo-yun-liang-zhong-yang-zi.json";
import loudVoice from "../../../content-drafts/richang/ma-ma-ni-shi-zai-xiong-wo-ma.json";
import tearsFirst from "../../../content-drafts/richang/wo-hai-mei-shuo-yan-lei-jiu-lai-le.json";
import stuckWords from "../../../content-drafts/richang/na-ju-hua-ka-zai-zui-ba-li.json";
import favoriteFlavor from "../../../content-drafts/richang/wo-zhi-xiang-chi-zhe-yi-zhong.json";
import sharedSnack from "../../../content-drafts/richang/ni-yi-chi-wo-ye-xiang-chi.json";
import wantToyNow from "../../../content-drafts/richang/na-liang-xiao-che-wo-jin-tian-jiu-xiang-yao.json";
import angryHands from "../../../content-drafts/richang/sheng-qi-de-xiao-shou-fang-na-li.json";
import nextEpisode from "../../../content-drafts/richang/zhe-yi-ji-wo-hai-xiang-kan.json";
import misunderstood from "../../../content-drafts/richang/zhe-ci-zhen-de-bu-shi-wo.json";
import shyHello from "../../../content-drafts/richang/na-sheng-ni-hao-cang-zai-bei-hou.json";
import schoolGoodbye from "../../../content-drafts/richang/xiao-men-kou-de-na-yi-ci-hui-shou.json";
import looseTooth from "../../../content-drafts/richang/yao-huang-de-di-yi-ke-xiao-ru-ya.json";
import pinyinCurves from "../../../content-drafts/richang/pin-yin-wang-guo-li-de-xiao-wan-gou.json";
import wanderingNumbers from "../../../content-drafts/richang/tiao-chu-tian-zi-ge-de-xiao-shu-zi.json";
import bathroomRequest from "../../../content-drafts/richang/wo-xiang-qu-xi-shou-jian-ke-yi-ju-shou-ma.json";
import quietNap from "../../../content-drafts/richang/shui-bu-zhao-de-wu-xiu-xiao-chuang.json";
import joiningPlay from "../../../content-drafts/richang/wo-ke-yi-he-ni-men-yi-qi-wan-ma.json";
import packingBag from "../../../content-drafts/richang/wo-de-xiao-shu-bao-jin-tian-zi-ji-shou.json";
import classroomHelper from "../../../content-drafts/richang/jin-tian-wo-shi-da-ban-zhi-ri-sheng.json";
import afterSchool from "../../../content-drafts/richang/fang-xue-lu-shang-man-man-shuo.json";
import gateVolunteer from "../../../content-drafts/richang/ma-ma-zai-xiao-men-kou-zhan-gang.json";
import threeTeachers from "../../../content-drafts/richang/da-ban-de-san-wei-lao-shi.json";
import surpriseGift from "../../../content-drafts/richang/jin-tian-bu-shi-sheng-ri-ya.json";

type EverydayDraft = {
  book: Omit<LibraryBook, "pages"> & {
    pages: Array<Pick<LibraryBook["pages"][number], "page" | "zhText" | "enText" | "illustrationPrompt"> & { imageStatus?: "complete" | "pending"; generationPrompt?: string }>;
  };
  imagePromptKit: { globalStyle: string; characterConsistency: string; negative: string };
};

export const RICHANG_BOOKS: LibraryBook[] = [
  apple, shoes, special, toys, time, cookie, milk, apology, chores, picnic,
  watch, joke, drawing, tiredMom, boundaries, privacy, alone, cake, queue, badminton,
  independence, leafReminder, newFriend, listening, similarCars, lostTeddy, giftHat,
  caregiverAgreement, nightLight, cloudViews,
  loudVoice, tearsFirst, stuckWords, favoriteFlavor, sharedSnack, wantToyNow,
  angryHands, nextEpisode, misunderstood, shyHello,
  schoolGoodbye, looseTooth, pinyinCurves, wanderingNumbers, bathroomRequest,
  quietNap, joiningPlay, packingBag, classroomHelper, afterSchool, gateVolunteer,
  threeTeachers, surpriseGift,
].filter((source) => !source.book.comingSoon).map((source) => {
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
  description: "跟着安安和家人、朋友，走进餐桌、玩具角、小区、公园和幼儿园。从生活中的选择与感受，到大班里的换牙、自理、交朋友、当值日生、三位老师的默契分工、普通日子里的惊喜礼物和家长志愿服务，在熟悉的小事里感受分享、约定、边界与陪伴。每本 12–20 页中英双语故事，配有中文旁白和亲子共读提示。",
  coverImage: "/library/richang/lan-ping-guo/1.webp",
  accent: "#cc7a45",
  ageRange: "4–8 岁",
  bookCount: RICHANG_BOOKS.filter((book) => !book.comingSoon).length,
};
