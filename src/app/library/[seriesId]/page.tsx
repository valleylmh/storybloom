import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSeries, getSeries, getSeriesBooks } from "@/lib/library";

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

      <section className="library-book-grid" aria-label={`${series.title}书目`}>
        {books.map((book) => {
          const coverPage = book.pages[0];
          // 草稿书的 imageUrl 先于图片文件存在；只有已完成的图才能当封面
          const cover =
            coverPage?.imageStatus === "complete" ? coverPage.imageUrl : null;
          const card = (
            <>
              <div
                className="library-book-cover"
                style={{ backgroundColor: `${series.accent}22` }}
              >
                {cover ? (
                  <img src={cover} alt={`${book.title}封面`} loading="lazy" />
                ) : (
                  <span
                    className="library-book-cover-fallback"
                    style={{ color: series.accent }}
                  >
                    {book.title.slice(0, 4)}
                  </span>
                )}
                {book.comingSoon ? (
                  <span className="library-book-soon">即将上线</span>
                ) : null}
              </div>
              <h2>
                {book.episodeNumber ? `第 ${book.episodeNumber} 回 · ` : ""}
                {book.title}
              </h2>
              <p className="library-book-subtitle">{book.subtitle}</p>
              {book.idiomMeaning ? (
                <p className="library-book-meaning">{book.idiomMeaning.zh}</p>
              ) : null}
            </>
          );

          return book.comingSoon ? (
            <div
              key={book.id}
              className="library-book-card library-book-card-soon"
              aria-disabled="true"
            >
              {card}
            </div>
          ) : (
            <Link
              key={book.id}
              href={`/library/${series.id}/${book.id}`}
              className="library-book-card"
            >
              {card}
            </Link>
          );
        })}
        {books.length === 0 ? (
          <p className="library-empty">本系列正在筹备中，敬请期待。</p>
        ) : null}
      </section>
    </main>
  );
}
