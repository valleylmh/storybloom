import type { LibraryBook } from "@/types/library";

export function isPublishedLibraryBook(
  book: Pick<LibraryBook, "comingSoon">,
): boolean {
  return book.comingSoon !== true;
}
