"use client";

import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { createFavoriteKey } from "@/lib/favorites";
import type { LibraryBookSummary } from "@/lib/library/catalog";
import {
  listReadingProgress,
  READING_PROGRESS_CHANGED_EVENT,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";
import LibraryCatalogCard from "@/components/library/LibraryCatalogCard";

export default function BookshelfReadingSections({
  books,
}: {
  books: LibraryBookSummary[];
}) {
  const [progressRecords, setProgressRecords] = useState<
    ReadingProgressRecord[]
  >([]);
  const { records: favoriteRecords, keys, toggle } = useFavorites();

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listReadingProgress().then((records) => {
        if (active) setProgressRecords(records);
      });
    };
    refresh();
    window.addEventListener(READING_PROGRESS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(READING_PROGRESS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const bookMap = useMemo(
    () => new Map(books.map((book) => [book.contentId, book] as const)),
    [books],
  );
  const progressMap = useMemo(
    () =>
      new Map(
        progressRecords.map((record) => [record.contentId, record] as const),
      ),
    [progressRecords],
  );
  const continueBooks = progressRecords
    .filter((record) => !record.completedAt && record.progressPercent > 0)
    .map((record) => bookMap.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const recentBooks = progressRecords
    .map((record) => bookMap.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const favoriteBooks = favoriteRecords
    .map((record) => bookMap.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);

  const section = (title: string, items: LibraryBookSummary[]) =>
    items.length ? (
      <section className="bookshelf-reading-section" aria-label={title}>
        <h2>{title}</h2>
        <div className="library-home-row">
          {items.map((book) => (
            <LibraryCatalogCard
              key={book.contentId}
              book={book}
              progress={progressMap.get(book.contentId)}
              favorite={keys.has(createFavoriteKey("library", book.contentId))}
              onToggleFavorite={() => toggle("library", book.contentId)}
              compact
            />
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div className="bookshelf-reading-sections">
      {section("继续阅读", continueBooks)}
      {section("我的收藏", favoriteBooks)}
      {section("最近阅读", recentBooks)}
    </div>
  );
}
