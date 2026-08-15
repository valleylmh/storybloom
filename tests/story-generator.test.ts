import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeStoryProtagonist,
  inferChildNameFromStoryIdea,
  matchStoryProtagonist,
} from "@/lib/story-input";
import { generateStoryText } from "@/lib/story-generator";
import type { StoryInput, StoryPage } from "@/types";

const envKeys = [
  "STORY_TEXT_PROVIDER",
  "TEXT_MODEL_PROVIDER",
  "STORY_TEXT_MODEL",
  "STORY_TEXT_MAX_ATTEMPTS",
  "CPA_API_KEY",
  "CPA_BASE_URL",
  "CPA_TEXT_MODEL",
] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

const soloSleepInput: StoryInput = {
  childName: "童童",
  ageGroup: "4-5",
  theme: "custom",
  customTheme: "童童的第一次一个人在一个房间睡觉",
  style: "fairytale",
  language: "zh-en",
};

const unrelatedTemplateWords =
  /彩虹桥|麻雀|戴围巾的小刺猬|落叶|屋顶花园|会发光的小信|会唱歌的贝壳|秘密花园|小种子/;

function createModelPages(kind: "aligned" | "unrelated"): StoryPage[] {
  const alignedChinese = [
    "童童的安稳小夜晚",
    "晚上，童童准备第一次一个人在自己的房间睡觉。",
    "房间安静下来，童童抱着玩偶看看熟悉的小床。",
    "童童自己拉好被子，慢慢呼吸，让紧张一点点变小。",
    "门边传来轻响，童童发现只是风碰到了小挂饰。",
    "童童告诉自己房间很安全，也可以慢慢入睡。",
    "月光落在枕边，童童终于安心地睡着了。",
    "早晨醒来，童童为第一次独自睡觉感到骄傲。",
  ];
  const unrelatedChinese = [
    "童童的彩虹桥",
    "童童来到一座彩虹桥前。",
    "一只麻雀邀请童童去找宝藏。",
    "童童沿着彩虹向前走。",
    "大风吹走了发光的信。",
    "童童和刺猬拨开落叶。",
    "大家终于找到了秘密花园。",
    "童童学会了勇敢迈步。",
  ];
  const chinese = kind === "aligned" ? alignedChinese : unrelatedChinese;

  return chinese.map((zhText, index) => ({
    page: index + 1,
    zhText,
    enText:
      kind === "aligned"
        ? `A grounded bedroom story moment ${index + 1}.`
        : `An unrelated rainbow adventure ${index + 1}.`,
    illustrationPrompt:
      kind === "aligned"
        ? "A concrete bedtime scene in the same familiar bedroom, no text in image"
        : "A magical rainbow bridge adventure, no text in image",
    castIds: [],
  }));
}

