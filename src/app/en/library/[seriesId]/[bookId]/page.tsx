import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import EnglishTopicLinks from "@/components/library/EnglishTopicLinks";
import LibrarySubscribeCard from "@/components/library/LibrarySubscribeCard";
import { getAdjacentBooks, getAllSeries, getBookByEnglishSlug, getPublishedBooks, getSeriesByEnglishSlug } from "@/lib/library";
import { bookEnglishTitle } from "@/lib/library/english-titles";
import { getEnglishBookTopics } from "@/lib/library/english-topics";
import { englishBookSlug, englishSeriesSlug, libraryBookPath, librarySeriesPath } from "@/lib/library/paths";
import { bookMetadata, bookStructuredData, seriesCopy } from "@/lib/library/seo";
import { bookReadingCopy } from "@/lib/library/reading-copy";

type Props = { params: Promise<{ seriesId: string; bookId: string }> };
export function generateStaticParams() {
  return getAllSeries().flatMap((series) =>
    getPublishedBooks(series.id).map((book) => ({
      seriesId: englishSeriesSlug(series.id),
      bookId: englishBookSlug(book),
    })),
  );
}

async function resolveEnglishBook(params: Props["params"]) {
  const { seriesId: seriesSlug, bookId: bookSlug } = await params;
  const series = getSeriesByEnglishSlug(seriesSlug);
  const book = series && getBookByEnglishSlug(series.id, bookSlug);
  if (!series || !book) notFound();
  return { book, series };
}

export async function generateMetadata({ params }: Props) {
  const { book, series } = await resolveEnglishBook(params);
  return bookMetadata(book, series, "en");
}

export default async function EnglishBookPage({ params }: Props) {
  const { book, series } = await resolveEnglishBook(params);
  const copy = seriesCopy(series, "en");
  const readingCopy = bookReadingCopy(book, "en");
  const title = bookEnglishTitle(book);
  const { previous, next } = getAdjacentBooks(series.id, book.id);
  return <main className="library-page" lang="en">
    <JsonLd data={bookStructuredData(book, series, "en")} />
    <nav className="library-topbar" aria-label="Breadcrumb">
      <Link href="/en/library">Picture Book Library</Link>
      <Link href={librarySeriesPath(series.id, "en")}>{copy.title}</Link>
      <Link href={libraryBookPath(book)} hrefLang="zh-CN"><span lang="zh-CN">中文</span> · Bilingual reader</Link>
    </nav>
    <header className="library-hero library-book-hero">
      <p className="library-kicker">{copy.title} · {book.pages.length} illustrated pages</p>
      <h1>{readingCopy ? <>{readingCopy.heading} (<span lang="zh-CN">{book.title}</span>)</> : title === book.title ? <><span lang="zh-CN">{book.title}</span> — Read in English</> : <>{title} (<span lang="zh-CN">{book.title}</span>)</>}</h1>
      <p className="library-lead">{readingCopy?.introduction ?? "A picture book for shared reading. Explore the English story below, or open the Chinese and English reader."}</p>
    </header>
    {book.idiomMeaning ? <section className="library-meaning-card" aria-label="Idiom meaning"><h2>What does the idiom mean?</h2><p>{book.idiomMeaning.en}</p></section> : null}
    {book.poem ? <section className="library-classic-card" aria-label="Original poem and English translation">
      <h2>Tang poem · <span lang="zh-CN">{book.poem.author}</span></h2>
      <blockquote lang="zh-CN" aria-label="Original Chinese poem">{book.poem.originalLines.map((line, index) => <span key={index}>{line}</span>)}</blockquote>
      <h3>English translation</h3>
      <blockquote lang="en">{book.poem.englishLines.map((line, index) => <span key={index}>{line}</span>)}</blockquote>
      <p>{book.poem.appreciation.en}</p>
    </section> : null}
    {book.classic ? <section className="library-classic-card" aria-label="About the classic"><h2>About this classic</h2><p>{book.classic.childExplanation.en}</p></section> : null}
    <section className="pages-grid library-pages" aria-label="Complete story in English">
      {book.pages.map((page) => <article className="page-card" key={page.page} aria-label={`Page ${page.page}`}>
        <div className="page-image-frame">
          {page.imageStatus === "complete" && page.imageUrl ? (
            <Image
              src={page.imageUrl}
              width={960}
              height={960}
              alt={title === book.title ? `Story illustration for page ${page.page}` : `Illustration for page ${page.page} of ${title}`}
              className="page-image"
              sizes="(max-width: 680px) 94vw, 540px"
              priority={page.page === 1}
            />
          ) : null}
        </div>
        <div className="page-copy"><p className="page-en">{page.enText}</p></div>
      </article>)}
    </section>
    {book.moral ? <section className="library-moral" aria-label="Story takeaway"><h2>A thought to share</h2><p>{book.moral.en}</p></section> : null}
    <EnglishTopicLinks topics={getEnglishBookTopics(book)} label="More in this collection" showAll />
    <nav className="library-adjacent" aria-label="Read another story">
      {previous ? <Link href={libraryBookPath(previous, "en")}>← {bookEnglishTitle(previous)}</Link> : <span />}
      {next ? <Link href={libraryBookPath(next, "en")}>{bookEnglishTitle(next)} →</Link> : <span />}
    </nav>
    <LibrarySubscribeCard locale="en" />
    <section className="library-cta"><h2>Make your child the hero of a new story</h2><p>Begin with an everyday moment or a little imaginary adventure.</p><Link className="library-cta-btn" href="/en#story-creation">Create an AI storybook</Link></section>
  </main>;
}
