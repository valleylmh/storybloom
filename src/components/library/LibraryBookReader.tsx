"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import type { BrowserNarrationMode } from "@/lib/browser-narration";
import type { StoryPage } from "@/types";

export type ReaderMode = "turn" | "grid";

function getIllustrationStatusLabel(page: StoryPage) {
  if (page.imageStatus === "complete" && page.imageUrl) {
    return `第 ${page.page} 页插图已完成`;
  }
  if (page.imageStatus === "failed") {
    return `第 ${page.page} 页插图生成失败`;
  }
  if (page.imageStatus === "pending") {
    return `第 ${page.page} 页插图正在生成`;
  }
  return `第 ${page.page} 页插图等待生成`;
}

/**
 * 绘本馆翻页阅读器：像翻实体书一样一页一页阅读，
 * 点击插图可放大查看并左右轮播。
 */
export default function LibraryBookReader({
  title,
  pages,
  accent,
  pageIndex: controlledPageIndex,
  readerMode: controlledReaderMode,
  narrationHighlight = null,
  playbackPositionMs = 0,
  playbackDurationMs = 0,
  showToolbar = true,
  onRetryIllustration,
  isIllustrationRetryable,
  getIllustrationStatusDetail,
  retryingIllustrationPages = [],
  onPageIndexChange,
  onReaderModeChange,
}: {
  title: string;
  pages: StoryPage[];
  accent: string;
  pageIndex?: number;
  readerMode?: ReaderMode;
  narrationHighlight?: BrowserNarrationMode | null;
  playbackPositionMs?: number;
  playbackDurationMs?: number;
  showToolbar?: boolean;
  onRetryIllustration?: (pageNumber: number) => void;
  isIllustrationRetryable?: (page: StoryPage) => boolean;
  getIllustrationStatusDetail?: (page: StoryPage) => string | undefined;
  retryingIllustrationPages?: readonly number[];
  onPageIndexChange?: (pageIndex: number) => void;
  onReaderModeChange?: (mode: ReaderMode) => void;
}) {
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<"next" | "prev">("next");
  const [turnKey, setTurnKey] = useState(0);
  const [internalReaderMode, setInternalReaderMode] =
    useState<ReaderMode>("turn");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const pageIndex = controlledPageIndex ?? internalPageIndex;
  const readerMode = controlledReaderMode ?? internalReaderMode;
  const previousPageIndexRef = useRef(pageIndex);
  const total = pages.length;
  const page = pages[pageIndex];

  useEffect(() => {
    const previousPageIndex = previousPageIndexRef.current;
    if (previousPageIndex === pageIndex) return;
    setTurnDirection(pageIndex > previousPageIndex ? "next" : "prev");
    setTurnKey((key) => key + 1);
    previousPageIndexRef.current = pageIndex;
  }, [pageIndex]);

  useEffect(() => {
    setLightboxIndex((currentIndex) =>
      currentIndex === null ? null : pageIndex,
    );
  }, [pageIndex]);

  useEffect(() => {
    if (readerMode !== "turn") return;
    const activeThumbnail = thumbnailsRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    activeThumbnail?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }, [pageIndex, readerMode]);

  const goToPage = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= total) {
        return;
      }
      if (nextIndex === pageIndex) return;
      if (controlledPageIndex === undefined) {
        setInternalPageIndex(nextIndex);
      }
      onPageIndexChange?.(nextIndex);
    },
    [controlledPageIndex, onPageIndexChange, pageIndex, total],
  );

  const changeReaderMode = useCallback(
    (nextMode: ReaderMode) => {
      if (nextMode === readerMode) return;
      if (controlledReaderMode === undefined) {
        setInternalReaderMode(nextMode);
      }
      onReaderModeChange?.(nextMode);
    },
    [controlledReaderMode, onReaderModeChange, readerMode],
  );

  const goToLightbox = useCallback(
    (nextIndex: number) => {
      setLightboxIndex(((nextIndex % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (lightboxIndex !== null) {
        if (event.key === "Escape") {
          setLightboxIndex(null);
        } else if (event.key === "ArrowLeft") {
          goToLightbox(lightboxIndex - 1);
        } else if (event.key === "ArrowRight") {
          goToLightbox(lightboxIndex + 1);
        }
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (readerMode === "turn" && event.key === "ArrowLeft") {
        goToPage(pageIndex - 1);
      } else if (readerMode === "turn" && event.key === "ArrowRight") {
        goToPage(pageIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex, pageIndex, readerMode, goToPage, goToLightbox]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxIndex]);

  function handleTouchStart(event: React.TouchEvent) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    const endX = event.changedTouches[0]?.clientX;
    const endY = event.changedTouches[0]?.clientY;
    if (
      startX === null ||
      startY === null ||
      endX === undefined ||
      endY === undefined
    ) {
      return;
    }

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
      return;
    }

    goToPage(deltaX < 0 ? pageIndex + 1 : pageIndex - 1);
  }

  const lightboxPage = lightboxIndex !== null ? pages[lightboxIndex] : null;
  const illustrationStatusAnnouncement =
    readerMode === "turn"
      ? getIllustrationStatusLabel(page)
      : `插图状态：${pages.map(getIllustrationStatusLabel).join("；")}`;

  function renderIllustrationControls(item: StoryPage) {
    if (!onRetryIllustration) return null;

    const retrying = retryingIllustrationPages.includes(item.page);
    const retryable = isIllustrationRetryable?.(item) || false;
    const statusDetail = getIllustrationStatusDetail?.(item);

    return (
      <>
        {item.imageStatus !== "complete" ? (
          <div
            className={
              item.imageStatus === "failed"
                ? "image-error-badge"
                : "image-loading-badge"
            }
          >
            {statusDetail || getIllustrationStatusLabel(item)}
          </div>
        ) : null}
        {retryable ? (
          <button
            type="button"
            className="image-retry-btn"
            onClick={() => onRetryIllustration(item.page)}
            disabled={retrying}
          >
            {retrying ? "正在重新生成…" : "重新生成本页"}
          </button>
        ) : item.imageStatus === "complete" ? (
          <button
            type="button"
            className="image-refresh-btn"
            aria-label={`重新生成第 ${item.page} 页插图`}
            title="重新生成本页"
            onClick={() => onRetryIllustration(item.page)}
            disabled={retrying}
          >
            ↻
          </button>
        ) : null}
      </>
    );
  }

  return (
    <section className="library-reader" aria-label="绘本正文">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {illustrationStatusAnnouncement}
      </p>
      {showToolbar ? (
        <div className="library-reader-toolbar">
          <div className="library-reader-toolbar-copy">
            <strong>阅读方式</strong>
            <span>
              {readerMode === "turn"
                ? "左右箭头、键盘或滑动翻页；点击插图可放大。"
                : "平铺查看全部页面；点击任意插图可放大轮播。"}
            </span>
          </div>
          <div
            className="library-reader-mode-switch"
            role="group"
            aria-label="切换阅读方式"
          >
            <button
              type="button"
              className={`library-reader-mode-btn ${
                readerMode === "turn" ? "library-reader-mode-btn-active" : ""
              }`}
              aria-pressed={readerMode === "turn"}
              onClick={() => changeReaderMode("turn")}
            >
              翻页阅读
            </button>
            <button
              type="button"
              className={`library-reader-mode-btn ${
                readerMode === "grid" ? "library-reader-mode-btn-active" : ""
              }`}
              aria-pressed={readerMode === "grid"}
              onClick={() => changeReaderMode("grid")}
            >
              平铺查看
            </button>
          </div>
        </div>
      ) : null}

      {readerMode === "turn" ? (
        <>
          <div
            className="book-stage"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              touchStartXRef.current = null;
              touchStartYRef.current = null;
            }}
          >
            <button
              type="button"
              className="book-nav-btn book-nav-prev"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
              aria-label="上一页"
            >
              <CaretLeft aria-hidden="true" />
            </button>

            <article
              key={turnKey}
              className={`book-spread book-turn-${turnDirection} ${
                narrationHighlight ? "book-spread-narrating" : ""
              }`}
              aria-label={`第 ${page.page} 页，共 ${total} 页，${getIllustrationStatusLabel(page)}`}
            >
              {playbackDurationMs > 0 ? (
                <progress
                  className="book-page-audio-progress"
                  aria-label={`第 ${page.page} 页音频播放进度`}
                  max={playbackDurationMs}
                  value={Math.min(playbackPositionMs, playbackDurationMs)}
                />
              ) : null}
              <div
                className={`book-page book-page-left ${
                  page.imageStatus === "pending" || page.imageStatus === "failed"
                    ? "page-image-frame-loading"
                    : ""
                }`}
              >
                {page.imageUrl && page.imageStatus === "complete" ? (
                  <button
                    type="button"
                    className="book-image-btn"
                    onClick={() => setLightboxIndex(pageIndex)}
                    aria-label={`放大查看第 ${page.page} 页插图，${getIllustrationStatusLabel(page)}`}
                    title="点击放大查看"
                  >
                    <img
                      src={page.imageUrl}
                      alt={`${title} 第 ${page.page} 页插图`}
                      className="book-image"
                    />
                  </button>
                ) : (
                  <div
                    className="book-image-fallback"
                    style={{ backgroundColor: `${accent}18`, color: accent }}
                    role="img"
                    aria-label={getIllustrationStatusLabel(page)}
                  >
                    <span>{page.page}</span>
                  </div>
                )}
                {renderIllustrationControls(page)}
              </div>
              <div className="book-page book-page-right">
                <p className="book-page-number" style={{ color: accent }}>
                  {page.page} / {total}
                </p>
                <p
                  className={`page-zh ${
                    narrationHighlight === "zh" ||
                    narrationHighlight === "zh-en"
                      ? "book-text-narrating"
                      : ""
                  }`}
                >
                  {page.zhText}
                </p>
                <p
                  className={`page-en ${
                    narrationHighlight === "en" ||
                    narrationHighlight === "zh-en"
                      ? "book-text-narrating"
                      : ""
                  }`}
                >
                  {page.enText}
                </p>
              </div>
            </article>

            <button
              type="button"
              className="book-nav-btn book-nav-next"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex === total - 1}
              aria-label="下一页"
            >
              <CaretRight aria-hidden="true" />
            </button>
          </div>

          <div
            ref={thumbnailsRef}
            className="book-thumbs"
            role="tablist"
            aria-label="页面导航"
          >
            {pages.map((item, index) => (
              <button
                key={item.page}
                type="button"
                role="tab"
                aria-selected={index === pageIndex}
                className={`book-thumb ${index === pageIndex ? "book-thumb-active" : ""}`}
                onClick={() => goToPage(index)}
                aria-label={`跳到第 ${item.page} 页，${getIllustrationStatusLabel(item)}`}
              >
                {item.imageUrl && item.imageStatus === "complete" ? (
                  <img src={item.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span
                    className="book-thumb-fallback"
                    style={{ backgroundColor: `${accent}18`, color: accent }}
                  >
                    {item.page}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="pages-grid library-pages library-reader-grid" aria-label="平铺绘本正文">
          {pages.map((item, index) => (
            <article
              key={item.page}
              className="page-card"
              aria-label={`第 ${item.page} 页，${getIllustrationStatusLabel(item)}`}
            >
              <div
                className={`page-image-frame ${
                  item.imageStatus === "pending" || item.imageStatus === "failed"
                    ? "page-image-frame-loading"
                    : ""
                }`}
              >
                {item.imageUrl && item.imageStatus === "complete" ? (
                  <button
                    type="button"
                    className="library-grid-image-btn"
                    onClick={() => setLightboxIndex(index)}
                    aria-label={`放大查看第 ${item.page} 页插图，${getIllustrationStatusLabel(item)}`}
                    title="点击放大查看"
                  >
                    <img
                      src={item.imageUrl}
                      alt={`${title} 第 ${item.page} 页插图`}
                      className="page-image"
                      loading={item.page > 2 ? "lazy" : undefined}
                    />
                  </button>
                ) : (
                  <div
                    className="library-page-fallback"
                    style={{ backgroundColor: `${accent}18`, color: accent }}
                    role="img"
                    aria-label={getIllustrationStatusLabel(item)}
                  >
                    <span>{item.page}</span>
                  </div>
                )}
                {renderIllustrationControls(item)}
              </div>
              <div className="page-copy">
                <p className="page-zh">{item.zhText}</p>
                <p className="page-en">{item.enText}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      {typeof document !== "undefined" && lightboxPage
        ? createPortal(
            <div
              className="lightbox-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={`第 ${lightboxPage.page} 页插图放大预览`}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setLightboxIndex(null);
                }
              }}
            >
              <button
                type="button"
                className="lightbox-close"
                aria-label="关闭放大预览"
                onClick={() => setLightboxIndex(null)}
              >
                <X aria-hidden="true" />
              </button>
              <figure className="lightbox-figure">
                <div className="lightbox-media">
                  <button
                    type="button"
                    className="lightbox-nav lightbox-nav-prev"
                    aria-label="上一张"
                    onClick={() => goToLightbox((lightboxIndex ?? 0) - 1)}
                  >
                    <CaretLeft aria-hidden="true" />
                  </button>
                  {lightboxPage.imageUrl &&
                  lightboxPage.imageStatus === "complete" ? (
                    <img
                      src={lightboxPage.imageUrl}
                      alt={`${title} 第 ${lightboxPage.page} 页插图`}
                    />
                  ) : (
                    <div
                      className="book-image-fallback lightbox-fallback"
                      style={{
                        backgroundColor: `${accent}30`,
                        color: "#fffaf4",
                      }}
                      role="img"
                      aria-label={getIllustrationStatusLabel(lightboxPage)}
                    >
                      <span>{lightboxPage.page}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="lightbox-nav lightbox-nav-next"
                    aria-label="下一张"
                    onClick={() => goToLightbox((lightboxIndex ?? 0) + 1)}
                  >
                    <CaretRight aria-hidden="true" />
                  </button>
                </div>
                <figcaption>
                  <span className="lightbox-counter">
                    {lightboxPage.page} / {total}
                  </span>
                  <span className="lightbox-caption-zh">
                    {lightboxPage.zhText}
                  </span>
                </figcaption>
              </figure>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
