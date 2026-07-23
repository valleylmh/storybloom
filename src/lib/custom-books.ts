import { SAMPLE_BOOKS } from "@/lib/sample-books";
import type { GenerateResponse } from "@/types";

export type CustomBookMeta = {
  id: string;
  title: string;
  subtitle: string;
  scenarioLabel: string;
  ageLabel: string;
  coverImage: string;
};

export type CustomBook = GenerateResponse & {
  customMeta: CustomBookMeta;
};

/**
 * The open-source repository deliberately reuses the public, AI-generated
 * sample books here. Real commissioned books and child photos must stay in a
 * private asset store and must never be committed to this repository.
 */
export const CUSTOM_BOOKS: CustomBook[] = SAMPLE_BOOKS.slice(0, 2).map((book) => ({
  ...book,
  storyId: `custom-demo-${book.sampleMeta.id}`,
  freeChanceLabel: "公开演示案例",
  customMeta: {
    id: book.sampleMeta.id,
    title: book.sampleMeta.title,
    subtitle: book.sampleMeta.subtitle,
    scenarioLabel: "公开演示",
    ageLabel: book.sampleMeta.ageLabel,
    coverImage:
      book.pages[0]?.imageUrl || `/sample-books/${book.sampleMeta.id}-1.svg`,
  },
}));
