import type { Metadata } from "next";
import IllustratedGift from "@/components/gifts/IllustratedGift";
import { illustratedGifts } from "@/components/gifts/illustrated-gifts";

const book = illustratedGifts[1];
export const metadata: Metadata = {
  title: `${book.title} · ${book.theme}绘本 | StoryBloom`,
  description: book.description.replaceAll("\n", ""),
  openGraph: {
    title: book.title,
    description: book.dedication.replaceAll("\n", ""),
    images: [`/gift-books/${book.slug}/cover.png`],
  },
};
export default function Page() {
  return <div data-gift-module><IllustratedGift book={book} /></div>;
}
