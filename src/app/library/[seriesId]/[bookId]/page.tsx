import JsonLd from "@/components/seo/JsonLd";
import { bookMetadata as createBookMetadata, bookStructuredData } from "@/lib/library/seo";
import { getLibraryContentId } from "@/lib/library/content-id";
import { bookEnglishTitle } from "@/lib/library/english-titles";
import { bookReadingCopy } from "@/lib/library/reading-copy";
import { libraryBookPath } from "@/lib/library/paths";
import { getLibraryChineseAudio } from "@/lib/library-book-audio";
import { getLibraryFeedbackConfig } from "@/lib/email/library-feedback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import LibraryBookExperience from "@/components/library/LibraryBookExperience";
import LibraryFavoriteButton from "@/components/library/LibraryFavoriteButton";
import LibraryBookTools from "@/components/library/LibraryBookTools";
import LibraryDetailBackLink from "@/components/library/LibraryDetailBackLink";
import LibraryBookStickyTitle from "@/components/library/LibraryBookStickyTitle";
import LibraryTopicLinks from "@/components/library/LibraryTopicLinks";
import LibrarySubscribeCard from "@/components/library/LibrarySubscribeCard";
import {
  getAdjacentBooks,
  getAllSeries,
  getBook,
  getSeries,
  getSeriesBooks,
} from "@/lib/library";
import {
  formatLibraryLanguages,
  getLibraryBookCategoryLabel,
  resolveLibraryBookMetadata,
} from "@/lib/library/metadata";
import { getBookTopics } from "@/lib/library/topics";
import { toAbsoluteAppUrl } from "@/lib/site-url";
import { storyCreationHref } from "@/lib/story-creation-url";

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
  const book = getBook(seriesId, bookId);
  const series = getSeries(book?.seriesId ?? seriesId);

  if (!series || !book) {
    return {};
  }

  return createBookMetadata(book, series);
}

export default async function LibraryBookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { seriesId, bookId } = await params;
  const book = getBook(seriesId, bookId);
  const series = getSeries(book?.seriesId ?? seriesId);

  if (!series || !book) {
    notFound();
  }

  if (book.seriesId !== seriesId) {
    permanentRedirect(`/library/${book.seriesId}/${book.id}`);
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
  const previewReadyForReview =
    book.pages.length > 0 &&
    book.pages.every(
      (page) => Boolean(page.imageUrl) && page.imageStatus === "complete",
    );
  const bookMetadata = resolveLibraryBookMetadata(book);
  const readingCopy = bookReadingCopy(book);
  const personalizeHref = storyCreationHref({ personalize: `${series.id}/${book.id}` });

  return (
    <main className="library-page">
      <JsonLd data={bookStructuredData(book, series)} />

      <nav className="library-topbar" aria-label="页面导航">
        <LibraryDetailBackLink
          fallbackHref={`/library/${series.id}`}
          fallbackLabel={series.title}
        />
        {!book.comingSoon ? <Link href={libraryBookPath(book, "en")} hrefLang="en" className="library-back">English →</Link> : null}
      </nav>

      <LibraryBookStickyTitle
        key={`sticky-title-${series.id}/${book.id}`}
        title={book.title}
        titleId="library-book-title"
        fallbackHref={`/library/${series.id}`}
        fallbackLabel={series.title}
      />

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
          {book.subseries ? ` · ${book.subseries.title}` : ""}
          {book.episodeNumber ? ` · 第 ${book.episodeNumber} 回` : ""} ·{" "}
          {book.ageLabel}
        </p>
        <div className="library-book-title-row">
          <h1 id="library-book-title">{book.title}</h1>
          <LibraryFavoriteButton
            contentId={getLibraryContentId(book)}
            compact
          />
        </div>
        <p className="library-lead">{book.subtitle}</p>
        <div className="library-book-detail-actions">
          <div className="library-book-facts" aria-label="绘本信息">
            <span>{getLibraryBookCategoryLabel(bookMetadata)}</span>
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

      {readingCopy ? (
        <section className="library-meaning-card" aria-label="绘本导读">
          <p className="library-meaning-zh">{readingCopy.introduction}</p>
        </section>
      ) : null}

      {book.idiomMeaning || book.origin ? (
        <section
          className="library-meaning-card"
          aria-label={
            book.idiomMeaning
              ? bookMetadata.tags.includes("谚语故事")
                ? "谚语释义"
                : "成语释义"
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
            <p className="library-meaning-origin">来源：{book.origin}</p>
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
        key={`${series.id}/${book.id}`}
        seriesTitle={series.title}
        playlist={seriesBooks.filter((item) => !item.comingSoon).map((item) => ({
          id: getLibraryContentId(item),
          title: item.title,
          englishTitle: bookEnglishTitle(item),
          cover: item.pages[0]?.imageStatus === "complete" ? item.pages[0].imageUrl : undefined,
          href: `/library/${series.id}/${item.id}`,
          chineseAudio: getLibraryChineseAudio(series.id, item.id, item.pages),
        }))}
        chineseAudio={getLibraryChineseAudio(series.id, book.id, book.pages)}
        title={book.title}
        pages={book.pages}
        accent={series.accent}
        storyKey={`library-${getLibraryContentId(book).replace("/", "-")}`}
        contentType="library"
        contentId={getLibraryContentId(book)}
        floatingActions={{
          feedbackEnabled: Boolean(getLibraryFeedbackConfig()),
          supportQrCodeUrl: process.env.STORYBLOOM_SUPPORT_QR_URL?.trim(),
          supportLabel: process.env.STORYBLOOM_SUPPORT_LABEL?.trim(),
        }}
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
            <h2 id="library-parent-guide-title">
              {book.seriesId === "sanzijing" && !book.classic
                ? "读完故事，一起试一件小事"
                : "这次不考背诵，练一种生活能力"}
            </h2>
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

      <LibraryTopicLinks topics={getBookTopics(book)} label="相关绘本专题" showAll />

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

      {book.comingSoon ? null : <LibrarySubscribeCard />}

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
