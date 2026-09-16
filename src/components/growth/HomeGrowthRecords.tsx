"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import type { GrowthRecord } from "@/lib/growth-records";

export default function HomeGrowthRecords({ locale }: { locale: "zh" | "en" }) {
  const { session, loading: authLoading } = useAuth();
  const sync = useAccountSync();
  const [local, setLocal] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (session || authLoading) return;
    let active = true;
    const load = () => { void localGrowthRepository.list().then(rows => { if (active) { setLocal(rows); setFailed(false); } }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); }); };
    load();
    window.addEventListener("storybloom:account-data-dirty", load);
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("storybloom:account-data-dirty", load); window.removeEventListener("focus", load); };
  }, [session, authLoading]);
  const records = [...(session ? sync.growth : local)].sort((a,b) => b.occurredOn.localeCompare(a.occurredOn)).slice(0,3);
  const pending = authLoading || (session ? sync.loading : loading);
  const zh = locale === "zh";
  return <section className="home-growth-records" aria-label={zh ? "成长记录" : "Growth moments"}>
    <header className="home-record-heading"><div><h2>{zh ? "成长记录" : "Growth moments"}</h2><p>{zh ? "留下孩子真实的小事，慢慢长成一本成长故事。" : "Little moments that become your child’s story."}</p></div><Link href="/me">{zh ? "查看全部 →" : "View all →"}</Link></header>
    {records.length ? <ol className="home-growth-timeline">{records.map(record => <li key={record.id}>
      <time dateTime={record.occurredOn}>{record.occurredOn.replaceAll("-", ".")}</time>
      <Link href={`/me/growth/${encodeURIComponent(record.childKey)}`}>
        {record.story.pages.find(page => page.imageUrl && page.imageStatus === "complete")?.imageUrl ? <img className="home-growth-thumb" src={record.story.pages.find(page => page.imageUrl && page.imageStatus === "complete")!.imageUrl} alt="" loading="lazy" /> : <span className="home-growth-thumb home-growth-thumb-empty" aria-hidden="true">✦</span>}
        <div><h3>{record.idea || record.story.coverTitle}</h3></div>
      </Link>
    </li>)}</ol> : pending ? <p role="status">{zh ? "正在读取成长记录…" : "Loading moments…"}</p> : failed ? <p role="alert">{zh ? "成长记录暂未读取成功，请稍后重试。" : "Unable to load moments. Please try again."}</p> : <div className="home-record-empty"><span aria-hidden="true">✧</span><h3>{zh ? "把今天的小事，留成成长记录" : "Keep a little moment from today"}</h3><p>{zh ? "第一次骑车、一次勇敢尝试，都是值得记住的成长。" : "A first bike ride, a brave little step — memories worth keeping."}</p></div>}
    <footer className="home-growth-footer"><Link className="home-growth-create" href="/?mode=minimal#story-creation">{zh ? (records.length ? "记录新的成长时刻 ＋" : "记录第一件小事 ＋") : "Capture a moment +"}</Link>
    {!session && !authLoading ? <Link className="home-growth-login" href="/login?next=%2Fme">{zh ? (records.length ? "本机记录 · 登录后可跨设备保存" : "登录查看已有记录 →") : "Sign in to see and sync your moments →"}</Link> : null}</footer>
  </section>;
}
