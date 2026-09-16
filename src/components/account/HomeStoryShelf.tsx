"use client";
import Link from "next/link";
import type { StoryHistoryRecord } from "@/lib/client-history";

export default function HomeStoryShelf({ records, locale, onOpen }: {
  records: StoryHistoryRecord[]; locale: "zh" | "en";
  onOpen: (record: StoryHistoryRecord) => void;
}) {
  const zh = locale === "zh";
  const recent = [...records].sort((a, b) =>
    Number(a.status === "complete") - Number(b.status === "complete") || b.updatedAt.localeCompare(a.updatedAt),
  ).slice(0, 3);
  return <section className="home-story-shelf" aria-label={zh ? "最近作品" : "Recent books"}>
    <header className="home-record-heading"><div><h2>{zh ? "最近作品" : "Recent books"}</h2><p>{zh ? "属于你们的故事，随时翻开再读。" : "Your own stories, ready to read again."}</p></div><Link href="/me/books">{zh ? "全部作品 →" : "All books →"}</Link></header>
    {recent.length ? <div className="home-shelf-books">{recent.map(record => {
      const cover = record.result.pages.find(page => page.imageStatus === "complete" && page.imageUrl && !page.imageUrl.startsWith("data:image/svg+xml"))?.imageUrl;
      return <button type="button" className="home-shelf-book" key={record.storyId} onClick={() => onOpen(record)}>
        <span className="home-book-cover">{cover ? <img src={cover} alt="" /> : <span>{record.result.coverTitle}</span>}</span>
        <strong>{record.result.coverTitle}</strong><small>{record.status === "complete" ? (zh ? "翻开故事 →" : "Read story →") : (zh ? "继续创作 →" : "Continue creating →")}</small>
      </button>;
    })}</div> : <div className="home-record-empty"><span aria-hidden="true">✦</span><h3>{zh ? "第一本故事，从今天开始" : "Your first story starts today"}</h3><p>{zh ? "写下一件小事，为孩子留下一本专属绘本。" : "Turn a little moment into a personal storybook."}</p><Link href="/?mode=minimal#story-creation">{zh ? "创作第一本绘本 →" : "Create your first book →"}</Link></div>}
  </section>;
}
