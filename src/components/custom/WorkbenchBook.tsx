"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { spreadStart, type CustomWorkbenchDraft } from "@/lib/custom-workbench";
import { bookOpenings, openingForPage } from "@/lib/custom-book/reader";
import { drawWorkbench, pageDimensions } from "./WorkbenchCanvas";
import s from "./WorkbenchBook.module.css";

function Leaf({
  draft,
  page,
}: {
  draft: CustomWorkbenchDraft;
  page: number | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (page === null) return;
    let active = true;
    const buffer = document.createElement("canvas");
    void document.fonts.ready
      .then(() => drawWorkbench(buffer, draft, page))
      .then(({ overflow, contentMismatch }) => {
        if (!active || !ref.current) return;
        const start = spreadStart(draft, page);
        const width = start ? buffer.width / 2 : buffer.width;
        ref.current.width = width;
        ref.current.height = buffer.height;
        ref.current
          .getContext("2d")
          ?.drawImage(
            buffer,
            start && page > start ? width : 0,
            0,
            width,
            buffer.height,
            0,
            0,
            width,
            buffer.height,
          );
        setError(
          contentMismatch
            ? "图中文字尚未更新，请重新生成"
            : overflow
              ? "文字溢出，请调整排版"
              : "",
        );
      })
      .catch(() => active && setError("图片读取失败，请更换素材"));
    return () => {
      active = false;
    };
  }, [draft, page]);
  return (
    <div className={s.leaf}>
      {page === null ? (
        <div className={s.endpaper}>
          <span>✧</span>
          <small>STORYBLOOM</small>
        </div>
      ) : (
        <canvas
          ref={ref}
          role="img"
          aria-label={
            page === 0
              ? `封面：${draft.title}`
              : `第 ${page} 页：${draft.pages[page - 1]?.text}`
          }
        />
      )}
      {error && (
        <span role="alert" className={s.error}>
          {error}
        </span>
      )}
    </div>
  );
}

