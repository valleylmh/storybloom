"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CopySimple } from "@phosphor-icons/react";
import { copyTextToClipboard } from "@/lib/social-share";

export type SocialSharePreviewPage = {
  page: number;
  imageUrl: string;
};

/**
 * 社交分享弹窗：预览逐页分享图片 + 中英文全文，可复制文本、下载 ZIP。
 * 生成绘本区与绘本馆共用，保证两处交互一致。
 */
export default function SocialShareDialog({
  open,
  onClose,
  previewPages,
  bilingualText,
  packing,
  onDownloadZip,
}: {
  open: boolean;
  onClose: () => void;
  previewPages: SocialSharePreviewPage[];
  bilingualText: string;
  packing: boolean;
  onDownloadZip: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [textCopied, setTextCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTextCopied(false);
    setCopyError(null);
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
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
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
      returnFocusRef.current = null;
    };
  }, [open, onClose]);

  async function handleCopyText() {
    try {
      await copyTextToClipboard(bilingualText);
      setTextCopied(true);
      setCopyError(null);
    } catch (error) {
      setTextCopied(false);
      setCopyError(
        error instanceof Error ? error.message : "复制失败，请手动复制。",
      );
    }
  }

  if (typeof document === "undefined" || !open || previewPages.length === 0) {
    return null;
  }

  return createPortal(
    <div
      className="share-dialog-backdrop social-share-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="share-dialog social-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-share-dialog-title"
      >
        <div className="share-dialog-header">
          <div>
            <h3 id="social-share-dialog-title">
              {previewPages.length} 页社交分享预览
            </h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="share-dialog-close"
            aria-label="关闭社交分享预览"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="share-dialog-body social-share-dialog-body">
          <div className="social-share-preview-grid">
            {previewPages.map((page) => (
              <article key={page.page} className="social-share-preview-card">
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
                <span>完整 {previewPages.length} 页中英文文本</span>
              </div>
              <div className="social-share-copy-action">
                <span aria-live="polite">{textCopied ? "已复制" : ""}</span>
                <button
                  type="button"
                  className="social-share-copy-btn"
                  onClick={handleCopyText}
                  aria-label={
                    textCopied ? "完整故事文本已复制" : "一键复制完整故事文本"
                  }
                  title={textCopied ? "已复制" : "复制 TXT 文本"}
                >
                  {textCopied ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <CopySimple aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {copyError ? (
              <p className="social-share-copy-error" role="alert">
                {copyError}
              </p>
            ) : null}
            <pre>{bilingualText}</pre>
          </section>
        </div>
        <div className="share-dialog-actions social-share-dialog-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="cta-btn"
            disabled={packing}
            onClick={onDownloadZip}
          >
            {packing ? "正在打包…" : "一键下载 ZIP"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
