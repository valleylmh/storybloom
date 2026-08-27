import type { LibraryBook, LibrarySeries } from "@/types/library";
import { CHENGYU_BOOKS, CHENGYU_SERIES } from "./chengyu";
import { HAOQI_BOOKS, HAOQI_SERIES } from "./haoqi";
import { isPublishedLibraryBook } from "./status";
import { SANZIJING_BOOKS, SANZIJING_SERIES } from "./sanzijing";
import { TANGSHI_BOOKS, TANGSHI_SERIES } from "./tangshi";
import { XIYOUJI_BOOKS, XIYOUJI_SERIES } from "./xiyouji";

// 预告占位卡（/library 首页展示，不可点击、无路由）。
// 西游记与「好奇为什么」已建系列（见下），此处留空；后续新系列先在这里预告。
const UPCOMING_SERIES: LibrarySeries[] = [];

const BOOKS_BY_SERIES: Record<string, LibraryBook[]> = {
  [CHENGYU_SERIES.id]: sortBooks(CHENGYU_BOOKS),
  [XIYOUJI_SERIES.id]: sortBooks(XIYOUJI_BOOKS),
  [HAOQI_SERIES.id]: sortBooks(HAOQI_BOOKS),
  [TANGSHI_SERIES.id]: sortBooks(TANGSHI_BOOKS),
  [SANZIJING_SERIES.id]: sortBooks(SANZIJING_BOOKS),
};

const SERIES: LibrarySeries[] = [
  CHENGYU_SERIES,
  XIYOUJI_SERIES,
  HAOQI_SERIES,
  TANGSHI_SERIES,
  SANZIJING_SERIES,
].map((series) => ({
  ...series,
  bookCount: (BOOKS_BY_SERIES[series.id] ?? []).filter(isPublishedLibraryBook)
    .length,
}));

function sortBooks(books: LibraryBook[]) {
  return [...books].sort((a, b) => a.order - b.order);
}

export function getAllSeries(): LibrarySeries[] {
  return SERIES;
}

export function getUpcomingSeries(): LibrarySeries[] {
  return UPCOMING_SERIES;
}

export function getSeries(seriesId: string): LibrarySeries | null {
  return SERIES.find((series) => series.id === seriesId) ?? null;
}

export function getSeriesBooks(seriesId: string): LibraryBook[] {
  return BOOKS_BY_SERIES[seriesId] ?? [];
}

export function getPublishedBooks(seriesId: string): LibraryBook[] {
  return getSeriesBooks(seriesId).filter(isPublishedLibraryBook);
}

export function getPublishedBookCount(seriesId?: string): number {
  if (seriesId) {
    return getPublishedBooks(seriesId).length;
  }

  return Object.values(BOOKS_BY_SERIES).reduce(
    (total, books) => total + books.filter(isPublishedLibraryBook).length,
    0,
  );
}

export function getBook(seriesId: string, bookId: string): LibraryBook | null {
  return getSeriesBooks(seriesId).find((book) => book.id === bookId) ?? null;
}

export function findAdjacentPublishedBooks(
  books: LibraryBook[],
  bookId: string,
): { previous: LibraryBook | null; next: LibraryBook | null } {
  const index = books.findIndex((book) => book.id === bookId);

  if (index === -1) {
    return { previous: null, next: null };
  }

  let previous: LibraryBook | null = null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isPublishedLibraryBook(books[cursor])) {
      previous = books[cursor];
      break;
    }
  }

  let next: LibraryBook | null = null;
  for (let cursor = index + 1; cursor < books.length; cursor += 1) {
    if (isPublishedLibraryBook(books[cursor])) {
      next = books[cursor];
      break;
    }
  }

  return { previous, next };
}

export function getAdjacentBooks(
  seriesId: string,
  bookId: string,
): { previous: LibraryBook | null; next: LibraryBook | null } {
  return findAdjacentPublishedBooks(getSeriesBooks(seriesId), bookId);
}
