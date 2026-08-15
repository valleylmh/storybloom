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

export default function LibrarySeriesExperience({
  books,
}: {
  books: LibraryBookSummary[];
}) {
  const [progressRecords, setProgressRecords] = useState<
    ReadingProgressRecord[]
  >([]);
  const [visibleCount, setVisibleCount] = useState(24);
  const { keys, toggle } = useFavorites();

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

  const progressMap = useMemo(
    () =>
      new Map(
        progressRecords.map((record) => [record.contentId, record] as const),
      ),
    [progressRecords],
  );
  const publishedBooks = books.filter((book) => !book.comingSoon);
  const completedCount = publishedBooks.filter(
    (book) => progressMap.get(book.contentId)?.completedAt,
  ).length;
  const activeProgress = publishedBooks
    .map((book) => progressMap.get(book.contentId))
    .filter((record): record is ReadingProgressRecord => Boolean(record));
  const reachedPercent = activeProgress.length
    ? Math.round(
        activeProgress.reduce(
          (total, record) => total + record.progressPercent,
          0,
        ) / Math.max(1, publishedBooks.length),
      )
    : 0;

  return (
    <>
      <section className="library-series-progress" aria-label="系列阅读进度">
        <div>
          <strong>
            {completedCount} / {publishedBooks.length} 本已读完
          </strong>
          <span>每一回都由家长主动打开，不会自动播放下一本。</span>
        </div>
        <div className="library-series-progress-track" aria-hidden="true">
          <span style={{ width: `${reachedPercent}%` }} />
        </div>
      </section>

      <section className="library-catalog-experience-grid" aria-label="系列书目">
        {books.slice(0, visibleCount).map((book) => (
          <LibraryCatalogCard
            key={book.contentId}
            book={book}
            progress={progressMap.get(book.contentId)}
            favorite={keys.has(createFavoriteKey("library", book.contentId))}
            onToggleFavorite={() => toggle("library", book.contentId)}
          />
        ))}
      </section>
      {visibleCount < books.length ? (
        <button
          type="button"
          className="library-catalog-more"
          onClick={() => setVisibleCount((count) => count + 24)}
        >
          显示更多本系列绘本
        </button>
      ) : null}
    </>
  );
}
