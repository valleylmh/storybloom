"use client";
import Link from "next/link";
import { groupGrowthRecordsByChild } from "@/lib/growth-records";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import AccountSyncStatus from "@/components/sync/AccountSyncStatus";
import styles from "./GrowthArchive.module.css";
export default function UnifiedGrowthLibrary() {
  const sync = useAccountSync();
  const children = groupGrowthRecordsByChild(sync.growth);
  return <main className={styles.embeddedPage}>
    <header className={styles.libraryHero}><div><h1>成长记录</h1><p>同一账号的成长时刻、照片和绘本，在电脑与手机间同步。</p></div><Link href="/?mode=minimal">记录成长时刻</Link></header>
    <AccountSyncStatus />
    {!children.length && !sync.loading ? <section className={styles.emptyState}><h2>还没有成长记录</h2><p>在保存过记录的设备上登录同一邮箱，即可开始同步。</p></section> : null}
    <section className={styles.childGrid} aria-label="孩子成长书架">
      {children.map(child => <Link className={styles.childCard} key={child.childKey} href={`/me/growth/${encodeURIComponent(child.childKey)}`}>
        <div className={styles.childVisual}>{child.coverUrl ? <img src={child.coverUrl} alt="" /> : null}</div>
        <div className={styles.childCardBody}><p>{child.recordCount} 个成长时刻</p><h2>{child.childName}的成长故事</h2><span>最近记录于 {child.latestOccurredOn}</span></div>
      </Link>)}
    </section>
  </main>;
}
