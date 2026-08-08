"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  Camera,
  CaretDown,
  Cloud,
  Clock,
  PencilSimpleLine,
  Plus,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import {
  getGrowthRecordCover,
  isValidGrowthDate,
  type GrowthRecord,
} from "@/lib/growth-records";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import type { GrowthRepository } from "@/lib/repositories/growth-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import {
  getGrowthClientRecordId,
  type GrowthDataSource,
} from "./growth-source-model";
import styles from "./GrowthArchive.module.css";

interface Props {
  childKey: string;
  embedded?: boolean;
  basePath?: string;
  repository?: GrowthRepository;
  source?: GrowthDataSource;
  pairedClientRecordIds?: ReadonlySet<string>;
  onOpenStory?: (record: GrowthRecord) => Promise<void>;
  onDeleteAll?: (record: GrowthRecord) => Promise<void>;
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getStoryScene(record: GrowthRecord) {
  return record.story.pages.find((page) => page.imageUrl)?.imageUrl;
}

export default function GrowthTimeline({
  childKey,
  embedded = false,
  basePath = "/growth",
  repository,
  source = "local",
  pairedClientRecordIds,
  onOpenStory,
  onDeleteAll,
}: Props) {
  const activeRepository = repository || localGrowthRepository;
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setRecords([]);
    void activeRepository
      .getByChild(childKey)
      .then((next) => {
        if (!active) return;
        setRecords(next);
        const first = next[0];
        if (first) {
          setSelectedYear(first.occurredOn.slice(0, 4));
          setExpandedIds(new Set([first.id]));
        } else {
          setSelectedYear("");
          setExpandedIds(new Set());
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(
            source === "cloud"
              ? "私有云端成长记录暂时读取失败；当前设备里的记录不受影响。"
              : "当前设备里的成长记录暂时读取失败，请稍后重试。",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeRepository, childKey, source]);

  const years = useMemo(
    () => Array.from(new Set(records.map((record) => record.occurredOn.slice(0, 4)))),
    [records],
  );
  const visibleRecords = useMemo(
    () => records.filter((record) => record.occurredOn.startsWith(selectedYear)),
    [records, selectedYear],
  );
  const childName = records[0]?.childName || "孩子";
  const avatarUrl = records.find((record) => record.childAvatarDataUrl)?.childAvatarDataUrl;

  function toggleRecord(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEditing(record: GrowthRecord) {
    setEditingId(record.id);
    setEditDate(record.occurredOn);
    setEditNote(record.note);
    setNotice("");
  }

  async function saveEditing(record: GrowthRecord) {
    if (!isValidGrowthDate(editDate)) {
      setNotice("请选择有效的发生时间。");
      return;
    }
    try {
      const updated = await activeRepository.update(record.id, {
        occurredOn: editDate,
        note: editNote.trim(),
      });
      setRecords((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
      );
      setEditingId(null);
      setSelectedYear(updated.occurredOn.slice(0, 4));
      setNotice(
        source === "cloud" ? "已仅更新私有云端记录。" : "已仅更新当前设备记录。",
      );
    } catch {
      setNotice(
        source === "cloud"
          ? "私有云端记录暂时无法更新；当前设备副本没有被修改。"
          : "当前设备记录暂时无法更新；云端副本没有被修改。",
      );
    }
  }

  async function removeRecord(record: GrowthRecord) {
    const sourceLabel = source === "cloud" ? "私有云端" : "当前设备";
    if (
      !window.confirm(
        `仅删除${sourceLabel}中的《${record.story.coverTitle}》成长记录？关联绘本会继续保留。`,
      )
    ) {
      return;
    }
    setBusyAction(`delete:${record.id}`);
    try {
      await activeRepository.remove(record.id);
    } catch {
      setNotice(
        source === "cloud"
          ? "云端记录删除失败；当前设备副本没有被修改。"
          : "本机记录删除失败；云端副本没有被修改。",
      );
      setBusyAction("");
      return;
    }
    const next = records.filter((item) => item.id !== record.id);
    setRecords(next);
    setEditingId(null);
    setBusyAction("");
    setNotice(
      source === "cloud"
        ? "已仅删除私有云端记录。关联绘本仍保留。"
        : "已仅删除当前设备记录。关联绘本仍保留。",
    );
    if (!next.some((item) => item.occurredOn.startsWith(selectedYear))) {
      setSelectedYear(next[0]?.occurredOn.slice(0, 4) || "");
    }
  }

  async function openStory(record: GrowthRecord) {
    setBusyAction(`open:${record.id}`);
    setNotice("");
    try {
      if (onOpenStory) {
        await onOpenStory(record);
      } else {
        await localStoryRepository.save({ result: record.story });
        window.location.href = `/?mode=minimal&book=${encodeURIComponent(record.storyId)}`;
      }
    } catch {
      setBusyAction("");
      setNotice(
        source === "cloud"
          ? "云端绘本的私有图片未能完整保存到本机，请检查网络后重试。云端副本没有被修改。"
          : "绘本暂时无法打开，请稍后重试。",
      );
    }
  }

  async function removeAllCopies(record: GrowthRecord) {
    if (!onDeleteAll) return;
    const firstConfirmed = window.confirm(
      `第一次确认：同时删除《${record.story.coverTitle}》在当前设备和私有云端的成长记录？`,
    );
    if (!firstConfirmed) return;
    const secondConfirmed = window.confirm(
      "第二次确认：两个成长记录副本都会删除，关联绘本仍会保留。确定继续吗？",
    );
    if (!secondConfirmed) return;

    setBusyAction(`delete-all:${getGrowthClientRecordId(record)}`);
    setNotice("");
    try {
      await onDeleteAll(record);
      const next = records.filter((item) => item.id !== record.id);
      setRecords(next);
      setEditingId(null);
      setNotice("当前设备与私有云端的成长记录副本均已删除；关联绘本仍保留。");
      if (!next.some((item) => item.occurredOn.startsWith(selectedYear))) {
        setSelectedYear(next[0]?.occurredOn.slice(0, 4) || "");
      }
    } catch {
      setNotice("全部删除未能完整完成，请返回成长书架刷新并确认仍存在的副本。");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <main className={embedded ? styles.embeddedPage : styles.page}>
      {!embedded ? (
        <header className={styles.nav}>
          <Link href={basePath} className={styles.brand}>
            <span>✦</span>
            StoryBloom
            <small>成长时间轴</small>
          </Link>
          <div className={styles.navActions}>
            <span className={styles.privacyLabel}>
              {source === "cloud" ? <Cloud /> : <ShieldCheck />}
              {source === "cloud" ? "账户私有 · 跨设备可见" : "仅保存在当前浏览器"}
            </span>
            <Link href={basePath} className={styles.navLink}>
              <ArrowLeft /> 成长书架
            </Link>
          </div>
        </header>
      ) : null}

      <div className={embedded ? styles.embeddedShell : styles.shell}>
        {embedded ? (
          <div className={styles.embeddedToolbar}>
            <span className={styles.privacyLabel}>
              {source === "cloud" ? <Cloud /> : <ShieldCheck />}
              {source === "cloud" ? "私有云端记录" : "当前设备记录"}
            </span>
            <Link href={basePath} className={styles.navLink}>
              <ArrowLeft /> 返回成长书架
            </Link>
          </div>
        ) : null}
        {loading ? (
          <section className={styles.loadingState} aria-label="正在加载时间轴">
            <span />
            <span />
          </section>
        ) : loadError ? (
          <section className={styles.emptyState}>
            {source === "cloud" ? <Cloud /> : <BookOpenText />}
            <h1>暂时无法读取这条成长时间轴</h1>
            <p>{loadError}</p>
            <Link href={basePath}>返回成长书架</Link>
          </section>
        ) : records.length === 0 ? (
          <section className={styles.emptyState}>
            <BookOpenText />
            <h1>没有找到这条成长时间轴</h1>
            <p>
              {source === "cloud"
                ? "记录可能尚未主动导入、已经删除，或属于当前设备副本。"
                : "记录可能已经删除，或者只保存在私有云端。"}
            </p>
            <Link href={basePath}>返回成长书架</Link>
          </section>
        ) : (
          <>
            <section className={styles.timelineHero}>
              <div className={styles.childIdentity}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" />
                ) : (
                  <span>{childName.slice(0, 1)}</span>
                )}
                <div>
                  <p>孩子的成长记录</p>
                  <h1>{childName}的成长故事</h1>
                  <span>
                    从 {formatLongDate(records[records.length - 1].occurredOn)} 开始，已经留下 {records.length} 个成长时刻
                  </span>
                </div>
              </div>
              <Link href="/?mode=minimal" className={styles.primaryAction}>
                <Plus /> 记录新成长
              </Link>
            </section>

            <section className={styles.timelineToolbar}>
              <div className={styles.yearSwitch} aria-label="选择年份">
                {years.map((year) => (
                  <button
                    type="button"
                    className={year === selectedYear ? styles.activeYear : ""}
                    aria-pressed={year === selectedYear}
                    onClick={() => setSelectedYear(year)}
                    key={year}
                  >
                    {year}
                  </button>
                ))}
              </div>
              <span>{visibleRecords.length} 个成长时刻</span>
            </section>

            {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

            <section className={styles.timeline} aria-label={`${childName}的成长时间轴`}>
              {visibleRecords.map((record) => {
                const expanded = expandedIds.has(record.id);
                const editing = editingId === record.id;
                const sceneUrl = getStoryScene(record);
                const coverUrl = getGrowthRecordCover(record);
                return (
                  <article className={styles.timelineItem} key={record.id}>
                    <time dateTime={record.occurredOn} className={styles.timelineDate}>
                      <strong>{record.occurredOn.slice(5).replace("-", ".")}</strong>
                      <span>{record.occurredOn.slice(0, 4)}</span>
                    </time>
                    <span className={styles.timelineNode} aria-hidden="true" />
                    <section className={styles.recordCard}>
                      <button
                        type="button"
                        className={styles.recordHeader}
                        aria-expanded={expanded}
                        onClick={() => toggleRecord(record.id)}
                      >
                        <div className={styles.recordHeaderCopy}>
                          {coverUrl ? <img src={coverUrl} alt="" /> : null}
                          <div>
                            <span>{formatLongDate(record.occurredOn)}</span>
                            <h2>{record.story.coverTitle}</h2>
                            <p>{record.idea}</p>
                          </div>
                        </div>
                        <CaretDown className={expanded ? styles.caretOpen : ""} />
                      </button>

                      {expanded ? (
                        <div className={styles.recordDetail}>
                          {editing ? (
                            <div className={styles.editForm}>
                              <label>
                                <span>发生时间</span>
                                <input
                                  type="date"
                                  required
                                  value={editDate}
                                  onChange={(event) => {
                                    setEditDate(event.target.value);
                                    setNotice("");
                                  }}
                                />
                              </label>
                              <label>
                                <span>家长备注</span>
                                <textarea
                                  maxLength={200}
                                  value={editNote}
                                  onChange={(event) => setEditNote(event.target.value)}
                                />
                              </label>
                              <div className={styles.editActions}>
                                <button type="button" onClick={() => setEditingId(null)}>取消</button>
                                <button type="button" onClick={() => void saveEditing(record)}>保存修改</button>
                              </div>
                            </div>
                          ) : record.note ? (
                            <blockquote>“{record.note}”</blockquote>
                          ) : null}

                          <div className={styles.mediaGrid}>
                            {record.photos.map((photo) => (
                              <figure key={photo.id}>
                                <img src={photo.dataUrl} alt={photo.name} />
                                <figcaption><Camera /> 成长现场</figcaption>
                              </figure>
                            ))}
                            {sceneUrl ? (
                              <figure>
                                <img src={sceneUrl} alt="生成后的绘本场景" />
                                <figcaption><BookOpenText /> 绘本场景</figcaption>
                              </figure>
                            ) : null}
                            {record.photos.length === 0 && !sceneUrl ? (
                              <div className={styles.mediaEmpty}>
                                <Camera />
                                <span>这条记录还没有图片</span>
                              </div>
                            ) : null}
                          </div>

                          <div className={styles.recordActions}>
                            <button
                              type="button"
                              className={styles.readButton}
                              disabled={Boolean(busyAction)}
                              onClick={() => void openStory(record)}
                            >
                              <BookOpenText />
                              {busyAction === `open:${record.id}`
                                ? "正在保存图片…"
                                : source === "cloud"
                                  ? "保存到本机并阅读"
                                  : "阅读本机绘本"}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyAction)}
                              onClick={() => startEditing(record)}
                            >
                              <PencilSimpleLine />
                              {source === "cloud" ? "仅编辑云端" : "仅编辑本机"}
                            </button>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              disabled={Boolean(busyAction)}
                              onClick={() => void removeRecord(record)}
                            >
                              <Trash />
                              {busyAction === `delete:${record.id}`
                                ? "删除中…"
                                : source === "cloud"
                                  ? "仅删除云端"
                                  : "仅删除本机"}
                            </button>
                            {onDeleteAll && pairedClientRecordIds?.has(getGrowthClientRecordId(record)) ? (
                              <button
                                type="button"
                                className={styles.deleteAllButton}
                                disabled={Boolean(busyAction)}
                                onClick={() => void removeAllCopies(record)}
                              >
                                <Trash />
                                {busyAction === `delete-all:${getGrowthClientRecordId(record)}`
                                  ? "全部删除中…"
                                  : "全部删除"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  </article>
                );
              })}
            </section>

            <p className={styles.timelineEnd}>
              <Clock /> 每一件小事，都可以成为孩子故事世界的一部分
            </p>
          </>
        )}
      </div>
    </main>
  );
}
