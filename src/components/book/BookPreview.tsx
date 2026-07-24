"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CopySimple,
  DownloadSimple,
  ImagesSquare,
  ShareNetwork,
  SpinnerGap,
} from "@phosphor-icons/react";
import SampleStoryImage from "@/components/book/SampleStoryImage";
import ShareLinkPanel from "@/components/book/ShareLinkPanel";
import StoryVideoPanel from "@/components/video/StoryVideoPanel";
import {
  getBrowserNarrationSegments,
  pickBrowserVoice,
} from "@/lib/browser-narration";
import { createZipBlob } from "@/lib/client-zip";
import type {
  GenerateResponse,
  SampleImageAssets,
  SampleImageModel,
  StoryPage,
} from "@/types";

type NarrationMode = "zh" | "en" | "zh-en";

const SAMPLE_IMAGE_MODELS: Array<{ id: SampleImageModel; label: string }> = [
  { id: "gpt-image-2", label: "GPT-Image-2" },
  { id: "nano-banana", label: "Nano Banana" },
];
const SAMPLE_IMAGE_MODEL_IDS = SAMPLE_IMAGE_MODELS.map((model) => model.id);

const NARRATION_OPTIONS: {
  mode: NarrationMode;
  label: string;
  generatingLabel: string;
  playingLabel: string;
}[] = [
  {
    mode: "zh",
    label: "中文",
    generatingLabel: "正在准备",
    playingLabel: "停止",
  },
  {
    mode: "en",
    label: "English",
    generatingLabel: "Preparing",
    playingLabel: "Stop",
  },
  {
    mode: "zh-en",
    label: "中英文",
    generatingLabel: "正在准备",
    playingLabel: "停止",
  },
];
const LIVE_IMAGE_REQUEST_CONCURRENCY = 4;
const ILLUSTRATION_POLL_INTERVAL_MS = 2500;
const ILLUSTRATION_STALE_THRESHOLD_MS = 3 * 60 * 1000;
const ILLUSTRATION_STALE_CLOCK_INTERVAL_MS = 5000;
const STORY_VIDEO_ENABLED =
  process.env.NEXT_PUBLIC_STORY_VIDEO_ENABLED !== "0";

interface Props {
  result: GenerateResponse;
  onBack: () => void;
  variant?: "own" | "sample" | "custom";
  backLabel?: string;
  onResultUpdate?: (result: GenerateResponse) => void;
  sampleBooks?: Array<
    GenerateResponse & {
      sampleMeta?: {
        themeLabel: string;
        ageLabel: string;
      };
    }
  >;
  onOpenSample?: (sample: GenerateResponse) => void;
}

function getPageLabel(page: StoryPage) {
  return page.page === 1 ? "封面" : `Page ${page.page}`;
}

function createSampleImageAssets(
  bookId: string,
  pageNumber: number,
): SampleImageAssets {
  return {
    placeholder: `/sample-books/${bookId}-${pageNumber}.svg`,
    variants: Object.fromEntries(
      SAMPLE_IMAGE_MODEL_IDS.map((model) => [
        model,
        `/sample-books/${model}/${bookId}/${pageNumber}.webp`,
      ]),
    ) as Record<SampleImageModel, string>,
  };
}

function getSampleBookId(result: GenerateResponse) {
  if (result.storyId.startsWith("sample-")) {
    return result.storyId.slice("sample-".length);
  }

  const firstImageUrl = result.pages[0]?.imageUrl || "";
  const match = firstImageUrl.match(
    /\/sample-books\/(?:[^/]+\/)?([^/.]+?)(?:\/\d+|-1)\.(?:webp|svg)$/,
  );

  return match?.[1] || null;
}

function isWaitingImagePage(page: StoryPage) {
  return page.imageStatus === "pending" || page.imageStatus === "demo";
}

function getImageStartedAtMs(page: StoryPage) {
  if (!page.imageStartedAt) {
    return null;
  }

  const startedAtMs = new Date(page.imageStartedAt).getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs : null;
}

function isStaleWaitingPage(page: StoryPage, nowMs: number) {
  if (!isWaitingImagePage(page)) {
    return false;
  }

  const startedAtMs = getImageStartedAtMs(page);
  if (startedAtMs === null) {
    return page.imageStatus === "demo";
  }

  return nowMs - startedAtMs > ILLUSTRATION_STALE_THRESHOLD_MS;
}

function getTimedOutImageError(useFreeFallback: boolean) {
  return useFreeFallback
    ? "免费生图模型超过 3 分钟仍未完成，请重新生成本页。"
    : "插图生成超过 3 分钟，已切换免费生图模型重试。";
}

type CanvasImage = HTMLImageElement & {
  cleanupObjectUrl?: () => void;
};

type SocialSharePreviewPage = {
  page: number;
  imageUrl: string;
};

async function createImage(src: string) {
  let imageSrc = src;
  let objectUrl: string | null = null;

  if (!src.startsWith("data:")) {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`图片加载失败，无法生成分享图：HTTP ${response.status}`);
    }

    objectUrl = URL.createObjectURL(await response.blob());
    imageSrc = objectUrl;
  }

  return new Promise<CanvasImage>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error("图片加载超时，无法生成分享图。"));
    }, 45_000);

    image.onload = () => {
      window.clearTimeout(timeout);
      if (objectUrl) {
        (image as CanvasImage).cleanupObjectUrl = () =>
          URL.revokeObjectURL(objectUrl);
      }
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error("图片加载失败，无法生成分享图。"));
    };
    image.src = imageSrc;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let current = "";

  for (const character of Array.from(text)) {
    const next = current + character;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trimEnd());
      current = character.trimStart();
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return lines;
}

