"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Play } from "@phosphor-icons/react";
import type { LibraryBookSummary } from "@/lib/library/catalog";
import {
  formatLibraryLanguages,
  LIBRARY_CATEGORY_LABELS,
} from "@/lib/library/metadata";
import type { ReadingProgressRecord } from "@/lib/reading-progress";

export default function LibraryCatalogCard({
  book,
  progress,
  favorite,
  onToggleFavorite,
  compact = false,
}: {
  book: LibraryBookSummary;
  progress?: ReadingProgressRecord;
  favorite: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
}) {
  const metadata = book.metadata;
  const progressLabel = progress?.completedAt
    ? "已读完"
    : progress && progress.pageIndex > 0
      ? `继续第 ${progress.pageIndex + 1} 页`
      : null;

  return (
    <article
      className={`library-catalog-card ${
        compact ? "library-catalog-card-compact" : ""
      }`}
    >
      <Link href={book.href} className="library-catalog-card-link">
        <div
          className="library-catalog-cover"
          style={{ backgroundColor: `${book.seriesAccent}22` }}
        >
          {book.coverImage ? (
            <Image
              src={book.coverImage}
              alt={`${book.title}封面`}
              fill
              sizes={compact ? "(max-width: 580px) 44vw, 220px" : "(max-width: 580px) 44vw, 280px"}
            />
          ) : (
            <span style={{ color: book.seriesAccent }}>
              {book.title.slice(0, 4)}
            </span>
          )}
          {book.episodeNumber ? (
            <em>第 {book.episodeNumber} 回</em>
          ) : null}
        </div>
        <div className="library-catalog-card-copy">
          <span className="library-catalog-category">
            {LIBRARY_CATEGORY_LABELS[metadata.category]}
          </span>
          <h3>{book.title}</h3>
          <p>{book.subtitle}</p>
          <div className="library-catalog-facts">
            <span>{metadata.ageRange.min}-{metadata.ageRange.max} 岁</span>
            <span>约 {metadata.estimatedMinutes} 分钟</span>
            <span>{formatLibraryLanguages(metadata.languages)}</span>
          </div>
          {progress ? (
            <div className="library-card-progress">
              <span style={{ width: `${progress.progressPercent}%` }} />
            </div>
          ) : null}
          <strong className="library-catalog-open">
            <Play aria-hidden="true" weight="fill" />
            {progressLabel || "打开播放"}
          </strong>
        </div>
      </Link>
      <button
        type="button"
        className={`library-card-favorite ${
          favorite ? "library-card-favorite-active" : ""
        }`}
        aria-label={favorite ? `取消收藏《${book.title}》` : `收藏《${book.title}》`}
        aria-pressed={favorite}
        onClick={onToggleFavorite}
      >
        <Heart aria-hidden="true" weight={favorite ? "fill" : "regular"} />
      </button>
    </article>
  );
}
