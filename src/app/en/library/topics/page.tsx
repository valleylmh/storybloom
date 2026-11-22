import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import {
  englishTopicPath,
  getAllEnglishTopics,
  getEnglishTopicBooks,
} from "@/lib/library/english-topics";
import { bookCover } from "@/lib/library/seo";
import { breadcrumbs, pageMetadata } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";

const DESCRIPTION =
  "Browse curated bilingual Chinese & English picture-book collections for kids: bedtime stories, Chinese idioms (Chengyu), Tang poems, Journey to the West, big feelings, science, and Chinese festivals. Free online reading with conversation prompts.";

export const metadata = pageMetadata({
  path: "/library/topics",
  locale: "en",
  bilingual: true,
  title: "Bilingual Chinese & English Story Collections for Kids | StoryBloom",
  description: DESCRIPTION,
});

export default function EnglishLibraryTopicsPage() {
  const topics = getAllEnglishTopics();

  return (
    <main className="library-page library-index-page" lang="en">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              url: toAbsoluteAppUrl("/en/library/topics"),
              name: "Bilingual Chinese & English Story Collections for Kids",
              description: DESCRIPTION,
              inLanguage: "en",
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: topics.length,
                itemListElement: topics.map((topic, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  name: topic.name,
                  url: toAbsoluteAppUrl(englishTopicPath(topic)),
                })),
              },
            },
            breadcrumbs([
              { name: "Home", path: "/en" },
              { name: "Picture Book Library", path: "/en/library" },
              { name: "Bilingual Collections", path: "/en/library/topics" },
            ]),
          ],
        }}
      />

      <nav className="library-topbar" aria-label="Page navigation">
        <Link href="/en/library" className="library-back">← Picture Book Library</Link>
        <Link href="/library/topics" hrefLang="zh-CN" className="library-back">中文专题</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">BILINGUAL COLLECTIONS · {topics.length} CURATED GUIDES</p>
        <h1>Chinese &amp; English picture books, curated by theme</h1>
        <p className="library-lead">{DESCRIPTION}</p>
      </header>

      <section className="library-book-grid" aria-label="Bilingual story collections">
        {topics.map((topic) => {
          const books = getEnglishTopicBooks(topic);
          const cover = books.map(({ book }) => bookCover(book)).find(Boolean);
          return (
            <Link key={topic.id} href={englishTopicPath(topic)} className="library-book-card">
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
              <span className="library-book-open">{books.length} illustrated stories →</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
