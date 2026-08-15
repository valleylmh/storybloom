import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibrarySeriesExperience from "@/components/library/LibrarySeriesExperience";
import { getAllSeries, getSeries, getSeriesBooks } from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";

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

  return {
    title: `${series.title}绘本 | 中英双语在线阅读 - StoryBloom`,
    description: series.description,
    alternates: { canonical: `/library/${series.id}` },
    openGraph: {
      title: `StoryBloom 绘本馆 · ${series.title}`,
      description: series.description,
      type: "website",
    },
  };
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

  return (
    <main className="library-page">
      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/library" className="library-back">
          ← 绘本馆
        </Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker" style={{ color: series.accent }}>
          {series.ageRange} · 中英双语
        </p>
        <h1>{series.title}</h1>
        <p className="library-lead">{series.description}</p>
      </header>

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
