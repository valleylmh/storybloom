"use client";

import type {
  StoryVideoCompositionProps,
  StoryVideoRenderScene,
} from "@/components/video/StoryVideoComposition";
import { StoryVideoComposition } from "@/components/video/StoryVideoComposition";
import {
  STORY_VIDEO_FPS,
  STORY_VIDEO_HEIGHT,
  STORY_VIDEO_WIDTH,
  createStoryVideoTimeline,
  getStoryVideoNarrationText,
  getStoryVideoTotalFrames,
  type StoryVideoAudioAsset,
  type StoryVideoNarrationMode,
} from "@/lib/story-video";
import type { StoryPage } from "@/types";

export type StoryVideoProgress = {
  progress: number;
  message: string;
};

export type StoryVideoRenderResult = {
  blob: Blob;
  extension: "mp4" | "webm";
  mimeType: "video/mp4" | "video/webm";
  audioAssets: StoryVideoAudioAsset[];
};

type PreparedImage = {
  colorUrl: string;
  grayscaleUrl: string;
};

type DecodedImage = ImageBitmap | HTMLImageElement;

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("视频生成已取消。", "AbortError");
  }
}

async function fetchBlob(source: string, signal: AbortSignal) {
  const response = await fetch(source, { signal });
  if (!response.ok) {
    throw new Error(`资源读取失败：HTTP ${response.status}`);
  }

  return response.blob();
}

async function loadHtmlImage(blob: Blob, signal: AbortSignal) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const handleAbort = () => {
        image.src = "";
        reject(new DOMException("视频生成已取消。", "AbortError"));
      };
      signal.addEventListener("abort", handleAbort, { once: true });
      image.onload = () => {
        signal.removeEventListener("abort", handleAbort);
        resolve(image);
      };
      image.onerror = () => {
        signal.removeEventListener("abort", handleAbort);
        reject(new Error("插图解码失败。"));
      };
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function decodeImage(blob: Blob, signal: AbortSignal): Promise<DecodedImage> {
  throwIfAborted(signal);
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }

  return loadHtmlImage(blob, signal);
}

function getDecodedImageSize(image: DecodedImage) {
  if ("naturalWidth" in image) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return { width: image.width, height: image.height };
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("灰度插图生成失败。"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

async function createGrayscaleBlob(blob: Blob, signal: AbortSignal) {
  const image = await decodeImage(blob, signal);

  try {
    const { width, height } = getDecodedImageSize(image);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("当前浏览器无法处理视频插图。");
    }

    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = Math.round(
        pixels.data[index] * 0.299 +
          pixels.data[index + 1] * 0.587 +
          pixels.data[index + 2] * 0.114,
      );
      pixels.data[index] = gray;
      pixels.data[index + 1] = gray;
      pixels.data[index + 2] = gray;
    }
    throwIfAborted(signal);
    context.putImageData(pixels, 0, 0);
    return canvasToBlob(canvas);
  } finally {
    if ("close" in image && typeof image.close === "function") {
      image.close();
    }
  }
}

async function prepareImage(source: string, signal: AbortSignal) {
  const colorBlob = await fetchBlob(source, signal);
  const grayscaleBlob = await createGrayscaleBlob(colorBlob, signal);
  return {
    colorUrl: URL.createObjectURL(colorBlob),
    grayscaleUrl: URL.createObjectURL(grayscaleBlob),
  } satisfies PreparedImage;
}

async function getAudioDuration(blob: Blob, signal: AbortSignal) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = document.createElement("audio");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("读取配音时长超时。"));
      }, 15000);
      const handleAbort = () => {
        cleanup();
        reject(new DOMException("视频生成已取消。", "AbortError"));
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        signal.removeEventListener("abort", handleAbort);
        audio.removeAttribute("src");
        audio.load();
      };

      signal.addEventListener("abort", handleAbort, { once: true });
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error("配音时长无效。"));
          return;
        }
        resolve(duration);
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error("配音文件解码失败。"));
      };
      audio.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function generatePageAudio({
  page,
  narrationMode,
  signal,
}: {
  page: StoryPage;
  narrationMode: Exclude<StoryVideoNarrationMode, "none">;
  signal: AbortSignal;
}) {
  const text = getStoryVideoNarrationText(page, narrationMode);
  if (!text) {
    return null;
  }

  const response = await fetch("/api/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      mode: narrationMode,
      format: "mp3",
      sampleRate: 24000,
    }),
    signal,
  });
  const data = (await response.json().catch(() => null)) as {
    audioUrl?: string;
    error?: string;
  } | null;
  if (!response.ok || !data?.audioUrl) {
    throw new Error(data?.error || `第 ${page.page} 页配音生成失败。`);
  }

  const audioBlob = await fetchBlob(data.audioUrl, signal);
  const durationSeconds = await getAudioDuration(audioBlob, signal);
  return {
    page: page.page,
    text,
    audioDataUrl: data.audioUrl,
    durationSeconds,
  } satisfies StoryVideoAudioAsset;
}

