import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getBook, getSeries } from "@/lib/library";
import { bookDescription, bookMetadata } from "@/lib/library/seo";
import { getAllTopics, getBookTopics, getTopicBooks, topicPath } from "@/lib/library/topics";

describe("library parenting topics", () => {
  it("only lists published books that carry a parent guide, without duplicates", () => {
    const topics = getAllTopics();
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);
    for (const topic of topics) {
      expect(new Set(topic.bookIds).size, topic.id).toBe(topic.bookIds.length);
      const books = getTopicBooks(topic);
      expect(books.map(({ series, book }) => `${series.id}/${book.id}`), topic.id).toEqual(topic.bookIds);
      expect(books.length, topic.id).toBeGreaterThanOrEqual(3);
      for (const { book } of books) expect(book.parentGuide, book.id).toBeDefined();
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

  it("leaves other series untouched", () => {
    const idiom = getBook("chengyu", "shou-zhu-dai-tu")!;
    expect(bookMetadata(idiom, getSeries("chengyu")!).title).toBe("守株待兔 - 中英双语成语故事绘本 | StoryBloom");
  });

  it("lists the topic index and every topic page in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/library/topics");
    for (const topic of getAllTopics()) expect(paths).toContain(topicPath(topic));
  });
});
