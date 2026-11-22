import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnglishLibraryCard from "@/components/library/EnglishLibraryCard";
import EnglishTopicLinks from "@/components/library/EnglishTopicLinks";
import JsonLd from "@/components/seo/JsonLd";
import { bookEnglishTitle } from "@/lib/library/english-titles";
import { englishTopicStructuredData } from "@/lib/library/english-topic-seo";
import {
  getAllEnglishTopics,
  getEnglishTopic,
  getEnglishTopicBooks,
} from "@/lib/library/english-topics";
import { libraryBookPath } from "@/lib/library/paths";
import { bookCover } from "@/lib/library/seo";
import { pageMetadata } from "@/lib/seo";

type Params = { topicId: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getAllEnglishTopics().map((topic) => ({ topicId: topic.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const topic = getEnglishTopic((await params).topicId);
  if (!topic) return {};
  const books = getEnglishTopicBooks(topic);
  return pageMetadata({
    path: `/library/topics/${topic.id}`,
    locale: "en",
    bilingual: false,
    title: `${topic.seoTitle} | StoryBloom`,
    description: topic.description,
    image: books.map(({ book }) => bookCover(book)).find(Boolean),
  });
}

export default async function EnglishLibraryTopicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const topic = getEnglishTopic((await params).topicId);
  if (!topic) notFound();

  const books = getEnglishTopicBooks(topic);
  const startBook = books.find(
    ({ series, book }) => `${series.id}/${book.id}` === topic.startWith,
  );

  return (
    <main className="library-page" lang="en">
      <JsonLd data={englishTopicStructuredData(topic)} />

      <nav className="library-topbar" aria-label="Page navigation">
        <Link href="/en/library" className="library-back">← Picture Book Library</Link>
        <Link href="/en/library/topics" className="library-back">All collections →</Link>
        <Link href="/library/topics" hrefLang="zh-CN" className="library-back">中文专题</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">
          BILINGUAL COLLECTION · {topic.name.toUpperCase()} · {books.length} STORIES
        </p>
        <h1>{topic.heading}</h1>
        <p className="library-lead">{topic.description}</p>
      </header>

      {startBook ? (
        <section className="library-meaning-card" aria-label="Where to start">
          <p className="library-meaning-zh">{topic.startHere}</p>
          <p className="library-meaning-origin">
            <Link href={libraryBookPath(startBook.book, "en")}>
              Start with {bookEnglishTitle(startBook.book)} →
            </Link>
          </p>
        </section>
      ) : null}

      <section className="library-book-grid" aria-label={topic.name}>
        {books.map(({ series, book }) => (
          <EnglishLibraryCard
            key={`${series.id}/${book.id}`}
            series={series}
            book={book}
          />
        ))}
      </section>

      <section className="library-parent-guide" aria-labelledby="topic-prompts-title">
        <header>
          <p>CONVERSATION PROMPTS</p>
          <h2 id="topic-prompts-title">Questions to ask after reading together</h2>
        </header>
        <article>
          <ul>
            {topic.discussionPrompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="library-parent-guide" aria-labelledby="topic-faq-title" id="faq">
        <header>
          <p>PARENT &amp; TEACHER FAQ</p>
          <h2 id="topic-faq-title">Common questions about {topic.name}</h2>
        </header>
        {topic.faqs.map((faq) => (
          <article key={faq.question}>
            <h3>{faq.question}</h3>
            <p>{faq.answer}</p>
          </article>
        ))}
      </section>

      <EnglishTopicLinks
        topics={getAllEnglishTopics().filter((item) => item.id !== topic.id)}
        label="More bilingual collections"
      />

      <section className="library-cta" aria-label="Create a custom bilingual storybook">
        <h2>Turn your child&apos;s own moment into a bilingual storybook</h2>
        <p>
          Write a short scene from today and generate an illustrated Chinese &amp; English picture
          book starring your child in minutes.
        </p>
        <Link href="/en#story-creation" className="library-cta-btn">
          Create a free AI storybook
        </Link>
      </section>
    </main>
  );
}
