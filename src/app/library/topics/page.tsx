import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { bookCover } from "@/lib/library/seo";
import { getAllTopics, getTopicBooks, topicPath } from "@/lib/library/topics";
import { breadcrumbs, pageMetadata } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";

const DESCRIPTION = "入园焦虑、怕黑、发脾气、二宝出生、输不起、屏幕时间……按孩子正在经历的事找绘本。每个情境精选几本中英双语绘本，免费在线阅读，附给大人的共读提问。";

export const metadata = pageMetadata({
  path: "/library/topics",
  title: "按育儿情境找绘本：入园焦虑、怕黑、发脾气、二宝 | StoryBloom",
  description: DESCRIPTION,
});

export default function LibraryTopicsPage() {
  const topics = getAllTopics();

  return (
    <main className="library-page">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "CollectionPage", url: toAbsoluteAppUrl("/library/topics"), name: "按育儿情境找绘本", description: DESCRIPTION, inLanguage: "zh-CN", mainEntity: { "@type": "ItemList", numberOfItems: topics.length, itemListElement: topics.map((topic, index) => ({ "@type": "ListItem", position: index + 1, name: topic.name, url: toAbsoluteAppUrl(topicPath(topic)) })) } },
        breadcrumbs([
          { name: "首页", path: "/" },
          { name: "绘本馆", path: "/library" },
          { name: "育儿情境", path: "/library/topics" },
        ]),
      ] }} />

      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/library" className="library-back">← 绘本馆</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">育儿情境 · {topics.length} 个专题</p>
        <h1>孩子正在经历什么，就读哪一本</h1>
        <p className="library-lead">{DESCRIPTION}</p>
      </header>

      <section className="library-book-grid" aria-label="育儿情境专题">
        {topics.map((topic) => {
          const books = getTopicBooks(topic);
          const cover = books.map(({ book }) => bookCover(book)).find(Boolean);
          return (
            <Link key={topic.id} href={topicPath(topic)} className="library-book-card">
              <div className="library-book-cover">
                {cover ? <Image src={cover} alt="" width={320} height={320} sizes="(max-width: 580px) 44vw, 280px" /> : null}
              </div>
              <h2>{topic.name}</h2>
              <p className="library-book-subtitle">{topic.heading}</p>
              <span className="library-book-open">{books.length} 本绘本 →</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
