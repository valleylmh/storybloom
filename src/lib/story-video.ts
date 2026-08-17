import type { StoryPage } from "@/types";

export type StoryVideoNarrationMode = "zh" | "en" | "zh-en" | "none";

export const STORY_VIDEO_FPS = 24;
export const STORY_VIDEO_WIDTH = 720;
export const STORY_VIDEO_HEIGHT = 1280;
export const STORY_VIDEO_MIN_SCENE_SECONDS = 6.4;
export const STORY_VIDEO_AUDIO_LEAD_IN_SECONDS = 0.45;
export const STORY_VIDEO_AUDIO_TAIL_SECONDS = 0.55;

export function getStoryVideoTransitionFrames(fps = STORY_VIDEO_FPS) {
  const blankFrames = Math.round(0.2 * fps);
  const grayscaleEnd = blankFrames + Math.round(1.45 * fps);
  const colorEnd = grayscaleEnd + Math.round(1.2 * fps);
  return { blankFrames, grayscaleEnd, colorEnd };
}

function interpolateStoryVideoReveal(
  frame: number,
  startFrame: number,
  endFrame: number,
) {
  if (frame <= startFrame) return 0;
  if (frame >= endFrame) return 100;
  return ((frame - startFrame) / Math.max(1, endFrame - startFrame)) * 100;
}

export function getStoryVideoImageReveal({
  frame,
  fps = STORY_VIDEO_FPS,
  coverScene,
}: {
  frame: number;
  fps?: number;
  coverScene: boolean;
}) {
  if (coverScene) {
    return { grayReveal: 100, colorReveal: 100 };
  }

  const { blankFrames, grayscaleEnd, colorEnd } =
    getStoryVideoTransitionFrames(fps);
  return {
    grayReveal: interpolateStoryVideoReveal(
      frame,
      blankFrames,
      grayscaleEnd,
    ),
    colorReveal: interpolateStoryVideoReveal(
      frame,
      grayscaleEnd,
      colorEnd,
    ),
  };
}

export type StoryVideoAudioAsset = {
  page: number;
  text: string;
  audioDataUrl: string;
  durationSeconds: number;
};

export type StoryVideoSubtitlePair = {
  zh: string;
  en: string;
};

export type StoryVideoTimelineScene = {
  page: number;
  zhText: string;
  enText: string;
  subtitlePairs: StoryVideoSubtitlePair[];
  imageUrl: string;
  narrationText: string;
  audioDataUrl?: string;
  audioDurationSeconds: number;
  durationInFrames: number;
  startFrame: number;
};

function splitStoryVideoSentences(text: string, language: "zh" | "en") {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const pattern =
    language === "zh"
      ? /[^。！？!?；;]+(?:[。！？!?；;]+[”’"']*|$)/g
      : /[^.!?;]+(?:[.!?;]+[”’"']*|$)/g;
  const sentences = normalized
    .match(pattern)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences?.length ? sentences : [normalized];
}

export function createStoryVideoSubtitlePairs(
  zhText: string,
  enText: string,
): StoryVideoSubtitlePair[] {
  const zhSentences = splitStoryVideoSentences(zhText, "zh");
  const enSentences = splitStoryVideoSentences(enText, "en");
  const pairCount = Math.max(zhSentences.length, enSentences.length);

  return Array.from({ length: pairCount }, (_, index) => ({
    zh: zhSentences[index] ?? "",
    en: enSentences[index] ?? "",
  }));
}

export function getStoryVideoReadinessError(
  pages: StoryPage[],
  totalPages: number,
) {
  if (pages.length === 0 || pages.length !== totalPages) {
    return "绘本页面还没有准备完整。";
  }

  const unavailablePage = pages.find(
    (page) => !page.imageUrl || page.imageStatus !== "complete",
  );
  if (unavailablePage) {
    return `第 ${unavailablePage.page} 页插图还没有准备完成。`;
  }

  return null;
}

export function getStoryVideoNarrationText(
  page: Pick<StoryPage, "zhText" | "enText">,
  mode: StoryVideoNarrationMode,
) {
  if (mode === "none") {
    return "";
  }

  if (mode === "zh") {
    return page.zhText.trim() || page.enText.trim();
  }

  if (mode === "en") {
    return page.enText.trim() || page.zhText.trim();
  }

  return [page.zhText.trim(), page.enText.trim()].filter(Boolean).join("\n");
}

export function calculateStoryVideoSceneFrames(
  audioDurationSeconds: number,
  fps = STORY_VIDEO_FPS,
) {
  const minimumFrames = Math.ceil(STORY_VIDEO_MIN_SCENE_SECONDS * fps);
  const narratedFrames = Math.ceil(
    (Math.max(0, audioDurationSeconds) +
      STORY_VIDEO_AUDIO_LEAD_IN_SECONDS +
      STORY_VIDEO_AUDIO_TAIL_SECONDS) *
      fps,
  );

  return Math.max(minimumFrames, narratedFrames);
}

export function createStoryVideoTimeline({
  pages,
  narrationMode,
  audioAssets = [],
  fps = STORY_VIDEO_FPS,
}: {
  pages: StoryPage[];
  narrationMode: StoryVideoNarrationMode;
  audioAssets?: StoryVideoAudioAsset[];
  fps?: number;
}) {
  const audioByPage = new Map(audioAssets.map((asset) => [asset.page, asset]));
  let startFrame = 0;

  return [...pages]
    .sort((first, second) => first.page - second.page)
    .map((page): StoryVideoTimelineScene => {
      if (!page.imageUrl) {
        throw new Error(`第 ${page.page} 页缺少插图。`);
      }

      const narrationText = getStoryVideoNarrationText(page, narrationMode);
      const audioAsset = audioByPage.get(page.page);
      const audioDurationSeconds = audioAsset?.durationSeconds ?? 0;
      const durationInFrames = calculateStoryVideoSceneFrames(
        audioDurationSeconds,
        fps,
      );
      const scene: StoryVideoTimelineScene = {
        page: page.page,
        zhText: page.zhText,
        enText: page.enText,
        subtitlePairs: createStoryVideoSubtitlePairs(
          page.zhText,
          page.enText,
        ),
        imageUrl: page.imageUrl,
        narrationText,
        audioDataUrl: audioAsset?.audioDataUrl,
        audioDurationSeconds,
        durationInFrames,
        startFrame,
      };

      startFrame += durationInFrames;
      return scene;
    });
}

export function getStoryVideoTotalFrames(
  scenes: Pick<StoryVideoTimelineScene, "startFrame" | "durationInFrames">[],
) {
  const lastScene = scenes[scenes.length - 1];
  return lastScene ? lastScene.startFrame + lastScene.durationInFrames : 0;
}

export function createStoryVideoFilename(
  title: string,
  extension: "mp4" | "webm",
) {
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${safeTitle || "storybloom-story"}.${extension}`;
}
