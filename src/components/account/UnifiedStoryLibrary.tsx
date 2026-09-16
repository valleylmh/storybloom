"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import AccountSyncStatus from "@/components/sync/AccountSyncStatus";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import { revokeSharesBeforeStoryDeletion } from "@/lib/client-share-management";
import type { SavedStory } from "@/lib/repositories/story-repository";
import styles from "./StoryCollection.module.css";

export default function UnifiedStoryLibrary() {
  const { supabase, session, loading: authLoading } = useAuth();
  const sync = useAccountSync();
  const [local, setLocal] = useState<SavedStory[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<SavedStory | null>(null);
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (session || authLoading) return;
    let active = true;
    const load = () => {void localStoryRepository.list().then(rows=>{if(active)setLocal(rows);}).catch(()=>{if(active)setError("本机作品暂时未能读取，请稍后重试。");}).finally(()=>{if(active)setLocalLoading(false);});};
    load(); window.addEventListener("focus",load);
    return ()=>{active=false;window.removeEventListener("focus",load);};
  }, [session,authLoading]);
  const records = session ? sync.stories : local;
  const loading = authLoading || (session ? sync.loading : localLoading);
  const visible = records.filter(story => (filter === "all" || (filter === "complete" ? story.status === "complete" : story.status !== "complete")) && story.result.coverTitle.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a,b)=> b.updatedAt.localeCompare(a.updatedAt));
  async function act(story: SavedStory, action: "open" | "rename" | "delete") {
    if (busy) return;
    if (action === "rename" && !title.trim()) return;
    if (action === "delete" && !window.confirm(`删除《${story.result.coverTitle}》？${session ? "其他设备同步后也会移除，" : ""}相关分享将撤销。`)) return;
    setBusy(story.clientStoryId); setError("");
    try {
      if (action === "open") {
        await localStoryRepository.save({ result: story.result });
        window.location.href = `/?mode=minimal&book=${encodeURIComponent(story.result.storyId)}`;
        return;
      }
      const operation = async () => {
        const repository = supabase && session ? createCloudStoryRepository(supabase, session.user.id) : null;
        const remote = repository ? (await repository.list()).find(row => row.clientStoryId === story.clientStoryId) : undefined;
        if (action === "rename") {
          if (remote && repository) await repository.update(remote.id, { title: title.trim() });
          else await localStoryRepository.update(story.clientStoryId, { title: title.trim() });
          return;
        }
        await revokeSharesBeforeStoryDeletion({ storyId: story.clientStoryId, accessToken: session?.access_token });
        if (remote && repository) await repository.remove(remote.id);
        await localStoryRepository.remove(story.clientStoryId);
      };
      if (session) await sync.mutate(operation);
      else { await operation(); setLocal(await localStoryRepository.list()); }
      setEditing(null);
    } catch { setError("操作尚未完成，请检查网络后重试。已有作品仍可在列表中查看。"); }
    finally { setBusy(""); }
  }
  return <main className={styles.collection}>
    <header className={styles.hero}><div><p>每一本，都是你们的故事</p><h2>把想象，收藏成一本本绘本。</h2><span>{records.length} 本专属作品 · 随时翻开，继续创造</span></div><Link href="/?mode=minimal#story-creation">＋ 创作新绘本</Link></header>
    <div className={styles.toolbar}><div className={styles.filters} aria-label="作品状态">{[["all","全部作品"],["complete","已完成"],["pending","待完成"]].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><input type="search" aria-label="搜索我的绘本" placeholder="搜索作品名称…" value={search} onChange={event=>setSearch(event.target.value)} /></div>
    {error ? <p role="alert">{error}</p> : null}
    {editing ? <form className={styles.edit} onSubmit={event=>{event.preventDefault();void act(editing,"rename");}}><label>绘本名称<input autoFocus maxLength={120} value={title} onChange={event=>setTitle(event.target.value)} /></label><button disabled={!!busy || !title.trim()} type="submit">保存名称</button><button disabled={!!busy} type="button" onClick={()=>setEditing(null)}>取消</button></form> : null}
    {!records.length ? <section className={styles.empty}><span>✦</span><h3>{loading ? "正在整理你的书架…" : "第一本绘本，从一个小小的想法开始"}</h3>{!loading ? <><p>写下今天的小事，让孩子成为故事的主角。</p><Link href="/?mode=minimal#story-creation">开始创作 →</Link></> : null}</section> : !visible.length ? <p className={styles.empty}>没有找到符合条件的作品，试试其他名称或状态。</p> : null}
    <section className={styles.grid} aria-label={session ? "账号绘本" : "本机绘本"}>{visible.map(story => {
      const cover = story.result.pages.find(page=>page.imageUrl && !page.imageUrl.startsWith("data:image/svg+xml"))?.imageUrl;
      return <article className={styles.book} key={story.clientStoryId}>
        <button className={styles.open} disabled={!!busy} onClick={()=>void act(story,"open")} aria-label={`阅读《${story.result.coverTitle}》`}><span className={styles.cover}>{cover ? <img src={cover} alt="" loading="lazy" /> : <span>{story.result.coverTitle}</span>}{story.status !== "complete" ? <small>待完成</small> : null}</span><h3>{story.result.coverTitle}</h3></button>
        <div className={styles.bookFooter}><button className={styles.read} disabled={!!busy} onClick={()=>void act(story,"open")}>{busy===story.clientStoryId ? "处理中…" : story.status === "complete" ? "翻开绘本" : "继续创作"}</button><details className={styles.more}><summary aria-label={`管理《${story.result.coverTitle}》`}>•••</summary><div><button disabled={!!busy} onClick={()=>{setEditing(story);setTitle(story.result.coverTitle);}}>改标题</button><button className={styles.delete} disabled={!!busy} onClick={()=>void act(story,"delete")}>删除</button></div></details></div>
      </article>;
    })}</section>
    <details className={styles.sync} open={sync.needsPhotoConsent || undefined}><summary>{session ? "同步状态与详情" : "本机保存与跨设备同步"}</summary><AccountSyncStatus /></details>
    <p className={styles.readingLink}>想继续读绘本馆的故事？<Link href="/library/reading">查看阅读记录与收藏 →</Link></p>
  </main>;
}
