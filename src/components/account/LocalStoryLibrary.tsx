"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText, ShieldCheck } from "@phosphor-icons/react";
import clsx from "clsx";
import type { StoryHistoryRecord } from "@/lib/client-history";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import styles from "./Account.module.css";

type Locale = "zh" | "en";

function formatHistoryTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(record: StoryHistoryRecord, locale: Locale) {
  if (locale === "en") {
    if (record.status === "complete") return "Complete";
    if (record.status === "failed") return "Needs retry";
    return "Generating";
  }
  if (record.status === "complete") return "已完成";
  if (record.status === "failed") return "有页面需重试";
  return "生成中";
}

export default function LocalStoryLibrary({
  locale = "zh",
  records,
  minimal = false,
  showWhenEmpty = false,
  showLocalNotice = false,
  title,
  hint,
  onOpen,
  onRecordsChange,
}: {
  locale?: Locale;
  records?: StoryHistoryRecord[];
  minimal?: boolean;
  showWhenEmpty?: boolean;
  showLocalNotice?: boolean;
  title?: string;
  hint?: string;
  onOpen?: (record: StoryHistoryRecord) => void;
  onRecordsChange?: (records: StoryHistoryRecord[]) => void;
}) {
  const controlled = records !== undefined;
  const [internalRecords, setInternalRecords] = useState<StoryHistoryRecord[]>([]);
  const [loading, setLoading] = useState(!controlled);
  const [deletingId, setDeletingId] = useState("");
  const visibleRecords = controlled ? records : internalRecords;
  const copy = locale === "zh"
    ? {
        title: "最近作品",
        hint: "本机保存的作品，未完成绘本会置顶。",
        open: "继续查看",
        remove: "删除",
        emptyTitle: "还没有本地绘本",
        emptyHint: "完成第一本绘本后，它会自动出现在这里。",
        create: "创作第一本绘本",
        loading: "正在读取当前浏览器里的绘本",
      }
    : {
        title: "Recent books",
        hint: "Saved on this browser. Unfinished books stay on top.",
        open: "Continue",
        remove: "Delete",
        emptyTitle: "No local books yet",
        emptyHint: "Your first completed storybook will appear here automatically.",
        create: "Create a storybook",
        loading: "Loading books saved in this browser",
      };

  useEffect(() => {
    if (controlled) {
      setLoading(false);
      return;
    }
    let active = true;
    const load = () => {
      void localStoryRepository.list()
        .then((next) => {
          if (active) setInternalRecords(next);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [controlled]);

  async function handleDelete(storyId: string) {
    const record = visibleRecords.find((item) => item.storyId === storyId);
    if (
      !window.confirm(
        locale === "zh"
          ? `仅删除当前浏览器里的《${record?.result.coverTitle || "这本绘本"}》吗？`
          : `Delete “${record?.result.coverTitle || "this storybook"}” from this browser only?`,
      )
    ) {
      return;
    }
    setDeletingId(storyId);
    try {
      await localStoryRepository.remove(storyId);
      const next = await localStoryRepository.list();
      if (!controlled) setInternalRecords(next);
      onRecordsChange?.(next);
    } finally {
      setDeletingId("");
    }
  }

  function handleOpen(record: StoryHistoryRecord) {
    if (onOpen) {
      onOpen(record);
      return;
    }
    window.location.href = `/?book=${encodeURIComponent(record.storyId)}`;
  }

  if (loading && showWhenEmpty) {
    return (
      <section className={styles.libraryBusy} aria-live="polite">
        <BookOpenText size={25} />
        <p>{copy.loading}</p>
      </section>
    );
  }

  if (visibleRecords.length === 0) {
    if (!showWhenEmpty) return null;
    return (
      <section className={styles.emptyLibrary}>
        <BookOpenText size={28} />
        <h2>{copy.emptyTitle}</h2>
        <p>{copy.emptyHint}</p>
        <Link className={styles.primaryButton} href="/?mode=minimal">
          {copy.create}
        </Link>
      </section>
    );
  }

  return (
    <section
      className={clsx("history-panel", minimal && "minimal-history-panel")}
      aria-label={title || copy.title}
    >
      <div className="history-header">
        <div>
          <h2>{title || copy.title}</h2>
          <p>{hint || copy.hint}</p>
        </div>
        {showLocalNotice ? (
          <span className={styles.localNotice}>
            <ShieldCheck /> 仅保存在当前浏览器
          </span>
        ) : null}
      </div>
      <div className="history-list">
        {visibleRecords.slice(0, 10).map((record) => (
          <article
            className="history-item"
            data-status={record.status}
            key={record.storyId}
          >
            <div>
              <div className="history-title-row">
                <h3>{record.result.coverTitle}</h3>
                <span>{getStatusLabel(record, locale)}</span>
              </div>
              <p>
                {record.result.input.childName} · {record.imageProgress.complete}/
                {record.imageProgress.total} · {formatHistoryTime(record.updatedAt, locale)}
              </p>
            </div>
            <div className="history-actions">
              <button
                type="button"
                className="history-open-btn"
                onClick={() => handleOpen(record)}
              >
                {copy.open}
              </button>
              <button
                type="button"
                className="text-danger-btn"
                disabled={deletingId === record.storyId}
                onClick={() => void handleDelete(record.storyId)}
              >
                {deletingId === record.storyId && locale === "zh" ? "删除中" : copy.remove}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
