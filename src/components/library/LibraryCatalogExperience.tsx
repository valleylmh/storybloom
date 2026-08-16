"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart } from "@phosphor-icons/react";
import { useFavorites } from "@/hooks/useFavorites";
import { createFavoriteKey, FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import type { LibraryBookSummary } from "@/lib/library/catalog";
import {
  listReadingProgress,
  READING_PROGRESS_CHANGED_EVENT,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";
import ReadingSyncControl from "@/components/library/ReadingSyncControl";
import LibraryCatalogCard from "@/components/library/LibraryCatalogCard";

type SeriesSummary = {
  id: string;
  title: string;
  subtitle: string;
};

function readingMap(records: ReadingProgressRecord[]) {
  return new Map(
    records.map((record) => [record.contentId, record] as const),
  );
}

export default function LibraryCatalogExperience({
  books,
  series,
}: {
  books: LibraryBookSummary[];
  series: SeriesSummary[];
}) {
  const [progressRecords, setProgressRecords] = useState<
    ReadingProgressRecord[]
  >([]);
  const { records: favoriteRecords, keys: favoriteKeys, toggle } =
    useFavorites();

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listReadingProgress().then((records) => {
        if (active) setProgressRecords(records);
      });
    };
    refresh();
    window.addEventListener(READING_PROGRESS_CHANGED_EVENT, refresh);
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(READING_PROGRESS_CHANGED_EVENT, refresh);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const publishedBooks = useMemo(
    () => books.filter((book) => !book.comingSoon),
    [books],
  );
  const progressByContent = useMemo(
    () => readingMap(progressRecords),
    [progressRecords],
  );
  const bookByContent = useMemo(
    () => new Map(publishedBooks.map((book) => [book.contentId, book] as const)),
    [publishedBooks],
  );
  const recentBooks = progressRecords
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const favoriteBooks = favoriteRecords
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const quickPanelCount = Number(recentBooks.length > 0) + Number(favoriteBooks.length > 0);

  const renderCard = (
    book: LibraryBookSummary,
    compact = false,
    minimal = false,
  ) => (
    <LibraryCatalogCard
      key={book.contentId}
      book={book}
      progress={progressByContent.get(book.contentId)}
      favorite={favoriteKeys.has(createFavoriteKey("library", book.contentId))}
      onToggleFavorite={() => toggle("library", book.contentId)}
      compact={compact}
      minimal={minimal}
    />
  );

  const renderQuickItem = (
    book: LibraryBookSummary,
    showFavoriteAction = false,
  ) => {
    const progress = progressByContent.get(book.contentId);
    const status = progress?.completedAt
      ? "已读"
      : progress && progress.progressPercent > 0
        ? `当前 · 第 ${progress.pageIndex + 1} 页`
        : null;
    const title = book.episodeNumber
      ? `第 ${book.episodeNumber} 回 · ${book.title}`
      : book.title;
    const favorite = favoriteKeys.has(
      createFavoriteKey("library", book.contentId),
    );

    return (
      <article key={book.contentId} className="library-quick-list-item">
        <Link href={book.href}>
          <div
            className="library-quick-list-cover"
            style={{ backgroundColor: `${book.seriesAccent}22` }}
          >
            {book.coverImage ? (
              <Image src={book.coverImage} alt="" fill sizes="72px" />
            ) : (
              <span style={{ color: book.seriesAccent }}>
                {book.title.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="library-quick-list-copy">
            <h3>{title}</h3>
            <div className="library-quick-list-meta">
              {status ? <span>{status}</span> : null}
              <p>{book.subtitle}</p>
            </div>
          </div>
        </Link>
        {showFavoriteAction ? (
          <button
            type="button"
            className={`library-quick-list-favorite ${
              favorite ? "library-quick-list-favorite-active" : ""
            }`}
            aria-label={
              favorite ? `取消收藏《${book.title}》` : `收藏《${book.title}》`
            }
            aria-pressed={favorite}
            onClick={() => toggle("library", book.contentId)}
          >
            <Heart aria-hidden="true" weight={favorite ? "fill" : "regular"} />
          </button>
        ) : null}
      </article>
    );
  };

  return (
    <>
      <ReadingSyncControl />

      {quickPanelCount > 0 ? (
        <div
          className={`library-quick-panels ${
            quickPanelCount === 1 ? "library-quick-panels-single" : ""
          }`}
        >
          {recentBooks.length > 0 ? (
            <section
              className="library-quick-panel"
              aria-labelledby="recent-reading-title"
            >
              <header>
                <h2 id="recent-reading-title">最近播放</h2>
                <span>{recentBooks.length} 本</span>
              </header>
              <div className="library-quick-list">
                {recentBooks.map((book) => renderQuickItem(book))}
              </div>
            </section>
          ) : null}

          {favoriteBooks.length > 0 ? (
            <section
              className="library-quick-panel"
              aria-labelledby="favorite-books-title"
            >
              <header>
                <h2 id="favorite-books-title">我的收藏</h2>
                <span>{favoriteBooks.length} 本</span>
              </header>
              <div className="library-quick-list">
                {favoriteBooks.map((book) => renderQuickItem(book, true))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <section
        className="library-home-section"
        aria-labelledby="series-stories-title"
      >
        <header className="library-home-section-header library-series-home-header">
          <h2 id="series-stories-title">系列故事</h2>
        </header>
        <div className="library-series-overview">
          {series.map((item) => {
            const allSeriesBooks = publishedBooks.filter(
              (book) => book.seriesId === item.id,
            );
            return (
              <section key={item.id} className="library-series-overview-item">
                <header>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>
                </header>
                <div className="library-home-row">
                  {allSeriesBooks.map((book) => renderCard(book, true, true))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </>
  );
}
