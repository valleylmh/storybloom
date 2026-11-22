import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import LibraryTopicLinks from "@/components/library/LibraryTopicLinks";
import { bookCover } from "@/lib/library/seo";
import { topicStructuredData } from "@/lib/library/topic-seo";
import { getAllTopics, getTopic, getTopicBooks, topicPath } from "@/lib/library/topics";
import { pageMetadata } from "@/lib/seo";
import { storyCreationHref } from "@/lib/story-creation-url";

type Params = { topicId: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getAllTopics().map((topic) => ({ topicId: topic.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const topic = getTopic((await params).topicId);
  if (!topic) return {};
  const books = getTopicBooks(topic);
  return pageMetadata({
    path: topicPath(topic),
    title: `${topic.searchLabel}推荐：${books.length} 本免费在线阅读 | StoryBloom`,
    description: topic.description,
    image: books.map(({ book }) => bookCover(book)).find(Boolean),
  });
}

export default async function LibraryTopicPage({ params }: { params: Promise<Params> }) {
  const topic = getTopic((await params).topicId);
  if (!topic) notFound();

  const books = getTopicBooks(topic);
  const groupLabel = topic.group === "parenting" ? "育儿情境" : "阅读主题";
  const startBook = books.find(
    ({ series, book }) => `${series.id}/${book.id}` === topic.startWith,
  );
  const questionItems = books.flatMap(({ series, book }) => {
    const question = book.parentGuide?.questions[0];
    return question ? [{ series, book, question }] : [];
  });
  const useBookQuestions = questionItems.length >= 3;
  const fallbackPrompts = !useBookQuestions ? (topic.discussionPrompts ?? []) : [];
  const otherTopics = [
    ...getAllTopics().filter((item) => item.id !== topic.id && item.group === topic.group),
    ...getAllTopics().filter((item) => item.id !== topic.id && item.group !== topic.group),
  ];

  return (
    <main className="library-page">
      <JsonLd data={topicStructuredData(topic)} />

      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/library" className="library-back">← 绘本馆</Link>
        <Link href="/library/topics" className="library-back">全部绘本专题 →</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">{groupLabel} · {topic.name} · {books.length} 本</p>
        <h1>{topic.heading}</h1>
        <p className="library-lead">{topic.description}</p>
      </header>

      {startBook ? (
        <section className="library-meaning-card" aria-label="先读哪一本">
          <p className="library-meaning-zh">{topic.startHere}</p>
          <p className="library-meaning-origin">
            <Link href={`/library/${startBook.series.id}/${startBook.book.id}`}>
              先打开《{startBook.book.title}》 →
            </Link>
          </p>
        </section>
      ) : null}

      <section className="library-book-grid" aria-label={`${topic.name}绘本`}>
        {books.map(({ series, book }) => {
          const cover = bookCover(book);
          const summaryNote = book.parentGuide
            ? `这本陪孩子练：${book.parentGuide.goal}`
            : book.idiomMeaning?.zh
              ?? book.poem?.appreciation.zh
              ?? book.moral?.zh;
          return (
            <Link key={`${series.id}/${book.id}`} href={`/library/${series.id}/${book.id}`} className="library-book-card">
              <div className="library-book-cover" style={{ backgroundColor: `${series.accent}22` }}>
                {cover ? (
                  <Image src={cover} alt={`${book.title}封面`} width={320} height={320} sizes="(max-width: 580px) 44vw, 280px" />
                ) : (
                  <span className="library-book-cover-fallback" style={{ color: series.accent }}>{book.title.slice(0, 4)}</span>
                )}
              </div>
              <h2>{book.title}</h2>
              <p className="library-book-subtitle">{book.subtitle}</p>
              {summaryNote ? <p className="library-book-meaning">{summaryNote}</p> : null}
              <span className="library-book-open">打开绘本 · {book.pages.length} 页 →</span>
            </Link>
          );
        })}
      </section>

      {useBookQuestions || fallbackPrompts.length > 0 ? (
        <section className="library-parent-guide" aria-labelledby="topic-questions-title">
          <header>
            <p>给大人的共读提问</p>
            <h2 id="topic-questions-title">读完以后，可以这样问孩子</h2>
          </header>
          <article>
            <ul>
              {useBookQuestions
                ? questionItems.map(({ series, book, question }) => (
                    <li key={`${series.id}/${book.id}`}>
                      <Link href={`/library/${series.id}/${book.id}`}>《{book.title}》</Link>：{question}
                    </li>
                  ))
                : fallbackPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
            </ul>
          </article>
        </section>
      ) : null}

      <section className="library-parent-guide" aria-labelledby="topic-faq-title" id="faq">
        <header>
          <p>家长常问</p>
          <h2 id="topic-faq-title">关于{topic.name}，家长常问的 {topic.faqs.length} 个问题</h2>
        </header>
        {topic.faqs.map((faq) => (
          <article key={faq.question}>
            <h3>{faq.question}</h3>
            <p>{faq.answer}</p>
          </article>
        ))}
      </section>

      <LibraryTopicLinks
        topics={otherTopics}
        label="更多绘本专题"
      />

      <section className="library-cta" aria-label="生成专属绘本">
        <h2>你家也有这样的时刻？写成孩子自己的绘本</h2>
        <p>下面这句话已经替你填好，换成你家今天发生的事，几分钟生成一本以孩子为主角的中英双语绘本。</p>
        <p>「{topic.idea}」</p>
        <a href={storyCreationHref({ idea: topic.idea })} className="library-cta-btn">用这句话开始写</a>
      </section>
    </main>
  );
}