async function prepareAudioAssets({
  pages,
  narrationMode,
  cachedAudioAssets,
  signal,
  onProgress,
}: {
  pages: StoryPage[];
  narrationMode: StoryVideoNarrationMode;
  cachedAudioAssets?: StoryVideoAudioAsset[];
  signal: AbortSignal;
  onProgress?: (progress: StoryVideoProgress) => void;
}) {
  if (narrationMode === "none") {
    return [];
  }

  const sortedPages = [...pages].sort((first, second) => first.page - second.page);
  const cachedByPage = new Map(
    (cachedAudioAssets ?? []).map((asset) => [asset.page, asset]),
  );
  const prepared: StoryVideoAudioAsset[] = [];

  for (const [index, page] of sortedPages.entries()) {
    throwIfAborted(signal);
    const expectedText = getStoryVideoNarrationText(page, narrationMode);
    const cached = cachedByPage.get(page.page);
    if (cached?.text === expectedText) {
      prepared.push(cached);
    } else {
      const generated = await generatePageAudio({
        page,
        narrationMode,
        signal,
      });
      if (generated) {
        prepared.push(generated);
      }
    }

    onProgress?.({
      progress: 0.2 + ((index + 1) / sortedPages.length) * 0.28,
      message: `正在准备第 ${index + 1}/${sortedPages.length} 页配音`,
    });
  }

  return prepared;
}

async function getEncodingPlan(muted: boolean) {
  const { canRenderMediaOnWeb } = await import("@remotion/web-renderer");
  const mp4 = await canRenderMediaOnWeb({
    container: "mp4",
    videoCodec: "h264",
    audioCodec: muted ? null : "aac",
    muted,
    width: STORY_VIDEO_WIDTH,
    height: STORY_VIDEO_HEIGHT,
    videoBitrate: "high",
    audioBitrate: "high",
  });
  if (mp4.canRender) {
    return {
      container: "mp4" as const,
      videoCodec: "h264" as const,
      audioCodec: muted ? null : ("aac" as const),
      extension: "mp4" as const,
      mimeType: "video/mp4" as const,
    };
  }

  const webm = await canRenderMediaOnWeb({
    container: "webm",
    videoCodec: "vp8",
    audioCodec: muted ? null : "opus",
    muted,
    width: STORY_VIDEO_WIDTH,
    height: STORY_VIDEO_HEIGHT,
    videoBitrate: "high",
    audioBitrate: "high",
  });
  if (webm.canRender) {
    return {
      container: "webm" as const,
      videoCodec: "vp8" as const,
      audioCodec: muted ? null : ("opus" as const),
      extension: "webm" as const,
      mimeType: "video/webm" as const,
    };
  }

  const issues = [...mp4.issues, ...webm.issues]
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message);
  throw new Error(
    issues[0] || "当前浏览器不支持本地视频导出，请使用最新版 Chrome。",
  );
}

