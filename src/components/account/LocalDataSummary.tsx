"use client";

import { useEffect, useState } from "react";
import { DeviceMobile, ShieldCheck } from "@phosphor-icons/react";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import styles from "./Account.module.css";

interface Counts {
  books: number;
  growthRecords: number;
  photos: number;
  children: number;
}

export default function LocalDataSummary({
  cloudCharacterCount,
  showCloudCharacters = false,
}: {
  cloudCharacterCount?: number | null;
  showCloudCharacters?: boolean;
}) {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      void Promise.all([
        localStoryRepository.list(),
        localGrowthRepository.list(),
      ]).then(
        ([books, growthRecords]) => {
          if (!active) return;
          setCounts({
            books: books.length,
            growthRecords: growthRecords.length,
            photos: growthRecords.reduce(
              (total, record) => total + record.photos.length,
              0,
            ),
            children: new Set(growthRecords.map((record) => record.childKey)).size,
          });
        },
      );
    };

    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  const localStats = [
    { label: "最近绘本", value: counts?.books },
    { label: "成长记录", value: counts?.growthRecords },
    { label: "成长照片", value: counts?.photos },
    { label: "孩子档案", value: counts?.children },
  ];

  return (
    <section className={styles.summaryCard} aria-label="当前设备的数据摘要">
      <div className={styles.summaryHeader}>
        <div>
          <p className={styles.sectionKicker}>LOCAL FAMILY DATA</p>
          <h2>当前设备</h2>
        </div>
        <span className={styles.summaryBadge}>
          <ShieldCheck /> 仅保存在当前浏览器
        </span>
      </div>
      <div className={styles.summaryGrid}>
        {localStats.map((item) => (
          <div className={styles.stat} key={item.label}>
            <span>{item.label}</span>
            <strong>
              {item.value === undefined
                ? "—"
                : `${item.value} ${
                    item.label === "最近绘本"
                      ? "本"
                      : item.label === "成长记录"
                        ? "条"
                        : item.label === "成长照片"
                          ? "张"
                          : "个"
                  }`}
            </strong>
          </div>
        ))}
        {showCloudCharacters ? (
          <div className={styles.stat}>
            <span>云端家庭角色</span>
            <strong>
              {typeof cloudCharacterCount === "number"
                ? `${cloudCharacterCount} 个`
                : "—"}
            </strong>
          </div>
        ) : null}
      </div>
      <p className={styles.summaryHint}>
        <DeviceMobile /> 这些绘本和成长记录属于当前浏览器；清除浏览器数据前请谨慎操作。
      </p>
    </section>
  );
}
