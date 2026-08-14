"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  DownloadSimple,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import {
  createLocalGrowthRetentionPreview,
  isLocalGrowthRetentionPolicy,
  readLocalGrowthRetentionPreference,
  writeLocalGrowthRetentionPreference,
  type LocalGrowthRetentionPolicy,
  type LocalGrowthRetentionPreference,
} from "@/lib/growth-archive-retention";
import { createLocalGrowthArchiveZip } from "@/lib/growth-archive-export";
import type { GrowthMomentBundle } from "@/lib/growth-moments";
import { getGrowthStorageErrorCode } from "@/lib/growth-storage-capacity";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { createIndexedDbSyncMetaStore } from "@/lib/sync/sync-meta";
import styles from "./GrowthArchive.module.css";

type ConfirmAction = "expired" | "all";

const RETENTION_OPTIONS: Array<{
  value: LocalGrowthRetentionPolicy;
  label: string;
}> = [
  { value: "keep-forever", label: "一直保留，直到家长主动删除" },
  { value: "1-year", label: "预览超过 1 年的成长时刻" },
  { value: "3-years", label: "预览超过 3 年的成长时刻" },
  { value: "5-years", label: "预览超过 5 年的成长时刻" },
];

function getLoadError(error: unknown) {
  const code = getGrowthStorageErrorCode(error);
  if (code === "growth-storage-unavailable") {
    return "浏览器的本机成长资料库当前不可用。";
  }
  return "暂时无法读取本机成长档案，请刷新后重试。";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GrowthArchiveControls({
  onArchiveChanged,
}: {
  onArchiveChanged?: () => void | Promise<void>;
}) {
  const { session } = useAuth();
  const [bundles, setBundles] = useState<GrowthMomentBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retention, setRetention] = useState<LocalGrowthRetentionPreference>(
    () => readLocalGrowthRetentionPreference(),
  );
  const [draftPolicy, setDraftPolicy] =
    useState<LocalGrowthRetentionPolicy>(retention.policy);
  const [busyAction, setBusyAction] = useState<"export" | "retention" | "delete" | "">("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>();
  const [notice, setNotice] = useState<{
    tone: "success" | "status" | "error";
    message: string;
  }>();

  const loadBundles = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const next = await localGrowthRepository.moments?.list();
      setBundles(next || []);
    } catch (error) {
      setLoadError(getLoadError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBundles();
    window.addEventListener("focus", loadBundles);
    return () => window.removeEventListener("focus", loadBundles);
  }, [loadBundles]);

  const summary = useMemo(
    () => ({
      children: new Set(bundles.map((bundle) => bundle.moment.childKey)).size,
      moments: bundles.length,
      photos: bundles.reduce(
        (total, bundle) => total + bundle.moment.originalAssets.length,
        0,
      ),
      versions: bundles.reduce(
        (total, bundle) => total + bundle.storybookVersions.length,
        0,
      ),
    }),
    [bundles],
  );
  const retentionPreview = useMemo(
    () => createLocalGrowthRetentionPreview(bundles, draftPolicy),
    [bundles, draftPolicy],
  );

  async function handleExport() {
    if (bundles.length === 0) return;
    setBusyAction("export");
    setNotice(undefined);
    try {
      const exported = await createLocalGrowthArchiveZip(bundles, retention);
      triggerDownload(exported.blob, exported.filename);
      setNotice({
        tone: "success",
        message: `已在当前浏览器打包 ${exported.archive.summary.moments} 个成长时刻；没有上传到服务器。`,
      });
    } catch {
      setNotice({ tone: "error", message: "本机成长档案导出失败，请稍后重试。" });
    } finally {
      setBusyAction("");
    }
  }

  function handleSaveRetention() {
    setBusyAction("retention");
    setNotice(undefined);
    const saved = writeLocalGrowthRetentionPreference(draftPolicy);
    if (!saved) {
      setNotice({
        tone: "error",
        message: "浏览器无法保存保留期限偏好；成长档案没有被删除。",
      });
    } else {
      setRetention(saved);
      setNotice({
        tone: "success",
        message:
          saved.policy === "keep-forever"
            ? "已保存为一直保留；只有家长主动确认时才会删除。"
            : "保留期限偏好已保存。到期内容只会列出预览，不会自动删除。",
      });
    }
    setBusyAction("");
  }

  async function removeSyncMetadata(targets: readonly GrowthMomentBundle[]) {
    const userId = session?.user.id;
    if (!userId || targets.length === 0) return 0;
    const syncMeta = createIndexedDbSyncMetaStore(userId);
    const results = await Promise.allSettled(
      targets.map((bundle) =>
        syncMeta.remove("growth-record", bundle.moment.clientMomentId),
      ),
    );
    return results.filter((result) => result.status === "rejected").length;
  }

  async function handleConfirmedDelete() {
    const action = confirmAction;
    if (!action || !localGrowthRepository.moments) return;
    const targets =
      action === "all"
        ? bundles
        : bundles.filter((bundle) =>
            retentionPreview.momentIds.includes(bundle.moment.momentId),
          );
    if (targets.length === 0) {
      setConfirmAction(undefined);
      return;
    }

    setBusyAction("delete");
    setNotice(undefined);
    try {
      if (action === "all") {
        await localGrowthRepository.moments.clearAll();
      } else {
        await localGrowthRepository.moments.removeMoments(
          targets.map((bundle) => bundle.moment.momentId),
        );
      }
      const syncFailures = await removeSyncMetadata(targets);
      setConfirmAction(undefined);
      await loadBundles();
      await Promise.resolve(onArchiveChanged?.()).catch(() => undefined);
      setNotice({
        tone: syncFailures ? "status" : "success",
        message: syncFailures
          ? "本机成长档案已删除，但个别账户导入状态未能清理；私有云副本没有被删除。"
          : action === "all"
            ? "当前浏览器中的全部成长档案已删除；绘本馆、家庭角色和私有云副本仍保留。"
            : `已删除 ${targets.length} 个到期成长时刻；其他本机内容和私有云副本仍保留。`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          getGrowthStorageErrorCode(error) === "growth-storage-unavailable"
            ? "浏览器的本机成长资料库当前不可用，删除没有执行。"
            : "本机成长档案删除失败，现有内容没有被视为已删除。",
      });
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section className={styles.governancePanel} aria-label="本机成长档案治理">
      <div className={styles.governanceHeader}>
        <div>
          <p className={styles.kicker}>LOCAL ARCHIVE CONTROLS</p>
          <h2>知道保存了什么，也能带走或删除</h2>
          <p>这些操作只针对当前浏览器中的成长档案，不会自动读取或修改私有云。</p>
        </div>
        <span><ShieldCheck /> 家长控制 · 不自动删除</span>
      </div>

      <div className={styles.governanceStats}>
        <span><strong>{loading ? "—" : summary.children}</strong> 个孩子</span>
        <span><strong>{loading ? "—" : summary.moments}</strong> 个时刻</span>
        <span><strong>{loading ? "—" : summary.photos}</strong> 张现场照片</span>
        <span><strong>{loading ? "—" : summary.versions}</strong> 个绘本版本</span>
      </div>

      {loadError ? <p className={styles.governanceError}>{loadError}</p> : null}

      <div className={styles.governanceGrid}>
        <article>
          <DownloadSimple />
          <div>
            <h3>导出本机成长档案</h3>
            <p>生成 ZIP：包含字段说明、成长时刻、绘本文字和当前可读取的图片文件。</p>
          </div>
          <button
            type="button"
            disabled={Boolean(busyAction) || bundles.length === 0 || Boolean(loadError)}
            onClick={() => void handleExport()}
          >
            {busyAction === "export" ? "正在打包…" : "下载 ZIP"}
          </button>
          <small>不包含登录令牌、签名链接、Provider 任务 ID、家庭角色库或私有云副本。</small>
        </article>

        <article>
          <Clock />
          <div>
            <h3>保留期限偏好</h3>
            <p>按真实发生日期预览到期内容；保存偏好不会触发删除。</p>
          </div>
          <label>
            <span className={styles.srOnly}>选择本机成长档案保留期限</span>
            <select
              value={draftPolicy}
              disabled={Boolean(busyAction)}
              onChange={(event) => {
                const value = event.target.value;
                if (isLocalGrowthRetentionPolicy(value)) setDraftPolicy(value);
              }}
            >
              {RETENTION_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={Boolean(busyAction) || draftPolicy === retention.policy}
            onClick={handleSaveRetention}
          >
            {busyAction === "retention" ? "保存中…" : "保存偏好"}
          </button>
          <small>
            {retentionPreview.cutoffDate
              ? `预览截止 ${retentionPreview.cutoffDate}：${retentionPreview.momentCount} 个时刻、${retentionPreview.photoCount} 张照片、${retentionPreview.storybookVersionCount} 个绘本版本。`
              : "当前没有到期规则；档案只会在家长主动确认后删除。"}
          </small>
        </article>
      </div>

      <details className={styles.fieldGuide}>
        <summary>查看本机保存字段与用途</summary>
        <div>
          <p><strong>孩子显示名称与本地分组键：</strong>区分当前设备中的成长时间轴，不会自动创建或绑定云端 ChildProfile。</p>
          <p><strong>日期、事实、备注与标签：</strong>按真实时刻排序，并保留家长确认的上下文。</p>
          <p><strong>现场照片与头像快照：</strong>用于家庭回看；照片不会随生成草稿发送给故事模型。</p>
          <p><strong>绘本版本、正文、插图和生成来源：</strong>让同一个时刻可以保留多个独立版本。</p>
          <p><strong>明确不包含：</strong>家庭角色库、真实声音、私有云副本、公开分享凭据和登录令牌。</p>
          <Link href="/child-family-data">查看儿童与家庭数据说明</Link>
        </div>
      </details>

      <div className={styles.governanceDanger}>
        <div>
          <h3>删除当前浏览器中的成长档案</h3>
          <p>绘本馆独立副本、家庭角色和私有云副本不会被连带删除。</p>
        </div>
        <div className={styles.governanceDangerActions}>
          {draftPolicy === retention.policy && retentionPreview.momentCount > 0 ? (
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => setConfirmAction("expired")}
            >
              删除 {retentionPreview.momentCount} 个到期时刻
            </button>
          ) : null}
          <button
            type="button"
            className={styles.governanceDeleteAll}
            disabled={Boolean(busyAction) || bundles.length === 0}
            onClick={() => setConfirmAction("all")}
          >
            <Trash /> 删除全部本机成长档案
          </button>
        </div>
      </div>

      {confirmAction ? (
        <div className={styles.governanceConfirm} role="alert">
          <strong>
            {confirmAction === "all"
              ? `确认删除当前浏览器中的 ${bundles.length} 个成长时刻？`
              : `确认删除预览中的 ${retentionPreview.momentCount} 个到期时刻？`}
          </strong>
          <p>相关现场照片和成长档案内的绘本版本会删除；普通绘本馆、家庭角色、私有云和公开分享不会自动删除。</p>
          <div>
            <button type="button" disabled={busyAction === "delete"} onClick={() => setConfirmAction(undefined)}>取消</button>
            <button type="button" disabled={busyAction === "delete"} onClick={() => void handleConfirmedDelete()}>
              {busyAction === "delete" ? "删除中…" : "确认仅删除本机档案"}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className={`${styles.governanceNotice} ${styles[`governanceNotice_${notice.tone}`]}`} role="status">
          {notice.message}
        </p>
      ) : null}
    </section>
  );
}
