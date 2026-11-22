import type { MetadataRoute } from "next";
import { getAllSeries, getPublishedBooks } from "@/lib/library";
import {
  englishTopicPath,
  getAllEnglishTopics,
  getEnglishTopicBooks,
} from "@/lib/library/english-topics";
import { libraryBookPath, librarySeriesPath } from "@/lib/library/paths";
import { bookCover } from "@/lib/library/seo";
import { getAllTopics, getTopicBooks, topicPath } from "@/lib/library/topics";
import { bilingualSitemapEntries } from "@/lib/seo-sitemap";
import { toAbsoluteAppUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const topicEntries: MetadataRoute.Sitemap = getAllTopics().map((topic) => {
    const books = getTopicBooks(topic).map(({ book }) => book);
    const dates = books.map((book) => book.publishedAt).filter(Boolean).sort();
    const images = books
      .slice(0, 4)
      .map(bookCover)
      .filter((image): image is string => Boolean(image))
      .map(toAbsoluteAppUrl);
    return {
      url: toAbsoluteAppUrl(topicPath(topic)),
      ...(dates.length ? { lastModified: dates[dates.length - 1] } : {}),
      ...(images.length ? { images } : {}),
    };
  });

  const englishTopicEntries: MetadataRoute.Sitemap = getAllEnglishTopics().map((topic) => {
    const books = getEnglishTopicBooks(topic).map(({ book }) => book);
    const dates = books.map((book) => book.publishedAt).filter(Boolean).sort();
    const images = books
      .slice(0, 4)
      .map(bookCover)
      .filter((image): image is string => Boolean(image))
      .map(toAbsoluteAppUrl);
    return {
      url: toAbsoluteAppUrl(englishTopicPath(topic)),
      ...(dates.length ? { lastModified: dates[dates.length - 1] } : {}),
      ...(images.length ? { images } : {}),
    };
  });

  const entries: MetadataRoute.Sitemap = [
    ...["/", "/inspiration", "/library", "/library/topics"].flatMap((path) => bilingualSitemapEntries(path)),
    ...["/custom", "/privacy", "/child-family-data", "/gifts", "/gifts/summer-pocket", "/gifts/joy-day", "/gifts/birthday-star", "/gifts/city-motors", "/gifts/journey-to-the-west"].map((path) => ({ url: toAbsoluteAppUrl(path) })),
    ...topicEntries,
    ...englishTopicEntries,
  ];

  for (const series of getAllSeries()) {
    const books = getPublishedBooks(series.id);
    const dates = books.map((book) => book.publishedAt).filter(Boolean).sort();
    entries.push(...bilingualSitemapEntries(librarySeriesPath(series.id), {
      ...(dates.length ? { lastModified: dates[dates.length - 1] } : {}),
      images: books.slice(0, 4).map(bookCover).filter((image): image is string => Boolean(image)).map(toAbsoluteAppUrl),
    }, librarySeriesPath(series.id, "en")));
    for (const book of books) {
      const cover = bookCover(book);
      entries.push(...bilingualSitemapEntries(libraryBookPath(book), {
        lastModified: book.publishedAt,
        ...(cover ? { images: [toAbsoluteAppUrl(cover)] } : {}),
      }, libraryBookPath(book, "en")));
    }
  }

  return entries;
}
