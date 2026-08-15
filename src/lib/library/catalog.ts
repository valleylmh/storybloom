import type { LibraryBook, LibraryBookMetadata, LibrarySeries } from "@/types/library";
import { resolveLibraryBookMetadata } from "./metadata";

export type LibraryBookSummary = {
  id: string;
  contentId: string;
  seriesId: string;
  seriesTitle: string;
  seriesAccent: string;
  title: string;
  subtitle: string;
  href: string;
  coverImage?: string;
  episodeNumber?: number;
  comingSoon: boolean;
  metadata: LibraryBookMetadata;
};

export function createLibraryBookSummary(
  series: LibrarySeries,
  book: LibraryBook,
): LibraryBookSummary {
  const coverPage = book.pages[0];
  return {
    id: book.id,
    contentId: `${series.id}/${book.id}`,
    seriesId: series.id,
    seriesTitle: series.title,
    seriesAccent: series.accent,
    title: book.title,
    subtitle: book.subtitle,
    href: `/library/${series.id}/${book.id}`,
    ...(coverPage?.imageStatus === "complete" && coverPage.imageUrl
      ? { coverImage: coverPage.imageUrl }
      : {}),
    ...(book.episodeNumber ? { episodeNumber: book.episodeNumber } : {}),
    comingSoon: Boolean(book.comingSoon),
    metadata: resolveLibraryBookMetadata(book),
  };
}
