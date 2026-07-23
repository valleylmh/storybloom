"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Copy, ShareNetwork } from "@phosphor-icons/react";
import StoryVideoPanel from "@/components/video/StoryVideoPanel";
import type { StoryPage } from "@/types";

const STORY_VIDEO_ENABLED =
  process.env.NEXT_PUBLIC_STORY_VIDEO_ENABLED !== "0";

type ShareStatus = "idle" | "copied" | "shared" | "error";

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some browsers expose Clipboard API but deny it outside a trusted gesture.
      // Continue with the selection-based fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("复制失败");
  }
}

export default function LibraryBookTools({
  title,
  description,
  pages,
  shareUrl,
}: {
  title: string;
  description: string;
  pages: StoryPage[];
  shareUrl: string;
}) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState("");
  const allImagesReady = useMemo(
    () =>
      pages.length > 0 &&
      pages.every(
        (page) => Boolean(page.imageUrl) && page.imageStatus === "complete",
      ),
    [pages],
  );

  async function handleCopyLink() {
    try {
      await copyText(shareUrl);
      setShareStatus("copied");
      setShareMessage("阅读链接已复制，可以发给家人朋友。");
    } catch {
      setShareStatus("error");
      setShareMessage("复制失败，请直接复制浏览器地址。");
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      await handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title: `${title} | StoryBloom 绘本馆`,
        text: description,
        url: shareUrl,
      });
      setShareStatus("shared");
      setShareMessage("分享已完成。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setShareStatus("error");
      setShareMessage("系统分享暂不可用，可以改用复制链接。");
    }
  }

  return (
    <section className="library-book-tools" aria-label="绘本视频与分享">
      {STORY_VIDEO_ENABLED ? (
        <StoryVideoPanel
          title={title}
          pages={pages}
          totalPages={pages.length}
          disabled={!allImagesReady}
        />
      ) : null}

      <div className="tool-panel library-share-panel">
        <div className="library-share-copy">
          <h3 className="section-accent-title">分享绘本</h3>
          <p>分享这本绘本的永久阅读链接，对方无需登录即可打开。</p>
        </div>

        <div className="library-share-actions">
          <button
            type="button"
            className="cta-btn library-share-action"
            onClick={handleShare}
          >
            <ShareNetwork aria-hidden="true" />
            分享这本绘本
          </button>
          <button
            type="button"
            className="secondary-btn library-share-action"
            onClick={handleCopyLink}
          >
            {shareStatus === "copied" ? (
              <CheckCircle aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {shareStatus === "copied" ? "链接已复制" : "复制阅读链接"}
          </button>
        </div>

        {shareMessage ? (
          <p
            className={`library-share-message ${shareStatus === "error" ? "library-share-message-error" : ""}`}
            role={shareStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {shareMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
