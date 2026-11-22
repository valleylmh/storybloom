import JsonLd from "@/components/seo/JsonLd";
import { seriesMetadata, seriesStructuredData } from "@/lib/library/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibrarySeriesExperience from "@/components/library/LibrarySeriesExperience";
import LibraryTopicLinks from "@/components/library/LibraryTopicLinks";
import { getAllSeries, getSeries, getSeriesBooks } from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import { librarySeriesPath } from "@/lib/library/paths";
import { getSeriesTopics } from "@/lib/library/topics";

type Params = { seriesId: string };

export function generateStaticParams(): Params[] {
  return getAllSeries().map((series) => ({ seriesId: series.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { seriesId } = await params;
  const series = getSeries(seriesId);

  if (!series) {
    return {};
  }

  return seriesMetadata(series, getSeriesBooks(series.id));
}

export default async function LibrarySeriesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { seriesId } = await params;
  const series = getSeries(seriesId);

  if (!series) {
    notFound();
  }

  const books = getSeriesBooks(seriesId);
  const bookSummaries = books.map((book) =>
    createLibraryBookSummary(series, book),
  );
  const seriesTopics = getSeriesTopics(series.id);
  const topicsLabel = seriesTopics.every((topic) => topic.group === "parenting")
    ? "按育儿情境找"
    : "相关绘本专题";

  return (
    <main className="library-page">
      <JsonLd data={seriesStructuredData(series, books)} />
      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/library" className="library-back">
          ← 绘本馆
        </Link>
        <Link href={librarySeriesPath(series.id, "en")} hrefLang="en" className="library-back">English →</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker" style={{ color: series.accent }}>
          {series.ageRange} · 中英双语
        </p>
        <h1>{series.title}</h1>
        <p className="library-lead">{series.description}</p>
      </header>

      <LibraryTopicLinks topics={seriesTopics} label={topicsLabel} showAll />

      {books.length > 0 ? (
        <LibrarySeriesExperience books={bookSummaries} />
      ) : (
        <section className="library-book-grid" aria-label={`${series.title}书目`}>
          <p className="library-empty">本系列正在筹备中，敬请期待。</p>
        </section>
      )}
    </main>
  );
}
