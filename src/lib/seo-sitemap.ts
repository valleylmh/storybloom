import type { MetadataRoute } from "next";
import { languageAlternates } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";

export function bilingualSitemapEntries(
  path: string,
  extra: Omit<MetadataRoute.Sitemap[number], "url"> = {},
  englishPath?: string,
): MetadataRoute.Sitemap {
  const paths = languageAlternates(path, englishPath);
  const languages = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, toAbsoluteAppUrl(value)]));
  return [paths["zh-CN"], paths.en].map((entryPath) => ({
    url: toAbsoluteAppUrl(entryPath), ...extra, alternates: { languages },
  }));
}
