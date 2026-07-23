import { CUSTOM_BOOKS } from "@/lib/custom-books";

CUSTOM_BOOKS.forEach((book) => {
  const firstPage = book.pages[0];

  if (!firstPage) {
    throw new Error(`${book.storyId} must include at least one page`);
  }

  book.customMeta.coverImage satisfies string;
  if (book.customMeta.coverImage.includes("/custom-books/")) {
    throw new Error(`${book.storyId} must not expose private custom-book assets`);
  }
  firstPage.imageUrl satisfies string | undefined;
});
