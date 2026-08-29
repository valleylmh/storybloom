import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryBookExperience from "@/components/library/LibraryBookExperience";
import LibraryFavoriteButton from "@/components/library/LibraryFavoriteButton";
import LibraryBookTools from "@/components/library/LibraryBookTools";
import LibraryDetailBackLink from "@/components/library/LibraryDetailBackLink";
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
    book.idiomMeaning?.zh ||
    book.poem?.appreciation.zh ||
    book.classic?.childExplanation.zh ||
    book.moral?.zh ||
    `${book.title} · ${book.subtitle}`;
  const coverPage = book.pages[0];
  const cover =
    coverPage?.imageStatus === "complete" ? coverPage.imageUrl : undefined;
  // 「为什么」类问题句是高价值搜索词（任务 C），有 question 时直接作标题主体
  const title = book.question
    ? `${book.question} - 儿童科普双语绘本 | StoryBloom`
    : book.poem
      ? `${book.title} - ${book.poem.author}唐诗双语绘本 | StoryBloom`
      : `${book.title} - 中英双语${series.title}绘本 | StoryBloom`;

  return {
    title,
    description: `${description} 免费在线阅读 ${book.pages.length} 页中英双语儿童绘本，适合 ${book.ageLabel}亲子共读。`,
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
  const personalizeHref = `/?mode=minimal&personalize=${encodeURIComponent(
    `${series.id}/${book.id}`,
  )}#story-creation`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    alternativeHeadline: book.subtitle,
    inLanguage: ["zh-CN", "en"],
    numberOfPages: book.pages.length,
    datePublished: book.publishedAt,
    ...(book.poem
      ? { author: { "@type": "Person", name: book.poem.author } }
      : {}),
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
        <LibraryDetailBackLink
          fallbackHref={`/library/${series.id}`}
          fallbackLabel={series.title}
        />
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
        <div className="library-book-title-row">
          <h1>{book.title}</h1>
          <LibraryFavoriteButton
            contentId={`${series.id}/${book.id}`}
            compact
          />
        </div>
        <p className="library-lead">{book.subtitle}</p>
        <div className="library-book-detail-actions">
          <div className="library-book-facts" aria-label="绘本信息">
            <span>{LIBRARY_CATEGORY_LABELS[bookMetadata.category]}</span>
            {book.poem ? (
              <span>
                {book.poem.dynasty} · {book.poem.author}
              </span>
            ) : null}
            <span>约 {bookMetadata.estimatedMinutes} 分钟</span>
            <span>
              {bookMetadata.ageRange.min}-{bookMetadata.ageRange.max} 岁
            </span>
            <span>{formatLibraryLanguages(bookMetadata.languages)}</span>
          </div>
        </div>
      </header>

      {book.idiomMeaning || book.origin ? (
        <section
          className="library-meaning-card"
          aria-label={
            book.idiomMeaning
              ? "成语释义"
              : book.classic
                ? "经典出处"
                : "作品出处"
          }
        >
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

      {book.classic ? (
        <section className="library-classic-card" aria-label="经典原文与现代解释">
          <p className="library-classic-label">选自 {book.classic.workTitle}</p>
          <blockquote>
            {book.classic.originalLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </blockquote>
          <p className="library-classic-explanation-zh">
            {book.classic.childExplanation.zh}
          </p>
          <p className="library-classic-explanation-en">
            {book.classic.childExplanation.en}
          </p>
          <p className="library-classic-context">
            <strong>放到今天：</strong>{book.classic.historicalContext}
          </p>
        </section>
      ) : null}

      <LibraryBookExperience
        title={book.title}
        pages={book.pages}
        accent={series.accent}
        storyKey={`library-${series.id}-${book.id}`}
        contentType="library"
        contentId={`${series.id}/${book.id}`}
        personalizeHref={
          bookMetadata.personalizationEnabled ? personalizeHref : undefined
        }
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

      {book.poem?.appreciation || book.moral ? (
        <section
          className="library-moral"
          aria-label={book.poem ? "诗意" : "寓意"}
        >
          <p className="library-moral-zh">
            {book.poem?.appreciation.zh ?? book.moral?.zh}
          </p>
          <p className="library-moral-en">
            {book.poem?.appreciation.en ?? book.moral?.en}
          </p>
        </section>
      ) : null}

      {book.parentGuide ? (
        <section className="library-parent-guide" aria-labelledby="library-parent-guide-title">
          <header>
            <p>给大人的共读锦囊</p>
            <h2 id="library-parent-guide-title">这次不考背诵，练一种生活能力</h2>
          </header>
          <div className="library-parent-guide-grid">
            <article>
              <h3>这本想陪孩子练什么</h3>
              <p>{book.parentGuide.goal}</p>
            </article>
            <article>
              <h3>共读时别急着说</h3>
              <p>{book.parentGuide.reminder}</p>
            </article>
            <article>
              <h3>可以这样问</h3>
              <ul>
                {book.parentGuide.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>今天试试看</h3>
              <p>{book.parentGuide.activity}</p>
            </article>
          </div>
          <div className="library-parent-guide-age-tips" aria-label="分龄提示">
            <p><strong>4–5 岁：</strong>{book.parentGuide.ageTips.age4to5}</p>
            <p><strong>6–8 岁：</strong>{book.parentGuide.ageTips.age6to8}</p>
          </div>
        </section>
      ) : null}

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

      <LibraryBookTools
        title={book.title}
        pages={book.pages}
        shareUrl={toAbsoluteAppUrl(`/library/${series.id}/${book.id}`)}
      />

      {bookMetadata.personalizationEnabled ? (
        <section className="library-cta" aria-label="生成专属绘本">
          <h2>让孩子走进这个故事</h2>
          <p>
            生成一本以孩子为主角的「{book.title}」新编绘本，
            或写下任何一个小心愿，几分钟做成专属中英双语绘本。
          </p>
          <Link href={personalizeHref} className="library-cta-btn">
            让孩子成为故事主角
          </Link>
        </section>
      ) : null}
    </main>
  );
}
