"use client";

import {
  ArrowClockwise,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  CircleNotch,
  CloudArrowUp,
  ImageSquare,
  TreeStructure,
  WarningCircle,
  WifiSlash,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countLocalImportSelection,
  countSelectedImportPhotos,
  createEmptyLocalImportSelection,
  getLocalImportCounts,
  getLocalImportDismissKey,
  getLocalOnlyCandidates,
  hasLocalImportWork,
  toggleLocalImportSelection,
  type LocalImportCandidate,
  type LocalImportConflictChoice,
  type LocalImportController,
  type LocalImportProgress,
  type LocalImportResult,
  type LocalImportSelection,
  type LocalImportSnapshot,
} from "./local-import-controller";
import styles from "./Account.module.css";

type ImportView =
  | "scanning"
  | "prompt"
  | "collapsed"
  | "selecting"
  | "importing"
  | "recovering"
  | "waiting"
  | "conflicts"
  | "failed"
  | "complete"
  | "hidden";

type LastAction = "scan" | "import" | "resume" | "conflict";

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

function readDismissed(userId: string) {
  try {
    return window.localStorage.getItem(getLocalImportDismissKey(userId)) !== null;
  } catch {
    return false;
  }
}

function writeDismissed(userId: string) {
  try {
    window.localStorage.setItem(
      getLocalImportDismissKey(userId),
      new Date().toISOString(),
    );
  } catch {
    // A disabled/full localStorage must not block local creation or reading.
  }
}

