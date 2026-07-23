import { describe, expect, it } from "vitest";
import {
  getBrowserNarrationSegments,
  pickBrowserVoice,
} from "@/lib/browser-narration";
import type { StoryPage } from "@/types";

const pages: StoryPage[] = [
  {
    page: 1,
    zhText: "第一段中文",
    enText: "First English line",
    illustrationPrompt: "cover",
  },
  {
    page: 2,
    zhText: "第二段中文",
    enText: "Second English line",
    illustrationPrompt: "page two",
  },
];

describe("browser narration", () => {
  it("creates language-specific segments in page order", () => {
    expect(getBrowserNarrationSegments(pages, "zh-en")).toEqual([
      { text: "第一段中文", lang: "zh-CN" },
      { text: "First English line", lang: "en-US" },
      { text: "第二段中文", lang: "zh-CN" },
      { text: "Second English line", lang: "en-US" },
    ]);
  });

  it("keeps a single-language narration in the selected language", () => {
    expect(getBrowserNarrationSegments(pages, "en")).toEqual([
      { text: "First English line", lang: "en-US" },
      { text: "Second English line", lang: "en-US" },
    ]);
  });

  it("prefers an exact browser voice language match", () => {
    const voices = [
      { lang: "zh-TW", localService: true },
      { lang: "zh-CN", localService: false },
    ] as SpeechSynthesisVoice[];

    expect(pickBrowserVoice(voices, "zh-CN")).toBe(voices[1]);
  });
});
