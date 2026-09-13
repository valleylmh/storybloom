"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GiftReader, { type GiftPage } from "./GiftReader";
import styles from "./GraduationGift.module.css";

const texts = [
  "第一次走进这里，我的手，紧紧拉着妈妈。",
  "老师蹲下来，把我的小小勇敢，轻轻接住。",
  "后来，我学会了分享，也有了最好的朋友。",
  "我们把笑声种进院子，把自己，长高了一点点。",
  "我学会了系鞋带，也学会了说：我来试试！",
  "原来，长大就是把小小的事情，认真做好。",
  "有些谢谢，我想亲手画给你。",
  "谢谢老师的每一次拥抱，也谢谢朋友，一直在身旁。",
  "毕业这天，我把夏天装进口袋。",
  "再见，幼儿园。谢谢你们，陪我长大。下一站，我会勇敢出发。",
];
const pages: GiftPage[] = texts.map((text, index) => ({ page: index + 1, text,
  imageUrl: `/gift-books/summer-pocket/spread-${[1, 2, 4, 5, 3][Math.floor(index / 2)]}.png`, half: index % 2 ? "right" : "left" }));

export default function GraduationGift() {
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
    const url = `${location.origin}/gifts/summer-pocket`;
    try {
      if (navigator.share) await navigator.share({ title: "把夏天装进口袋 · 毕业纪念绘本", text: "送给即将毕业的小小的你。", url });
      else { await navigator.clipboard.writeText(url); setMessage("阅读链接已复制，可以发送给朋友。"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("暂时无法分享，请复制浏览器地址栏中的链接。");
    }
  }

  return <main className={styles.gift}>
    <nav className={styles.topbar}><Link href="/gifts" className={styles.brand}>STORYBLOOM <span>礼物绘本</span></Link><button onClick={share}>分享这本礼物 ↗</button></nav>
    {!open ? <section className={styles.hero}>
      <div className={styles.intro}><p className={styles.eyebrow}>THE LITTLE SUMMER COLLECTION · 01</p><span className={styles.tag}>幼儿园毕业纪念 · 公开样书</span><h1>有些夏天，<br />值得装进<span>口袋。</span></h1><p className={styles.description}>把第一次勇敢、最好的朋友、舍不得的告别，<br />留成一本长大以后，还想翻开的礼物。</p><div className={styles.dedication}><span>TO · 即将毕业的小小的你</span><p>愿你带着被爱过的勇气，<br />走向更大的世界。</p><small>一份献给成长的毕业礼物</small></div><button className={styles.primary} disabled={opening} onClick={() => setOpening(true)}>拆开这份礼物 <span>↗</span></button><p className={styles.note}>原创插画 · 图文一体 · 立体翻阅</p></div>
      <div className={styles.stage}><button ref={coverRef} className={`${styles.cover} ${opening ? styles.opening : ""}`} disabled={opening} onClick={() => setOpening(true)} aria-label="打开把夏天装进口袋"><img src="/gift-books/summer-pocket/cover.png" alt="把夏天装进口袋，幼儿园毕业纪念绘本封面" /></button><span className={styles.seal}>给成长<br />一个拥抱</span></div>
    </section> : <section className={styles.reading}><header><div><p className={styles.eyebrow}>A GIFT TO KEEP</p><h1>把夏天装进口袋</h1></div><button ref={closeRef} onClick={() => { setOpen(false); requestAnimationFrame(() => coverRef.current?.focus({ preventScroll: true })); }}>合上绘本</button></header><GiftReader title="把夏天装进口袋" pages={pages} /><p className={styles.readingGift}>送给即将毕业的你：谢谢你，把平凡的日子变成闪闪发光的回忆。</p></section>}
    <p role="status" className={styles.message}>{message}</p>
    <section className={styles.commission}><div><p className={styles.eyebrow}>MADE FOR YOUR STORY</p><h2>下一本，写你们的故事。</h2><p>班级毕业礼、孩子成长纪念、送给老师的感谢。<br />把名字、共同经历和祝福，设计成属于你们的一本。</p></div><div className={styles.actions}><Link href="/custom">了解绘本定制 ↗</Link><a href="/gift-books/summer-pocket/summer-pocket-artwork.zip" download>下载样书原图 ↓</a><small>本册为虚构人物公开样书 · 封面 + 10 页正文</small></div></section>
    <footer className={styles.footer}><span>STORYBLOOM · 让心意，有一本书的模样。</span><Link href="/privacy">隐私与数据</Link></footer>
  </main>;
}
