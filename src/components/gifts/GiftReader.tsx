"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
export type GiftPage = { page: number; imageUrl: string; text: string; half?: "left" | "right"; chapter?: string };
import styles from "./GiftReader.module.css";

type Turn = { from: number; to: number; direction: "next" | "prev" };

export default function GiftReader({ title, pages, chapters = [] }: { title: string; pages: GiftPage[]; chapters?: Array<{ title: string; pageIndex: number }> }) {
  const [spread, setSpread] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSpread(to);
      return;
    }
    locked.current = true;
    setTurn({ from: spread, to, direction });
  }

  function leaf(index: number, side: "left" | "right") {
    const page = pages[index];
    return <div className={`${styles.page} ${styles[side]} ${page && !page.half ? styles.editorial : ""}`}>
      {page ? <>
        <img className={`${styles.art} ${!page.half ? styles.reusedArt : ""} ${page.half === "right" ? styles.artRight : ""}`} src={page.imageUrl} alt={page.text} draggable={false} />
        {!page.half ? <div className={styles.editorialText}><p>{page.text}</p><span>{page.page}</span></div> : null}
      </> : <div className={styles.ending}><span>故事读完了</span><strong>下一站，勇敢出发。</strong></div>}
    </div>;
  }

  const leftIndex = turn?.direction === "prev" ? turn.to * 2 : spread * 2;
  const rightIndex = turn?.direction === "next" ? turn.to * 2 + 1 : spread * 2 + 1;

  return <section className={styles.reader} aria-label="立体绘本阅读器" onKeyDown={(event) => {
    if (event.target instanceof HTMLElement && event.target.closest("select, input, textarea, [contenteditable=true]")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      go(event.key === "ArrowRight" ? "next" : "prev");
    }
  }}>
    <div className={styles.toolbar}><span>{title}</span>{chapters.length > 0 ? <label>章节目录 <select aria-label="选择章节" disabled={!!turn} value={chapters.reduce((active, chapter, index) => chapter.pageIndex <= spread * 2 ? index : active, 0)} onChange={(event) => setSpread(Math.floor(chapters[Number(event.target.value)].pageIndex / 2))}>{chapters.map((chapter,index) => <option key={chapter.pageIndex} value={index}>{chapter.title}</option>)}</select></label> : null}</div>
    <div className={styles.book} style={{ "--left-step": `${1.5 + spread / Math.max(1,count-1) * 2}px`, "--right-step": `${3.5 - spread / Math.max(1,count-1) * 2}px` } as CSSProperties} tabIndex={0} aria-label="展开的书本，使用左右方向键翻页"
      onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={(event) => {
        const start = touch.current; touch.current = null;
        if (!start) return;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? "next" : "prev");
      }}>
      <div className={styles.leftStack} aria-hidden="true">{[4,3,2,1].map(level => <i key={level} style={{ "--sheet": level } as CSSProperties} />)}</div>
      <div className={styles.rightStack} aria-hidden="true">{[4,3,2,1].map(level => <i key={level} style={{ "--sheet": level } as CSSProperties} />)}</div>
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
    <p className={styles.hint}>轻轻翻动一页，让故事继续</p>
  </section>;
}
