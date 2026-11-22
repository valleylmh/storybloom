import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import EnglishLibraryCard from "@/components/library/EnglishLibraryCard";
import EnglishTopicLinks from "@/components/library/EnglishTopicLinks";
import { getAllSeries, getPublishedBooks } from "@/lib/library";
import { getAllEnglishTopics } from "@/lib/library/english-topics";
import { librarySeriesPath } from "@/lib/library/paths";
import { libraryBreadcrumbs, seriesCopy } from "@/lib/library/seo";
import { pageMetadata } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";

export const metadata = pageMetadata({
  path: "/library", locale: "en", bilingual: true,
  title: "Free Chinese & English Picture Books for Kids | StoryBloom",
  description: "Read free bilingual picture books: Chinese idiom stories for kids, proverbs, Tang poems, Journey to the West, science and everyday family stories.",
});

export default function EnglishLibraryPage() {
  const series = getAllSeries();
  return <main className="library-page library-index-page" lang="en">
    <JsonLd data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: "StoryBloom Picture Book Library", url: toAbsoluteAppUrl("/en/library"), inLanguage: "en", mainEntity: { "@type": "ItemList", numberOfItems: series.length, itemListElement: series.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: seriesCopy(item, "en").title, url: toAbsoluteAppUrl(librarySeriesPath(item.id, "en")) })) } },
      libraryBreadcrumbs(undefined, undefined, "en"),
    ] }} />
    <nav className="library-topbar" aria-label="Page navigation"><Link href="/en">← Home</Link><Link href="/library" hrefLang="zh-CN">中文</Link></nav>
    <header className="library-hero"><p className="library-kicker">STORYBLOOM PICTURE BOOK LIBRARY</p><h1>Chinese and English stories for reading together</h1><p className="library-lead">Free illustrated stories for curious kids and their families. No account needed to read.</p></header>
    <EnglishTopicLinks topics={getAllEnglishTopics()} label="Browse by theme" showAll />
    <div className="library-catalog">
      {series.map((item) => {
        const copy = seriesCopy(item, "en");
        const books = getPublishedBooks(item.id);
        return <section className="library-series-section" key={item.id}>
          <header className="library-series-section-header"><h2>{copy.title}</h2><Link href={librarySeriesPath(item.id, "en")}>View all {books.length} books →</Link></header>
          <p>{copy.description}</p>
          <div className="library-book-grid">{books.slice(0, 4).map((book) => <EnglishLibraryCard key={book.id} series={item} book={book} />)}</div>
        </section>;
      })}
    </div>
  </main>;
}
