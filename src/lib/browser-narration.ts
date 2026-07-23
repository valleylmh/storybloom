import type { StoryPage } from "@/types";

export type BrowserNarrationMode = "zh" | "en" | "zh-en";

export type BrowserNarrationSegment = {
  text: string;
  lang: "zh-CN" | "en-US";
};

export function getBrowserNarrationSegments(
  pages: StoryPage[],
  mode: BrowserNarrationMode,
) {
  return pages.flatMap<BrowserNarrationSegment>((page) => {
    const segments: BrowserNarrationSegment[] = [];
    if ((mode === "zh" || mode === "zh-en") && page.zhText?.trim()) {
      segments.push({ text: page.zhText.trim(), lang: "zh-CN" });
    }
    if ((mode === "en" || mode === "zh-en") && page.enText?.trim()) {
      segments.push({ text: page.enText.trim(), lang: "en-US" });
    }
    return segments;
  });
}

export function pickBrowserVoice(
  voices: SpeechSynthesisVoice[],
  lang: BrowserNarrationSegment["lang"],
) {
  const normalizedLang = lang.toLowerCase();
  const languagePrefix = normalizedLang.split("-")[0];
  const matchingVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(languagePrefix),
  );

  return (
    matchingVoices.find((voice) => voice.lang.toLowerCase() === normalizedLang) ||
    matchingVoices.find((voice) => voice.localService) ||
    matchingVoices[0] ||
    null
  );
}
