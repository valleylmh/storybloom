import type { LibraryBook } from "@/types/library";

/** Reading and favorite identities stay stable when an existing book changes series. */
export function getLibraryContentId(book: Pick<LibraryBook, "seriesId" | "id">) {
  return `${book.seriesId === "yanyu" ? "chengyu" : book.seriesId}/${book.id}`;
}
