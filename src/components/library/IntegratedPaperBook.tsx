"use client";

import { useEffect, useRef, useState } from "react";
import type { StoryPage } from "@/types";
import styles from "./IntegratedPaperBook.module.css";

type Turn = { from: number; to: number; direction: "next" | "prev" };

export default function IntegratedPaperBook({ title, pages }: { title: string; pages: StoryPage[] }) {
  const [spread, setSpread] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [english, setEnglish] = useState(false);
  const [large, setLarge] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef(false);
  const count = Math.ceil(pages.length / 2);

  useEffect(() => {
    if (!turn) return;
    const timer = window.setTimeout(() => {
      setSpread(turn.to);
      setTurn(null);
      locked.current = false;
    }, 820);
    return () => window.clearTimeout(timer);
  }, [turn]);

  useEffect(() => {
    // Decode neighboring sheets before they become the front/back of a turn.
    for (const page of pages.slice(Math.max(0, spread * 2 - 2), spread * 2 + 6)) {
      if (!page.imageUrl) continue;
      const image = new Image();
      image.src = page.imageUrl;
      void image.decode().catch(() => {});
    }
  }, [pages, spread]);

  function go(direction: "next" | "prev") {
    const to = spread + (direction === "next" ? 1 : -1);
    if (locked.current || to < 0 || to >= count) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || large) {
      setSpread(to);
      return;
    }
    locked.current = true;
    setTurn({ from: spread, to, direction });
  }

  function leaf(index: number, side: "left" | "right") {
    const page = pages[index];
    return <div className={`${styles.page} ${styles[side]}`}>
      {page ? <>
        <img className={styles.art} src={page.imageUrl} alt={`${title} 第 ${page.page} 页插画`} draggable={false} />
        <div className={styles.words}><p lang={english ? "en" : "zh-CN"}>{english ? page.enText : page.zhText}</p></div>
        <span className={styles.pageNumber}>{page.page}</span>
      </> : <div className={styles.ending}><span>故事读完了</span><strong>把收获，种在每一天。</strong></div>}
    </div>;
  }

  const leftIndex = turn?.direction === "prev" ? turn.to * 2 : spread * 2;
  const rightIndex = turn?.direction === "next" ? turn.to * 2 + 1 : spread * 2 + 1;

  return <section className={styles.reader} aria-label="立体绘本阅读器" onKeyDown={(event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      go(event.key === "ArrowRight" ? "next" : "prev");
    }
  }}>
    <div className={styles.toolbar}><span>立体绘本</span><div>
      <button aria-pressed={english} disabled={!!turn} onClick={() => setEnglish(!english)}>{english ? "中文" : "English"}</button>
      <button aria-pressed={large} disabled={!!turn} onClick={() => setLarge(!large)}>{large ? "返回展开书本" : "放大阅读"}</button>
    </div></div>
    <div className={`${styles.book} ${large ? styles.large : ""}`} tabIndex={0} aria-label="展开的书本，使用左右方向键翻页"
      onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={(event) => {
        const start = touch.current; touch.current = null;
        if (!start) return;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? "next" : "prev");
      }}>
      <div className={styles.base}>{leaf(leftIndex, "left")}{leaf(rightIndex, "right")}</div>
      {turn ? <div className={`${styles.turning} ${turn.direction === "next" ? styles.next : styles.prev}`} aria-hidden="true">
        <div className={styles.front}>{leaf(turn.direction === "next" ? turn.from * 2 + 1 : turn.from * 2, turn.direction === "next" ? "right" : "left")}</div>
        <div className={styles.back}>{leaf(turn.direction === "next" ? turn.to * 2 : turn.to * 2 + 1, turn.direction === "next" ? "left" : "right")}</div>
      </div> : null}
    </div>
    <nav className={styles.navigation} aria-label="立体绘本翻页">
      <button onClick={() => go("prev")} disabled={spread === 0 || !!turn}>← 上一页</button>
      <span aria-live="polite">{spread * 2 + 1}–{Math.min(spread * 2 + 2, pages.length)} / {pages.length}</span>
      <button onClick={() => go("next")} disabled={spread === count - 1 || !!turn}>下一页 →</button>
    </nav>
    <p className={styles.hint}>{large ? "图文随纸页一起阅读" : "轻轻翻动一页，让故事继续"}</p>
  </section>;
}
