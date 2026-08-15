import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryBookExperience from "@/components/library/LibraryBookExperience";
import LibraryFavoriteButton from "@/components/library/LibraryFavoriteButton";
import LibraryBookTools from "@/components/library/LibraryBookTools";
import {
  getAdjacentBooks,
  getAllSeries,
  getBook,
  getSeries,
  getSeriesBooks,
} from "@/lib/library";
import {
  formatLibraryLanguages,
  LIBRARY_CATEGORY_LABELS,
  resolveLibraryBookMetadata,
} from "@/lib/library/metadata";
import { toAbsoluteAppUrl } from "@/lib/site-url";

type Params = { seriesId: string; bookId: string };

export function generateStaticParams(): Params[] {
  return getAllSeries().flatMap((series) =>
    getSeriesBooks(series.id).map((book) => ({
      seriesId: series.id,
      bookId: book.id,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { seriesId, bookId } = await params;
  const series = getSeries(seriesId);
  const book = getBook(seriesId, bookId);

  if (!series || !book) {
    return {};
  }

  const description =
    book.idiomMeaning?.zh || book.moral?.zh || `${book.title} · ${book.subtitle}`;
  const coverPage = book.pages[0];
  const cover =
    coverPage?.imageStatus === "complete" ? coverPage.imageUrl : undefined;
  // 「为什么」类问题句是高价值搜索词（任务 C），有 question 时直接作标题主体
  const title = book.question
    ? `${book.question} - 儿童科普双语绘本 | StoryBloom`
    : `${book.title} - 中英双语${series.title}绘本 | StoryBloom`;

  return {
    title,
    description: `${description} 免费在线阅读 8 页中英双语儿童绘本，适合 ${book.ageLabel}亲子共读。`,
    alternates: { canonical: `/library/${series.id}/${book.id}` },
    // 未正式发布的书不进搜索引擎
    robots: book.comingSoon ? { index: false, follow: false } : undefined,
    openGraph: {
      title: `${book.title} | StoryBloom 绘本馆`,
      description,
      type: "article",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

export default async function LibraryBookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { seriesId, bookId } = await params;
  const series = getSeries(seriesId);
  const book = getBook(seriesId, bookId);

  if (!series || !book) {
    notFound();
  }

  const { previous, next } = getAdjacentBooks(seriesId, bookId);
  // 连载预告：没有已发布的下一本时，展示紧随其后的未发布书（「即将更新」）
  const seriesBooks = getSeriesBooks(seriesId);
  const bookIndex = seriesBooks.findIndex((item) => item.id === bookId);
  const upcomingNext =
    !next && bookIndex !== -1
      ? (seriesBooks
          .slice(bookIndex + 1)
          .find((item) => item.comingSoon) ?? null)
      : null;
  const coverPage = book.pages[0];
  const coverImage =
    coverPage?.imageStatus === "complete" ? coverPage.imageUrl : undefined;
  const previewReadyForReview =
    book.pages.length > 0 &&
    book.pages.every(
      (page) => Boolean(page.imageUrl) && page.imageStatus === "complete",
    );
  const bookMetadata = resolveLibraryBookMetadata(book);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    alternativeHeadline: book.subtitle,
    inLanguage: ["zh-CN", "en"],
    numberOfPages: book.pages.length,
    datePublished: book.publishedAt,
    isPartOf: {
      "@type": "BookSeries",
      name: `StoryBloom ${series.title}`,
    },
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: bookMetadata.ageRange.min,
      suggestedMaxAge: bookMetadata.ageRange.max,
    },
    ...(coverImage ? { image: toAbsoluteAppUrl(coverImage) } : {}),
  };

  return (
    <main className="library-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="library-topbar" aria-label="页面导航">
        <Link href={`/library/${series.id}`} className="library-back">
          ← {series.title}
        </Link>
      </nav>

      {book.comingSoon ? (
        <div className="library-preview-banner" role="status">
          {previewReadyForReview
            ? "抢先预览 · 本书文字与插图已完成，等待上线验收"
            : "抢先预览 · 本书文字与插图仍在制作打磨中"}
        </div>
      ) : null}

      <header className="library-hero library-book-hero">
        <p className="library-kicker" style={{ color: series.accent }}>
          {series.title}
          {book.episodeNumber ? ` · 第 ${book.episodeNumber} 回` : ""} ·{" "}
          {book.ageLabel}
        </p>
        <h1>{book.title}</h1>
        <p className="library-lead">{book.subtitle}</p>
        <div className="library-book-detail-actions">
          <div className="library-book-facts" aria-label="绘本信息">
            <span>{LIBRARY_CATEGORY_LABELS[bookMetadata.category]}</span>
            <span>约 {bookMetadata.estimatedMinutes} 分钟</span>
            <span>
              {bookMetadata.ageRange.min}-{bookMetadata.ageRange.max} 岁
            </span>
            <span>{formatLibraryLanguages(bookMetadata.languages)}</span>
          </div>
          <LibraryFavoriteButton contentId={`${series.id}/${book.id}`} />
        </div>
      </header>

      {book.idiomMeaning || book.origin ? (
        <section className="library-meaning-card" aria-label="成语释义">
          {book.idiomMeaning ? (
            <>
              <p className="library-meaning-zh">
                <strong>{book.title}</strong>：{book.idiomMeaning.zh}
              </p>
              <p className="library-meaning-en">{book.idiomMeaning.en}</p>
            </>
          ) : null}
          {book.origin ? (
            <p className="library-meaning-origin">典出 {book.origin}</p>
          ) : null}
        </section>
      ) : null}

      <LibraryBookExperience
        title={book.title}
        pages={book.pages}
        accent={series.accent}
        storyKey={`library-${series.id}-${book.id}`}
        contentType="library"
        contentId={`${series.id}/${book.id}`}
      />

      {/* 无 JS / 搜索引擎兜底：完整正文仍以平铺形式输出 */}
      <noscript>
        <section className="pages-grid library-pages" aria-label="绘本正文">
          {book.pages.map((page) => (
            <article
              key={page.page}
              className="page-card"
              aria-label={`第 ${page.page} 页`}
            >
              <div className="page-image-frame">
                {page.imageUrl && page.imageStatus === "complete" ? (
                  <img
                    src={page.imageUrl}
                    alt={`${book.title} 第 ${page.page} 页插图`}
                    className="page-image"
                    loading={page.page > 2 ? "lazy" : undefined}
                  />
                ) : (
                  <div
                    className="library-page-fallback"
                    style={{ backgroundColor: `${series.accent}18`, color: series.accent }}
                    aria-hidden="true"
                  >
                    <span>{page.page}</span>
                  </div>
                )}
              </div>
              <div className="page-copy">
                <p className="page-zh">{page.zhText}</p>
                <p className="page-en">{page.enText}</p>
              </div>
            </article>
          ))}
        </section>
      </noscript>

      {book.moral ? (
        <section className="library-moral" aria-label="寓意">
          <p className="library-moral-zh">{book.moral.zh}</p>
          <p className="library-moral-en">{book.moral.en}</p>
        </section>
      ) : null}

      <LibraryBookTools
        title={book.title}
        pages={book.pages}
        shareUrl={toAbsoluteAppUrl(`/library/${series.id}/${book.id}`)}
      />

      <nav className="library-adjacent" aria-label="继续阅读">
        {previous ? (
          <Link
            href={`/library/${series.id}/${previous.id}`}
            className="library-adjacent-link"
          >
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/library/${series.id}/${next.id}`}
            className="library-adjacent-link"
          >
            {next.episodeNumber ? `第 ${next.episodeNumber} 回 · ` : ""}
            {next.title} →
          </Link>
        ) : upcomingNext ? (
          <span className="library-adjacent-upcoming">
            {upcomingNext.episodeNumber
              ? `第 ${upcomingNext.episodeNumber} 回 · `
              : ""}
            {upcomingNext.title} · 即将更新
          </span>
        ) : (
          <span />
        )}
      </nav>

      <section className="library-cta" aria-label="生成专属绘本">
        <h2>让孩子走进这个故事</h2>
        <p>
          生成一本以孩子为主角的「{book.title}」新编绘本，
          或写下任何一个小心愿，几分钟做成专属中英双语绘本。
        </p>
        <Link
          href={`/?mode=minimal&idea=${encodeURIComponent(
            `让孩子走进「${book.title}」的故事，和主角一起明白其中的道理`,
          )}`}
          className="library-cta-btn"
        >
          免费生成专属绘本
        </Link>
      </section>
    </main>
  );
}
