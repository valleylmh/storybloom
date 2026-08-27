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
  /** Maintained search corpus; intentionally excludes full page text. */
  searchText: string;
};

export function createLibraryBookSummary(
  series: LibrarySeries,
  book: LibraryBook,
): LibraryBookSummary {
  const coverPage = book.pages[0];
  const metadata = resolveLibraryBookMetadata(book);
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
    metadata,
    searchText: [
      book.title,
      book.subtitle,
      series.title,
      series.subtitle,
      book.question,
      book.origin,
      book.moral?.zh,
      book.moral?.en,
      book.idiomMeaning?.zh,
      book.idiomMeaning?.en,
      book.poem?.dynasty,
      book.poem?.author,
      ...(book.poem?.originalLines ?? []),
      ...(book.poem?.englishLines ?? []),
      book.poem?.appreciation.zh,
      book.poem?.appreciation.en,
      book.classic?.workTitle,
      ...(book.classic?.originalLines ?? []),
      book.classic?.childExplanation.zh,
      book.classic?.childExplanation.en,
      book.parentGuide?.goal,
      ...metadata.tags,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
