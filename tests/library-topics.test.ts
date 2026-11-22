import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getAllSeries, getBook, getSeries } from "@/lib/library";
import { bookEnglishTitle } from "@/lib/library/english-titles";
import { englishTopicStructuredData } from "@/lib/library/english-topic-seo";
import {
  englishTopicPath,
  getAllEnglishTopics,
  getEnglishBookTopics,
  getEnglishSeriesTopics,
  getEnglishTopic,
  getEnglishTopicBooks,
} from "@/lib/library/english-topics";
import { legacyEnglishLibraryPath, libraryBookPath } from "@/lib/library/paths";
import { bookDescription, bookMetadata } from "@/lib/library/seo";
import {
  FEATURED_ENGLISH_TOPIC_LINKS,
  FEATURED_TOPIC_LINKS,
} from "@/lib/library/topic-links";
import { topicStructuredData } from "@/lib/library/topic-seo";
import {
  getAllTopics,
  getBookTopics,
  getSeriesTopics,
  getTopic,
  getTopicBooks,
  getTopicsByGroup,
  topicPath,
} from "@/lib/library/topics";

describe("library topics", () => {
  it("only lists published books without duplicates, and enforces discussion guides per group", () => {
    const topics = getAllTopics();
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);
    expect(getTopicsByGroup("parenting").length + getTopicsByGroup("theme").length).toBe(topics.length);
    expect(getTopicsByGroup("theme").length).toBeGreaterThanOrEqual(5);

    for (const topic of topics) {
      expect(new Set(topic.bookIds).size, topic.id).toBe(topic.bookIds.length);
      const books = getTopicBooks(topic);
      expect(books.map(({ series, book }) => `${series.id}/${book.id}`), topic.id).toEqual(topic.bookIds);
      expect(books.length, topic.id).toBeGreaterThanOrEqual(3);
      if (topic.group === "parenting") {
        for (const { book } of books) expect(book.parentGuide, book.id).toBeDefined();
      } else {
        const guidedCount = books.filter(({ book }) => Boolean(book.parentGuide?.questions[0])).length;
        expect(
          guidedCount >= 3 || (topic.discussionPrompts?.length ?? 0) >= 3,
          `${topic.id} discussion prompts`,
        ).toBe(true);
      }
      expect(topic.idea.length, topic.id).toBeLessThanOrEqual(100);
    }
  });

  it("titles a topic book with its primary topic and describes what the book practises", () => {
    const book = getBook("richang", "jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma")!;
    const metadata = bookMetadata(book, getSeries("richang")!);

    expect(getBookTopics(book)[0].id).toBe("pa-hei-dan-xiao");
    expect(metadata.title).toBe("今晚的小灯可以亮着吗 - 孩子怕黑胆小绘本 | StoryBloom");
    expect(metadata.description).toContain(book.parentGuide!.goal);
    expect(metadata.description).toContain(book.subtitle);
    expect(metadata.alternates?.canonical).toBe("/library/richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma");
  });

  it("uses the primary topic when a book belongs to several", () => {
    const book = getBook("richang", "yao-huang-de-di-yi-ke-xiao-ru-ya")!;
    expect(getBookTopics(book).map((topic) => topic.id)).toEqual(["you-xiao-xian-jie", "pa-hei-dan-xiao"]);
    expect(bookMetadata(book, getSeries("richang")!).title).toContain("幼小衔接绘本");
  });

  it("keeps the subtitle in the title of parent-guide books outside every topic", () => {
    const book = getBook("richang", "lan-ping-guo")!;
    expect(getBookTopics(book)).toEqual([]);
    expect(bookMetadata(book, getSeries("richang")!).title).toBe("烂苹果：好苹果，要留到哪一天 - 亲子共读绘本 | StoryBloom");
    expect(bookDescription(book)).toContain(book.parentGuide!.goal);
  });

  it("leaves non-parenting series titles untouched even when included in theme topics", () => {
    const idiom = getBook("chengyu", "shou-zhu-dai-tu")!;
    expect(bookMetadata(idiom, getSeries("chengyu")!).title).toBe("守株待兔 - 中英双语成语故事绘本 | StoryBloom");

    const themedIdiom = getBook("chengyu", "cao-chong-cheng-xiang")!;
    expect(getBookTopics(themedIdiom).map((topic) => topic.id)).toContain("cheng-yu-pin-ge");
    expect(bookMetadata(themedIdiom, getSeries("chengyu")!).title).toBe("曹冲称象 - 中英双语成语故事绘本 | StoryBloom");

    const science = getBook("haoqi", "tian-kong-wei-shen-me-shi-lan-se")!;
    expect(getBookTopics(science).map((topic) => topic.id)).toContain("tian-qi-yu-zi-ran");
    expect(bookMetadata(science, getSeries("haoqi")!).title).toBe("天空为什么是蓝色的？ - 儿童科普双语绘本 | StoryBloom");

    const poem = getBook("tangshi", "yong-e")!;
    expect(getBookTopics(poem).map((topic) => topic.id)).toContain("tang-shi-qi-meng");
    expect(bookMetadata(poem, getSeries("tangshi")!).title).toBe("咏鹅 - 骆宾王唐诗双语绘本 | StoryBloom");
  });

  it("lists the topic index and every topic page in the sitemap with lastModified and images", () => {
    const entries = sitemap();
    const byPath = new Map(entries.map((entry) => [new URL(entry.url).pathname, entry]));
    expect(byPath.has("/library/topics")).toBe(true);
    for (const topic of getAllTopics()) {
      const entry = byPath.get(topicPath(topic));
      expect(entry, topic.id).toBeDefined();
      expect(entry?.lastModified, topic.id).toBeTruthy();
      expect(entry?.images?.length ?? 0, topic.id).toBeGreaterThan(0);
    }
  });

  it("provides valid start guides, FAQs, and referenced book titles for every topic", () => {
    for (const topic of getAllTopics()) {
      const books = getTopicBooks(topic);
      const bookTitles = new Set(books.map(({ book }) => book.title));
      expect(topic.bookIds, topic.id).toContain(topic.startWith);

      const startBook = books.find(
        ({ series, book }) => `${series.id}/${book.id}` === topic.startWith,
      );
      expect(startBook, `${topic.id} startWith`).toBeDefined();
      expect(topic.startHere, topic.id).toContain(`《${startBook!.book.title}》`);

      expect(topic.faqs.length, topic.id).toBeGreaterThanOrEqual(3);
      expect(topic.faqs.length, topic.id).toBeLessThanOrEqual(4);
      expect(
        new Set(topic.faqs.map((faq) => faq.question)).size,
        topic.id,
      ).toBe(topic.faqs.length);

      for (const faq of topic.faqs) {
        expect(faq.question.endsWith("？"), `${topic.id}: ${faq.question}`).toBe(true);
        expect(faq.answer.length, `${topic.id}: ${faq.question}`).toBeGreaterThanOrEqual(40);
        expect(faq.answer.length, `${topic.id}: ${faq.question}`).toBeLessThanOrEqual(220);
      }

      const texts = [topic.startHere, ...topic.faqs.map((faq) => faq.answer)];
      for (const text of texts) {
        for (const match of text.matchAll(/《([^》]+)》/g)) {
          expect(bookTitles.has(match[1]), `${topic.id}: 《${match[1]}》`).toBe(true);
        }
      }
    }
  });

  it("maps covered series back to their topics", () => {
    for (const seriesId of ["richang", "sanzijing", "qiche", "haoqi", "tangshi", "chengyu", "yanyu"]) {
      expect(getSeriesTopics(seriesId).length, seriesId).toBeGreaterThan(0);
    }
    expect(getSeriesTopics("xiyouji")).toEqual([]);
  });

  it("emits CollectionPage, FAQPage, and BreadcrumbList JSON-LD for each topic", () => {
    for (const topic of getAllTopics()) {
      const graph = topicStructuredData(topic)["@graph"];
      const types = graph.map((node) => node["@type"]);
      expect(types, topic.id).toContain("CollectionPage");
      expect(types, topic.id).toContain("BreadcrumbList");
      const faqNode = graph.find((node) => node["@type"] === "FAQPage");
      expect(faqNode, topic.id).toBeDefined();
      expect(faqNode).toHaveProperty("mainEntity");
      expect((faqNode as { mainEntity: unknown[] }).mainEntity).toHaveLength(
        topic.faqs.length,
      );
    }
  });

  it("keeps featured homepage topic links aligned with defined topics", () => {
    for (const item of FEATURED_TOPIC_LINKS) {
      const topic = getTopic(item.id);
      expect(topic, item.id).not.toBeNull();
      expect(topic?.name, item.id).toBe(item.name);
    }
  });
});

