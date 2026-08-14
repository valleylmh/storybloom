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
import {
  projectGrowthMomentBundle,
  selectActiveStorybookVersion,
  type GrowthMomentBundle,
} from "@/lib/growth-moments";
import {
  getGrowthVersionCreationHref,
  writeGrowthVersionCreationIntent,
} from "@/lib/growth-version-creation";
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
  const [momentBundles, setMomentBundles] = useState<GrowthMomentBundle[]>([]);
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
    setMomentBundles([]);
    const momentTask = activeRepository.moments
      ? activeRepository.moments.list()
      : Promise.resolve([] as GrowthMomentBundle[]);
    const recordTask = activeRepository.moments
      ? momentTask.then((bundles) =>
          bundles
            .filter((bundle) => bundle.moment.childKey === childKey)
            .map(projectGrowthMomentBundle)
            .filter((record): record is GrowthRecord => Boolean(record)),
        )
      : activeRepository.getByChild(childKey);
    void Promise.all([recordTask, momentTask])
      .then(([next, bundles]) => {
        if (!active) return;
        setRecords(next);
        const nextBundles = bundles.filter(
          (bundle) => bundle.moment.childKey === childKey,
        );
        setMomentBundles(nextBundles);
        const first = next[0];
        const firstMoment = nextBundles[0]?.moment;
        if (first || firstMoment) {
          const latestOccurredOn = [first?.occurredOn, firstMoment?.occurredOn]
            .filter((value): value is string => Boolean(value))
            .sort((left, right) => right.localeCompare(left))[0];
          setSelectedYear(
            latestOccurredOn.slice(0, 4),
          );
          setExpandedIds(first ? new Set([first.id]) : new Set());
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

  const childMomentBundles = useMemo(
    () =>
      momentBundles.filter((bundle) => bundle.moment.childKey === childKey),
    [childKey, momentBundles],
  );
  const momentOnlyBundles = useMemo(
    () =>
      childMomentBundles.filter(
        (bundle) => bundle.storybookVersions.length === 0,
      ),
    [childMomentBundles],
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set([
          ...records.map((record) => record.occurredOn.slice(0, 4)),
          ...momentOnlyBundles.map((bundle) =>
            bundle.moment.occurredOn.slice(0, 4),
          ),
        ]),
      ).sort((left, right) => right.localeCompare(left)),
    [momentOnlyBundles, records],
  );
  const visibleRecords = useMemo(
    () => records.filter((record) => record.occurredOn.startsWith(selectedYear)),
    [records, selectedYear],
  );
  const visibleMomentOnlyBundles = useMemo(
    () =>
      momentOnlyBundles.filter((bundle) =>
        bundle.moment.occurredOn.startsWith(selectedYear),
      ),
    [momentOnlyBundles, selectedYear],
  );
  const childName =
    records[0]?.childName || childMomentBundles[0]?.moment.childName || "孩子";
  const totalMomentCount = activeRepository.moments
    ? childMomentBundles.length
    : records.length;
  const oldestOccurredOn = [
    ...records.map((record) => record.occurredOn),
    ...momentOnlyBundles.map((bundle) => bundle.moment.occurredOn),
  ].sort()[0];
  const avatarUrl =
    records.find((record) => record.childAvatarDataUrl)?.childAvatarDataUrl ||
    childMomentBundles.find((bundle) => bundle.moment.childAvatarDataUrl)?.moment
      .childAvatarDataUrl;

  function sortTimelineRecords(next: GrowthRecord[]) {
    return [...next].sort(
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) ||
        right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  function applyMomentBundle(bundle: GrowthMomentBundle) {
    setMomentBundles((current) => [
      ...current.filter(
        (candidate) => candidate.moment.momentId !== bundle.moment.momentId,
      ),
      bundle,
    ]);
    const projection = projectGrowthMomentBundle(bundle);
    setRecords((current) =>
      sortTimelineRecords([
        ...current.filter(
          (record) =>
            (record.momentId || record.id) !== bundle.moment.momentId,
        ),
        ...(projection ? [projection] : []),
      ]),
    );
  }

  function getMomentBundle(record: GrowthRecord) {
    const momentId = record.momentId || record.id;
    return childMomentBundles.find(
      (bundle) => bundle.moment.momentId === momentId,
    );
  }

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
      if (activeRepository.moments) {
        const bundle = await activeRepository.moments.get(
          updated.momentId || updated.id,
        );
        if (bundle) applyMomentBundle(bundle);
      }
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
    const bundle = getMomentBundle(record);
    const localDeleteDetail = bundle
      ? `现场照片及 ${bundle.storybookVersions.length} 个绘本版本会从成长档案移除；绘本馆中的独立副本不会自动删除。`
      : "关联绘本会继续保留。";
    if (
      !window.confirm(
        source === "cloud"
          ? `仅删除${sourceLabel}中的《${record.story.coverTitle}》成长记录？关联绘本会继续保留。`
          : `删除${sourceLabel}中的这个成长时刻？${localDeleteDetail}`,
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
    setMomentBundles((current) =>
      current.filter(
        (candidate) =>
          candidate.moment.momentId !== (record.momentId || record.id),
      ),
    );
    setEditingId(null);
    setBusyAction("");
    setNotice(
      source === "cloud"
        ? "已仅删除私有云端记录。关联绘本仍保留。"
        : "已删除当前设备中的成长时刻；绘本馆中的独立副本未被修改。",
    );
    const remainingMoments = childMomentBundles.filter(
      (candidate) =>
        candidate.moment.momentId !== (record.momentId || record.id),
    );
    if (
      !next.some((item) => item.occurredOn.startsWith(selectedYear)) &&
      !remainingMoments.some((item) =>
        item.moment.occurredOn.startsWith(selectedYear),
      )
    ) {
      setSelectedYear(
        (
          next[0]?.occurredOn || remainingMoments[0]?.moment.occurredOn || ""
        ).slice(0, 4),
      );
    }
  }

  async function chooseStorybookVersion(
    record: GrowthRecord,
    versionId: string,
  ) {
    const bundle = getMomentBundle(record);
    if (!activeRepository.moments || !bundle) return;
    setBusyAction(`select-version:${bundle.moment.momentId}`);
    setNotice("");
    try {
      const updated = await activeRepository.moments.selectVersion(
        bundle.moment.momentId,
        versionId,
      );
      applyMomentBundle(updated);
      setNotice("已切换这个成长时刻的阅读版本，仅影响当前设备。");
    } catch {
      setNotice("绘本版本暂时无法切换，请稍后重试。");
    } finally {
      setBusyAction("");
    }
  }

  async function removeActiveStorybookVersion(record: GrowthRecord) {
    const bundle = getMomentBundle(record);
    const active = bundle ? selectActiveStorybookVersion(bundle) : undefined;
    if (!activeRepository.moments || !bundle || !active) return;
    const lastVersion = bundle.storybookVersions.length === 1;
    if (
      !window.confirm(
        `仅删除绘本版本《${active.result.coverTitle}》？${
          lastVersion
            ? "删除后真实成长时刻和现场照片仍保留，但暂时没有可阅读的绘本版本。"
            : "其他绘本版本、真实时刻和现场照片都会保留。"
        }`,
      )
    ) {
      return;
    }
    setBusyAction(`delete-version:${active.versionId}`);
    setNotice("");
    try {
      const updated = await activeRepository.moments.removeVersion(
        bundle.moment.momentId,
        active.versionId,
      );
      applyMomentBundle(updated);
      setExpandedIds((current) => {
        const next = new Set(current);
        if (lastVersion) next.delete(record.id);
        return next;
      });
      setNotice(
        lastVersion
          ? "绘本版本已删除；真实成长时刻和现场照片仍保存在当前设备。"
          : "绘本版本已删除，其他版本与真实成长时刻仍保留。",
      );
    } catch {
      setNotice("绘本版本删除失败，成长时刻没有被修改。");
    } finally {
      setBusyAction("");
    }
  }

  async function clearOriginalPhotos(record: GrowthRecord) {
    const bundle = getMomentBundle(record);
    if (!activeRepository.moments || !bundle || bundle.moment.originalAssets.length === 0) {
      return;
    }
    if (
      !window.confirm(
        "删除这个成长时刻的全部现场照片？家长备注和所有绘本版本都会保留。",
      )
    ) {
      return;
    }
    setBusyAction(`clear-photos:${bundle.moment.momentId}`);
    setNotice("");
    try {
      const updated = await activeRepository.moments.clearOriginalAssets(
        bundle.moment.momentId,
      );
      applyMomentBundle(updated);
      setNotice("现场照片已从当前设备删除；绘本版本和家长备注仍保留。");
    } catch {
      setNotice("现场照片删除失败，成长时刻没有被修改。");
    } finally {
      setBusyAction("");
    }
  }

  function startGrowthVersionCreation(bundle: GrowthMomentBundle) {
    const intent = writeGrowthVersionCreationIntent(bundle.moment.momentId);
    if (!intent) {
      setNotice("无法在当前浏览器保存版本创作入口，请刷新后重试。");
      return;
    }
    window.location.href = getGrowthVersionCreationHref();
  }

  async function removeMomentOnly(bundle: GrowthMomentBundle) {
    if (!activeRepository.moments) return;
    if (
      !window.confirm(
        "删除这个没有绘本版本的成长时刻？家长备注和现场照片都会从当前设备移除。",
      )
    ) {
      return;
    }
    setBusyAction(`delete-moment:${bundle.moment.momentId}`);
    try {
      await activeRepository.moments.removeMoment(bundle.moment.momentId);
      setMomentBundles((current) =>
        current.filter(
          (candidate) => candidate.moment.momentId !== bundle.moment.momentId,
        ),
      );
      setNotice("成长时刻已从当前设备删除。");
      const remaining = childMomentBundles.filter(
        (candidate) => candidate.moment.momentId !== bundle.moment.momentId,
      );
      if (
        !records.some((record) => record.occurredOn.startsWith(selectedYear)) &&
        !remaining.some((candidate) =>
          candidate.moment.occurredOn.startsWith(selectedYear),
        )
      ) {
        setSelectedYear(
          (records[0]?.occurredOn || remaining[0]?.moment.occurredOn || "").slice(
            0,
            4,
          ),
        );
      }
    } catch {
      setNotice("成长时刻删除失败，请稍后重试。");
    } finally {
      setBusyAction("");
    }
  }

  async function clearMomentOnlyPhotos(bundle: GrowthMomentBundle) {
    if (!activeRepository.moments || bundle.moment.originalAssets.length === 0) return;
    if (!window.confirm("删除这个成长时刻的全部现场照片？家长备注仍会保留。")) {
      return;
    }
    setBusyAction(`clear-moment-photos:${bundle.moment.momentId}`);
    try {
      const updated = await activeRepository.moments.clearOriginalAssets(
        bundle.moment.momentId,
      );
      applyMomentBundle(updated);
      setNotice("现场照片已删除，成长时刻仍保留。");
    } catch {
      setNotice("现场照片删除失败，成长时刻没有被修改。");
    } finally {
      setBusyAction("");
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
        ) : records.length === 0 && momentOnlyBundles.length === 0 ? (
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
                    从 {formatLongDate(oldestOccurredOn)} 开始，已经留下 {totalMomentCount} 个成长时刻
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
              <span>
                {visibleRecords.length + visibleMomentOnlyBundles.length} 个成长时刻
              </span>
            </section>

            {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

            <section className={styles.timeline} aria-label={`${childName}的成长时间轴`}>
              {visibleRecords.map((record) => {
                const expanded = expandedIds.has(record.id);
                const editing = editingId === record.id;
                const sceneUrl = getStoryScene(record);
                const coverUrl = getGrowthRecordCover(record);
                const bundle = getMomentBundle(record);
                const activeVersion = bundle
                  ? selectActiveStorybookVersion(bundle)
                  : undefined;
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
                            {bundle ? (
                              <small className={styles.versionCount}>
                                {bundle.storybookVersions.length} 个绘本版本 · 真实时刻与绘本分开保存
                              </small>
                            ) : null}
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

                          {bundle && activeVersion ? (
                            <div className={styles.versionPanel}>
                              <div>
                                <strong>绘本版本</strong>
                                <span>切换或删除版本不会删除真实时刻与现场照片。</span>
                              </div>
                              <label>
                                <span className={styles.srOnly}>选择阅读版本</span>
                                <select
                                  value={activeVersion.versionId}
                                  disabled={Boolean(busyAction)}
                                  onChange={(event) =>
                                    void chooseStorybookVersion(
                                      record,
                                      event.target.value,
                                    )
                                  }
                                >
                                  {bundle.storybookVersions.map((version, index) => (
                                    <option value={version.versionId} key={version.versionId}>
                                      {index + 1}. {version.result.coverTitle}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => void removeActiveStorybookVersion(record)}
                              >
                                <Trash /> 删除当前版本
                              </button>
                            </div>
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
                            {bundle ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => startGrowthVersionCreation(bundle)}
                              >
                                <Plus /> 再生成一个版本
                              </button>
                            ) : null}
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
                            {bundle && record.photos.length > 0 ? (
                              <button
                                type="button"
                                disabled={Boolean(busyAction)}
                                onClick={() => void clearOriginalPhotos(record)}
                              >
                                <Camera /> 删除现场照片
                              </button>
                            ) : null}
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

              {visibleMomentOnlyBundles.map((bundle) => (
                <article
                  className={styles.timelineItem}
                  key={bundle.moment.momentId}
                >
                  <time
                    dateTime={bundle.moment.occurredOn}
                    className={styles.timelineDate}
                  >
                    <strong>
                      {bundle.moment.occurredOn.slice(5).replace("-", ".")}
                    </strong>
                    <span>{bundle.moment.occurredOn.slice(0, 4)}</span>
                  </time>
                  <span className={styles.timelineNode} aria-hidden="true" />
                  <section className={styles.recordCard}>
                    <div className={styles.momentOnlyCard}>
                      <div>
                        <span>{formatLongDate(bundle.moment.occurredOn)}</span>
                        <h2>{bundle.moment.sourceIdea}</h2>
                        <p>真实成长时刻已保留，当前没有绘本版本。</p>
                      </div>
                      {bundle.moment.parentNote ? (
                        <blockquote>“{bundle.moment.parentNote}”</blockquote>
                      ) : null}
                      {bundle.moment.originalAssets.length > 0 ? (
                        <div className={styles.mediaGrid}>
                          {bundle.moment.originalAssets.map((asset) => (
                            <figure key={asset.assetId}>
                              <img src={asset.dataUrl} alt={asset.name} />
                              <figcaption><Camera /> 成长现场</figcaption>
                            </figure>
                          ))}
                        </div>
                      ) : null}
                      <div className={styles.recordActions}>
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => startGrowthVersionCreation(bundle)}
                        >
                          <Plus /> 生成第一个绘本版本
                        </button>
                        {bundle.moment.originalAssets.length > 0 ? (
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => void clearMomentOnlyPhotos(bundle)}
                          >
                            <Camera /> 删除现场照片
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.deleteButton}
                          disabled={Boolean(busyAction)}
                          onClick={() => void removeMomentOnly(bundle)}
                        >
                          <Trash /> 删除整个时刻
                        </button>
                      </div>
                    </div>
                  </section>
                </article>
              ))}
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