export async function renderStoryVideo({
  title,
  pages,
  narrationMode,
  cachedAudioAssets,
  signal,
  onProgress,
}: {
  title: string;
  pages: StoryPage[];
  narrationMode: StoryVideoNarrationMode;
  cachedAudioAssets?: StoryVideoAudioAsset[];
  signal: AbortSignal;
  onProgress?: (progress: StoryVideoProgress) => void;
}): Promise<StoryVideoRenderResult> {
  throwIfAborted(signal);
  onProgress?.({ progress: 0.02, message: "正在检查浏览器视频能力" });
  const encodingPlan = await getEncodingPlan(narrationMode === "none");
  throwIfAborted(signal);

  const timeline = createStoryVideoTimeline({
    pages,
    narrationMode,
  });
  const preparedImages = new Map<number, PreparedImage>();
  const temporaryUrls: string[] = [];

  try {
    for (const [index, scene] of timeline.entries()) {
      const image = await prepareImage(scene.imageUrl, signal);
      preparedImages.set(scene.page, image);
      temporaryUrls.push(image.colorUrl, image.grayscaleUrl);
      onProgress?.({
        progress: 0.05 + ((index + 1) / timeline.length) * 0.15,
        message: `正在处理第 ${index + 1}/${timeline.length} 页插图`,
      });
    }

    const audioAssets = await prepareAudioAssets({
      pages,
      narrationMode,
      cachedAudioAssets,
      signal,
      onProgress,
    });
    const finalTimeline = createStoryVideoTimeline({
      pages,
      narrationMode,
      audioAssets,
    });
    const audioByPage = new Map(audioAssets.map((asset) => [asset.page, asset]));
    const renderScenes: StoryVideoRenderScene[] = [];
    for (const scene of finalTimeline) {
      const image = preparedImages.get(scene.page);
      if (!image) {
        throw new Error(`第 ${scene.page} 页插图处理失败。`);
      }

      const audioAsset = audioByPage.get(scene.page);
      let audioSrc: string | undefined;
      if (audioAsset) {
        const audioBlob = await awaitBlobFromDataUrl(audioAsset.audioDataUrl);
        audioSrc = URL.createObjectURL(audioBlob);
        temporaryUrls.push(audioSrc);
      }

      renderScenes.push({
        page: scene.page,
        subtitlePairs: scene.subtitlePairs,
        imageSrc: image.colorUrl,
        grayscaleImageSrc: image.grayscaleUrl,
        audioSrc,
        audioDurationSeconds: scene.audioDurationSeconds,
        durationInFrames: scene.durationInFrames,
        startFrame: scene.startFrame,
      });
    }
    const totalFrames = getStoryVideoTotalFrames(finalTimeline);
    if (totalFrames <= 0) {
      throw new Error("视频时间轴为空。");
    }

    const props: StoryVideoCompositionProps = {
      title,
      fps: STORY_VIDEO_FPS,
      narrationMode,
      scenes: renderScenes,
    };
    const { renderMediaOnWeb } = await import("@remotion/web-renderer");
    const licenseKey = process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY?.trim();
    onProgress?.({ progress: 0.5, message: "正在渲染竖屏视频" });
    const rendered = await renderMediaOnWeb({
      composition: {
        id: `storybloom-${Date.now()}`,
        component: StoryVideoComposition,
        durationInFrames: totalFrames,
        fps: STORY_VIDEO_FPS,
        width: STORY_VIDEO_WIDTH,
        height: STORY_VIDEO_HEIGHT,
        defaultProps: props,
      },
      inputProps: props,
      container: encodingPlan.container,
      videoCodec: encodingPlan.videoCodec,
      audioCodec: encodingPlan.audioCodec,
      muted: narrationMode === "none",
      videoBitrate: "high",
      audioBitrate: "high",
      hardwareAcceleration: "prefer-hardware",
      pageResponsiveness: "high",
      outputTarget: null,
      signal,
      logLevel: "warn",
      allowHtmlInCanvas: false,
      isProduction: process.env.NODE_ENV === "production",
      ...(licenseKey ? { licenseKey } : {}),
      onProgress: ({ progress }) => {
        onProgress?.({
          progress: 0.5 + progress * 0.5,
          message: "正在编码视频画面",
        });
      },
    });
    throwIfAborted(signal);
    const blob = await rendered.getBlob();
    onProgress?.({ progress: 1, message: "视频已生成" });

    return {
      blob,
      extension: encodingPlan.extension,
      mimeType: encodingPlan.mimeType,
      audioAssets,
    };
  } finally {
    temporaryUrls.forEach((url) => URL.revokeObjectURL(url));
  }
}

async function awaitBlobFromDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("配音资源读取失败。");
  }
  return response.blob();
}
