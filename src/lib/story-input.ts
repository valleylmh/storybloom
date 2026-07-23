export type StoryInputLocale = "zh" | "en";

export function inferChildNameFromStoryIdea(
  idea: string,
  locale: StoryInputLocale,
) {
  if (locale === "zh") {
    const match = idea.match(
      /^([\u4e00-\u9fff]{1,4})(?=第一次|想要|想|在|和|学会|害怕|喜欢|要去|去)/,
    );
    const inferredName = match?.[1].replace(/的$/, "");
    return inferredName || "故事里的孩子";
  }

  const match = idea.match(/^([A-Z][a-z]{1,18})(?=\s)/);
  return match?.[1] || "The child";
}