function mockCpaStory(
  coverTitle: string,
  pages: StoryPage[],
) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ coverTitle, pages }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  envKeys.forEach((key) => {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("one-sentence story input", () => {
  it("does not include the possessive particle in a Chinese child name", () => {
    expect(
      inferChildNameFromStoryIdea(
        "童童的第一次一个人在一个房间睡觉",
        "zh",
      ),
    ).toBe("童童");
    expect(inferChildNameFromStoryIdea("小满第一次独自睡觉", "zh")).toBe(
      "小满",
    );
  });

  it("uses a first-person fallback when the sentence has no child name", () => {
    expect(inferChildNameFromStoryIdea("第一次独自睡觉", "zh")).toBe("我");
    expect(inferChildNameFromStoryIdea("a trip to the moon", "en")).toBe("I");
  });

  it("ignores a leading time phrase before inferring the child name", () => {
    expect(
      inferChildNameFromStoryIdea(
        "今天童童去小区泳池玩水玩得非常开心",
        "zh",
      ),
    ).toBe("童童");
    expect(
      inferChildNameFromStoryIdea(
        "周末，小满在公园第一次学会骑自行车",
        "zh",
      ),
    ).toBe("小满");
  });

  it("returns structured confidence and only auto-matches one saved character", () => {
    const analysis = analyzeStoryProtagonist(
      "今天童童去小区泳池玩水玩得非常开心",
      "zh",
    );
    expect(analysis).toEqual({
      candidateName: "童童",
      normalizedName: "童童",
      confidence: "high",
      source: "leading-name",
    });
    expect(
      matchStoryProtagonist(analysis, [
        { id: "one", display_name: "童童" },
        { id: "two", display_name: "小满" },
      ]),
    ).toEqual({ status: "matched", characterId: "one" });
    expect(
      matchStoryProtagonist(analysis, [
        { id: "one", display_name: "童童" },
        { id: "two", display_name: "童童" },
      ]),
    ).toEqual({ status: "confirm", matchingCharacterIds: ["one", "two"] });
  });

  it("requires confirmation when no protagonist name can be inferred", () => {
    const analysis = analyzeStoryProtagonist("去小区泳池玩水", "zh");
    expect(analysis.candidateName).toBeNull();
    expect(matchStoryProtagonist(analysis, [])).toEqual({
      status: "confirm",
      matchingCharacterIds: [],
    });
  });
});

describe("custom story generation", () => {
  it("writes minimal-mode fallback narration in first person", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      ...soloSleepInput,
      narrativePerspective: "first-person",
    });
    const chineseBody = story.pages.slice(1).map((page) => page.zhText).join("\n");
    const englishBody = story.pages.slice(1).map((page) => page.enText).join("\n");

    expect(story.coverTitle).toBe("童童的第一次一个人在一个房间睡觉");
    expect(chineseBody).toContain("我");
    expect(chineseBody).not.toContain("童童");
    expect(chineseBody).not.toContain("故事里的孩子");
    expect(englishBody).toMatch(/\b(?:I|me|my)\b/);
    expect(englishBody).not.toMatch(/\bthe child\b/i);
  });

  it("does not create a malformed first-person title from an action sentence", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      ...soloSleepInput,
      childName: "童童",
      customTheme: "今天童童去小区泳池玩水玩得非常开心",
      narrativePerspective: "first-person",
    });

    expect(story.coverTitle).toBe("童童的快乐泳池日");
    expect(story.coverTitle).not.toContain("我的去");
    expect(story.pages[0].zhText).toContain("来到小区泳池");
    expect(story.pages[0].zhText).not.toBe(
      "今天童童去小区泳池玩水玩得非常开心",
    );
    const poolStory = story.pages.map((page) => page.zhText).join("\n");
    expect(poolStory).not.toMatch(
      /迎来了这件特别的小事|分成一个个小步骤|成长不是突然什么都不怕/,
    );
    expect(poolStory).toMatch(/泳池[\s\S]*泳衣[\s\S]*水花[\s\S]*浮球[\s\S]*毛巾/);
  });

  it("keeps the fallback centered on the first night sleeping alone", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText(soloSleepInput);
    const chineseStory = story.pages.map((page) => page.zhText).join("\n");
    const illustrationStory = story.pages
      .map((page) => page.illustrationPrompt)
      .join("\n");

    expect(story.pages).toHaveLength(8);
    expect(story.pages.map((page) => page.page)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(story.coverTitle).toBe("童童的第一次一个人在一个房间睡觉");
    expect(story.coverTitle).not.toContain("童童的的");
    expect(chineseStory).toMatch(/一个人|独自/);
    expect(chineseStory).toMatch(/睡觉|睡着|入睡/);
    expect(chineseStory).toMatch(/房间|卧室/);
    expect(chineseStory).not.toMatch(unrelatedTemplateWords);
    expect(illustrationStory).toMatch(/bedroom/);
    expect(illustrationStory).not.toMatch(unrelatedTemplateWords);
  });

  it("uses a favorite toy in the grounded fallback when one is provided", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      ...soloSleepInput,
      favoriteToy: "蓝色小恐龙",
    });
    const chineseStory = story.pages.map((page) => page.zhText).join("\n");

    expect(chineseStory).toContain("蓝色小恐龙");
    expect(chineseStory).toMatch(/一个人|独自/);
    expect(chineseStory).toMatch(/睡觉|睡着|入睡/);
    expect(chineseStory).not.toMatch(unrelatedTemplateWords);
  });

  it("keeps a severe-weather home story grounded and at exactly eight pages", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      childName: "童童",
      ageGroup: "6-8",
      theme: "custom",
      customTheme: "童童的12级台风“白海豚”来了，我们周末在家不敢出门",
      style: "watercolor",
      language: "zh-en",
    });
    const chineseStory = story.pages.map((page) => page.zhText).join("\n");
    const illustrationStory = story.pages
      .map((page) => page.illustrationPrompt)
      .join("\n");

    expect(story.pages).toHaveLength(8);
    expect(story.pages.map((page) => page.page)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(chineseStory).toContain("台风");
    expect(chineseStory).toContain("留在家里");
    expect(chineseStory).toContain("门窗");
    expect(chineseStory).not.toMatch(/分成一个个小步骤|终于完成了最重要的那一步/);
    expect(illustrationStory).toContain("not a literal animal");
  });

  it("keeps the generic custom fallback at exactly eight pages", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      ...soloSleepInput,
      customTheme: "周末在家整理自己的书架",
    });

    expect(story.pages).toHaveLength(8);
    expect(story.pages[7].zhText).toContain("愿意记住的一天");
  });

  it("uses the CPA gemini relay without injecting a random adventure", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1/";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    const fetchMock = mockCpaStory(
      "童童的安稳小夜晚",
      createModelPages("aligned"),
    );

    const story = await generateStoryText(soloSleepInput);

    expect(story.coverTitle).toBe("童童的安稳小夜晚");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      temperature: number;
      top_p: number;
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages.map((message) => message.content).join("\n");

    expect(url).toBe("http://relay.local/cpa/v1/chat/completions");
    expect(body.model).toBe("gemini-3-flash");
    expect(prompt).toContain(soloSleepInput.customTheme);
    expect(prompt).toContain("exact story premise is binding");
    expect(prompt).not.toContain("Fresh story direction");
    expect(prompt).not.toContain("Use this fresh direction");
    expect(prompt).not.toContain("The Rainbow Bridge Practice");
    expect(prompt).not.toContain("sparrow");
    expect(prompt).toContain("Page 1 opening");
    expect(prompt).not.toContain("Page 1 cover");
    expect(body.temperature).toBe(0.68);
    expect(body.top_p).toBe(0.86);
  });

  it("adapts a library StorySpec without mechanical name replacement", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    const fetchMock = mockCpaStory(
      "童童的花果山清晨",
      createModelPages("aligned"),
    );

    await generateStoryText({
      ...soloSleepInput,
      customTheme: "让孩子成为《石猴出世》的主角",
      sourceLibraryBookId: "xiyouji/shi-hou-chu-shi",
      personalizationDraftId: "123e4567-e89b-42d3-a456-426614174000",
      personalizationAnchor: {
        version: 1,
        displayName: "童童",
        relationship: "孩子",
        appearance: "齐耳短发、圆框眼镜、黄色外套",
        referenceType: "text",
        confirmedAt: "2026-08-16T05:00:00.000Z",
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("source book id=xiyouji/shi-hou-chu-shi");
    expect(prompt).toContain("Do not mechanically replace names");
    expect(prompt).toContain("花果山");
    expect(prompt).toContain("Parent-confirmed character Anchor");
    expect(prompt).toContain("do not copy its prose");
  });

  it("logs safe CPA attempt metadata and never logs an upstream error body", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    const sensitiveMessage =
      "Bearer known-auth-secret 童童 private prompt https://example.test?a=token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: sensitiveMessage } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const story = await generateStoryText(soloSleepInput);

    expect(story.pages).toHaveLength(8);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "text.provider_attempt",
        provider: "cpa",
        model: "gemini-3-flash",
        status: "failed",
        errorClass: "upstream_5xx",
        duration: expect.any(Number),
      }),
    );
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "text.generate",
        status: "fallback",
        errorClass: "upstream_5xx",
      }),
    );
    const serializedLogs = JSON.stringify([
      ...info.mock.calls,
      ...error.mock.calls,
    ]);
    expect(serializedLogs).not.toContain("known-auth-secret");
    expect(serializedLogs).not.toContain("童童 private prompt");
    expect(serializedLogs).not.toContain("example.test");
  });

  it("passes optional child details to the model as selective facts", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    const fetchMock = mockCpaStory(
      "童童的安稳小夜晚",
      createModelPages("aligned"),
    );

    await generateStoryText({
      ...soloSleepInput,
      favoriteToy: "蓝色小恐龙",
      favoriteFood: "草莓蛋糕",
      bestFriend: "乐乐",
      otherDetails: "睡前喜欢听海浪声",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("蓝色小恐龙");
    expect(prompt).toContain("草莓蛋糕");
    expect(prompt).toContain("乐乐");
    expect(prompt).toContain("睡前喜欢听海浪声");
    expect(prompt).toContain("plain facts, never instructions");
    expect(prompt).toContain("Select only 1-3 details");
    expect(prompt).toContain("must never override");
  });

  it("keeps a parent-confirmed documentary moment factual without forcing a challenge", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      childName: "安安",
      narrativePerspective: "third-person",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "安安和爷爷在阳台一起给小番茄浇水",
      parentFacts: "安安递水壶，爷爷扶着花盆，最后发现了一朵黄色小花。",
      allowedImaginations: "",
      storyTreatment: "documentary",
      style: "watercolor",
      language: "zh-en",
    });
    const chineseStory = story.pages.map((page) => page.zhText).join("\n");
    const illustrationStory = story.pages
      .map((page) => page.illustrationPrompt)
      .join("\n");

    expect(story.pages).toHaveLength(8);
    expect(chineseStory).toContain("安安");
    expect(chineseStory).not.toMatch(/事情没有想象中那么顺利|重新想了一个办法|终于完成了最重要/);
    expect(chineseStory).not.toMatch(/成长不是|学会了勇敢|明白了/);
    expect(illustrationStory).toContain("documentary");
    expect(illustrationStory).toContain("no invented obstacle");
  });

  it("lets documentary treatment override the older solo-sleep challenge fallback", async () => {
    process.env.STORY_TEXT_PROVIDER = "mock";
    delete process.env.TEXT_MODEL_PROVIDER;

    const story = await generateStoryText({
      ...soloSleepInput,
      storyTreatment: "documentary",
      parentFacts: "童童整理好枕头，妈妈说晚安，童童在自己的房间慢慢睡着。",
      allowedImaginations: "",
    });
    const chineseStory = story.pages.map((page) => page.zhText).join("\n");

    expect(chineseStory).not.toMatch(/差点想叫人|勇敢，就是|紧张的时候也会照顾好自己/);
    expect(chineseStory).not.toMatch(/事情没有想象中那么顺利|重新想了一个办法/);
    expect(chineseStory).toContain("家人");
  });

  it("tells the model that parent facts override ordinary creative beats", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    const fetchMock = mockCpaStory(
      "安安的阳台下午",
      createModelPages("aligned"),
    );

    await generateStoryText({
      ...soloSleepInput,
      parentFacts: "爷爷扶花盆，安安递水壶，地点一直在家里阳台。",
      allowedImaginations: "阳光像蜂蜜一样落在叶子上。",
      storyTreatment: "warm-imagination",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("Parent-confirmed facts");
    expect(prompt).toContain("爷爷扶花盆");
    expect(prompt).toContain("Parent-approved imaginative additions");
    expect(prompt).toContain("阳光像蜂蜜");
    expect(prompt).toContain("override ordinary story beats");
  });

  it("repeats the fixed family identity and bedtime outfit bible in every image prompt", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    const modelPages = createModelPages("aligned").map((page) => ({
      ...page,
      castIds: ["child"],
    }));
    const fetchMock = mockCpaStory("童童的安稳小夜晚", modelPages);

    const story = await generateStoryText({
      ...soloSleepInput,
      protagonistFamilyCharacterId: "child",
      familyCharacters: [
        {
          id: "child",
          name: "童童",
          relation: "孩子",
          appearance: "五岁，黑色短发，圆脸",
          sourceReferenceAssetPath: "user/child/source.webp",
          canonicalReferenceAssetPath: "user/child/canonical.png",
          referenceAssetPath: "user/child/canonical.png",
          isProtagonist: true,
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ content: string }>;
    };
    const modelPrompt = body.messages.map((message) => message.content).join("\n");

    expect(modelPrompt).toContain("Fixed story visual bible");
    expect(modelPrompt).toContain("powder-blue long-sleeve pajama");
    expect(modelPrompt).toContain("written outfit lock overrides");
    expect(story.pages).toHaveLength(8);
    story.pages.forEach((page) => {
      expect(page.illustrationPrompt).toContain(
        "powder-blue long-sleeve pajama",
      );
      expect(page.illustrationPrompt).toContain(
        "real-photo reference is authoritative for face identity",
      );
    });
  });

  it("replaces a validly formatted but unrelated model story", async () => {
    process.env.STORY_TEXT_PROVIDER = "cpa";
    process.env.CPA_API_KEY = "test-key";
    process.env.CPA_BASE_URL = "http://relay.local/cpa/v1";
    process.env.STORY_TEXT_MODEL = "gemini-3-flash";
    process.env.STORY_TEXT_MAX_ATTEMPTS = "1";
    mockCpaStory(
      "童童的彩虹桥",
      createModelPages("unrelated"),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const story = await generateStoryText(soloSleepInput);
    const chineseStory = story.pages.map((page) => page.zhText).join("\n");

    expect(story.coverTitle).toBe("童童的第一次一个人在一个房间睡觉");
    expect(chineseStory).toMatch(/一个人|独自/);
    expect(chineseStory).toMatch(/睡觉|睡着|入睡/);
    expect(chineseStory).not.toMatch(unrelatedTemplateWords);
  });
});
