"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle, Copy, ShareNetwork, SpinnerGap } from "@phosphor-icons/react";
import SocialShareDialog, {
  type SocialSharePreviewPage,
} from "@/components/book/SocialShareDialog";
import NarrationToolbar from "@/components/book/NarrationToolbar";
import StoryVideoPanel from "@/components/video/StoryVideoPanel";
import { createZipBlob } from "@/lib/client-zip";
import {
  createBilingualStoryText,
  createSocialShareFiles,
  downloadBlob,
  sanitizeFileName,
} from "@/lib/social-share";
import type { StoryPage } from "@/types";

const STORY_VIDEO_ENABLED =
  process.env.NEXT_PUBLIC_STORY_VIDEO_ENABLED !== "0";

type ShareStatus = "idle" | "copied" | "error";

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
  pages,
  shareUrl,
}: {
  title: string;
  pages: StoryPage[];
  shareUrl: string;
}) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState("");
  const [socialShareStatus, setSocialShareStatus] = useState<
    "idle" | "rendering" | "packing"
  >("idle");
  const [socialShareDialogOpen, setSocialShareDialogOpen] = useState(false);
  const [socialSharePreviewPages, setSocialSharePreviewPages] = useState<
    SocialSharePreviewPage[]
  >([]);
  const socialShareFilesRef = useRef<File[] | null>(null);
  const socialSharePreviewUrlsRef = useRef<string[]>([]);
  const allImagesReady = useMemo(
    () =>
      pages.length > 0 &&
      pages.every(
        (page) => Boolean(page.imageUrl) && page.imageStatus === "complete",
      ),
    [pages],
  );
  const bilingualText = useMemo(
    () => createBilingualStoryText(title, pages),
    [title, pages],
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

  async function getOrCreateSocialShareFiles() {
    if (socialShareFilesRef.current) {
      return socialShareFilesRef.current;
    }

    const files = await createSocialShareFiles(title, pages, bilingualText);
    const imageFiles = files.filter((file) =>
      file.name.startsWith("images/page-"),
    );
    if (imageFiles.length !== pages.length) {
      throw new Error("社交分享图片没有生成完整，请重试。");
    }

    socialSharePreviewUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    const previewUrls = imageFiles.map((file) => URL.createObjectURL(file));
    socialSharePreviewUrlsRef.current = previewUrls;
    socialShareFilesRef.current = files;
    setSocialSharePreviewPages(
      pages.map((page, index) => ({
        page: page.page,
        imageUrl: previewUrls[index],
      })),
    );
    return files;
  }

  async function handleOpenSharePreview() {
    if (!allImagesReady) {
      setShareStatus("error");
      setShareMessage("本书插图还没有全部就绪，暂时无法生成分享预览。");
      return;
    }

    setSocialShareStatus("rendering");
    setShareMessage("");
    try {
      await getOrCreateSocialShareFiles();
      setSocialShareDialogOpen(true);
      setShareStatus("idle");
    } catch (error) {
      setShareStatus("error");
      setShareMessage(
        error instanceof Error ? error.message : "分享预览生成失败，请重试。",
      );
    } finally {
      setSocialShareStatus("idle");
    }
  }

  async function handleDownloadSocialPack() {
    setSocialShareStatus("packing");
    try {
      const files = await getOrCreateSocialShareFiles();
      const zip = await createZipBlob(
        files.map((file) => ({ name: file.name, data: file })),
      );
      downloadBlob(zip, `storybloom-${sanitizeFileName(title)}-social.zip`);
    } catch (error) {
      setShareStatus("error");
      setShareMessage(
        error instanceof Error ? error.message : "社交分享包生成失败。",
      );
    } finally {
      setSocialShareStatus("idle");
    }
  }

  return (
    <section className="library-book-tools" aria-label="绘本朗读、视频与分享">
      <NarrationToolbar pages={pages} storyKey={shareUrl} />

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
          <p>弹窗预览逐页中英绘本图片与全文，也可以复制永久阅读链接。</p>
        </div>

        <div className="library-share-actions">
          <button
            type="button"
            className="cta-btn library-share-action"
            onClick={handleOpenSharePreview}
            disabled={socialShareStatus !== "idle"}
          >
            {socialShareStatus === "rendering" ? (
              <SpinnerGap aria-hidden="true" className="spin" />
            ) : (
              <ShareNetwork aria-hidden="true" />
            )}
            {socialShareStatus === "rendering"
              ? "正在生成预览..."
              : "分享这本绘本"}
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

      <SocialShareDialog
        open={socialShareDialogOpen}
        onClose={() => setSocialShareDialogOpen(false)}
        previewPages={socialSharePreviewPages}
        bilingualText={bilingualText}
        packing={socialShareStatus === "packing"}
        onDownloadZip={handleDownloadSocialPack}
      />
    </section>
  );
}
