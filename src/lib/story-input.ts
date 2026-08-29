export type StoryInputLocale = "zh" | "en";
export type StoryProtagonistConfidence = "high" | "low";
export type StoryProtagonistSource =
  | "explicit-name"
  | "relationship-name"
  | "context-name"
  | "leading-name"
  | "no-name";

export type StoryProtagonistAnalysis = {
  candidateName: string | null;
  normalizedName: string | null;
  confidence: StoryProtagonistConfidence;
  source: StoryProtagonistSource;
};

export type StoryProtagonistChoice = {
  id: string;
  display_name: string;
};

export type StoryProtagonistMatch =
  | { status: "matched"; characterId: string }
  | { status: "confirm"; matchingCharacterIds: string[] };

const CHINESE_TIME_PREFIX =
  /^(?:(?:今天|昨天|明天|今晚|今早|今晨|早上|上午|中午|下午|傍晚|晚上|夜里|周末|这个周末|上个周末|下个周末|星期[一二三四五六日天]|周[一二三四五六日天])(?:的时候)?)[，,、：:\s]*/;

const NON_NAME_PROTAGONISTS = new Set([
  "我",
  "我们",
  "他",
  "她",
  "它",
  "孩子",
  "宝宝",
  "小朋友",
  "女儿",
  "儿子",
  "爸爸",
  "妈妈",
  "父亲",
  "母亲",
  "家人",
  "大家",
  "主角",
  "主人公",
]);

const NON_NAME_PARTS = [
  "孩子",
  "宝宝",
  "小朋友",
  "女儿",
  "儿子",
  "爸爸",
  "妈妈",
  "父亲",
  "母亲",
  "家人",
  "大家",
  "主角",
  "主人公",
];

const CHINESE_ACTION_PREFIX =
  /^(?:第一次|想要|想|正在|在|和|跟|与|陪|学会|害怕|喜欢|要去|去|参加|开始|发现|遇到|帮助|带)/;

type ChineseNameMatch = {
  candidateName: string;
  source: Exclude<StoryProtagonistSource, "no-name">;
};

function readChineseNameMatch(
  idea: string,
  pattern: RegExp,
  source: ChineseNameMatch["source"],
): ChineseNameMatch | null {
  const candidateName = pattern.exec(idea)?.[1]?.replace(/的$/, "").trim();
  if (
    !candidateName ||
    NON_NAME_PROTAGONISTS.has(candidateName) ||
    NON_NAME_PARTS.some((part) => candidateName.includes(part)) ||
    CHINESE_ACTION_PREFIX.test(candidateName)
  ) {
    return null;
  }
  return { candidateName, source };
}

function findChineseProtagonistName(idea: string): ChineseNameMatch | null {
  return (
    readChineseNameMatch(
      idea,
      /(?:故事的?)?(?:主角|主人公)(?:名字)?\s*(?:叫|是|名叫)\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?/,
      "explicit-name",
    ) ||
    readChineseNameMatch(
      idea,
      /(?:孩子|宝宝|女儿|儿子)(?:的)?名字\s*(?:叫|是)\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?/,
      "explicit-name",
    ) ||
    readChineseNameMatch(
      idea,
      /(?:孩子|宝宝|女儿|儿子)\s*(?:叫|名叫)\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?/,
      "explicit-name",
    ) ||
    readChineseNameMatch(
      idea,
      /(?:我家|我的)?(?:孩子|宝宝|女儿|儿子)\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?(?=第一次|想要|想|正在|在|和|跟|与|陪|学会|害怕|喜欢|要去|去|参加|开始|发现|遇到|帮助|[，,。.!！?？、：:\s]|$)/,
      "relationship-name",
    ) ||
    readChineseNameMatch(
      idea,
      /(?:给|为)\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?(?=讲|做|写|创作|生成)/,
      "context-name",
    ) ||
    readChineseNameMatch(
      idea,
      /关于\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?(?=第一次|想要|想|正在|在|和|跟|与|学会|害怕|喜欢|要去|去|参加|开始|发现|遇到|帮助|[，,。.!！?？、：:\s]|$)/,
      "context-name",
    ) ||
    readChineseNameMatch(
      idea,
      /(?:爸爸|妈妈|父亲|母亲|爷爷|奶奶|外公|外婆)\s*(?:带着?|陪着?|和|跟)\s*[“"「『]?([\u4e00-\u9fff]{1,4})[”"」』]?(?=第一次|想要|想|正在|在|和|跟|与|学会|害怕|喜欢|要去|去|参加|开始|发现|遇到|帮助|[，,。.!！?？、：:\s]|$)/,
      "context-name",
    ) ||
    readChineseNameMatch(
      idea,
      /^([\u4e00-\u9fff]{1,4})(?=第一次|快开学|即将|想要|想|正在|在|和|跟|与|陪|学会|害怕|喜欢|要去|去|参加|开始|发现|遇到|帮助)/,
      "leading-name",
    )
  );
}

export function stripChineseTimePrefix(idea: string) {
  let normalized = idea.trim();
  let previous = "";
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(CHINESE_TIME_PREFIX, "");
  }
  return normalized;
}

export function normalizeCharacterName(name: string) {
  return name
    .trim()
    .replace(/[的，,。.!！?？：:；;、\s]+$/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
}

export function analyzeStoryProtagonist(
  idea: string,
  locale: StoryInputLocale,
): StoryProtagonistAnalysis {
  if (locale === "zh") {
    const normalizedIdea = stripChineseTimePrefix(idea);
    const match = findChineseProtagonistName(normalizedIdea);
    const candidateName = match?.candidateName || null;
    return {
      candidateName,
      normalizedName: candidateName ? normalizeCharacterName(candidateName) : null,
      confidence: candidateName ? "high" : "low",
      source: match?.source || "no-name",
    };
  }

  const match = idea.trim().match(/^([A-Z][a-z]{1,18})(?=\s)/);
  const candidateName = match?.[1] || null;
  return {
    candidateName,
    normalizedName: candidateName ? normalizeCharacterName(candidateName) : null,
    confidence: candidateName ? "low" : "low",
    source: candidateName ? "leading-name" : "no-name",
  };
}

export function matchStoryProtagonist(
  analysis: StoryProtagonistAnalysis,
  choices: StoryProtagonistChoice[],
): StoryProtagonistMatch {
  if (!analysis.normalizedName) {
    return { status: "confirm", matchingCharacterIds: [] };
  }

  const matches = choices.filter(
    (choice) => normalizeCharacterName(choice.display_name) === analysis.normalizedName,
  );
  if (matches.length === 1) {
    return { status: "matched", characterId: matches[0].id };
  }
  return {
    status: "confirm",
    matchingCharacterIds: matches.map((choice) => choice.id),
  };
}

export function inferChildNameFromStoryIdea(
  idea: string,
  locale: StoryInputLocale,
) {
  return analyzeStoryProtagonist(idea, locale).candidateName || (locale === "zh" ? "我" : "I");
}
