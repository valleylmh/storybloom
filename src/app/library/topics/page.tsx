import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { bookCover } from "@/lib/library/seo";
import {
  getAllTopics,
  getTopicBooks,
  getTopicsByGroup,
  topicPath,
  type LibraryTopic,
} from "@/lib/library/topics";
import { breadcrumbs, pageMetadata } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";

const DESCRIPTION =
  "入园焦虑、怕黑、发脾气、收拾与边界、睡前故事、交通安全、自然科普、唐诗启蒙与成语智慧……按孩子正在经历的事或当下兴趣找绘本。每个专题精选几本中英双语绘本，免费在线阅读，附共读建议与家长问答。";

export const metadata = pageMetadata({
  path: "/library/topics",
  bilingual: true,
  title: "按场景与主题找绘本：入园焦虑、睡前故事、交通安全、科普与唐诗 | StoryBloom",
  description: DESCRIPTION,
});

function TopicGrid({ topics, label }: { topics: LibraryTopic[]; label: string }) {
  return (
    <div className="library-book-grid" aria-label={label}>
      {topics.map((topic) => {
        const books = getTopicBooks(topic);
        const cover = books.map(({ book }) => bookCover(book)).find(Boolean);
        return (
          <Link key={topic.id} href={topicPath(topic)} className="library-book-card">
            <div className="library-book-cover">
              {cover ? (
                <Image
                  src={cover}
                  alt=""
                  width={320}
                  height={320}
                  sizes="(max-width: 580px) 44vw, 280px"
                />
              ) : null}
            </div>
            <h3>{topic.name}</h3>
            <p className="library-book-subtitle">{topic.heading}</p>
            <span className="library-book-open">{books.length} 本绘本 →</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function LibraryTopicsPage() {
  const topics = getAllTopics();
  const parentingTopics = getTopicsByGroup("parenting");
  const themeTopics = getTopicsByGroup("theme");

  return (
    <main className="library-page library-index-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              url: toAbsoluteAppUrl("/library/topics"),
              name: "按场景与主题找绘本",
              description: DESCRIPTION,
              inLanguage: "zh-CN",
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: topics.length,
                itemListElement: topics.map((topic, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  name: topic.name,
                  url: toAbsoluteAppUrl(topicPath(topic)),
                })),
              },
            },
            breadcrumbs([
              { name: "首页", path: "/" },
              { name: "绘本馆", path: "/library" },
              { name: "绘本专题", path: "/library/topics" },
            ]),
          ],
        }}
      />

      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/library" className="library-back">← 绘本馆</Link>
        <Link href="/en/library/topics" hrefLang="en" className="library-back">English →</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">绘本专题 · {topics.length} 个精选合集</p>
        <h1>孩子正在经历什么，或想读什么，就打开哪一组</h1>
        <p className="library-lead">{DESCRIPTION}</p>
      </header>

      <div className="library-catalog">
        <section className="library-series-section" aria-labelledby="topics-parenting-heading">
          <header className="library-series-section-header">
            <h2 id="topics-parenting-heading">按育儿情境找</h2>
            <span className="library-series-count">{parentingTopics.length} 个专题</span>
          </header>
          <TopicGrid topics={parentingTopics} label="育儿情境专题" />
        </section>

        <section className="library-series-section" aria-labelledby="topics-theme-heading">
          <header className="library-series-section-header">
            <h2 id="topics-theme-heading">按阅读主题找</h2>
            <span className="library-series-count">{themeTopics.length} 个专题</span>
          </header>
          <TopicGrid topics={themeTopics} label="阅读主题专题" />
        </section>
      </div>
    </main>
  );
}
