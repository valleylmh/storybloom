import { describe, expect, it } from "vitest";
import {
  STORY_VIDEO_FPS,
  calculateStoryVideoSceneFrames,
  createStoryVideoFilename,
  createStoryVideoSubtitlePairs,
  createStoryVideoTimeline,
  getStoryVideoImageReveal,
  getStoryVideoNarrationText,
  getStoryVideoReadinessError,
  getStoryVideoTotalFrames,
} from "@/lib/story-video";
import type { StoryPage } from "@/types";

const pages: StoryPage[] = [
  {
    page: 2,
    zhText: "第二页中文",
    enText: "Second page",
    illustrationPrompt: "second",
    imageUrl: "data:image/png;base64,second",
    imageStatus: "complete",
  },
  {
    page: 1,
    zhText: "第一页中文",
    enText: "First page",
    illustrationPrompt: "first",
    imageUrl: "data:image/png;base64,first",
    imageStatus: "complete",
  },
];

describe("story video readiness", () => {
  it("accepts only a complete set of finished illustrations", () => {
    expect(getStoryVideoReadinessError(pages, 2)).toBeNull();
    expect(getStoryVideoReadinessError(pages.slice(0, 1), 2)).toBe(
      "绘本页面还没有准备完整。",
    );
    expect(
      getStoryVideoReadinessError(
        pages.map((page) =>
          page.page === 2 ? { ...page, imageStatus: "pending" } : page,
        ),
        2,
      ),
    ).toBe("第 2 页插图还没有准备完成。");
  });
});

describe("story video narration", () => {
  it("selects Chinese, English, bilingual, or silent text", () => {
    const page = pages[0];
    expect(getStoryVideoNarrationText(page, "zh")).toBe("第二页中文");
    expect(getStoryVideoNarrationText(page, "en")).toBe("Second page");
    expect(getStoryVideoNarrationText(page, "zh-en")).toBe(
      "第二页中文\nSecond page",
    );
    expect(getStoryVideoNarrationText(page, "none")).toBe("");
  });

  it("falls back to the available language", () => {
    expect(
      getStoryVideoNarrationText({ zhText: "", enText: "Only English" }, "zh"),
    ).toBe("Only English");
  });
});

describe("story video subtitles", () => {
  it("keeps a single Chinese sentence next to its English translation", () => {
    expect(
      createStoryVideoSubtitlePairs(
        "小熊醒来了。",
        "The little bear woke up.",
      ),
    ).toEqual([
      {
        zh: "小熊醒来了。",
        en: "The little bear woke up.",
      },
    ]);
  });

  it("pairs multiple translated sentences in reading order", () => {
    expect(
      createStoryVideoSubtitlePairs(
        "小熊醒来了。它推开窗！",
        "The little bear woke up. It opened the window!",
      ),
    ).toEqual([
      {
        zh: "小熊醒来了。",
        en: "The little bear woke up.",
      },
      {
        zh: "它推开窗！",
        en: "It opened the window!",
      },
    ]);
  });

  it("preserves unmatched trailing sentences", () => {
    expect(
      createStoryVideoSubtitlePairs(
        "第一句。第二句。第三句。",
        "First sentence. Second sentence.",
      ),
    ).toEqual([
      { zh: "第一句。", en: "First sentence." },
      { zh: "第二句。", en: "Second sentence." },
      { zh: "第三句。", en: "" },
    ]);
  });
});

describe("story video timeline", () => {
  it("keeps page order stable and uses real audio durations", () => {
    const timeline = createStoryVideoTimeline({
      pages,
      narrationMode: "en",
      audioAssets: [
        {
          page: 1,
          text: "First page",
          audioDataUrl: "data:audio/mp3;base64,first",
          durationSeconds: 8,
        },
        {
          page: 2,
          text: "Second page",
          audioDataUrl: "data:audio/mp3;base64,second",
          durationSeconds: 2,
        },
      ],
    });

    expect(timeline.map((scene) => scene.page)).toEqual([1, 2]);
    expect(timeline[0].startFrame).toBe(0);
    expect(timeline[0].subtitlePairs).toEqual([
      { zh: "第一页中文", en: "First page" },
    ]);
    expect(timeline[0].durationInFrames).toBe(9 * STORY_VIDEO_FPS);
    expect(timeline[1].startFrame).toBe(timeline[0].durationInFrames);
    expect(timeline[1].durationInFrames).toBe(
      calculateStoryVideoSceneFrames(2),
    );
    expect(getStoryVideoTotalFrames(timeline)).toBe(
      timeline[0].durationInFrames + timeline[1].durationInFrames,
    );
  });
});

describe("story video cover frame", () => {
  it("keeps the first page fully visible from frame zero", () => {
    expect(
      getStoryVideoImageReveal({
        frame: 0,
        coverScene: true,
      }),
    ).toEqual({ grayReveal: 100, colorReveal: 100 });
  });

  it("preserves the reveal animation for later pages", () => {
    expect(
      getStoryVideoImageReveal({
        frame: 0,
        coverScene: false,
      }),
    ).toEqual({ grayReveal: 0, colorReveal: 0 });
  });
});

describe("story video filenames", () => {
  it("creates a filesystem-safe download name", () => {
    expect(createStoryVideoFilename(' 星光/愿望: "新篇" ', "mp4")).toBe(
      "星光-愿望-新篇.mp4",
    );
  });
});
