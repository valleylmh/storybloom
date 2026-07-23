"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FilmSlate, SpinnerGap } from "@phosphor-icons/react";
import {
  createStoryVideoFilename,
  getStoryVideoReadinessError,
  type StoryVideoAudioAsset,
  type StoryVideoNarrationMode,
} from "@/lib/story-video";
import type { StoryPage } from "@/types";

type VideoStatus = "idle" | "preparing" | "rendering" | "complete" | "error";

const VIDEO_NARRATION_OPTIONS: Array<{
  mode: StoryVideoNarrationMode;
  label: string;
}> = [
  { mode: "zh", label: "中文" },
  { mode: "en", label: "English" },
  { mode: "zh-en", label: "双语" },
  { mode: "none", label: "无旁白" },
];

export default function StoryVideoPanel({
  title,
  pages,
  totalPages,
  disabled,
}: {
  title: string;
  pages: StoryPage[];
  totalPages: number;
  disabled: boolean;
}) {
  const [narrationMode, setNarrationMode] =
    useState<StoryVideoNarrationMode>("zh");
  const [status, setStatus] = useState<VideoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState(
    "生成过程在当前浏览器完成。",
  );
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoExtension, setVideoExtension] = useState<"mp4" | "webm">("mp4");
  const abortControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const videoUrlRef = useRef<string | null>(null);
  const videoDialogRef = useRef<HTMLDivElement>(null);
  const videoCloseButtonRef = useRef<HTMLButtonElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const audioCacheRef = useRef(
    new Map<StoryVideoNarrationMode, StoryVideoAudioAsset[]>(),
  );
  const readinessError = useMemo(
    () => getStoryVideoReadinessError(pages, totalPages),
    [pages, totalPages],
  );
  const isBusy = status === "preparing" || status === "rendering";

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      abortControllerRef.current?.abort();
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!videoDialogOpen) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      videoCloseButtonRef.current?.focus();
    });

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setVideoDialogOpen(false);
        return;
      }

      if (event.key !== "Tab" || !videoDialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        videoDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], video[controls][tabindex="0"], [tabindex]:not([tabindex="-1"])',
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
      } else if (!videoDialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      videoPreviewRef.current?.pause();
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
      returnFocusRef.current = null;
    };
  }, [videoDialogOpen]);

  function replaceVideoUrl(nextUrl: string | null) {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
    videoUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
  }

  async function handleGenerateVideo() {
    const currentReadinessError = getStoryVideoReadinessError(
      pages,
      totalPages,
    );
    if (disabled || currentReadinessError) {
      setError(currentReadinessError || "绘本插图还没有准备完成。");
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setVideoDialogOpen(false);
    replaceVideoUrl(null);
    setError(null);
    setStatus("preparing");
    setProgress(0);
    setProgressMessage("正在加载浏览器视频引擎");

    try {
      const { renderStoryVideo } = await import("@/lib/render-story-video");
      const rendered = await renderStoryVideo({
        title,
        pages,
        narrationMode,
        cachedAudioAssets: audioCacheRef.current.get(narrationMode),
        signal: controller.signal,
        onProgress: (nextProgress) => {
          if (runIdRef.current !== runId) {
            return;
          }
          setStatus(nextProgress.progress >= 0.5 ? "rendering" : "preparing");
          setProgress(nextProgress.progress);
          setProgressMessage(nextProgress.message);
        },
      });

      if (runIdRef.current !== runId) {
        return;
      }

      audioCacheRef.current.set(narrationMode, rendered.audioAssets);
      const nextVideoUrl = URL.createObjectURL(rendered.blob);
      replaceVideoUrl(nextVideoUrl);
      setVideoExtension(rendered.extension);
      setProgress(1);
      setProgressMessage(
        rendered.extension === "mp4"
          ? "MP4 视频已生成。"
          : "当前浏览器已生成 WebM 视频。",
      );
      setStatus("complete");
      setVideoDialogOpen(true);
    } catch (renderError) {
      if (runIdRef.current !== runId) {
        return;
      }

      if (
        renderError instanceof DOMException &&
        renderError.name === "AbortError"
      ) {
        setStatus("idle");
        setProgress(0);
        setProgressMessage("视频生成已取消。");
        return;
      }

      setStatus("error");
      setError(
        renderError instanceof Error
          ? renderError.message
          : "视频生成失败，请稍后重试。",
      );
    } finally {
      if (runIdRef.current === runId) {
        abortControllerRef.current = null;
      }
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleDownload() {
    if (!videoUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = createStoryVideoFilename(title, videoExtension);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const videoDialog =
    typeof document !== "undefined" && videoDialogOpen && videoUrl
      ? createPortal(
          <div
            className="share-dialog-backdrop story-video-dialog-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setVideoDialogOpen(false);
              }
            }}
          >
            <div
              ref={videoDialogRef}
              className="share-dialog story-video-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="story-video-dialog-title"
              aria-describedby="story-video-dialog-description"
            >
              <div className="share-dialog-header">
                <div>
                  <h3 id="story-video-dialog-title">绘本视频已生成</h3>
                  <p id="story-video-dialog-description">
                    {progressMessage}
                  </p>
                </div>
                <button
                  ref={videoCloseButtonRef}
                  type="button"
                  className="share-dialog-close"
                  aria-label="关闭视频预览"
                  onClick={() => setVideoDialogOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="share-dialog-body story-video-dialog-body">
                <video
                  ref={videoPreviewRef}
                  src={videoUrl}
                  poster={pages[0]?.imageUrl}
                  controls
                  playsInline
                  preload="metadata"
                  tabIndex={0}
                  aria-label="生成的绘本视频预览"
                />
              </div>
              <div className="share-dialog-actions story-video-dialog-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setVideoDialogOpen(false)}
                >
                  关闭
                </button>
                <button
                  type="button"
                  className="cta-btn"
                  onClick={handleDownload}
                >
                  下载{videoExtension.toUpperCase()}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="tool-panel story-video-panel">
        <div>
          <h3 className="section-accent-title">绘本视频</h3>
          <p>
            将当前插图、字幕和旁白合成为 720 × 1280
            竖屏视频，适合手机分享。
          </p>
        </div>

        <div className="story-video-toolbar">
          <button
            type="button"
            className={`cta-btn story-video-generate-btn ${isBusy ? "story-video-generate-btn-busy" : ""}`}
            disabled={disabled || Boolean(readinessError) || isBusy}
            onClick={handleGenerateVideo}
          >
            {isBusy ? <SpinnerGap aria-hidden="true" /> : <FilmSlate aria-hidden="true" />}
            <span>
              {isBusy
                ? "正在生成视频"
                : status === "complete"
                  ? "重新生成绘本视频"
                  : "生成绘本视频"}
            </span>
          </button>

          <select
            className="story-video-select"
            aria-label="选择视频旁白语言"
            value={narrationMode}
            disabled={isBusy}
            onChange={(event) =>
              setNarrationMode(event.target.value as StoryVideoNarrationMode)
            }
          >
            {VIDEO_NARRATION_OPTIONS.map((option) => (
              <option key={option.mode} value={option.mode}>
                {option.label}
              </option>
            ))}
          </select>

          {isBusy ? (
            <button type="button" className="secondary-btn" onClick={handleCancel}>
              取消
            </button>
          ) : null}
        </div>

        {readinessError ? (
          <p className="tool-meta story-video-hint">插图完成后即可生成视频。</p>
        ) : null}

        {isBusy ? (
          <div
            className="story-video-progress"
            role="status"
            aria-live="polite"
          >
            <div className="story-video-progress-copy">
              <span>{progressMessage}</span>
              <strong>{Math.round(progress * 100)}%</strong>
            </div>
            <progress max={1} value={progress} aria-label={progressMessage} />
          </div>
        ) : null}

        {error ? (
          <div className="tool-error" role="alert">
            {error}
          </div>
        ) : null}

        {videoUrl ? (
          <div className="share-ready-row story-video-ready-row">
            <div
              className="story-video-ready-copy"
              role="status"
              aria-live="polite"
            >
              <strong>视频已生成</strong>
              <span>{progressMessage}</span>
            </div>
            <button
              type="button"
              className="secondary-btn share-open-btn"
              onClick={() => setVideoDialogOpen(true)}
            >
              查看视频
            </button>
          </div>
        ) : null}
      </div>
      {videoDialog}
    </>
  );
}