describe("english bilingual library topics", () => {
  it("lists unique published books with English titles, start guides, prompts, and FAQs", () => {
    const topics = getAllEnglishTopics();
    expect(topics.length).toBeGreaterThanOrEqual(6);
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);

    for (const topic of topics) {
      expect(new Set(topic.bookIds).size, topic.id).toBe(topic.bookIds.length);
      const books = getEnglishTopicBooks(topic);
      expect(
        books.map(({ series, book }) => `${series.id}/${book.id}`),
        topic.id,
      ).toEqual(topic.bookIds);
      expect(books.length, topic.id).toBeGreaterThanOrEqual(4);

      for (const { book } of books) {
        expect(bookEnglishTitle(book), book.id).not.toBe(book.title);
      }

      expect(topic.bookIds, topic.id).toContain(topic.startWith);
      const startBook = books.find(
        ({ series, book }) => `${series.id}/${book.id}` === topic.startWith,
      );
      expect(startBook, `${topic.id} startWith`).toBeDefined();
      expect(topic.startHere, topic.id).toContain(bookEnglishTitle(startBook!.book));

      expect(topic.discussionPrompts.length, topic.id).toBeGreaterThanOrEqual(3);
      expect(topic.faqs.length, topic.id).toBeGreaterThanOrEqual(3);
      expect(topic.faqs.length, topic.id).toBeLessThanOrEqual(4);
      expect(
        new Set(topic.faqs.map((faq) => faq.question)).size,
        topic.id,
      ).toBe(topic.faqs.length);

      for (const faq of topic.faqs) {
        expect(faq.question.endsWith("?"), `${topic.id}: ${faq.question}`).toBe(true);
        expect(faq.answer.length, `${topic.id}: ${faq.question}`).toBeGreaterThanOrEqual(80);
        expect(faq.answer.length, `${topic.id}: ${faq.question}`).toBeLessThanOrEqual(360);
      }
    }
  });

  it("covers every published series and connects individual books back to collections", () => {
    for (const series of getAllSeries()) {
      expect(getEnglishSeriesTopics(series.id).length, series.id).toBeGreaterThan(0);
    }
    const minNong = getBook("tangshi", "min-nong-qi-er")!;
    expect(getEnglishBookTopics(minNong).map((topic) => topic.id)).toContain(
      "tang-poems-for-kids",
    );
    const ambulance = getBook("qiche", "jiu-hu-che-zen-yang-zheng-fen-duo-miao")!;
    expect(getEnglishBookTopics(ambulance).map((topic) => topic.id)).toContain(
      "science-and-vehicles-for-kids",
    );
  });

  it("emits English CollectionPage, FAQPage, and BreadcrumbList JSON-LD with canonical English book URLs", () => {
    for (const topic of getAllEnglishTopics()) {
      const books = getEnglishTopicBooks(topic);
      const graph = englishTopicStructuredData(topic)["@graph"];
      const collection = graph.find((node) => node["@type"] === "CollectionPage") as
        | { inLanguage?: string; mainEntity?: { itemListElement?: Array<{ url: string }> } }
        | undefined;
      expect(collection?.inLanguage, topic.id).toBe("en");

      const itemUrls = collection?.mainEntity?.itemListElement?.map((item) => item.url) ?? [];
      expect(itemUrls, topic.id).toHaveLength(books.length);
      for (const [index, { book }] of books.entries()) {
        const pathname = new URL(itemUrls[index]).pathname;
        expect(pathname, `${topic.id}/${book.id}`).toBe(libraryBookPath(book, "en"));
        expect(legacyEnglishLibraryPath(pathname), `${topic.id}/${book.id}`).toBeUndefined();
      }

      const faqNode = graph.find((node) => node["@type"] === "FAQPage") as
        | { mainEntity?: unknown[] }
        | undefined;
      expect(faqNode?.mainEntity, topic.id).toHaveLength(topic.faqs.length);

      const crumbs = graph.find((node) => node["@type"] === "BreadcrumbList");
      expect(crumbs, topic.id).toBeDefined();
    }
  });

  it("lists /en/library/topics with bilingual alternates and every English topic page in the sitemap", () => {
    const entries = sitemap();
    const byPath = new Map(entries.map((entry) => [new URL(entry.url).pathname, entry]));

    const zhIndex = byPath.get("/library/topics");
    const enIndex = byPath.get("/en/library/topics");
    expect(zhIndex?.alternates?.languages).toHaveProperty("en");
    expect(enIndex?.alternates?.languages).toHaveProperty("zh-CN");

    for (const topic of getAllEnglishTopics()) {
      const entry = byPath.get(englishTopicPath(topic));
      expect(entry, topic.id).toBeDefined();
      expect(entry?.lastModified, topic.id).toBeTruthy();
      expect(entry?.images?.length ?? 0, topic.id).toBeGreaterThan(0);
      expect(entry?.alternates, topic.id).toBeUndefined();
    }
  });

  it("keeps featured English homepage topic links aligned with defined English topics", () => {
    for (const item of FEATURED_ENGLISH_TOPIC_LINKS) {
      const topic = getEnglishTopic(item.id);
      expect(topic, item.id).not.toBeNull();
      expect(topic?.name, item.id).toBe(item.name);
    }
  });
});
