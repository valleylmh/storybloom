import type { MetadataRoute } from "next";
import { getAllSeries, getSeriesBooks } from "@/lib/library";

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/custom`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/library`, changeFrequency: "weekly", priority: 0.9 },
  ];

  for (const series of getAllSeries()) {
    entries.push({
      url: `${BASE_URL}/library/${series.id}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    for (const book of getSeriesBooks(series.id)) {
      if (book.comingSoon) {
        continue;
      }
      entries.push({
        url: `${BASE_URL}/library/${series.id}/${book.id}`,
        lastModified: book.publishedAt,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
