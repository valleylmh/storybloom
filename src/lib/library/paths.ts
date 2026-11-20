import type { SiteLocale } from "@/lib/seo";
import type { LibraryBook } from "@/types/library";
import { ENGLISH_BOOKS } from "./english-titles";

const ENGLISH_SERIES_SLUGS = new Map([
  ["chengyu", "chinese-idioms"],
  ["yanyu", "chinese-proverbs"],
  ["xiyouji", "journey-to-the-west"],
  ["haoqi", "science-stories"],
  ["tangshi", "tang-poems"],
  ["sanzijing", "family-and-growing-up"],
  ["qiche", "cars-and-transport"],
  ["richang", "everyday-stories"],
]);

type BookIdentity = Pick<LibraryBook, "seriesId" | "id">;

export function englishSeriesSlug(seriesId: string) {
  return ENGLISH_SERIES_SLUGS.get(seriesId) ?? seriesId;
}

export function englishBookSlug(book: BookIdentity) {
  return ENGLISH_BOOKS[`${book.seriesId}/${book.id}`]?.slug ?? book.id;
}

export function librarySeriesPath(seriesId: string, locale: SiteLocale = "zh") {
  return locale === "en" ? `/en/library/${englishSeriesSlug(seriesId)}` : `/library/${seriesId}`;
}

export function libraryBookPath(book: BookIdentity, locale: SiteLocale = "zh") {
  const slug = locale === "en" ? englishBookSlug(book) : book.id;
  return `${librarySeriesPath(book.seriesId, locale)}/${slug}`;
}

const legacyPaths = new Map<string, string>();
for (const seriesId of ENGLISH_SERIES_SLUGS.keys()) {
  legacyPaths.set(`/en/library/${seriesId}`, librarySeriesPath(seriesId, "en"));
}
for (const contentId of Object.keys(ENGLISH_BOOKS)) {
  const [seriesId, id] = contentId.split("/");
  const destination = libraryBookPath({ seriesId, id }, "en");
  legacyPaths.set(`/en/library/${contentId}`, destination);
  // Proverbs were originally published under the idiom series.
  if (seriesId === "yanyu" && !ENGLISH_BOOKS[`chengyu/${id}`]) {
    legacyPaths.set(`/en/library/chengyu/${id}`, destination);
  }
}

export function legacyEnglishLibraryPath(pathname: string) {
  return legacyPaths.get(pathname);
}
