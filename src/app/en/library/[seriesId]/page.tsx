import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/seo/JsonLd";
import EnglishLibraryCard from "@/components/library/EnglishLibraryCard";
import EnglishTopicLinks from "@/components/library/EnglishTopicLinks";
import { getAllSeries, getPublishedBooks, getSeriesByEnglishSlug } from "@/lib/library";
import { getEnglishSeriesTopics } from "@/lib/library/english-topics";
import { englishSeriesSlug, librarySeriesPath } from "@/lib/library/paths";
import { seriesCopy, seriesMetadata, seriesStructuredData } from "@/lib/library/seo";

type Props = { params: Promise<{ seriesId: string }> };
export function generateStaticParams() {
  return getAllSeries().map((series) => ({ seriesId: englishSeriesSlug(series.id) }));
}
export async function generateMetadata({ params }: Props) {
  const { seriesId: seriesSlug } = await params;
  const series = getSeriesByEnglishSlug(seriesSlug);
  if (!series) notFound();
  return seriesMetadata(series, getPublishedBooks(series.id), "en");
}

export default async function EnglishSeriesPage({ params }: Props) {
  const { seriesId: seriesSlug } = await params;
  const series = getSeriesByEnglishSlug(seriesSlug);
  if (!series) notFound();
  const books = getPublishedBooks(series.id);
  const copy = seriesCopy(series, "en");
  return <main className="library-page" lang="en">
    <JsonLd data={seriesStructuredData(series, books, "en")} />
    <nav className="library-topbar" aria-label="Breadcrumb"><Link href="/en/library">← Picture Book Library</Link><Link href={librarySeriesPath(series.id)} hrefLang="zh-CN" lang="zh-CN">中文</Link></nav>
    <header className="library-hero"><p className="library-kicker">CHINESE &amp; ENGLISH · READ TOGETHER</p><h1>{copy.title}</h1><p className="library-lead">{copy.description}</p></header>
    <EnglishTopicLinks topics={getEnglishSeriesTopics(series.id)} label="Related collections" showAll />
    <section className="library-book-grid" aria-label={copy.title}>{books.map((book) => <EnglishLibraryCard key={book.id} book={book} series={series} />)}</section>
  </main>;
}
