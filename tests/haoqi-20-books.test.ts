import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getBook, getPublishedBooks } from "@/lib/library";

const NEW_HAOQI_BOOK_IDS = [
  "hai-lang-wei-shen-me-yi-xia-yi-xia",
  "chao-xi-wei-shen-me-hui-zhang-luo",
  "bai-tian-wei-shen-me-kan-bu-jian-xing-xing",
  "yun-wei-shen-me-hui-piao",
  "xue-wei-shen-me-shi-bai-se-de",
  "lu-zhu-shi-zen-me-lai-de",
  "ying-zi-wei-shen-me-gen-zhe-wo",
  "jing-zi-wei-shen-me-neng-zhao-chu-wo",
  "fei-zao-pao-wei-shen-me-you-cai-se",
  "da-lei-wei-shen-me-hui-xiang",
  "wei-shen-me-xian-kan-dao-shan-dian-zai-ting-dao-lei-sheng",
  "bing-wei-shen-me-fu-zai-shui-mian",
  "re-qi-qiu-wei-shen-me-neng-fei",
  "niao-wei-shen-me-hui-fei",
  "yu-wei-shen-me-neng-zai-shui-li-hu-xi",
  "ying-huo-chong-wei-shen-me-hui-fa-guang",
  "xiang-ri-kui-wei-shen-me-chao-zhe-tai-yang",
  "zhi-wu-wei-shen-me-xu-yao-yang-guang",
  "mao-de-hu-zi-you-shen-me-yong",
  "ban-ma-wei-shen-me-you-tiao-wen",
] as const;

const NEXT_QUESTIONS = [
  "潮水为什么会涨落",
  "白天为什么看不见星星",
  "云为什么会飘",
  "雪花为什么看起来是白色",
  "露珠",
  "影子",
  "镜子",
  "肥皂泡",
  "打雷",
  "先看到闪电",
  "冰为什么",
  "热气球",
  "鸟儿",
  "鱼为什么",
  "萤火虫",
  "向日葵",
  "植物为什么",
  "猫的胡子",
  "斑马",
  "蜘蛛网",
] as const;

describe("好奇为什么新增 20 本", () => {
  it("publishes orders 11–30 as eight-page bilingual books", () => {
    const published = getPublishedBooks("haoqi");
    const newBooks = NEW_HAOQI_BOOK_IDS.map((id) => getBook("haoqi", id));

    expect(newBooks.every(Boolean)).toBe(true);
    expect(newBooks.map((book) => book?.order)).toEqual(
      NEW_HAOQI_BOOK_IDS.map((_, index) => index + 11),
    );
    expect(published.filter((book) => book.order >= 11)).toHaveLength(20);

    for (const book of newBooks) {
      expect(book).not.toBeNull();
      if (!book) continue;
      expect(book.seriesId).toBe("haoqi");
      expect(book.comingSoon).not.toBe(true);
      expect(book.question).toMatch(/？$/);
      expect(book.pages).toHaveLength(8);
      for (const page of book.pages) {
        expect(page.zhText.length).toBeLessThanOrEqual(40);
        expect(page.enText.length).toBeGreaterThan(0);
        expect(page.illustrationPrompt).toMatch(/no text/i);
        expect(page.imageStatus).toBe("complete");
        expect(page.imageUrl).toBe(
          `/library/haoqi/${book.id}/${page.page}.webp`,
        );

        const imagePath = join(process.cwd(), "public", page.imageUrl ?? "");
        expect(existsSync(imagePath), imagePath).toBe(true);
        expect(statSync(imagePath).size).toBeGreaterThan(0);
        expect(statSync(imagePath).size).toBeLessThanOrEqual(300 * 1024);
      }
    }
  });

  it("keeps the curiosity handoff from each new book to the next question", () => {
    for (const [index, id] of NEW_HAOQI_BOOK_IDS.entries()) {
      const book = getBook("haoqi", id);
      expect(book?.pages[7]?.zhText).toContain(NEXT_QUESTIONS[index]);
    }
  });
});
