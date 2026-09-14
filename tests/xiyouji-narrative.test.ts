import { describe, expect, it } from "vitest";
import { getSeriesBooks, getBook, getAdjacentBooks } from "@/lib/library";

describe("西游记故事因果与结局", () => {
  const books = getSeriesBooks("xiyouji");
  const index = (id: string) => books.findIndex(book => book.id === id);
  const text = (id: string) => getBook("xiyouji", id)!.pages.map(page => page.zhText).join("");
  it("keeps early supplements and rescues before their consequences", () => {
    const sequences = [
      ["tian-ma-yuan-zhi-ban-biao", "pan-tao-yuan-de-qing-tie", "da-nao-tian-gong", "wu-xing-shan-xia", "shuang-cha-ling-ren-lu", "shi-tu-xiang-yu"],
      ["bai-long-ma", "hei-feng-shan-hu-jia-sha", "gao-lao-zhuang-yu-ba-jie", "huang-feng-ling-ding-feng-zhu", "liu-sha-he-shou-sha-seng"],
      ["san-da-bai-gu-jing", "hua-guo-shan-qing-shi-xiong", "bao-xiang-guo-jiu-gong-zhu"],
      ["huo-yun-dong-shou-hong-hai-er", "hei-shui-he-bian-tuo-long", "che-chi-guo-san-chang-bi-shi", "tong-tian-he-jiu-tong-zi", "jin-dou-dong-shou-qing-niu", "nu-er-guo-ci-bie"],
      ["san-jie-ba-jiao-shan", "ji-sai-guo-sao-bao-ta", "jing-ji-ling-kai-lu", "mu-xian-an-shi-hui", "xiao-lei-yin-si-shi-jia-fo", "qi-jue-shan-qing-guo-xiang", "zhu-zi-guo-wen-wen-zhen", "zhu-zi-guo-jie-xin-jie", "pan-si-dong-qiao-tuo-xian"],
      ["yu-hua-zhou-shou-xin-tu", "yu-hua-zhou-zhao-gong-ju", "jin-ping-fu-shou-hua-deng", "tian-zhu-guo-bian-yu-tu"],
    ];
    for (const sequence of sequences) for (let i = 1; i < sequence.length; i++) {
      expect(index(sequence[i - 1]), sequence.join(" → ")).toBeLessThan(index(sequence[i]));
    }
  });
  it("explains Wukong leaving and returning, and sets up the old turtle promise", () => {
    expect(text("san-da-bai-gu-jing")).toContain("回了花果山");
    expect(text("bao-xiang-guo-jiu-gong-zhu")).toContain("师徒在宝象国重聚");
    expect(text("huang-feng-ling-ding-feng-zhu")).not.toContain("沙僧");
    expect(text("tong-tian-he-jiu-tong-zi")).toContain("何时能修成人身");
    expect(text("lao-yuan-wen-jiu-nuo")).toContain("何时能修成人身");
  });
  it("ends after returning east and then west, honoring all five, dragon transformation and headband disappearance", () => {
    const finale = books.at(-1)!;
    expect(finale.id).toBe("chang-an-gong-de-yuan-man");
    expect(finale.pages.length).toBeGreaterThanOrEqual(10);
    expect(finale.pages.length).toBeLessThanOrEqual(20);
    expect(finale.pages.map(p => p.page)).toEqual(Array.from({length: 14}, (_, i) => i + 1));
    for (const term of ["重返灵山", "旃檀功德佛", "斗战胜佛", "净坛使者", "金身罗汉", "八部天龙马", "金鳞银须", "金箍果然不见了", "圆满结束"]) expect(text(finale.id)).toContain(term);
    expect(text(finale.id).indexOf("重返灵山")).toBeLessThan(text(finale.id).indexOf("旃檀功德佛"));
    expect(getAdjacentBooks("xiyouji", finale.id).next).toBeNull();
    expect(finale.pages[13].illustrationPrompt).toContain("no shoes, crown, circlet, headband");
  });
});