export default function WorkbenchBook({
  draft,
  page,
  onNavigate,
  immersive = false,
}: {
  draft: CustomWorkbenchDraft;
  page: number;
  onNavigate: (page: number) => void;
  immersive?: boolean;
}) {
  const [ended, setEnded] = useState(false);
  useEffect(() => setEnded(false), [page, draft.pageCount]);
  const target = ended ? 100 : openingForPage(page);
  const [current, setCurrent] = useState(target);
  const [turn, setTurn] = useState<{ from: number; to: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (target === current) {
      setTurn(null);
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrent(target);
      return;
    }
    setTurn({ from: current, to: target });
    const timer = setTimeout(() => {
      setCurrent(target);
      setTurn(null);
    }, 820);
    return () => clearTimeout(timer);
  }, [target, current]);
  const openings = [...bookOpenings(draft.pageCount), 100];
  const selectOpening = (next: number) => {
    setEnded(next === 100);
    if (next !== 100) onNavigate(next);
  };
  const index = openings.indexOf(target);
  const move = (direction: number) => {
    if (!turn && openings[index + direction] !== undefined)
      selectOpening(openings[index + direction]);
  };
  const [w, h] = pageDimensions(draft.format);
  const leaf = (opening: number, side: "left" | "right") => {
    if (opening === 100)
      return (
        <div
          className={`${s.paper} ${s[side]} ${side === "right" ? s.invisible : s.hardcover}`}
        >
          <div className={s.backCover}>
            <small>STORYBLOOM · 原创绘本</small>
            <span>✧</span>
            <h3>{draft.title}</h3>
            <p>
              故事读完了，
              <br />
              想象还在继续。
            </p>
            <small>献给每一个爱听故事的你</small>
          </div>
        </div>
      );
    const number =
      opening === 0
        ? side === "right"
          ? 0
          : null
        : opening === 1
          ? side === "right"
            ? 1
            : null
          : opening + (side === "right" ? 1 : 0);
    return (
      <div
        className={`${s.paper} ${s[side]} ${opening === 0 && side === "right" ? s.hardcover : ""} ${opening === 0 && side === "left" ? s.invisible : ""}`}
      >
        {opening === 0 && side === "right" && !draft.cover?.embeddedText && (
          <span className={s.coverLabel}>STORYBLOOM · 珍藏绘本</span>
        )}
        <Leaf
          draft={draft}
          page={number !== null && number <= draft.pageCount ? number : null}
        />
      </div>
    );
  };
  const forward = turn ? turn.to > turn.from : true;
  return (
    <div
      className={`${s.reader} ${immersive ? s.immersiveBook : ""}`}
      style={{ "--ratio": (2 * w) / h, "--leaf-ratio": w / h } as CSSProperties}
    >
      <div
        className={`${s.book} ${turn?.to === 100 ? s.finishClosing : turn?.from === 100 ? s.finishOpening : current === 100 ? s.backClosed : turn?.from === 0 ? s.opening : turn?.to === 0 ? s.closing : current === 0 ? s.closed : ""}`}
        tabIndex={0}
        aria-label="可翻页绘本，使用左右方向键翻阅"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            move(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
            move(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <div className={s.base}>
          {leaf(turn ? (forward ? turn.from : turn.to) : current, "left")}
          {leaf(turn ? (forward ? turn.to : turn.from) : current, "right")}
        </div>
        {turn && (
          <div
            key={`${turn.from}-${turn.to}`}
            className={`${s.turning} ${forward ? s.next : s.prev}`}
          >
            <div className={s.front}>
              {leaf(turn.from, forward ? "right" : "left")}
            </div>
            <div className={s.back}>
              {leaf(turn.to, forward ? "left" : "right")}
            </div>
          </div>
        )}
      </div>
      <nav className={s.navigation} aria-label="绘本翻页">
        <button
          disabled={index <= 0 || !!turn}
          onClick={() => move(-1)}
          aria-label="上一对页"
        >
          ←
        </button>
        <span>
          {target === 100
            ? "封底 · 全书完"
            : target === 0
              ? "封面 · 翻开故事"
              : target === 1
                ? "第 1 页"
                : `第 ${target}${target < draft.pageCount ? `–${target + 1}` : ""} 页`}
          {target > 1 && spreadStart(draft, target) && (
            <small>连续跨页插画</small>
          )}
        </span>
        <button
          disabled={index === openings.length - 1 || !!turn}
          onClick={() => move(1)}
          aria-label={index === openings.length - 2 ? "合上书本" : "下一对页"}
        >
          {index === openings.length - 2 ? "合上书本" : "→"}
        </button>
      </nav>
      <div className={s.progress} aria-label="阅读进度">
        {openings.map((p, i) => (
          <button
            key={p}
            aria-label={
              p === 100
                ? "合上书本，查看封底"
                : p === 0
                  ? "跳到封面"
                  : `跳到第 ${p} 页`
            }
            aria-current={index === i ? "step" : undefined}
            disabled={!!turn}
            onClick={() => selectOpening(p)}
          />
        ))}
      </div>
      <p className={s.hint}>
        左右滑动或使用方向键翻页{immersive ? " · 横屏阅读更舒展" : ""}
      </p>
    </div>
  );
}

export function ImmersiveWorkbenchReader({
  draft,
  page,
  onNavigate,
  onClose,
}: {
  draft: CustomWorkbenchDraft;
  page: number;
  onNavigate: (page: number) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      ref={root}
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`沉浸阅读：${draft.title}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const nodes = Array.from(
            root.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [tabindex="0"]',
            ) || [],
          );
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header className={s.header}>
        <div>
          <small>STORYBLOOM · 私人绘本时光</small>
          <h2>{draft.title || "未命名绘本"}</h2>
        </div>
        <button ref={close} onClick={onClose}>
          退出阅读 ×
        </button>
      </header>
      <main className={s.readingStage}>
        <WorkbenchBook
          draft={draft}
          page={page}
          onNavigate={onNavigate}
          immersive
        />
      </main>
    </div>,
    document.body,
  );
}
