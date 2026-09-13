import type { Metadata } from "next";
import GraduationGift from "@/components/gifts/GraduationGift";
export const metadata: Metadata = {
  title: "把夏天装进口袋 · 幼儿园毕业礼物绘本 | StoryBloom",
  description: "送给即将毕业的小小的你。一本把勇敢、友谊与告别珍藏起来的图文一体电子绘本。",
  openGraph: { title: "把夏天装进口袋", description: "愿你带着被爱过的勇气，走向更大的世界。", images: ["/gift-books/summer-pocket/cover.png"] },
};
export default function Page() { return <div data-gift-module><GraduationGift /></div>; }
