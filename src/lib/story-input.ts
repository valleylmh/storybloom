export type StoryInputLocale = "zh" | "en";
export type StoryProtagonistConfidence = "high" | "low";
export type StoryProtagonistSource = "leading-name" | "no-name";

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
    const match = normalizedIdea.match(
      /^([\u4e00-\u9fff]{1,4})(?=第一次|想要|想|在|和|学会|害怕|喜欢|要去|去)/,
    );
    const candidateName = match?.[1].replace(/的$/, "") || null;
    return {
      candidateName,
      normalizedName: candidateName ? normalizeCharacterName(candidateName) : null,
      confidence: candidateName ? "high" : "low",
      source: candidateName ? "leading-name" : "no-name",
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
