"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenText, ShieldCheck, Trash } from "@phosphor-icons/react";
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

function isUsableStoryCover(imageUrl?: string) {
  const normalized = imageUrl?.trim().toLowerCase();
  return Boolean(normalized && !normalized.startsWith("data:image/svg+xml"));
}

function getStoryCover(record: StoryHistoryRecord) {
  return record.result.pages.find(
    (page) => page.imageStatus === "complete" && isUsableStoryCover(page.imageUrl),
  )?.imageUrl;
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
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteDialogTitleId = useId();
  const deleteDialogDescriptionId = useId();
  const visibleRecords = controlled ? records : internalRecords;
  const pendingDeleteRecord = visibleRecords.find(
    (record) => record.storyId === pendingDeleteId,
  );
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
        deleteTitle: "删除这本绘本？",
        deleteHint: (coverTitle: string) =>
          `只会删除当前浏览器里的《${coverTitle}》，不会影响云端副本或已经公开的分享链接。`,
        deleteCancel: "取消",
        deleteConfirm: "确认删除",
        deleteError: "删除没有完成，请稍后重试。",
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
        deleteTitle: "Delete this storybook?",
        deleteHint: (coverTitle: string) =>
          `This removes “${coverTitle}” from this browser only. Cloud copies and published share links are not affected.`,
        deleteCancel: "Cancel",
        deleteConfirm: "Delete",
        deleteError: "The storybook could not be deleted. Please try again.",
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

  useEffect(() => {
    if (!pendingDeleteRecord) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmDeleteButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletingId) {
        setPendingDeleteId("");
        setDeleteError("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [deletingId, pendingDeleteRecord]);

  function requestDelete(storyId: string) {
    setDeleteError("");
    setPendingDeleteId(storyId);
  }

  function cancelDelete() {
    if (deletingId) return;
    setPendingDeleteId("");
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!pendingDeleteRecord || deletingId) return;
    const storyId = pendingDeleteRecord.storyId;
    setDeletingId(storyId);
    setDeleteError("");
    try {
      await localStoryRepository.remove(storyId);
      const next = await localStoryRepository.list();
      if (next.some((record) => record.storyId === storyId)) {
        throw new Error("local-story-delete-not-persisted");
      }
      if (!controlled) setInternalRecords(next);
      onRecordsChange?.(next);
      setPendingDeleteId("");
    } catch {
      setDeleteError(copy.deleteError);
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
        {visibleRecords.slice(0, 10).map((record) => {
          const coverImage = getStoryCover(record);
          return (
            <article
              className="history-item"
              data-status={record.status}
              key={record.storyId}
            >
              <div className="history-cover" data-placeholder={!coverImage}>
                {coverImage ? (
                  <img src={coverImage} alt="" loading="lazy" />
                ) : (
                  <>
                    <BookOpenText aria-hidden="true" weight="duotone" />
                    <small>{locale === "zh" ? "绘本" : "BOOK"}</small>
                  </>
                )}
              </div>
              <div className="history-copy">
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
                  aria-haspopup="dialog"
                  onClick={() => requestDelete(record.storyId)}
                >
                  {deletingId === record.storyId && locale === "zh" ? "删除中" : copy.remove}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {pendingDeleteRecord ? (
        <div
          className={styles.deleteDialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelDelete();
          }}
        >
          <section
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={deleteDialogTitleId}
            aria-describedby={deleteDialogDescriptionId}
          >
            <span className={styles.deleteDialogIcon} aria-hidden="true">
              <Trash weight="duotone" />
            </span>
            <div>
              <p className={styles.deleteDialogKicker}>
                {locale === "zh" ? "当前设备" : "THIS DEVICE"}
              </p>
              <h3 id={deleteDialogTitleId}>{copy.deleteTitle}</h3>
              <p id={deleteDialogDescriptionId}>
                {copy.deleteHint(pendingDeleteRecord.result.coverTitle)}
              </p>
            </div>
            {deleteError ? (
              <p className={styles.deleteDialogError} role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={styles.deleteDialogCancel}
                disabled={Boolean(deletingId)}
                onClick={cancelDelete}
              >
                {copy.deleteCancel}
              </button>
              <button
                ref={confirmDeleteButtonRef}
                type="button"
                className={styles.deleteDialogConfirm}
                disabled={Boolean(deletingId)}
                onClick={() => void confirmDelete()}
              >
                {deletingId ? (locale === "zh" ? "删除中…" : "Deleting…") : copy.deleteConfirm}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
