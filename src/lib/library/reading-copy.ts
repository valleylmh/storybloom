import type { SiteLocale } from "@/lib/seo";
import type { LibraryBook } from "@/types/library";

interface BookReadingCopy {
  title: string;
  heading: string;
  introduction: string;
}

// Reviewed introductions for books with search impressions but no clicks.
// Keep the promised content visible on the reading page as well as in metadata.
const READING_COPY: Record<string, Partial<Record<SiteLocale, BookReadingCopy>>> = {
  "tangshi/min-nong-qi-er": {
    en: {
      title: "Min Nong: Hoeing the Fields at Noon | StoryBloom",
      heading: "Min Nong · Part 2 — Hoeing the Fields at Noon",
      introduction: "Read Min Nong (悯农·其二), the Tang poem beginning ‘锄禾日当午’, with the original Chinese, an English translation and eight illustrated pages. Explore how farmers grow our food and why every grain matters.",
    },
  },
  "tangshi/jing-ye-si": {
    zh: {
      title: "静夜思绘本｜李白古诗原文与英文翻译 - StoryBloom",
      heading: "静夜思",
      introduction: "床前明月光，疑是地上霜。免费阅读李白《静夜思》原文、英文翻译与八页插画，陪 4–8 岁孩子认识月光与思乡，适合亲子共读。",
    },
    en: {
      title: "Jing Ye Si: Quiet Night Thoughts by Li Bai | StoryBloom",
      heading: "Jing Ye Si — Quiet Night Thoughts",
      introduction: "Read Li Bai’s Jing Ye Si (静夜思), a Tang poem about moonlight and missing home. Explore the original Chinese, an English translation and eight illustrated pages for reading together.",
    },
  },
  "qiche/jiu-hu-che-zen-yang-zheng-fen-duo-miao": {
    zh: {
      title: "救护车怎样争分夺秒？儿童交通安全绘本 | StoryBloom",
      heading: "救护车怎样争分夺秒",
      introduction: "救护车为什么鸣笛，路上的车辆怎样让行？跟着安安认识警示灯、安全距离与让行通道。免费阅读十二页中英双语插画，适合 4–8 岁亲子共读。",
    },
    en: {
      title: "Ambulances, Sirens & Road Safety for Kids | StoryBloom",
      heading: "How Ambulances Race Against Time",
      introduction: "Why do ambulances use sirens, and how do other vehicles make room? Join An’an in a free twelve-page illustrated story about warning lights, safe distances and helping an ambulance reach its destination safely.",
    },
  },
};

export function bookReadingCopy(book: LibraryBook, locale: SiteLocale = "zh") {
  return READING_COPY[`${book.seriesId}/${book.id}`]?.[locale];
}