function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let current = "";

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  maxLines?: number,
) {
  const visibleLines =
    typeof maxLines === "number" ? lines.slice(0, maxLines) : lines;
  visibleLines.forEach((line, index) => {
    const suffix =
      maxLines && index === maxLines - 1 && lines.length > maxLines
        ? "..."
        : "";
    ctx.fillText(`${line}${suffix}`, x, y + index * lineHeight);
  });

  return y + visibleLines.length * lineHeight;
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("社交分享图片生成失败。"));
      }
    }, "image/png");
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImage,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function getSingleLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, middle).join("")}…`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return `${characters.slice(0, low).join("")}…`;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 48);
}

function createBilingualStoryText(title: string, pages: StoryPage[]) {
  return [
    title,
    "",
    ...pages.map(
      (page) =>
        `Page ${page.page}\n中文：${page.zhText || ""}\nEnglish: ${page.enText || ""}`,
    ),
  ].join("\n\n");
}

function copyTextWithSelection(text: string) {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } finally {
    textarea.remove();
    if (activeElement?.isConnected) {
      activeElement.focus();
    }
  }
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Embedded browsers may deny clipboard permission; use selection fallback.
  }

  try {
    if (copyTextWithSelection(text)) {
      return;
    }
  } catch {
    // Use the same actionable message for unsupported legacy copy paths.
  }

  throw new Error("当前浏览器无法自动复制，请手动选择文本复制。");
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export default function BookPreview({
  result,
  onBack,
  variant = "own",
  backLabel,
  onResultUpdate,
  sampleBooks = [],
  onOpenSample,
}: Props) {
  const [pages, setPages] = useState(result.pages);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeNarration, setActiveNarration] = useState<NarrationMode | null>(
    null,
  );
  const [audioStatus, setAudioStatus] = useState<
    "idle" | "generating" | "playing"
  >("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<string | null>(null);
  const [narrationPlaybackKind, setNarrationPlaybackKind] = useState<
    "browser" | "audio" | null
  >(null);
  const [imageProgress, setImageProgress] = useState({
    complete: 0,
    total: result.pages.length,
  });
  const [shareStatus, setShareStatus] = useState<"idle" | "rendering">("idle");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [socialShareStatus, setSocialShareStatus] = useState<
    "idle" | "rendering" | "packing"
  >("idle");
  const [socialShareDialogOpen, setSocialShareDialogOpen] = useState(false);
  const [socialSharePreviewPages, setSocialSharePreviewPages] = useState<
    SocialSharePreviewPage[]
  >([]);
  const [socialShareTextCopied, setSocialShareTextCopied] = useState(false);
  const [socialShareCopyError, setSocialShareCopyError] = useState<
    string | null
  >(null);
  const [retryingPages, setRetryingPages] = useState<number[]>([]);
  const [activeImageActionsPage, setActiveImageActionsPage] = useState<
    number | null
  >(null);
  const [activeSampleImageModel, setActiveSampleImageModel] =
    useState<SampleImageModel>("gpt-image-2");
  const narrationRunRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const browserNarrationCancelRef = useRef<(() => void) | null>(null);
  const staticNarrationAvailabilityRef = useRef(
    new Map<string, Promise<boolean>>(),
  );
  const activeStoryIdRef = useRef(result.storyId);
  const requestedImagePagesRef = useRef(new Set<number>());
  const activeImageRequestsRef = useRef(new Set<number>());
  const freeFallbackRequestsRef = useRef(
    new Map<number, Promise<{ page: StoryPage; allComplete?: boolean }>>(),
  );
  const onResultUpdateRef = useRef(onResultUpdate);
  const lastPublishedPagesKeyRef = useRef("");
  const socialShareFilesRef = useRef<File[] | null>(null);
  const socialSharePreviewUrlsRef = useRef<string[]>([]);
  const socialShareSourceKeyRef = useRef("");
  const socialShareDialogRef = useRef<HTMLDivElement>(null);
  const socialShareCloseButtonRef = useRef<HTMLButtonElement>(null);
  const socialShareReturnFocusRef = useRef<HTMLElement | null>(null);
  const isSamplePreview = variant === "sample";
  const isCustomPreview = variant === "custom";
  const canRegenerateImages = !isSamplePreview && !isCustomPreview;
  const sampleBookId = useMemo(() => getSampleBookId(result), [result]);
  const socialShareBilingualText = useMemo(
    () => createBilingualStoryText(result.coverTitle, pages),
    [pages, result.coverTitle],
  );

  function getSamplePageImage(page: StoryPage) {
    if (sampleBookId) {
      return createSampleImageAssets(sampleBookId, page.page);
    }

    return page.sampleImage ?? null;
  }

  function revokeSocialSharePreviewUrls() {
    socialSharePreviewUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    socialSharePreviewUrlsRef.current = [];
  }

  function clearSocialSharePreview() {
    revokeSocialSharePreviewUrls();
    socialShareFilesRef.current = null;
    socialShareSourceKeyRef.current = "";
    setSocialSharePreviewPages([]);
    setSocialShareTextCopied(false);
    setSocialShareCopyError(null);
    setSocialShareDialogOpen(false);
  }

  function stopNarrationPlayback() {
    browserNarrationCancelRef.current?.();
    browserNarrationCancelRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.onended = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onerror = null;
    audio.removeAttribute("src");
    audio.load();
  }

  function hasStaticNarrationAsset(url: string) {
    const existing = staticNarrationAvailabilityRef.current.get(url);
    if (existing) {
      return existing;
    }

    const request = fetch(url, { method: "HEAD", cache: "no-store" })
      .then((response) => response.ok)
      .catch(() => false);
    staticNarrationAvailabilityRef.current.set(url, request);
    return request;
  }

  function getSocialShareSourceKey() {
    return [
      result.storyId,
      result.coverTitle,
      ...pages.map((page) =>
        [
          page.page,
          page.imageCompletedAt || "",
          page.imageUrl?.length || 0,
          page.zhText,
          page.enText,
        ].join(":"),
      ),
    ].join("|");
  }

  useEffect(() => {
    onResultUpdateRef.current = onResultUpdate;
  }, [onResultUpdate]);

  useEffect(() => {
    return () => {
      socialSharePreviewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      narrationRunRef.current += 1;
      stopNarrationPlayback();
    };
  }, []);

  function shouldUseTapImageActions() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches
    );
  }

  function getIllustrationRequestBody(
    pageNumber: number,
    useFreeFallback = false,
  ) {
    return {
      storyId: result.storyId,
      page: pageNumber,
      regenerationMode: useFreeFallback ? "free-fallback" : undefined,
    };
  }

  function replacePageInState(updatedPage: StoryPage) {
    setPages((current) => {
      const next = current.map((item) =>
        item.page === updatedPage.page ? updatedPage : item,
      );
      setImageProgress({
        complete: next.filter((page) => page.imageStatus === "complete").length,
        total: next.length,
      });
      return next;
    });
  }

  async function wait(ms: number) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function pollIllustrationPage(
    pageNumber: number,
    useFreeFallback: boolean,
    requestStartedAtMs: number,
  ): Promise<{ page: StoryPage; allComplete?: boolean }> {
    const deadlineMs = requestStartedAtMs + ILLUSTRATION_STALE_THRESHOLD_MS;

    while (Date.now() < deadlineMs) {
      await wait(
        Math.min(
          ILLUSTRATION_POLL_INTERVAL_MS,
          Math.max(0, deadlineMs - Date.now()),
        ),
      );

      const response = await fetch(
        `/api/illustration?storyId=${encodeURIComponent(result.storyId)}&page=${pageNumber}`,
      );
      const data = (await response.json().catch(() => null)) as {
        page?: StoryPage;
        error?: string;
        allComplete?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "插图状态查询失败。");
      }

      if (!data?.page) {
        continue;
      }

      if (activeStoryIdRef.current !== result.storyId) {
        throw new Error("Story changed before illustration finished.");
      }

      if (data.page.imageStatus === "complete") {
        return { page: data.page, allComplete: data.allComplete };
      }

      if (data.page.imageStatus === "failed") {
        throw new Error(data.page.imageError || data.error || "插图生成失败。");
      }

      if (!useFreeFallback && isStaleWaitingPage(data.page, Date.now())) {
        console.warn(
          "[BookPreview] Page " +
            pageNumber +
            " still waiting, retrying with free fallback",
        );
        return requestIllustrationPage(pageNumber, true);
      }
    }

    if (!useFreeFallback) {
      console.warn(
        "[BookPreview] Page " +
          pageNumber +
          " exceeded 3 min, retrying with free fallback",
      );
      return requestIllustrationPage(pageNumber, true);
    }

    throw new Error(getTimedOutImageError(true));
  }

  async function requestIllustrationPage(
    pageNumber: number,
    useFreeFallback = false,
  ): Promise<{ page: StoryPage; allComplete?: boolean }> {
    if (useFreeFallback) {
      const existingRequest = freeFallbackRequestsRef.current.get(pageNumber);
      if (existingRequest) {
        return existingRequest;
      }
    }

    const request = doRequestIllustrationPage(pageNumber, useFreeFallback);
    activeImageRequestsRef.current.add(pageNumber);
    void request.then(
      () => {
        activeImageRequestsRef.current.delete(pageNumber);
      },
      () => {
        activeImageRequestsRef.current.delete(pageNumber);
      },
    );

    if (useFreeFallback) {
      freeFallbackRequestsRef.current.set(pageNumber, request);
      void request.then(
        () => {
          freeFallbackRequestsRef.current.delete(pageNumber);
        },
        () => {
          freeFallbackRequestsRef.current.delete(pageNumber);
        },
      );
    }

    return request;
  }

  async function doRequestIllustrationPage(
    pageNumber: number,
    useFreeFallback: boolean,
  ): Promise<{ page: StoryPage; allComplete?: boolean }> {
    const requestStartedAtMs = Date.now();
    const response = await fetch("/api/illustration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        getIllustrationRequestBody(pageNumber, useFreeFallback),
      ),
    });
    const data = (await response.json()) as {
      status?: "accepted";
      page?: StoryPage;
      error?: string;
      allComplete?: boolean;
    };

    if (response.status === 202 || data.status === "accepted") {
      if (data.page) {
        replacePageInState(data.page);
      }
      return pollIllustrationPage(
        pageNumber,
        useFreeFallback,
        data.page
          ? (getImageStartedAtMs(data.page) ?? requestStartedAtMs)
          : requestStartedAtMs,
      );
    }

    if (!response.ok || data.error || !data.page) {
      throw new Error(data.error || "插图生成失败。");
    }

    return { page: data.page, allComplete: data.allComplete };
  }

  useEffect(() => {
    if (activeStoryIdRef.current !== result.storyId) {
      narrationRunRef.current += 1;
      stopNarrationPlayback();
      activeStoryIdRef.current = result.storyId;
      requestedImagePagesRef.current.clear();
      activeImageRequestsRef.current.clear();
      freeFallbackRequestsRef.current.clear();
      setActiveNarration(null);
      setAudioStatus("idle");
      setAudioError(null);
      setAudioMeta(null);
      setNarrationPlaybackKind(null);
    }

    setPages(result.pages);
    setNowMs(Date.now());
    setImageProgress({
      complete: result.pages.filter((page) => page.imageStatus === "complete")
        .length,
      total: result.pages.length,
    });
    setShareError(null);
    setShareImageUrl(null);
    setShareDialogOpen(false);
    clearSocialSharePreview();
    setSocialShareStatus("idle");
    setActiveImageActionsPage(null);
  }, [result.storyId]);

  const shareDialogRef = useRef<HTMLDivElement>(null);
  const hasTimedPendingImages = pages.some(
    (page) => isWaitingImagePage(page) && Boolean(page.imageStartedAt),
  );

  useEffect(() => {
    if (!hasTimedPendingImages) {
      return;
    }

    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, ILLUSTRATION_STALE_CLOCK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasTimedPendingImages]);

  useEffect(() => {
    if (!shareDialogOpen) {
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => {
      shareDialogRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShareDialogOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [shareDialogOpen]);

  useEffect(() => {
    if (!socialShareDialogOpen) {
      return;
    }

    socialShareReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      socialShareCloseButtonRef.current?.focus();
    });

    function handleSocialShareDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSocialShareDialogOpen(false);
        return;
      }

      if (event.key !== "Tab" || !socialShareDialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        socialShareDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      } else if (!socialShareDialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleSocialShareDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleSocialShareDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      if (socialShareReturnFocusRef.current?.isConnected) {
        socialShareReturnFocusRef.current.focus();
      }
      socialShareReturnFocusRef.current = null;
    };
  }, [socialShareDialogOpen]);

  function handleDownloadShareImage() {
    if (!shareImageUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = shareImageUrl;
    link.download = `storybloom-${result.storyId}.png`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function createSocialShareFiles() {
    if (!allImagesReady) {
      throw new Error("还有页面缺少插图，暂时无法生成社交分享包。");
    }

    const loadedImages = await Promise.all(
      pages.map((page) => (page.imageUrl ? createImage(page.imageUrl) : null)),
    );

    try {
      const files: File[] = [];
      const width = 1080;
      const height = 1440;
      const textX = 72;
      const textMaxWidth = width - textX * 2;

      for (const [index, page] of pages.entries()) {
        const image = loadedImages[index];
        if (!image) {
          continue;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("当前浏览器不支持 Canvas。");
        }

        drawImageCover(ctx, image, width, height);
        ctx.font = "700 40px Microsoft YaHei, sans-serif";
        const zhLines = page.zhText
          ? wrapText(ctx, page.zhText, textMaxWidth)
          : [];
        ctx.font = "400 28px Arial, sans-serif";
        const enLines = page.enText
          ? wrapWords(ctx, page.enText, textMaxWidth)
          : [];
        const visibleZhLines = Math.min(3, zhLines.length);
        const visibleEnLines = Math.min(3, enLines.length);
        const languageGap = visibleZhLines > 0 && visibleEnLines > 0 ? 12 : 0;
        const textBlockHeight =
          visibleZhLines * 54 + languageGap + visibleEnLines * 40;
        const textTop = height - 62 - textBlockHeight;

        const overlay = ctx.createLinearGradient(
          0,
          Math.max(700, textTop - 190),
          0,
          height,
        );
        overlay.addColorStop(0, "rgba(25, 18, 14, 0)");
        overlay.addColorStop(0.52, "rgba(25, 18, 14, 0.28)");
        overlay.addColorStop(1, "rgba(25, 18, 14, 0.88)");
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "rgba(255, 252, 247, 0.9)";
        ctx.font = "700 25px Arial, Microsoft YaHei, sans-serif";
        ctx.fillText(`STORYBLOOM  ·  ${String(page.page).padStart(2, "0")}`, textX, 76);

        ctx.textBaseline = "top";
        let textY = textTop;
        ctx.fillStyle = "#fffaf4";
        ctx.font = "700 40px Microsoft YaHei, sans-serif";
        if (visibleZhLines > 0) {
          textY = drawWrappedText(ctx, zhLines, textX, textY, 54, 3);
        }
        if (visibleEnLines > 0) {
          textY += languageGap;
          ctx.fillStyle = "rgba(255, 250, 244, 0.82)";
          ctx.font = "400 28px Arial, sans-serif";
          drawWrappedText(ctx, enLines, textX, textY, 40, 3);
        }
        ctx.textBaseline = "alphabetic";

        const pngBlob = await canvasToPngBlob(canvas);
        files.push(
          new File(
            [pngBlob],
            `images/page-${String(page.page).padStart(2, "0")}.png`,
            { type: "image/png" },
          ),
        );
      }

      const readme = [
        "StoryBloom 社交分享包",
        "",
        "images/：适合微信、小红书发布的逐页图片，图片底部已叠加中英文文字。",
        "story-bilingual.txt：按 Page 1 到 Page 8 排列的中英文故事全文。",
      ].join("\n");

      files.push(
        new File([socialShareBilingualText], "story-bilingual.txt", {
          type: "text/plain;charset=utf-8",
        }),
        new File([readme], "README.txt", { type: "text/plain;charset=utf-8" }),
      );
      return files;
    } finally {
      loadedImages.forEach((image) => image?.cleanupObjectUrl?.());
    }
  }

  async function getOrCreateSocialShareFiles() {
    const sourceKey = getSocialShareSourceKey();
    if (
      socialShareFilesRef.current &&
      socialShareSourceKeyRef.current === sourceKey
    ) {
      return socialShareFilesRef.current;
    }

    const storyId = result.storyId;
    const files = await createSocialShareFiles();
    if (activeStoryIdRef.current !== storyId) {
      throw new Error("绘本已切换，请重新打开分享预览。");
    }

    const imageFiles = files.filter((file) =>
      file.name.startsWith("images/page-"),
    );
    if (imageFiles.length !== pages.length) {
      throw new Error("社交分享图片没有生成完整，请重试。");
    }

    revokeSocialSharePreviewUrls();
    const previewUrls = imageFiles.map((file) => URL.createObjectURL(file));
    socialSharePreviewUrlsRef.current = previewUrls;
    socialShareFilesRef.current = files;
    socialShareSourceKeyRef.current = sourceKey;
    setSocialSharePreviewPages(
      pages.map((page, index) => ({
        page: page.page,
        imageUrl: previewUrls[index],
      })),
    );
    return files;
  }

  async function handleOpenSocialSharePreview() {
    setSocialShareStatus("rendering");
    setShareError(null);
    setSocialShareTextCopied(false);
    setSocialShareCopyError(null);
    try {
      await getOrCreateSocialShareFiles();
      setSocialShareDialogOpen(true);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "社交分享预览生成失败。",
      );
    } finally {
      setSocialShareStatus("idle");
    }
  }

  async function handleCopySocialShareText() {
    try {
      await copyTextToClipboard(socialShareBilingualText);
      setSocialShareTextCopied(true);
      setSocialShareCopyError(null);
      setShareError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "复制失败，请手动复制。";
      setSocialShareTextCopied(false);
      setSocialShareCopyError(message);
      setShareError(message);
    }
  }

  async function handleDownloadSocialPack() {
    setSocialShareStatus("packing");
    setShareError(null);
    try {
      const files = await getOrCreateSocialShareFiles();
      const zip = await createZipBlob(
        files.map((file) => ({ name: file.name, data: file })),
      );
      downloadBlob(
        zip,
        `storybloom-${sanitizeFileName(result.coverTitle)}-social.zip`,
      );
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "社交分享包生成失败。",
      );
    } finally {
      setSocialShareStatus("idle");
    }
  }

  useEffect(() => {
    if (!canRegenerateImages) {
      return;
    }

    async function generateLiveImages() {
      const pendingPages = result.pages.filter((page) => {
        if (
          page.imageStatus === "complete" ||
          requestedImagePagesRef.current.has(page.page)
        ) {
          return false;
        }

        requestedImagePagesRef.current.add(page.page);
        return true;
      });

      if (pendingPages.length === 0) {
        return;
      }

      const startedAt = new Date().toISOString();
      const pendingPageNumbers = new Set(pendingPages.map((page) => page.page));
      setPages((current) =>
        current.map((item) =>
          pendingPageNumbers.has(item.page)
            ? {
                ...item,
                imageStatus: "pending" as const,
                imageStartedAt: item.imageStartedAt || startedAt,
              }
            : item,
        ),
      );

      let nextIndex = 0;

      async function worker() {
        while (nextIndex < pendingPages.length) {
          const page = pendingPages[nextIndex];
          nextIndex += 1;

          try {
            const data = await requestIllustrationPage(page.page);

            if (activeStoryIdRef.current !== result.storyId) {
              return;
            }

            replacePageInState(data.page);
          } catch (error) {
            if (activeStoryIdRef.current !== result.storyId) {
              return;
            }

            setPages((current) =>
              current.map((item) =>
                item.page === page.page
                  ? {
                      ...item,
                      imageStatus: "failed" as const,
                      imageError:
                        error instanceof Error
                          ? error.message
                          : "插图生成失败。",
                    }
                  : item,
              ),
            );
          }
        }
      }

      await Promise.all(
        Array.from(
          {
            length: Math.min(
              LIVE_IMAGE_REQUEST_CONCURRENCY,
              pendingPages.length,
            ),
          },
          () => worker(),
        ),
      );
    }

    generateLiveImages();
  }, [canRegenerateImages, result.storyId, result.pages]);

  useEffect(() => {
    if (!canRegenerateImages) {
      return;
    }

    const stalePages = pages.filter(
      (page) =>
        isStaleWaitingPage(page, nowMs) &&
        !retryingPages.includes(page.page) &&
        !activeImageRequestsRef.current.has(page.page) &&
        !freeFallbackRequestsRef.current.has(page.page),
    );

    stalePages.forEach((page) => {
      handleRetryPage(page.page);
    });
  }, [canRegenerateImages, nowMs, pages, retryingPages]);

  const allImagesReady = useMemo(
    () =>
      pages.length === result.totalPages &&
      pages.every(
        (page) => Boolean(page.imageUrl) && page.imageStatus === "complete",
      ),
    [pages, result.totalPages],
  );
  const hasDemoImages = pages.some((page) => page.imageStatus === "demo");
  const hasPendingImages = pages.some(
    (page) => page.imageStatus === "pending" || page.imageStatus === "demo",
  );
  useEffect(() => {
    if (!canRegenerateImages || !onResultUpdateRef.current) {
      return;
    }

    const pagesKey = JSON.stringify(
      pages.map((page) => ({
        page: page.page,
        imageUrl: page.imageUrl,
        imageStatus: page.imageStatus,
        imageError: page.imageError,
        imageStartedAt: page.imageStartedAt,
        imageCompletedAt: page.imageCompletedAt,
      })),
    );
    if (lastPublishedPagesKeyRef.current === pagesKey) {
      return;
    }

    lastPublishedPagesKeyRef.current = pagesKey;
    onResultUpdateRef.current({
      ...result,
      pages,
      totalPages: pages.length,
      imagesPending: hasPendingImages,
    });
  }, [hasPendingImages, canRegenerateImages, pages, result.storyId]);

  function getNarrationOption(mode: NarrationMode) {
    return (
      NARRATION_OPTIONS.find((item) => item.mode === mode) ||
      NARRATION_OPTIONS[0]
    );
  }

  function speakBrowserSegment(
    segment: ReturnType<typeof getBrowserNarrationSegments>[number],
  ) {
    return new Promise<void>((resolve, reject) => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        reject(new Error("当前浏览器不支持本机语音朗读。"));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      utterance.rate = segment.lang === "zh-CN" ? 0.88 : 0.92;
      utterance.pitch = 1;
      utterance.voice = pickBrowserVoice(
        window.speechSynthesis.getVoices(),
        segment.lang,
      );

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (browserNarrationCancelRef.current === finish) {
          browserNarrationCancelRef.current = null;
        }
        resolve();
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        if (browserNarrationCancelRef.current === finish) {
          browserNarrationCancelRef.current = null;
        }
        reject(new Error(message));
      };

      browserNarrationCancelRef.current = finish;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") {
          finish();
          return;
        }
        fail("本机语音朗读失败，请检查浏览器语音设置。");
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  async function handleRetryPage(pageNumber: number) {
    if (freeFallbackRequestsRef.current.has(pageNumber)) {
      return;
    }

    setActiveImageActionsPage(null);
    const storyId = result.storyId;
    const startedAt = new Date().toISOString();
    setRetryingPages((current) =>
      current.includes(pageNumber) ? current : [...current, pageNumber],
    );
    setPages((current) =>
      current.map((page) =>
        page.page === pageNumber
          ? {
              ...page,
              imageStatus: "pending" as const,
              imageError: undefined,
              imageStartedAt: startedAt,
              imageCompletedAt: undefined,
              imageDurationMs: undefined,
            }
          : page,
      ),
    );

    try {
      const data = await requestIllustrationPage(pageNumber, true);

      if (activeStoryIdRef.current !== storyId) {
        return;
      }

      replacePageInState(data.page);
    } catch (error) {
      if (activeStoryIdRef.current !== storyId) {
        return;
      }

      setPages((current) =>
        current.map((page) =>
          page.page === pageNumber
            ? {
                ...page,
                imageStatus: "failed" as const,
                imageError:
                  error instanceof Error ? error.message : "插图生成失败。",
              }
            : page,
        ),
      );
    } finally {
      if (activeStoryIdRef.current === storyId) {
        setRetryingPages((current) =>
          current.filter((page) => page !== pageNumber),
        );
      }
    }
  }

  async function handleNarration(mode: NarrationMode) {
    const segments = getBrowserNarrationSegments(pages, mode);
    if (!segments.length) {
      setAudioError("当前语言模式没有可朗读文本。");
      return;
    }

    narrationRunRef.current += 1;
    const runId = narrationRunRef.current;
    const shouldStop =
      activeNarration === mode &&
      (audioStatus === "generating" || audioStatus === "playing");
    stopNarrationPlayback();
    if (shouldStop) {
      setActiveNarration(null);
      setAudioStatus("idle");
      setAudioMeta(null);
      return;
    }

    setAudioError(null);
    setAudioMeta(null);
    setActiveNarration(mode);
    setAudioStatus("generating");

    try {
      const staticNarrationUrl =
        mode === "zh" ? result.narrationAudio?.url : undefined;
      const hasStaticNarration =
        Boolean(staticNarrationUrl) &&
        (await hasStaticNarrationAsset(staticNarrationUrl || ""));

      if (
        narrationRunRef.current !== runId ||
        activeStoryIdRef.current !== result.storyId
      ) {
        return;
      }

      if (hasStaticNarration && staticNarrationUrl) {
        const audio = audioRef.current;
        if (!audio) {
          throw new Error("浏览器音频播放器未准备好。");
        }

        setNarrationPlaybackKind("audio");
        setAudioMeta("精选绘本预生成音频 · 本次不产生 TTS 费用");
        audio.src = staticNarrationUrl;
        audio.load();
        audio.onplay = () => {
          if (narrationRunRef.current === runId) {
            setActiveNarration(mode);
            setAudioStatus("playing");
          }
        };
        audio.onpause = () => {
          if (narrationRunRef.current === runId && !audio.ended) {
            setActiveNarration(null);
            setAudioStatus("idle");
          }
        };
        audio.onended = () => {
          if (narrationRunRef.current === runId) {
            setActiveNarration(null);
            setAudioStatus("idle");
          }
        };
        audio.onerror = () => {
          if (narrationRunRef.current === runId) {
            setAudioError("音频加载失败，请重试。");
            setActiveNarration(null);
            setAudioStatus("idle");
          }
        };

        try {
          await audio.play();
        } catch {
          setActiveNarration(null);
          setAudioStatus("idle");
          setAudioMeta("精选音频已准备好，请点击播放器开始");
        }
        return;
      }

      if (!("speechSynthesis" in window)) {
        throw new Error("当前浏览器不支持本机语音朗读。");
      }

      setNarrationPlaybackKind("browser");
      setAudioMeta("本机系统语音 · 不调用付费 TTS");
      setAudioStatus("playing");
      for (const segment of segments) {
        if (
          narrationRunRef.current !== runId ||
          activeStoryIdRef.current !== result.storyId
        ) {
          return;
        }
        await speakBrowserSegment(segment);
      }

      if (narrationRunRef.current === runId) {
        setActiveNarration(null);
        setAudioStatus("idle");
      }
    } catch (error) {
      if (narrationRunRef.current === runId) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAudioError(
          error instanceof Error ? error.message : "音频生成失败。",
        );
        setActiveNarration(null);
        setAudioStatus("idle");
      }
    }
  }

  async function handleShareImage() {
    if (!allImagesReady) {
      setShareError("还有页面缺少插图，暂时无法生成分享图。");
      return;
    }

    setShareStatus("rendering");
    setShareError(null);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("当前浏览器不支持 Canvas。");
      }

      const width = 1080;
      const padding = 48;
      const gap = 24;
      const columns = 2;
      const cardWidth = (width - padding * 2 - gap) / columns;
      const imageSize = cardWidth;
      const cardPadding = 24;
      const textWidth = cardWidth - cardPadding * 2;
      const loadedImages = await Promise.all(
        pages.map((page) =>
          page.imageUrl ? createImage(page.imageUrl) : null,
        ),
      );

      ctx.font = "700 28px Microsoft YaHei, sans-serif";
      const layouts = pages.map((page) => {
        ctx.font = "700 28px Microsoft YaHei, sans-serif";
        const zhLines = page.zhText
          ? wrapText(ctx, page.zhText, textWidth)
          : [];
        ctx.font = "400 23px Arial, sans-serif";
        const enLines = page.enText
          ? wrapText(ctx, page.enText, textWidth)
          : [];
        const textHeight =
          cardPadding * 2 +
          zhLines.slice(0, 2).length * 38 +
          enLines.slice(0, 3).length * 32 +
          16;
        return {
          zhLines,
          enLines,
          height: imageSize + Math.max(150, textHeight),
        };
      });

      const headerHeight = 210;
      const rowHeights = Array.from(
        { length: Math.ceil(pages.length / columns) },
        (_, rowIndex) => {
          const first = layouts[rowIndex * columns]?.height || 0;
          const second = layouts[rowIndex * columns + 1]?.height || 0;
          return Math.max(first, second);
        },
      );
      const height =
        headerHeight +
        rowHeights.reduce((sum, rowHeight) => sum + rowHeight + gap, 0) +
        padding;

      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#f7efe6";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#2f241d";
      ctx.font = "800 54px Microsoft YaHei, sans-serif";
      ctx.fillText(result.coverTitle, padding, 86);
      ctx.fillStyle = "#736156";
      ctx.font = "400 28px Microsoft YaHei, sans-serif";
      ctx.fillText("StoryBloom · AI 儿童绘本", padding, 132);
      ctx.fillText(hasDemoImages ? "本地演示图" : "真实插图版本", padding, 172);

      pages.forEach((page, index) => {
        const layout = layouts[index];
        const image = loadedImages[index];
        const row = Math.floor(index / columns);
        const column = index % columns;
        const cardX = padding + column * (cardWidth + gap);
        const cardY =
          headerHeight +
          rowHeights
            .slice(0, row)
            .reduce((sum, rowHeight) => sum + rowHeight + gap, 0);

        roundedRect(ctx, cardX, cardY, cardWidth, rowHeights[row], 24);
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.fill();

        if (image) {
          roundedRect(ctx, cardX, cardY, imageSize, imageSize, 24);
          ctx.save();
          ctx.clip();
          ctx.drawImage(image, cardX, cardY, imageSize, imageSize);
          ctx.restore();
        }

        let textY = cardY + imageSize + cardPadding + 10;
        const textX = cardX + cardPadding;
        if (layout.zhLines.length > 0) {
          ctx.fillStyle = "#2f241d";
          ctx.font = "700 28px Microsoft YaHei, sans-serif";
          textY =
            drawWrappedText(ctx, layout.zhLines, textX, textY, 38, 2) + 18;
        }

        if (layout.enLines.length > 0) {
          ctx.fillStyle = "#736156";
          ctx.font = "400 23px Arial, sans-serif";
          drawWrappedText(ctx, layout.enLines, textX, textY, 32, 3);
        }
      });

      loadedImages.forEach((image) => image?.cleanupObjectUrl?.());

      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl === "data:,") {
        throw new Error("分享图生成失败。");
      }

      setShareImageUrl(dataUrl);
      setShareDialogOpen(true);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "分享图生成失败。",
      );
    } finally {
      setShareStatus("idle");
    }
  }

  return (
    <div className="preview-wrap">
      {variant !== "own" ? (
        <button className="back-btn" onClick={onBack}>
          ← {backLabel || "返回重新生成"}
        </button>
      ) : null}

      <section className="preview-header">
        <div className="preview-badge">
          {isSamplePreview
            ? "精选绘本 · 等待时先读一本"
            : isCustomPreview
              ? `${result.freeChanceLabel} · ${result.totalPages} 页成品`
            : hasDemoImages
              ? "本地演示图 · 仅用于流程验收"
              : result.freeChanceLabel}
        </div>
        <h2>{result.coverTitle}</h2>
        <p>
          {isSamplePreview
            ? "这是一本文字和插图都已准备好的精选绘本，可以在等待专属绘本时先读。"
            : isCustomPreview
              ? "这是一套已完成的绘本案例，可以查看成品节奏、画面一致性，也可以生成分享长图。"
            : `这次已经生成完整 ${result.totalPages} 页内容。${
                allImagesReady
                  ? " 可以直接朗读、预览，或生成一张适合分享的 PNG 长图。"
                  : ` 故事主线已完成，插图正在逐张替换（${imageProgress.complete}/${imageProgress.total}）。`
              }`}
        </p>
      </section>

      <section className="storybook-tools" aria-label="绘本工具">
        <div className="tool-panel">
          <div>
            <h3>朗读</h3>
            <p>
              使用当前设备的系统语音朗读，不调用付费 TTS。精选绘本中文会复用已有音频。
            </p>
          </div>
          <div className="segmented-buttons">
            {NARRATION_OPTIONS.map((item) => (
              <button
                key={item.mode}
                type="button"
                className={`secondary-btn ${activeNarration === item.mode ? "secondary-btn-active" : ""}`}
                onClick={() => handleNarration(item.mode)}
                disabled={audioStatus === "generating"}
              >
                {activeNarration === item.mode
                  ? audioStatus === "generating"
                    ? getNarrationOption(item.mode).generatingLabel
                    : getNarrationOption(item.mode).playingLabel
                  : item.label}
              </button>
            ))}
          </div>
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            className="audio-player"
            hidden={narrationPlaybackKind !== "audio"}
          />
          {audioMeta ? <p className="tool-meta">{audioMeta}</p> : null}
          {audioError ? <div className="tool-error">{audioError}</div> : null}
        </div>
      </section>

      {shareDialogOpen && shareImageUrl ? (
        <div
          className="share-dialog-backdrop"
          role="presentation"
          onClick={() => setShareDialogOpen(false)}
        >
          <div
            className="share-dialog"
            ref={shareDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="分享长图预览"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="share-dialog-header">
              <div>
                <h3>分享长图预览</h3>
                <p>图片已由 Canvas 生成，手机上可长按图片保存。</p>
              </div>
              <button
                type="button"
                className="share-dialog-close"
                aria-label="关闭分享长图预览"
                onClick={() => setShareDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="share-dialog-body">
              <img src={shareImageUrl} alt="生成的分享长图预览" />
            </div>
            <div className="share-dialog-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShareDialogOpen(false)}
              >
                关闭
              </button>
              <button
                type="button"
                className="cta-btn share-download-link"
                onClick={handleDownloadShareImage}
              >
                下载 PNG
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {typeof document !== "undefined" &&
      socialShareDialogOpen &&
      socialSharePreviewPages.length > 0
        ? createPortal(
            <div
              className="share-dialog-backdrop social-share-dialog-backdrop"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setSocialShareDialogOpen(false);
                }
              }}
            >
              <div
                ref={socialShareDialogRef}
                className="share-dialog social-share-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="social-share-dialog-title"
              >
                <div className="share-dialog-header">
                  <div>
                    <h3 id="social-share-dialog-title">8 页社交分享预览</h3>
                  </div>
                  <button
                    ref={socialShareCloseButtonRef}
                    type="button"
                    className="share-dialog-close"
                    aria-label="关闭社交分享预览"
                    onClick={() => setSocialShareDialogOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="share-dialog-body social-share-dialog-body">
                  <div className="social-share-preview-grid">
                    {socialSharePreviewPages.map((page) => (
                      <article
                        key={page.page}
                        className="social-share-preview-card"
                      >
                        <img
                          src={page.imageUrl}
                          alt={`第 ${page.page} 页社交分享图片，图片内含中英文故事文字`}
                        />
                      </article>
                    ))}
                  </div>
                  <section
                    className="social-share-text-panel"
                    aria-labelledby="social-share-text-title"
                  >
                    <div className="social-share-text-header">
                      <div className="social-share-text-meta">
                        <strong id="social-share-text-title">
                          story-bilingual.txt
                        </strong>
                        <span>完整 8 页中英文文本</span>
                      </div>
                      <div className="social-share-copy-action">
                        <span aria-live="polite">
                          {socialShareTextCopied ? "已复制" : ""}
                        </span>
                        <button
                          type="button"
                          className="social-share-copy-btn"
                          onClick={handleCopySocialShareText}
                          aria-label={
                            socialShareTextCopied
                              ? "完整故事文本已复制"
                              : "一键复制完整故事文本"
                          }
                          title={
                            socialShareTextCopied
                              ? "已复制"
                              : "复制 TXT 文本"
                          }
                        >
                          {socialShareTextCopied ? (
                            <Check aria-hidden="true" />
                          ) : (
                            <CopySimple aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    {socialShareCopyError ? (
                      <p className="social-share-copy-error" role="alert">
                        {socialShareCopyError}
                      </p>
                    ) : null}
                    <pre>{socialShareBilingualText}</pre>
                  </section>
                </div>
                <div className="share-dialog-actions social-share-dialog-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setSocialShareDialogOpen(false)}
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    className="cta-btn"
                    disabled={socialShareStatus === "packing"}
                    onClick={handleDownloadSocialPack}
                  >
                    {socialShareStatus === "packing"
                      ? "正在打包…"
                      : "一键下载 ZIP"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isSamplePreview ? (
        <div className="sample-model-tabs" aria-label="切换生图模型效果">
          {SAMPLE_IMAGE_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              className={`sample-model-tab ${
                activeSampleImageModel === model.id
                  ? "sample-model-tab-active"
                  : ""
              }`}
              aria-pressed={activeSampleImageModel === model.id}
              onClick={() => setActiveSampleImageModel(model.id)}
            >
              {model.label}
            </button>
          ))}
        </div>
      ) : null}

      <section
        className="pages-grid"
        data-sample-model={isSamplePreview ? activeSampleImageModel : undefined}
      >
        {pages.map((page) => {
          const sampleImage = isSamplePreview ? getSamplePageImage(page) : null;

          return (
          <article
            key={page.page}
            className="page-card"
            aria-label={getPageLabel(page)}
          >
            <div
              className={`page-image-frame ${
                page.imageStatus === "pending" ||
                page.imageStatus === "demo" ||
                page.imageStatus === "failed"
                  ? "page-image-frame-loading"
                  : ""
              } ${activeImageActionsPage === page.page ? "page-image-frame-actions-open" : ""}`}
              onClick={() => {
                if (
                  page.imageStatus === "complete" &&
                  shouldUseTapImageActions()
                ) {
                  setActiveImageActionsPage((current) =>
                    current === page.page ? null : page.page,
                  );
                }
              }}
            >
              {sampleImage ? (
                <div className="page-image-stack">
                  <SampleStoryImage
                    placeholderSrc={sampleImage.placeholder}
                    realSrc={sampleImage.variants[activeSampleImageModel]}
                    alt={`Story page ${page.page}`}
                  />
                </div>
              ) : page.imageUrl ? (
                <img
                  src={page.imageUrl}
                  alt={`Story page ${page.page}`}
                  className="page-image"
                  data-provider={
                    page.imageProvider || page.imagePlannedProvider || ""
                  }
                  data-status={page.imageStatus || ""}
                  data-duration-ms={page.imageDurationMs ?? ""}
                  data-attempts={
                    page.imageAttempts ? page.imageAttempts.length : 0
                  }
                />
              ) : (
                <div
                  className="page-image placeholder"
                  data-planned-provider={page.imagePlannedProvider || ""}
                >
                  {page.imageStatus === "failed"
                    ? "插图生成失败，请稍后重试"
                    : "插图生成中"}
                </div>
              )}
              {page.imageStatus === "pending" || page.imageStatus === "demo" ? (
                <div className="image-loading-badge">
                  {page.imageStatus === "pending"
                    ? "正在替换真实插图"
                    : "等待生成"}
                </div>
              ) : null}
              {page.imageStatus === "failed" ? (
                <div className="image-error-badge">
                  {page.imageError || "插图生成失败，请重新生成本页"}
                </div>
              ) : null}
              {canRegenerateImages && isStaleWaitingPage(page, nowMs) ? (
                <button
                  type="button"
                  className="image-retry-btn"
                  onClick={() => handleRetryPage(page.page)}
                  disabled={retryingPages.includes(page.page)}
                >
                  {retryingPages.includes(page.page)
                    ? "正在重试..."
                    : "重新生成本页"}
                </button>
              ) : null}
              {canRegenerateImages && page.imageStatus === "failed" ? (
                <button
                  type="button"
                  className="image-retry-btn"
                  onClick={() => handleRetryPage(page.page)}
                  disabled={retryingPages.includes(page.page)}
                >
                  {retryingPages.includes(page.page)
                    ? "正在重试..."
                    : "重新生成本页"}
                </button>
              ) : null}
              {canRegenerateImages && page.imageStatus === "complete" ? (
                <button
                  type="button"
                  className="image-refresh-btn"
                  aria-label={`重新生成第 ${page.page} 页插图`}
                  title="重新生成本页"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRetryPage(page.page);
                  }}
                  disabled={retryingPages.includes(page.page)}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 1-15.2 6.5" />
                    <path d="M3 12A9 9 0 0 1 18.2 5.5" />
                    <path d="M18 2v4h-4" />
                    <path d="M6 22v-4h4" />
                  </svg>
                </button>
              ) : null}
            </div>
            <div className="page-copy">
              {page.zhText ? <p className="page-zh">{page.zhText}</p> : null}
              {page.enText ? <p className="page-en">{page.enText}</p> : null}
            </div>
          </article>
          );
        })}
      </section>

      {canRegenerateImages && STORY_VIDEO_ENABLED ? (
        <StoryVideoPanel
          key={result.storyId}
          title={result.coverTitle}
          pages={pages}
          totalPages={result.totalPages}
          disabled={!allImagesReady}
        />
      ) : null}

      <section className="tool-panel social-share-panel" aria-label="社交分享">
        <div className="social-share-toolbar">
          <div className="social-share-copy">
            <h3 className="section-accent-title">社交分享</h3>
            <p>弹窗预览 8 页中英绘本图片，并可一键下载完整 ZIP。</p>
          </div>
          <div className="social-icon-actions" aria-label="社交分享操作">
            <button
              type="button"
              className={`social-icon-btn ${shareStatus === "rendering" ? "social-icon-btn-busy" : ""}`}
              onClick={handleShareImage}
              disabled={shareStatus === "rendering" || socialShareStatus !== "idle" || !allImagesReady}
              aria-label="生成分享长图 PNG"
              title="生成分享长图 PNG"
            >
              {shareStatus === "rendering" ? <SpinnerGap aria-hidden="true" /> : <ImagesSquare aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={`social-icon-btn ${socialShareStatus === "rendering" ? "social-icon-btn-busy" : ""}`}
              onClick={handleOpenSocialSharePreview}
              disabled={socialShareStatus !== "idle" || shareStatus === "rendering" || !allImagesReady}
              aria-label="预览微信、小红书分享包"
              title="预览微信、小红书分享包"
            >
              {socialShareStatus === "rendering" ? <SpinnerGap aria-hidden="true" /> : <ShareNetwork aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={`social-icon-btn social-icon-btn-primary ${socialShareStatus === "packing" ? "social-icon-btn-busy" : ""}`}
              onClick={handleDownloadSocialPack}
              disabled={socialShareStatus !== "idle" || shareStatus === "rendering" || !allImagesReady}
              aria-label="下载社交分享包 ZIP"
              title="下载社交分享包 ZIP"
            >
              {socialShareStatus === "packing" ? <SpinnerGap aria-hidden="true" /> : <DownloadSimple aria-hidden="true" />}
            </button>
          </div>
        </div>
        {shareImageUrl ? (
          <div className="share-ready-row" aria-live="polite">
            <span>分享长图已生成。</span>
            <button type="button" className="secondary-btn share-open-btn" onClick={() => setShareDialogOpen(true)}>
              查看预览
            </button>
          </div>
        ) : null}
        {shareError ? <div className="tool-error">{shareError}</div> : null}
        {variant === "own" ? <ShareLinkPanel result={result} /> : null}
      </section>

      {canRegenerateImages && sampleBooks.length > 0 && onOpenSample ? (
        <section
          className="sample-shelf preview-sample-shelf"
          aria-label="精选绘本"
        >
          <div className="sample-shelf-header">
            <h3>精选绘本</h3>
            <p>
              这里放了 3
              本完整示例，可以随时打开阅读，也可以对比不同生图模型的效果。
            </p>
          </div>
          <div className="sample-book-grid">
            {sampleBooks.map((sample) => (
              <button
                key={sample.storyId}
                type="button"
                className="sample-book-card"
                onClick={() => onOpenSample(sample)}
              >
                <SampleStoryImage
                  className="sample-book-image-frame"
                  placeholderSrc={sample.pages[0]?.sampleImage?.placeholder}
                  realSrc={sample.pages[0]?.sampleImage?.variants["gpt-image-2"]}
                  alt=""
                />
                <span className="sample-book-title">{sample.coverTitle}</span>
                <span className="sample-book-meta">
                  {sample.sampleMeta
                    ? `${sample.sampleMeta.themeLabel} · ${sample.sampleMeta.ageLabel}`
                    : "精选绘本"}
                </span>
                <span className="sample-book-open">开始阅读</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
