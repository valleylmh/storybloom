"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GiftReader, { type GiftPage } from "./GiftReader";
import styles from "./GraduationGift.module.css";

import type { IllustratedGiftBook } from "./illustrated-gifts";

export default function IllustratedGift({ book }: { book: IllustratedGiftBook }) {
  const pages: GiftPage[] = book.texts.map((text, index) => ({
    page: index + 1, text,
    imageUrl: `/gift-books/${book.slug}/spread-${Math.floor(index / 2) + 1}.webp`,
    half: index % 2 ? "right" : "left",
  }));
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");
  const coverRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => { setOpen(true); setOpening(false); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
    return () => window.clearTimeout(timer);
  }, [opening]);
  useEffect(() => { if (open) closeRef.current?.focus({ preventScroll: true }); }, [open]);

  async function share() {
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      setMessage("这是本地样书，公开上线后才能把阅读链接发送给朋友。现在可以下载样书原图。");
      return;
    }
    const url = `${location.origin}/gifts/${book.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: `${book.title} · ${book.theme}绘本`, text: book.dedication, url });
      else { await navigator.clipboard.writeText(url); setMessage("阅读链接已复制，可以发送给朋友。"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("暂时无法分享，请复制浏览器地址栏中的链接。");
    }
  }

  return <main className={styles.gift} style={{ backgroundColor: book.background }}>
    <nav className={styles.topbar}><Link href="/gifts" className={styles.brand}>STORYBLOOM <span>礼物绘本</span></Link><button onClick={share}>分享这本礼物 ↗</button></nav>
    {!open ? <section className={styles.hero}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{book.eyebrow}</p>
        <span className={styles.tag}>{book.theme} · 公开样书</span>
        <h1>{book.headline[0]}<br /><span>{book.headline[1]}</span></h1>
        <p className={styles.description} style={{ whiteSpace: "pre-line" }}>{book.description}</p>
        <div className={styles.dedication}><span>TO · {book.recipient}</span><p style={{ whiteSpace: "pre-line" }}>{book.dedication}</p><small>一份值得珍藏的{book.theme}</small></div>
        <button className={styles.primary} disabled={opening} onClick={() => setOpening(true)}>拆开这份礼物 <span>↗</span></button>
        <p className={styles.note}>原创故事 · 图文一体 · 立体翻阅</p>
      </div>
      <div className={styles.stage}>
        <button ref={coverRef} className={`${styles.cover} ${opening ? styles.opening : ""}`} disabled={opening} onClick={() => setOpening(true)} aria-label={`打开${book.title}`}>
          <img src={`/gift-books/${book.slug}/cover.webp`} alt={`${book.title}，${book.theme}绘本封面`} width={1086} height={1448} style={{ height: "auto" }} />
        </button>
        <span className={styles.seal}>{book.seal[0]}<br />{book.seal[1]}</span>
      </div>
    </section> : <section className={styles.reading}><header><div><p className={styles.eyebrow}>A GIFT TO KEEP</p><h1>{book.title}</h1></div><button ref={closeRef} onClick={() => { setOpen(false); requestAnimationFrame(() => coverRef.current?.focus({ preventScroll: true })); }}>合上绘本</button></header><GiftReader title={book.title} pages={pages} /><p className={styles.readingGift}>{book.dedication}</p></section>}
    <p role="status" className={styles.message}>{message}</p>
    <section className={styles.commission}><div><p className={styles.eyebrow}>MADE FOR YOUR STORY</p><h2>下一本，写你们的故事。</h2><p>{book.commission}</p></div><div className={styles.actions}><Link href="/custom">了解绘本定制 ↗</Link><a href={`/gift-books/${book.slug}/${book.slug}-artwork.zip`} download>下载样书原图 ↓</a><small>本册为虚构人物公开样书 · 封面 + {pages.length} 页正文</small></div></section>
    <footer className={styles.footer}><span>STORYBLOOM · 让心意，有一本书的模样。</span><Link href="/privacy">隐私与数据</Link></footer>
  </main>;
}