function formatUpdatedAt(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function CandidateGroup({
  candidates,
  selection,
  onToggle,
}: {
  candidates: LocalImportCandidate[];
  selection: LocalImportSelection;
  onToggle: (candidate: LocalImportCandidate) => void;
}) {
  if (candidates.length === 0) return null;

  const isStory = candidates[0]?.entityType === "story";
  const selectedIds = isStory ? selection.storyIds : selection.growthRecordIds;

  return (
    <fieldset className={styles.importFieldset}>
      <legend>{isStory ? "最近绘本" : "成长记录"}</legend>
      <div className={styles.importCandidateList}>
        {candidates.map((candidate) => {
          const updatedAt = formatUpdatedAt(candidate.updatedAt);
          return (
            <label className={styles.importCandidate} key={`${candidate.entityType}:${candidate.localId}`}>
              <input
                checked={selectedIds.includes(candidate.localId)}
                onChange={() => onToggle(candidate)}
                type="checkbox"
              />
              <span className={styles.importCandidateIcon}>
                {isStory ? <BookOpen /> : <TreeStructure />}
              </span>
              <span className={styles.importCandidateCopy}>
                <strong>{candidate.title}</strong>
                <span>
                  {candidate.detail || (updatedAt ? `更新于 ${updatedAt}` : "保存在当前设备")}
                  {!isStory && candidate.photoCount
                    ? ` · ${candidate.photoCount} 张照片`
                    : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function LocalImportCard({
  controller,
  userId,
}: {
  controller: LocalImportController;
  userId: string;
}) {
  const [view, setView] = useState<ImportView>("scanning");
  const [snapshot, setSnapshot] = useState<LocalImportSnapshot | null>(null);
  const [selection, setSelection] = useState<LocalImportSelection>(
    createEmptyLocalImportSelection,
  );
  const [progress, setProgress] = useState<LocalImportProgress | null>(null);
  const [result, setResult] = useState<LocalImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardianConsentConfirmed, setGuardianConsentConfirmed] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>("scan");
  const [resolvingConflict, setResolvingConflict] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const applyResult = useCallback((nextResult: LocalImportResult) => {
    setResult(nextResult);
    setProgress(null);

    if (nextResult.conflicts?.length) {
      setView("conflicts");
      return;
    }
    if ((nextResult.pendingCount || 0) > 0) {
      setView("waiting");
      return;
    }
    if ((nextResult.failedCount || 0) > 0 || nextResult.error) {
      setError(nextResult.error || "部分内容暂时未能同步，请稍后继续导入。");
      setView("failed");
      return;
    }
    setView("complete");
  }, []);

  const handleProgress = useCallback((nextProgress: LocalImportProgress) => {
    setProgress(nextProgress);
  }, []);

  const resumePending = useCallback(async () => {
    if (!isOnline()) {
      setView("waiting");
      return;
    }

    setLastAction("resume");
    setError(null);
    setProgress(null);
    setView("recovering");
    try {
      const nextResult = await controller.resumePending(handleProgress);
      applyResult(nextResult);
    } catch (cause) {
      if (!isOnline()) {
        setView("waiting");
        return;
      }
      setError(cause instanceof Error ? cause.message : "恢复导入失败，请稍后重试。");
      setView("failed");
    }
  }, [applyResult, controller, handleProgress]);

  const initialize = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setView("scanning");
    setSnapshot(null);
    setSelection(createEmptyLocalImportSelection());
    setProgress(null);
    setResult(null);
    setError(null);
    setGuardianConsentConfirmed(false);
    setLastAction("scan");

    try {
      const nextSnapshot = await controller.scan();
      if (requestId !== requestIdRef.current) return;
      setSnapshot(nextSnapshot);

      if (!hasLocalImportWork(nextSnapshot)) {
        setView("hidden");
        return;
      }

      const counts = getLocalImportCounts(nextSnapshot);
      if (counts.pending > 0 || counts.failed > 0) {
        if (!isOnline()) {
          setView("waiting");
        } else {
          void resumePending();
        }
        return;
      }

      setView(readDismissed(userId) ? "collapsed" : "prompt");
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      setError(cause instanceof Error ? cause.message : "无法读取当前设备的数据摘要。");
      setView("failed");
    }
  }, [controller, resumePending, userId]);

  useEffect(() => {
    void initialize();
    return () => {
      requestIdRef.current += 1;
    };
  }, [initialize]);

  useEffect(() => {
    if (view !== "waiting") return;
    const handleOnline = () => {
      void resumePending();
    };
    window.addEventListener("online", handleOnline, { once: true });
    return () => window.removeEventListener("online", handleOnline);
  }, [resumePending, view]);

  const counts = useMemo(
    () => (snapshot ? getLocalImportCounts(snapshot) : null),
    [snapshot],
  );
  const localOnly = useMemo(
    () => (snapshot ? getLocalOnlyCandidates(snapshot) : null),
    [snapshot],
  );
  const selectedCount = countLocalImportSelection(selection);
  const selectedPhotoCount = useMemo(
    () => (snapshot ? countSelectedImportPhotos(snapshot, selection) : 0),
    [selection, snapshot],
  );

  const dismiss = () => {
    writeDismissed(userId);
    setView("collapsed");
  };

  const openSelection = () => {
    setSelection(createEmptyLocalImportSelection());
    setGuardianConsentConfirmed(false);
    setView("selecting");
  };

  const toggleCandidate = (candidate: LocalImportCandidate) => {
    setSelection((current) =>
      toggleLocalImportSelection(
        current,
        candidate.entityType,
        candidate.localId,
      ),
    );
  };

  const startImport = async () => {
    if (selectedCount === 0) return;
    setLastAction("import");
    setError(null);
    setProgress(null);
    setView("importing");
    try {
      const nextResult = await controller.importSelected(
        {
          ...selection,
          guardianConsentConfirmed:
            selectedPhotoCount > 0 && guardianConsentConfirmed,
        },
        handleProgress,
      );
      applyResult(nextResult);
    } catch (cause) {
      if (!isOnline()) {
        setView("waiting");
        return;
      }
      setError(cause instanceof Error ? cause.message : "导入失败，请稍后继续。");
      setView("failed");
    }
  };

  const resolveConflict = async (
    conflictKey: string,
    choice: LocalImportConflictChoice,
  ) => {
    if (!controller.resolveConflict) {
      setError("当前同步服务尚未准备好处理冲突，请稍后重试。");
      setView("failed");
      return;
    }

    setLastAction("conflict");
    setResolvingConflict(conflictKey);
    setError(null);
    try {
      const nextResult = await controller.resolveConflict(
        conflictKey,
        choice,
        handleProgress,
      );
      applyResult(nextResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存冲突选择失败，请重试。");
      setView("failed");
    } finally {
      setResolvingConflict(null);
    }
  };

  if (view === "hidden") return null;

  if (view === "scanning") {
    return (
      <section className={styles.importCard} aria-live="polite">
        <CircleNotch className={styles.spin} size={22} />
        <div className={styles.importStatusCopy}>
          <h2>正在查看当前设备的数据</h2>
          <p>这里只读取数量，不会上传任何内容。</p>
        </div>
      </section>
    );
  }

  if (view === "collapsed" && counts) {
    return (
      <section className={`${styles.importCard} ${styles.importCardCompact}`}>
        <span className={styles.importIcon}>
          <CloudArrowUp />
        </span>
        <div className={styles.importStatusCopy}>
          <h2>本地内容可选择同步</h2>
          <p>
            仍有 {counts.stories} 本绘本、{counts.growthRecords} 条成长记录保存在当前设备；不会自动上传。
          </p>
        </div>
        <button className={styles.importTextButton} onClick={openSelection} type="button">
          查看可导入内容
        </button>
      </section>
    );
  }

  if (view === "prompt" && counts) {
    return (
      <section className={styles.importCard} aria-labelledby="local-import-title">
        <div className={styles.importHeader}>
          <span className={styles.importIcon}>
            <CloudArrowUp />
          </span>
          <div>
            <p className={styles.sectionKicker}>OPTIONAL CLOUD IMPORT</p>
            <h2 id="local-import-title">发现当前设备中的家庭内容</h2>
          </div>
        </div>
        <p className={styles.importLead}>这些内容目前只保存在本设备。是否导入云端，由你决定。</p>
        <div className={styles.importCountGrid}>
          <div>
            <BookOpen />
            <strong>{counts.stories}</strong>
            <span>本最近绘本</span>
          </div>
          <div>
            <TreeStructure />
            <strong>{counts.growthRecords}</strong>
            <span>条成长记录</span>
          </div>
          <div>
            <ImageSquare />
            <strong>{counts.photos}</strong>
            <span>张成长照片</span>
          </div>
        </div>
        <p className={styles.importPrivacyNote}>
          登录不会自动上传。导入完成后，本地副本仍会保留；同步失败也不影响创作和阅读。
        </p>
        <div className={styles.importActions}>
          <button className={styles.importSecondaryButton} onClick={dismiss} type="button">
            暂不处理
          </button>
          <button className={styles.importPrimaryButton} onClick={openSelection} type="button">
            选择内容并导入
          </button>
        </div>
      </section>
    );
  }

  if (view === "selecting" && localOnly) {
    return (
      <section className={styles.importCard} aria-labelledby="local-import-select-title">
        <div className={styles.importHeader}>
          <button
            aria-label="返回导入提示"
            className={styles.importBackButton}
            onClick={() => setView("prompt")}
            type="button"
          >
            <ArrowLeft />
          </button>
          <div>
            <p className={styles.sectionKicker}>CHOOSE WHAT TO IMPORT</p>
            <h2 id="local-import-select-title">逐项选择要导入的内容</h2>
          </div>
        </div>
        <p className={styles.importLead}>默认没有选中任何内容。你可以只同步希望跨设备查看的项目。</p>
        <div className={styles.importSelectionGroups}>
          <CandidateGroup
            candidates={localOnly.stories}
            onToggle={toggleCandidate}
            selection={selection}
          />
          <CandidateGroup
            candidates={localOnly.growthRecords}
            onToggle={toggleCandidate}
            selection={selection}
          />
        </div>
        {selectedPhotoCount > 0 ? (
          <label className={styles.importConsentCheck}>
            <input
              type="checkbox"
              checked={guardianConsentConfirmed}
              onChange={(event) =>
                setGuardianConsentConfirmed(event.currentTarget.checked)
              }
            />
            <span>
              我确认自己是所选成长照片中的本人或其监护人，已获得明确授权，并同意将 {selectedPhotoCount} 张照片上传到家庭私有云端。
            </span>
          </label>
        ) : null}
        <div className={styles.importSelectionFooter}>
          <span>已选择 {selectedCount} 项</span>
          <div className={styles.importActions}>
            <button className={styles.importSecondaryButton} onClick={dismiss} type="button">
              暂不处理
            </button>
            <button
              className={styles.importPrimaryButton}
              disabled={
                selectedCount === 0 ||
                (selectedPhotoCount > 0 && !guardianConsentConfirmed)
              }
              onClick={() => void startImport()}
              type="button"
            >
              导入所选内容
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (view === "importing" || view === "recovering") {
    const completed = Math.min(progress?.completed || 0, progress?.total || 1);
    const total = Math.max(progress?.total || 1, 1);
    return (
      <section className={styles.importCard} aria-live="polite">
        <CircleNotch className={styles.spin} size={24} />
        <div className={styles.importStatusCopy}>
          <h2>{view === "recovering" ? "正在恢复上次导入" : "正在导入所选内容"}</h2>
          <p>{progress?.message || "正在安全保存到你的私有云端空间，请不要关闭页面。"}</p>
          <progress className={styles.importProgress} max={total} value={completed} />
          <span className={styles.importProgressLabel}>
            {progress?.total ? `${completed} / ${progress.total}` : "正在准备"}
          </span>
        </div>
      </section>
    );
  }

  if (view === "waiting") {
    return (
      <section className={`${styles.importCard} ${styles.importStatusCard}`} aria-live="polite">
        <span className={`${styles.importIcon} ${styles.importIconWaiting}`}>
          <WifiSlash />
        </span>
        <div className={styles.importStatusCopy}>
          <h2>等待同步</h2>
          <p>已保存导入进度。本地内容可以继续正常创作和阅读；联网后会再尝试一次。</p>
        </div>
        <button
          className={styles.importTextButton}
          disabled={!isOnline()}
          onClick={() => void resumePending()}
          type="button"
        >
          <ArrowClockwise /> 继续导入
        </button>
      </section>
    );
  }

  if (view === "conflicts" && result?.conflicts?.length) {
    return (
      <section className={styles.importCard} aria-labelledby="local-import-conflict-title">
        <div className={styles.importHeader}>
          <span className={`${styles.importIcon} ${styles.importIconWarning}`}>
            <WarningCircle />
          </span>
          <div>
            <p className={styles.sectionKicker}>YOUR CHOICE REQUIRED</p>
            <h2 id="local-import-conflict-title">两端都有更新，请选择保留版本</h2>
          </div>
        </div>
        <p className={styles.importLead}>StoryBloom 不会静默覆盖。每项选择只影响云端或本地副本中的这一条内容。</p>
        <div className={styles.importConflictList}>
          {result.conflicts.map((conflict) => (
            <article className={styles.importConflict} key={conflict.conflictKey}>
              <div>
                <strong>{conflict.title}</strong>
                <p>{conflict.description || "当前设备与云端都在上次同步后发生了变化。"}</p>
                <span>
                  本地：{formatUpdatedAt(conflict.localUpdatedAt) || "时间未知"} · 云端：
                  {formatUpdatedAt(conflict.cloudUpdatedAt) || "时间未知"}
                </span>
              </div>
              <div className={styles.importConflictActions}>
                <button
                  disabled={Boolean(resolvingConflict)}
                  onClick={() => void resolveConflict(conflict.conflictKey, "keep-cloud")}
                  type="button"
                >
                  保留云端版本
                </button>
                <button
                  disabled={Boolean(resolvingConflict)}
                  onClick={() => void resolveConflict(conflict.conflictKey, "keep-local")}
                  type="button"
                >
                  保留当前设备版本
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (view === "complete" && result) {
    return (
      <section className={`${styles.importCard} ${styles.importStatusCard}`} aria-live="polite">
        <span className={`${styles.importIcon} ${styles.importIconSuccess}`}>
          <CheckCircle />
        </span>
        <div className={styles.importStatusCopy}>
          <h2>导入完成</h2>
          <p>
            已同步 {result.importedStories} 本绘本、{result.importedGrowthRecords} 条成长记录和 {result.importedPhotos} 张照片。本地副本仍然保留。
          </p>
        </div>
        <button
          className={styles.importTextButton}
          onClick={() => {
            writeDismissed(userId);
            void initialize();
          }}
          type="button"
        >
          完成
        </button>
      </section>
    );
  }

  return (
    <section className={`${styles.importCard} ${styles.importStatusCard}`} aria-live="polite">
      <span className={`${styles.importIcon} ${styles.importIconWarning}`}>
        <WarningCircle />
      </span>
      <div className={styles.importStatusCopy}>
        <h2>{lastAction === "scan" ? "暂时无法读取本地数据" : "部分内容导入失败"}</h2>
        <p>{error || "本地内容没有丢失，也不影响继续创作和阅读。"}</p>
      </div>
      <button
        className={styles.importTextButton}
        onClick={() => void (lastAction === "scan" ? initialize() : resumePending())}
        type="button"
      >
        <ArrowClockwise /> {lastAction === "scan" ? "重新扫描" : "继续导入"}
      </button>
    </section>
  );
}
