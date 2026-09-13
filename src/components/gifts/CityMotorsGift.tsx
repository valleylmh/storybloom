"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GiftReader, { type GiftPage } from "./GiftReader";
import styles from "./GraduationGift.module.css";

export default function CityMotorsGift({ pages, chapters }: { pages: GiftPage[]; chapters: Array<{title:string;pageIndex:number}> }) {
  const [open,setOpen]=useState(false);
  const [opening,setOpening]=useState(false);
  const [notice,setNotice]=useState("");
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{ if(!opening)return; const timer=window.setTimeout(()=>{setOpen(true);setOpening(false);},window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:650); return ()=>window.clearTimeout(timer); },[opening]);
  useEffect(()=>{if(open)closeRef.current?.focus({preventScroll:true});},[open]);
  async function share(){
    if(location.hostname==="localhost" || location.hostname==="127.0.0.1"){setNotice("当前是本地样书，公开上线后即可分享阅读链接。");return;}
    try { const url=`${location.origin}/gifts/city-motors`; if(navigator.share)await navigator.share({title:"城市汽车小队 · 全集典藏版",url});else {await navigator.clipboard.writeText(url);setNotice("阅读链接已复制。");} } catch(e){if(!(e instanceof DOMException && e.name==="AbortError"))setNotice("请复制地址栏中的链接分享。");}
  }
  return <main className={styles.gift}>
    <nav className={styles.topbar}><Link href="/gifts" className={styles.brand}>STORYBLOOM <span>礼物绘本</span></Link><button onClick={share}>分享这本礼物 ↗</button></nav>
    {!open ? <section className={styles.hero}><div className={styles.intro}><p className={styles.eyebrow}>THE CURIOUS CITY COLLECTION · 02</p><span className={styles.tag}>交通与工程 · 全集典藏版</span><h1>把整座城市，<br />装进<span>一本书。</span></h1><p className={styles.description}>跟着安安，从第一个红绿灯出发，<br />认识守护城市的车辆，见证一座公园的诞生。</p><div className={styles.dedication}><span>TO · 爱问为什么的小小探索家</span><p>每一次出发，<br />都是发现世界的开始。</p><small>26 个完整故事 · 368 页原有插画 · 全新城市开场</small></div><button className={styles.primary} disabled={opening} onClick={()=>setOpening(true)}>打开汽车大绘本 ↗</button><p className={styles.note}>完整合订 · 章节直达 · 立体翻阅</p></div><div className={styles.stage}><button className={`${styles.cover} ${styles.cityCover} ${opening?styles.opening:""}`} aria-label="打开城市汽车小队" disabled={opening} onClick={()=>setOpening(true)}><span className={styles.cityCoverTitle}><small>给小小探索家的城市发现之旅</small><strong>城市汽车小队</strong><span>26 个故事 · 全集典藏版</span></span><img src="/library/qiche/hong-lu-deng-wei-shen-me-hui-bian-se/1.webp" alt="安安和妈妈一起观察城市路口" /><span className={styles.cityImprint}>STORYBLOOM · 好奇心出发</span></button></div></section> : <section className={styles.reading}><header><div><p className={styles.eyebrow}>THE CURIOUS CITY</p><h1>城市汽车小队</h1></div><button ref={closeRef} onClick={()=>setOpen(false)}>合上绘本</button></header><GiftReader title="城市汽车小队 · 全集典藏版" pages={pages} chapters={chapters}/></section>}
    <p role="status" className={styles.message}>{notice}</p>
    <section className={styles.commission}><div><p className={styles.eyebrow}>A BOOK FOR EVERY CURIOUS MIND</p><h2>送给那个，爱问为什么的孩子。</h2><p>从城市交通到工程合作，把日常的好奇变成可以珍藏的礼物。</p></div><div className={styles.actions}><Link href="/custom">了解主题绘本定制 ↗</Link><Link href="/gifts/summer-pocket">看看毕业纪念绘本 ↗</Link><small>26 章中文故事完整收录 · 原有图片完整保留</small></div></section><footer className={styles.footer}><Link href="/gifts">STORYBLOOM · 礼物绘本</Link><Link href="/privacy">隐私与数据</Link></footer>
  </main>;
}
