"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GiftReader, { type GiftPage } from "./GiftReader";
import styles from "./GraduationGift.module.css";

export default function JourneyWestGift({ pages, chapters }: { pages: GiftPage[]; chapters: Array<{title:string;pageIndex:number}> }) {
  const [open,setOpen]=useState(false);
  const [opening,setOpening]=useState(false);
  const [notice,setNotice]=useState("");
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{ if(!opening)return; const timer=window.setTimeout(()=>{setOpen(true);setOpening(false);},window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:650); return ()=>window.clearTimeout(timer); },[opening]);
  useEffect(()=>{if(open)closeRef.current?.focus({preventScroll:true});},[open]);
  async function share(){
    if(location.hostname==="localhost" || location.hostname==="127.0.0.1"){setNotice("当前是本地样书，公开上线后即可分享阅读链接。");return;}
    try { const url=`${location.origin}/gifts/journey-to-the-west`; if(navigator.share)await navigator.share({title:"西游记 · 全集典藏版",url});else {await navigator.clipboard.writeText(url);setNotice("阅读链接已复制。");} } catch(e){if(!(e instanceof DOMException && e.name==="AbortError"))setNotice("请复制地址栏中的链接分享。");}
  }
  return <main className={styles.gift}>
    <nav className={styles.topbar}><Link href="/gifts" className={styles.brand}>STORYBLOOM <span>礼物绘本</span></Link><button onClick={share}>分享这本礼物 ↗</button></nav>
    {!open ? <section className={styles.hero}><div className={styles.intro}><p className={styles.eyebrow}>THE JOURNEY WEST COLLECTION · 03</p><span className={styles.tag}>东方经典 · 全集典藏版</span><h1>翻过千山，<br />读懂<span>勇敢与陪伴。</span></h1><p className={styles.description}>从花果山的第一声欢笑，到取经归来的圆满，<br />和悟空一起，把漫长的路走成成长的故事。</p><div className={styles.dedication}><span>TO · 心里装着远方的小小读者</span><p>愿你有出发的勇气，<br />也有一路同行的伙伴。</p><small>60 回 · {chapters.length} 个分篇 · {pages.length} 页完整插画</small></div><button className={styles.primary} disabled={opening} onClick={()=>setOpening(true)}>翻开西游记 ↗</button><p className={styles.note}>完整合订 · 章节直达 · 立体翻阅</p></div><div className={styles.stage}><button className={`${styles.cover} ${styles.cityCover} ${styles.journeyCover} ${opening?styles.opening:""}`} aria-label="打开西游记" disabled={opening} onClick={()=>setOpening(true)}><span className={styles.cityCoverTitle}><small>从石猴出世，到五圣成真</small><strong>西游记</strong><span>60 回 · 全集典藏版</span></span><img src="/library/xiyouji/shi-hou-chu-shi/1.webp" alt="花果山上的小猴王" /><span className={styles.cityImprint}>STORYBLOOM · 与勇敢同行</span></button></div></section> : <section className={styles.reading}><header><div><p className={styles.eyebrow}>THE JOURNEY WEST</p><h1>西游记</h1></div><button ref={closeRef} onClick={()=>setOpen(false)}>合上绘本</button></header><GiftReader title="西游记 · 全集典藏版" pages={pages} chapters={chapters}/></section>}
    <p role="status" className={styles.message}>{notice}</p>
    <section className={styles.commission}><div><p className={styles.eyebrow}>A JOURNEY TO TREASURE</p><h2>送给那个，心里有远方的孩子。</h2><p>把勇敢、坚持与同行的温暖，留成一本可以反复翻开的礼物。</p></div><div className={styles.actions}><Link href="/custom">了解主题绘本定制 ↗</Link><Link href="/gifts/summer-pocket">看看毕业纪念绘本 ↗</Link><small>{chapters.length} 篇中文故事完整收录 · 原有图片完整保留</small></div></section><footer className={styles.footer}><Link href="/gifts">STORYBLOOM · 礼物绘本</Link><Link href="/privacy">隐私与数据</Link></footer>
  </main>;
}
