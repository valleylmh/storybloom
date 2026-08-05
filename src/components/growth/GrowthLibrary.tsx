"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenText, Plus, ShieldCheck } from "@phosphor-icons/react";
import {
  groupGrowthRecordsByChild,
  listGrowthRecords,
  type GrowthRecord,
} from "@/lib/growth-records";
import styles from "./GrowthArchive.module.css";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function GrowthLibrary() {
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const children = useMemo(() => groupGrowthRecordsByChild(records), [records]);

  useEffect(() => {
    let active = true;
    const load = () => {
      void listGrowthRecords().then((next) => {
        if (!active) return;
        setRecords(next);
        setLoading(false);
      });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href="/?mode=minimal" className={styles.brand}>
          <span>✦</span>
          StoryBloom
          <small>成长书架</small>
        </Link>
        <Link href="/?mode=minimal" className={styles.navLink}>
          <ArrowLeft /> 返回创作
        </Link>
      </header>

      <div className={styles.shell}>
        <section className={styles.libraryHero}>
          <div>
            <p className={styles.kicker}>FAMILY GROWTH SHELF</p>
            <h1>孩子的成长故事</h1>
            <p>把真实发生的小事、家长备注、现场照片和专属绘本留在一起。</p>
          </div>
          <span className={styles.privacyLabel}>
            <ShieldCheck /> 仅保存在当前浏览器
          </span>
        </section>

        {loading ? (
          <section className={styles.loadingState} aria-label="正在加载成长记录">
            <span />
            <span />
          </section>
        ) : children.length === 0 ? (
          <section className={styles.emptyState}>
            <BookOpenText />
            <h2>还没有成长记录</h2>
            <p>回到极简模式，开启“成长记录”后生成第一本成长绘本。</p>
            <Link href="/?mode=minimal">
              <Plus /> 记录第一个成长时刻
            </Link>
          </section>
        ) : (
          <section className={styles.childGrid} aria-label="孩子成长书架">
            {children.map((child) => (
              <Link
                className={styles.childCard}
                href={`/growth/${encodeURIComponent(child.childKey)}`}
                key={child.childKey}
              >
                <div className={styles.childVisual}>
                  {child.coverUrl ? <img src={child.coverUrl} alt="" /> : null}
                  <div className={styles.childAvatar}>
                    {child.avatarUrl ? (
                      <img src={child.avatarUrl} alt="" />
                    ) : (
                      <span>{child.childName.slice(0, 1)}</span>
                    )}
                  </div>
                </div>
                <div className={styles.childCardBody}>
                  <p>{child.recordCount} 个成长时刻</p>
                  <h2>{child.childName}的成长故事</h2>
                  <span>最近记录于 {formatDate(child.latestOccurredOn)}</span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
