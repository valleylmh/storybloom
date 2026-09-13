import type { Metadata } from "next";
import Link from "next/link";
import { getBook } from "@/lib/library";
import PaperBookPreview from "@/components/library/PaperBookPreview";

export const metadata: Metadata = {
  title: "守株待兔 · 立体绘本样板 | StoryBloom",
  robots: { index: false, follow: false },
};

export default function PaperPreviewPage() {
  const book = getBook("chengyu", "shou-zhu-dai-tu")!;
  return <main className="paper-preview-page">
    <nav className="paper-preview-nav" aria-label="页面导航"><Link href="/library/chengyu/shou-zhu-dai-tu">← 返回绘本详情</Link><span>立体绘本 · 体验样板</span></nav>
    <PaperBookPreview title={book.title} subtitle={book.subtitle} pages={book.pages} />
  </main>;
}
