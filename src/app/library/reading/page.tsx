import Link from "next/link";
import BookshelfReadingSections from "@/components/account/BookshelfReadingSections";
import ReadingSyncControl from "@/components/library/ReadingSyncControl";
import { getAllSeries, getSeriesBooks } from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";
export const metadata = { title: "阅读记录与收藏 | StoryBloom" };
export default function ReadingPage() {
  const books = getAllSeries().flatMap(series => getSeriesBooks(series.id).filter(book=>!book.comingSoon).map(book=>createLibraryBookSummary(series,book)));
  return <main className="library-page"><nav className="library-topbar"><Link href="/library">← 返回绘本馆</Link></nav><header className="library-hero"><p className="library-kicker">我的阅读时光</p><h1>把喜欢的故事，再读一遍。</h1><p className="library-lead">继续上次的阅读，或翻开收藏里的那一本。</p></header><BookshelfReadingSections books={books} /><details className="growth-sync-details"><summary>阅读进度与收藏同步</summary><ReadingSyncControl /></details></main>;
}
