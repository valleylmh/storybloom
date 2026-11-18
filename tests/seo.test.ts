import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { getAllSeries, getBook, getPublishedBooks, getSeries } from "@/lib/library";
import { bookDescription, bookMetadata, bookStructuredData, seriesMetadata, seriesStructuredData, ENGLISH_SERIES } from "@/lib/library/seo";
import { bookReadingCopy } from "@/lib/library/reading-copy";
import { languageAlternates, pageMetadata, serializeJsonLd } from "@/lib/seo";

describe("public SEO routes", () => {
  it("keeps language versions self canonical with reciprocal language links", () => {
    for (const locale of ["zh", "en"] as const) {
      const metadata = pageMetadata({ path: "/library/chengyu", title: "Stories", description: "Read together", locale, bilingual: true });
      expect(metadata.alternates?.canonical).toBe(locale === "en" ? "/en/library/chengyu" : "/library/chengyu");
      expect(metadata.alternates?.languages).toEqual(languageAlternates("/library/chengyu"));
      expect(metadata.openGraph).toMatchObject({ siteName: "StoryBloom", locale: locale === "en" ? "en_US" : "zh_CN", url: metadata.alternates?.canonical });
    }
    expect(pageMetadata({ path: "/", title: "Home", description: "Stories" }).alternates?.canonical).toBe("/");
    expect(pageMetadata({ path: "/install", title: "Install", description: "Guide", noindex: true }).robots).toEqual({ index: false, follow: true });
  });

  it("includes every published book in both languages, gifts and cover images without private routes", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const slug of ["", "/summer-pocket", "/city-motors", "/joy-day", "/birthday-star", "/journey-to-the-west"]) {
      expect(urls.some((url) => new URL(url).pathname === `/gifts${slug}`)).toBe(true);
    }
    for (const series of getAllSeries()) {
      expect(ENGLISH_SERIES[series.id]).toBeDefined();
      const books = getPublishedBooks(series.id);
      const collection = entries.find((entry) => new URL(entry.url).pathname === `/library/${series.id}`);
      expect(collection?.lastModified).toBeTruthy();
      expect(seriesMetadata(series, books).openGraph).toHaveProperty("images");
      for (const book of books) {
        for (const prefix of ["", "/en"]) {
          const entry = entries.find((item) => new URL(item.url).pathname === `${prefix}/library/${series.id}/${book.id}`);
          expect(entry, book.id).toBeDefined();
          expect(entry?.alternates?.languages).toHaveProperty("zh-CN");
          expect(entry?.images?.length).toBeGreaterThan(0);
        }
      }
    }
    expect(urls.some((url) => /\/(me|install)(\/|$)/.test(new URL(url).pathname))).toBe(false);
  });

  it("gives every traffic story a distinct description and complete Book and breadcrumb data", () => {
    const books = getPublishedBooks("qiche");
    const descriptions = books.map((book) => bookDescription(book));
    expect(new Set(descriptions).size).toBe(books.length);
    for (const series of getAllSeries()) {
      const book = getPublishedBooks(series.id)[0];
      const metadata = bookMetadata(book, series);
      expect(metadata.alternates?.canonical).toBe(`/library/${series.id}/${book.id}`);
      const data = bookStructuredData(book, series);
      expect(data["@graph"][0]).toMatchObject({ "@type": "Book", url: expect.stringContaining(`/library/${series.id}/${book.id}`), description: expect.any(String), author: expect.any(Object), publisher: { name: "StoryBloom" } });
      expect(data["@graph"][1]).toHaveProperty("@type", "BreadcrumbList");
      expect(seriesStructuredData(series, getPublishedBooks(series.id))["@graph"][0]).toHaveProperty("@type", "CollectionPage");
    }
  });

  it("matches the Min Nong search intent with the visible English introduction", () => {
    const book = getBook("tangshi", "min-nong-qi-er")!;
    const series = getSeries("tangshi")!;
    const metadata = bookMetadata(book, series, "en");
    const readingCopy = bookReadingCopy(book, "en")!;

    expect(metadata.title).toContain("Min Nong");
    expect(metadata.title).toContain("Hoeing the Fields at Noon");
    expect(readingCopy.heading).toContain("Hoeing the Fields at Noon");
    expect(metadata.description).toBe(readingCopy.introduction);
    expect(metadata.description).toContain("English translation");
    expect(metadata.alternates?.canonical).toBe("/en/library/tangshi/min-nong-qi-er");
    expect(bookStructuredData(book, series, "en")["@graph"][0].description).toBe(readingCopy.introduction);
  });

  it("describes the actual reading content on the other zero-click book pages", () => {
    const poem = getBook("tangshi", "jing-ye-si")!;
    const ambulance = getBook("qiche", "jiu-hu-che-zen-yang-zheng-fen-duo-miao")!;

    expect(bookMetadata(poem, getSeries("tangshi")!).title).toContain("古诗原文与英文翻译");
    expect(bookDescription(poem)).toContain("床前明月光");
    expect(bookDescription(ambulance)).toContain("警示灯");
    expect(bookMetadata(ambulance, getSeries("qiche")!, "en").title).toContain("Ambulances");
    expect(bookDescription(ambulance, "en")).toBe(bookReadingCopy(ambulance, "en")?.introduction);
  });

  it("ships a small real WebP cover and safely serializes script text", () => {
    const path = join(process.cwd(), "public/gift-books/summer-pocket/cover.webp");
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeLessThan(200_000);
    const encoded = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(encoded).not.toContain("<");
    expect(JSON.parse(encoded).name).toBe("</script><script>alert(1)</script>");
  });
});
