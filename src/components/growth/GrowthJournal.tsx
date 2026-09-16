"use client";
import { useState } from "react";
import Link from "next/link";
import { groupGrowthRecordsByChild, type GrowthRecord } from "@/lib/growth-records";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import { useAuth } from "@/hooks/useAuth";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import styles from "./GrowthJournal.module.css";

export default function GrowthJournal({ records, loading, local = false, error = false }: {
  records: GrowthRecord[]; loading: boolean; local?: boolean; error?: boolean;
}) {
  const { session, supabase } = useAuth();
  const account = useAccountSync();
  const [opening, setOpening] = useState("");
  const [openError, setOpenError] = useState("");
  async function openBook(record: GrowthRecord) {
    if (opening) return;
    setOpening(record.id); setOpenError("");
    try {
      if (!local && session && supabase) {
        // The timeline already holds the selected book and its readable URLs.
        // Do not download every illustration before opening the reader.
        const story = account.stories.find(item => item.clientStoryId === record.storyId)?.result || record.story;
        await localStoryRepository.save({ result: story });
        window.location.href = `/?mode=minimal&book=${encodeURIComponent(story.storyId)}`;
      } else {
        const existing = await localStoryRepository.get(record.storyId);
        if (!existing) await localStoryRepository.save({ result: record.story });
        window.location.href = `/?mode=minimal&book=${encodeURIComponent(existing?.clientStoryId || record.story.storyId)}`;
      }
    } catch { setOpenError("绘本暂时没能打开，请检查网络后重试。成长记录仍然保留。"); }
    finally { setOpening(""); }
  }
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const children = groupGrowthRecordsByChild(records);
  const active = children.some(child => child.childKey === selected) ? selected : "";
  const visible = records.filter(record => (!active || record.childKey === active) &&
    `${record.idea} ${record.note} ${record.story.coverTitle}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a,b) => b.occurredOn.localeCompare(a.occurredOn));
  const months = [...new Set(visible.map(record => record.occurredOn.slice(0,7)))];
  return <div className={styles.journal}>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>一点一滴，都是长大的模样</p><h2>把小小的今天，<br />留给长大的你。</h2><p className={styles.intro}>真实的小事、珍贵的照片，还有只属于你们的故事。</p>
      <Link className={styles.create} href="/?mode=minimal#story-creation">＋ 记录成长时刻</Link></div>
      <div className={styles.keepsake} aria-hidden="true"><span>我们的成长手记</span><strong>{records.length.toString().padStart(2,"0")}</strong><small>个值得记住的时刻</small><i>慢慢长大 · 好好收藏</i></div>
    </header>
    {local ? <p className={styles.localNote}>记录保存在当前浏览器。<Link href="/login?next=%2Fme">登录查看并同步家庭记录 →</Link></p> : null}
    {records.length > 0 ? <div className={styles.toolbar}><div className={styles.filters} aria-label="按孩子筛选"><button aria-pressed={!active} onClick={() => setSelected("")}>全部时刻 <span>{records.length}</span></button>{children.length > 1 ? children.map(child => <button key={child.childKey} aria-pressed={active === child.childKey} onClick={() => setSelected(child.childKey)}>{child.childName}</button>) : null}</div><input type="search" aria-label="搜索成长记录" placeholder="找找记忆里的小事…" value={search} onChange={event => setSearch(event.target.value)} /></div> : null}
    {openError ? <p role="alert">{openError}</p> : null}
    {loading && !records.length ? <p className={styles.empty} role="status">正在翻开成长手记…</p> : error ? <p className={styles.empty} role="alert">暂时没能读取成长记录，请稍后重试。</p> : !records.length ? <section className={styles.empty}><span>✧</span><h3>第一篇成长手记，从今天开始</h3><p>第一次骑车、睡前的一句话、一次勇敢的尝试。<br />不用等特别的日子，平凡的小事也值得留下。</p><Link href="/?mode=minimal#story-creation">记录第一件小事 →</Link></section> : !visible.length ? <p className={styles.empty}>没有找到相关记录，试试其他关键词。</p> : <section aria-label="成长时间轴" className={styles.timeline}>{months.map(month => <section className={styles.month} key={month}><h3><strong>{Number(month.slice(5))}月</strong><span>{month.slice(0,4)}</span></h3><div className={styles.entries}>{visible.filter(record=>record.occurredOn.startsWith(month)).map(record => {
      const cover = record.story.pages.find(page=>page.imageUrl && page.imageStatus === "complete")?.imageUrl;
      return <article key={record.id} className={styles.entry}><time dateTime={record.occurredOn}>{Number(record.occurredOn.slice(8))}<small>日</small></time><button type="button" disabled={Boolean(opening)} onClick={() => void openBook(record)} className={styles.entryLink}>
        <div className={styles.cover}>{cover ? <img src={cover} alt={`${record.story.coverTitle}绘本封面`} loading="lazy" /> : <span>成长<br />手记</span>}</div>
        <div className={styles.copy}><h4>{record.idea || record.story.coverTitle}</h4>{record.note ? <p>{record.note}</p> : null}<span className={styles.read}>{opening === record.id ? "正在打开绘本…" : "翻开这段成长故事"}</span></div>
      </button></article>;
    })}</div></section>)}</section>}
  </div>;
}
