"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DownloadSimple,
  ImagesSquare,
  ShareNetwork,
  SpinnerGap,
} from "@phosphor-icons/react";
import SampleStoryImage from "@/components/book/SampleStoryImage";
import NarrationToolbar from "@/components/book/NarrationToolbar";
import ShareLinkPanel from "@/components/book/ShareLinkPanel";
import SocialShareDialog, {
  type SocialSharePreviewPage,
} from "@/components/book/SocialShareDialog";
import StoryVideoPanel from "@/components/video/StoryVideoPanel";
import { createZipBlob } from "@/lib/client-zip";
import {
  createBilingualStoryText,
  createImage,
  createSocialShareFiles,
  downloadBlob,
  drawWrappedText,
  roundedRect,
  sanitizeFileName,
  wrapText,
} from "@/lib/social-share";
import {
  getImageStartedAtMs,
  getInitialIllustrationAction,
  ILLUSTRATION_STALE_THRESHOLD_MS,
  isStaleWaitingPage,
  isWaitingImagePage,
} from "@/lib/illustration-request-policy";
import type {
  GenerateResponse,
  SampleImageAssets,
  SampleImageModel,
  StoryPage,
} from "@/types";

const SAMPLE_IMAGE_MODELS: Array<{ id: SampleImageModel; label: string }> = [
  { id: "gpt-image-2", label: "GPT-Image-2" },
  { id: "nano-banana", label: "Nano Banana" },
];
const SAMPLE_IMAGE_MODEL_IDS = SAMPLE_IMAGE_MODELS.map((model) => model.id);

const LIVE_IMAGE_REQUEST_CONCURRENCY = 4;
const ILLUSTRATION_POLL_INTERVAL_MS = 2500;
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
  return `Page ${page.page}`;
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

function getTimedOutImageError(useFreeFallback: boolean) {
  return useFreeFallback
    ? "免费生图模型超过 3 分钟仍未完成，请重新生成本页。"
    : "插图生成超过 3 分钟，已切换免费生图模型重试。";
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
  const [retryingPages, setRetryingPages] = useState<number[]>([]);
  const [activeImageActionsPage, setActiveImageActionsPage] = useState<
    number | null
  >(null);
  const [activeSampleImageModel, setActiveSampleImageModel] =
    useState<SampleImageModel>("gpt-image-2");
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
    setSocialShareDialogOpen(false);
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

  async function resumeIllustrationPage(
    page: StoryPage,
  ): Promise<{ page: StoryPage; allComplete?: boolean }> {
    const startedAtMs = getImageStartedAtMs(page);
    if (startedAtMs === null) {
      return requestIllustrationPage(page.page);
    }

    activeImageRequestsRef.current.add(page.page);
    try {
      return await pollIllustrationPage(page.page, false, startedAtMs);
    } finally {
      activeImageRequestsRef.current.delete(page.page);
    }
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
      activeStoryIdRef.current = result.storyId;
      requestedImagePagesRef.current.clear();
      activeImageRequestsRef.current.clear();
      freeFallbackRequestsRef.current.clear();
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

  async function getOrCreateSocialShareFiles() {
    const sourceKey = getSocialShareSourceKey();
    if (
      socialShareFilesRef.current &&
      socialShareSourceKeyRef.current === sourceKey
    ) {
      return socialShareFilesRef.current;
    }

    if (!allImagesReady) {
      throw new Error("还有页面缺少插图，暂时无法生成社交分享包。");
    }

    const storyId = result.storyId;
    const files = await createSocialShareFiles(
      result.coverTitle,
      pages,
      socialShareBilingualText,
    );
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
      const requestStartedAtMs = Date.now();
      const illustrationTasks = result.pages.flatMap((page) => {
        if (requestedImagePagesRef.current.has(page.page)) return [];

        const action = getInitialIllustrationAction(page, requestStartedAtMs);
        if (action === "wait") return [];

        requestedImagePagesRef.current.add(page.page);
        return [{ page, action }];
      });

      if (illustrationTasks.length === 0) {
        return;
      }

      const startedAt = new Date().toISOString();
      const pendingPageNumbers = new Set(
        illustrationTasks
          .filter((task) => task.action === "start")
          .map((task) => task.page.page),
      );
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
        while (nextIndex < illustrationTasks.length) {
          const task = illustrationTasks[nextIndex];
          nextIndex += 1;
          const { page } = task;

          try {
            const data = task.action === "resume"
              ? await resumeIllustrationPage(page)
              : await requestIllustrationPage(page.page);

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
              illustrationTasks.length,
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
        <NarrationToolbar
          pages={pages}
          storyKey={result.storyId}
          staticChineseAudioUrl={result.narrationAudio?.url}
        />
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

      <SocialShareDialog
        open={socialShareDialogOpen}
        onClose={() => setSocialShareDialogOpen(false)}
        previewPages={socialSharePreviewPages}
        bilingualText={socialShareBilingualText}
        packing={socialShareStatus === "packing"}
        onDownloadZip={handleDownloadSocialPack}
      />

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
