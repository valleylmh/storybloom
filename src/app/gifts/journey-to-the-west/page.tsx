import type { Metadata } from "next";
import { XIYOUJI_BOOKS } from "@/lib/library/xiyouji";
import JourneyWestGift from "@/components/gifts/JourneyWestGift";
import type { GiftPage } from "@/components/gifts/GiftReader";

export const metadata: Metadata = {
  title: "西游记 · 全集典藏版 | StoryBloom 精品绘本",
  description: "从石猴出世到五圣成真，60 回西游故事合订成一本可以翻阅与珍藏的精品电子绘本。",
  openGraph: { title: "西游记 · 全集典藏版", images: ["/library/xiyouji/shi-hou-chu-shi/1.webp"] },
};

export default function Page() {
  const pages: GiftPage[] = [];
  const chapters: Array<{ title: string; pageIndex: number }> = [];
  XIYOUJI_BOOKS.forEach((book, index) => {
    chapters.push({ title: `${String(index + 1).padStart(2, "0")} · ${book.title}`, pageIndex: pages.length });
    book.pages.forEach((page) => {
      pages.push({ page: pages.length + 1, imageUrl: page.imageUrl!, text: page.zhText, chapter: book.title });
    });
  });
  return <div data-gift-module><JourneyWestGift pages={pages} chapters={chapters} /></div>;
}
