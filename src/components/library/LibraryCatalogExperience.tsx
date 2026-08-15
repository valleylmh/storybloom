"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react";
import { useFavorites } from "@/hooks/useFavorites";
import { createFavoriteKey, FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import type { LibraryBookSummary } from "@/lib/library/catalog";
import { LIBRARY_CATEGORY_LABELS } from "@/lib/library/metadata";
import {
  listReadingProgress,
  READING_PROGRESS_CHANGED_EVENT,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";
import type { LibraryCategory } from "@/types/library";
import ReadingSyncControl from "@/components/library/ReadingSyncControl";
import LibraryCatalogCard from "@/components/library/LibraryCatalogCard";

type SeriesSummary = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const CATEGORY_ORDER: LibraryCategory[] = [
  "idiom",
  "classic",
  "science",
  "bedtime",
  "family-growth",
];

function readingMap(records: ReadingProgressRecord[]) {
  return new Map(
    records.map((record) => [record.contentId, record] as const),
  );
}

function dayNumber() {
  const now = new Date();
  return Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
      86_400_000,
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
  const [category, setCategory] = useState<LibraryCategory | "all">("all");
  const [visibleCount, setVisibleCount] = useState(24);
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
  const continueReading = progressRecords
    .filter((record) => !record.completedAt && record.progressPercent > 0)
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const recentBooks = progressRecords
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const favoriteBooks = favoriteRecords
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const featuredBooks = publishedBooks.filter((book) => book.metadata.featured);
  const tonightBook =
    featuredBooks[dayNumber() % Math.max(1, featuredBooks.length)] ??
    publishedBooks[dayNumber() % Math.max(1, publishedBooks.length)];
  const filteredBooks =
    category === "all"
      ? publishedBooks
      : publishedBooks.filter((book) => book.metadata.category === category);
  const visibleBooks = filteredBooks.slice(0, visibleCount);

  const renderCard = (book: LibraryBookSummary, compact = false) => (
    <LibraryCatalogCard
      key={book.contentId}
      book={book}
      progress={progressByContent.get(book.contentId)}
      favorite={favoriteKeys.has(createFavoriteKey("library", book.contentId))}
      onToggleFavorite={() => toggle("library", book.contentId)}
      compact={compact}
    />
  );

  return (
    <>
      <ReadingSyncControl />

      {continueReading.length > 0 ? (
        <section className="library-home-section" aria-labelledby="continue-reading-title">
          <header className="library-home-section-header">
            <div>
              <p>接着上次</p>
              <h2 id="continue-reading-title">继续阅读</h2>
            </div>
          </header>
          <div className="library-home-row">
            {continueReading.map((book) => renderCard(book, true))}
          </div>
        </section>
      ) : null}

      {recentBooks.length > 0 ? (
        <section className="library-home-section" aria-labelledby="recent-reading-title">
          <header className="library-home-section-header">
            <div>
              <p>最近打开</p>
              <h2 id="recent-reading-title">最近播放</h2>
            </div>
          </header>
          <div className="library-home-row">
            {recentBooks.map((book) => renderCard(book, true))}
          </div>
        </section>
      ) : null}

      {favoriteBooks.length > 0 ? (
        <section className="library-home-section" aria-labelledby="favorite-books-title">
          <header className="library-home-section-header">
            <div>
              <p>家庭收藏</p>
              <h2 id="favorite-books-title">我的收藏</h2>
            </div>
          </header>
          <div className="library-home-row">
            {favoriteBooks.map((book) => renderCard(book, true))}
          </div>
        </section>
      ) : null}

      {tonightBook ? (
        <section className="library-tonight" aria-labelledby="tonight-title">
          <div className="library-tonight-copy">
            <span><Sparkle weight="fill" /> 按日期轮换的精选故事</span>
            <h2 id="tonight-title">今晚读什么</h2>
            <h3>{tonightBook.title}</h3>
            <p>{tonightBook.subtitle}</p>
            <Link href={tonightBook.href}>今晚读这本</Link>
          </div>
          <div className="library-tonight-card">
            {renderCard(tonightBook, true)}
          </div>
        </section>
      ) : null}

      <section className="library-home-section" aria-labelledby="series-stories-title">
        <header className="library-home-section-header">
          <div>
            <p>按顺序慢慢读</p>
            <h2 id="series-stories-title">系列故事</h2>
          </div>
        </header>
        <div className="library-series-overview">
          {series.map((item) => {
            const seriesBooks = publishedBooks
              .filter((book) => book.seriesId === item.id)
              .slice(0, 4);
            return (
              <section key={item.id} className="library-series-overview-item">
                <header>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                  </div>
                  <Link href={item.href}>查看全部</Link>
                </header>
                <div className="library-home-row">
                  {seriesBooks.map((book) => renderCard(book, true))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="library-home-section" aria-labelledby="category-browser-title">
        <header className="library-home-section-header">
          <div>
            <p>按家庭当下需要选择</p>
            <h2 id="category-browser-title">分类浏览</h2>
          </div>
        </header>
        <div className="library-category-filters" role="group" aria-label="绘本分类">
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => {
              setCategory("all");
              setVisibleCount(24);
            }}
          >
            全部
          </button>
          {CATEGORY_ORDER.filter((item) =>
            publishedBooks.some((book) => book.metadata.category === item),
          ).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
                setVisibleCount(24);
              }}
            >
              {LIBRARY_CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="library-catalog-experience-grid">
          {visibleBooks.map((book) => renderCard(book))}
        </div>
        {visibleBooks.length < filteredBooks.length ? (
          <button
            type="button"
            className="library-catalog-more"
            onClick={() => setVisibleCount((count) => count + 24)}
          >
            显示更多绘本
          </button>
        ) : null}
      </section>
    </>
  );
}
