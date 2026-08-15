"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  CloudCheck,
  DownloadSimple,
  Trash,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import {
  CLOUD_GROWTH_RETENTION_OPTIONS,
  DELETE_ALL_CLOUD_GROWTH_CONFIRMATION,
  DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
  getBrowserTimeZone,
  isCloudGrowthRetentionDays,
  type CloudGrowthArchiveSummary,
  type CloudGrowthRetentionDays,
} from "@/lib/account/cloud-growth-archive-contract";
import styles from "./GrowthArchive.module.css";

type ConfirmAction = "expired" | "all";
type Notice = { tone: "success" | "status" | "error"; message: string };

const RETENTION_LABELS = new Map<CloudGrowthRetentionDays, string>([
  [null, "一直保留，直到家长主动删除"],
  [365, "预览超过 1 年的私有云时刻"],
  [1095, "预览超过 3 年的私有云时刻"],
  [1825, "预览超过 5 年的私有云时刻"],
]);

function getResponseError(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const value = body as { error?: unknown; message?: unknown };
  if (typeof value.error === "string") return value.error;
  if (typeof value.message === "string") return value.message;
  return fallback;
}

function getDownloadFileName(response: Response) {
  const disposition = response.headers.get("content-disposition") || "";
  return (
    /filename="?([^";]+)"?/i.exec(disposition)?.[1] ||
    "storybloom-cloud-growth-archive.zip"
  );
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

export default function CloudGrowthArchiveControls({
  onArchiveChanged,
}: {
  onArchiveChanged?: () => void | Promise<void>;
}) {
  const { session } = useAuth();
  const [summary, setSummary] = useState<CloudGrowthArchiveSummary>();
  const [draftRetention, setDraftRetention] =
    useState<CloudGrowthRetentionDays>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<
    "export" | "retention" | "delete" | ""
  >("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>();
  const [notice, setNotice] = useState<Notice>();
  const accessToken = session?.access_token;

  const requestHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken || ""}`,
      "X-StoryBloom-Time-Zone": getBrowserTimeZone(),
    }),
    [accessToken],
  );

  const loadSummary = useCallback(async () => {
    if (!accessToken) {
      setSummary(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/growth-archive", {
        headers: requestHeaders,
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getResponseError(body, "暂时无法读取私有云成长档案治理信息。"),
        );
      }
      const next = (body as { summary?: CloudGrowthArchiveSummary })?.summary;
      if (!next) throw new Error("私有云成长档案摘要不完整。");
      setSummary(next);
      setDraftRetention(next.retentionDays);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "暂时无法读取私有云成长档案治理信息。",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestHeaders]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const retentionOptions = useMemo(() => {
    const options = [...CLOUD_GROWTH_RETENTION_OPTIONS] as CloudGrowthRetentionDays[];
    if (
      summary?.retentionDays &&
      !isCloudGrowthRetentionDays(summary.retentionDays)
    ) {
      options.push(summary.retentionDays);
    }
    return options;
  }, [summary?.retentionDays]);

  async function handleExport() {
    if (!accessToken || !summary?.counts.moments) return;
    setBusyAction("export");
    setNotice(undefined);
    try {
      const response = await fetch("/api/account/growth-archive/export", {
        headers: requestHeaders,
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          getResponseError(body, "私有云成长档案导出失败，请稍后重试。"),
        );
      }
      triggerDownload(await response.blob(), getDownloadFileName(response));
      setNotice({
        tone:
          response.headers.get("x-storybloom-export-status") === "partial"
            ? "status"
            : "success",
        message:
          response.headers.get("x-storybloom-export-status") === "partial"
            ? "ZIP 已开始下载；个别私有图片无法读取，详情见导出包中的报告。"
            : "私有云成长档案 ZIP 已开始下载；当前设备本机档案没有被上传。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error ? cause.message : "私有云成长档案导出失败。",
      });
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveRetention() {
    if (!accessToken || !summary) return;
    setBusyAction("retention");
    setNotice(undefined);
    try {
      const response = await fetch("/api/account/growth-archive", {
        method: "PATCH",
        headers: { ...requestHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: draftRetention }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getResponseError(body, "私有云保留期限保存失败，请稍后重试。"),
        );
      }
      const next = (body as { summary?: CloudGrowthArchiveSummary })?.summary;
      if (!next) throw new Error("私有云成长档案摘要不完整。");
      setSummary(next);
      setDraftRetention(next.retentionDays);
      setNotice({
        tone: "success",
        message: next.retentionDays
          ? "私有云保留期限偏好已保存。到期内容只会预览，不会自动删除。"
          : "已保存为一直保留；只有家长主动确认时才会删除私有云档案。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error ? cause.message : "私有云保留期限保存失败。",
      });
    } finally {
      setBusyAction("");
    }
  }

  async function handleConfirmedDelete() {
    if (!accessToken || !summary || !confirmAction) return;
    const action = confirmAction;
    setBusyAction("delete");
    setNotice(undefined);
    try {
      const response = await fetch("/api/account/growth-archive", {
        method: "DELETE",
        headers: { ...requestHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: action,
          confirmation:
            action === "all"
              ? DELETE_ALL_CLOUD_GROWTH_CONFIRMATION
              : DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok && response.status !== 207) {
        throw new Error(
          getResponseError(body, "私有云成长档案删除失败，请稍后重试。"),
        );
      }
      const warnings = Array.isArray(
        (body as { report?: { warnings?: unknown } })?.report?.warnings,
      )
        ? ((body as { report: { warnings: unknown[] } }).report.warnings.filter(
            (value): value is string => typeof value === "string",
          ))
        : [];
      setConfirmAction(undefined);
      await loadSummary();
      await Promise.resolve(onArchiveChanged?.()).catch(() => undefined);
      setNotice({
        tone: warnings.length ? "status" : "success",
        message: warnings.length
          ? `私有云成长档案已尽量删除，但仍有 ${warnings.length} 项需要稍后重试。当前设备和绘本馆副本未删除。`
          : action === "all"
            ? "私有云成长档案已删除；当前设备、普通绘本馆、家庭角色和公开分享仍保留。"
            : "到期的私有云成长时刻已删除；其他云端内容和当前设备副本仍保留。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error ? cause.message : "私有云成长档案删除失败。",
      });
    } finally {
      setBusyAction("");
    }
  }

  const counts = summary?.counts;
  return (
    <section className={styles.governancePanel} aria-label="私有云成长档案治理">
      <div className={styles.governanceHeader}>
        <div>
          <p className={styles.kicker}>PRIVATE CLOUD CONTROLS</p>
          <h2>私有云副本也能单独带走或删除</h2>
          <p>所有操作都要求登录并由家长主动触发，不会读取、上传或删除当前设备中的本机档案。</p>
        </div>
        <span><CloudCheck /> 账户私有 · 不自动删除</span>
      </div>

      <div className={styles.governanceStats}>
        <span><strong>{loading ? "—" : counts?.children || 0}</strong> 个孩子</span>
        <span><strong>{loading ? "—" : counts?.moments || 0}</strong> 个时刻</span>
        <span><strong>{loading ? "—" : counts?.photos || 0}</strong> 张成长照片</span>
        <span><strong>{loading ? "—" : counts?.storybookVersions || 0}</strong> 个绘本版本</span>
      </div>

      {error ? <p className={styles.governanceError}>{error}</p> : null}

      <div className={styles.governanceGrid}>
        <article>
          <DownloadSimple />
          <div>
            <h3>导出私有云成长档案</h3>
            <p>服务端生成专用 ZIP，只打包成长时刻、关联绘本文字和可读取的私有图片。</p>
          </div>
          <button
            type="button"
            disabled={Boolean(busyAction) || !summary?.counts.moments || Boolean(error)}
            onClick={() => void handleExport()}
          >
            {busyAction === "export" ? "正在打包…" : "下载云端 ZIP"}
          </button>
          <small>不包含登录令牌、签名 URL、Provider 任务 ID、家庭角色库、真实声音或无关绘本。</small>
        </article>

        <article>
          <Clock />
          <div>
            <h3>私有云保留期限</h3>
            <p>按浏览器所在时区和真实发生日期预览；保存偏好不会设置自动删除任务。</p>
          </div>
          <label>
            <span className={styles.srOnly}>选择私有云成长档案保留期限</span>
            <select
              value={draftRetention === null ? "forever" : String(draftRetention)}
              disabled={Boolean(busyAction) || !summary}
              onChange={(event) => {
                const value =
                  event.target.value === "forever"
                    ? null
                    : Number(event.target.value);
                if (isCloudGrowthRetentionDays(value)) setDraftRetention(value);
              }}
            >
              {retentionOptions.map((option) => (
                <option value={option === null ? "forever" : String(option)} key={String(option)}>
                  {RETENTION_LABELS.get(option) || `当前自定义：${option} 天`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={Boolean(busyAction) || !summary || draftRetention === summary.retentionDays}
            onClick={() => void handleSaveRetention()}
          >
            {busyAction === "retention" ? "保存中…" : "保存偏好"}
          </button>
          <small>
            {summary?.cutoffDate
              ? `预览截止 ${summary.cutoffDate}：${summary.expired.moments} 个时刻、${summary.expired.photos} 张照片、${summary.expired.storybookVersions} 个绘本版本。`
              : "当前没有到期规则；私有云档案只会在家长主动确认后删除。"}
          </small>
        </article>
      </div>

      <details className={styles.fieldGuide}>
        <summary>查看私有云保存字段、来源与边界</summary>
        <div>
          <p><strong>孩子档案引用：</strong>只用于区分账户内的成长时间轴，不会把 ChildProfile 合并为家庭角色。</p>
          <p><strong>日期、事实、备注与标签：</strong>来自家长主动导入或确认的成长内容。</p>
          <p><strong>成长照片：</strong>只包含家长明确选择上传到私有 Storage 的照片。</p>
          <p><strong>关联绘本：</strong>导出正文和必要来源；删除成长档案不会连带删除普通绘本馆副本。</p>
          <p><strong>明确不包含：</strong>当前设备本机档案、家庭角色库、真实声音、公开分享凭据和登录令牌。</p>
          <Link href="/child-family-data">查看儿童与家庭数据说明</Link>
        </div>
      </details>

      <p className={`${styles.governanceNotice} ${styles.governanceNotice_status}`}>
        {loading
          ? "正在核对私有云 GrowthMoment 兼容基础。"
          : error
            ? "暂时无法确认 GrowthMoment 云端兼容表状态；不会因此执行同步或删除。"
            : summary?.foundation === "available"
              ? "GrowthMoment 基础表、权限和主动导入双写已通过生产验收；同一账户两台真实设备的完整 UI 流程仍待最终确认。"
              : "当前仍使用旧版私有云成长记录；GrowthMoment 云端 migration 尚未部署或不可读取。"}
      </p>

      <div className={styles.governanceDanger}>
        <div>
          <h3>删除私有云中的成长档案</h3>
          <p>不会删除当前设备副本、普通绘本馆、家庭角色、真实声音或公开分享。</p>
        </div>
        <div className={styles.governanceDangerActions}>
          {summary?.retentionDays && summary.expired.moments > 0 ? (
            <button
              type="button"
              disabled={Boolean(busyAction) || draftRetention !== summary.retentionDays}
              onClick={() => setConfirmAction("expired")}
            >
              删除 {summary.expired.moments} 个到期时刻
            </button>
          ) : null}
          <button
            type="button"
            className={styles.governanceDeleteAll}
            disabled={Boolean(busyAction) || !summary?.counts.moments}
            onClick={() => setConfirmAction("all")}
          >
            <Trash /> 删除全部私有云成长档案
          </button>
        </div>
      </div>

      {confirmAction ? (
        <div className={styles.governanceConfirm} role="alert">
          <strong>
            {confirmAction === "all"
              ? `确认删除私有云中的 ${summary?.counts.moments || 0} 个成长时刻？`
              : `确认删除预览中的 ${summary?.expired.moments || 0} 个到期时刻？`}
          </strong>
          <p>对应的私有云成长照片和成长档案内版本关系会删除；当前设备、普通绘本馆、家庭角色与公开分享不会自动删除。</p>
          <div>
            <button type="button" disabled={busyAction === "delete"} onClick={() => setConfirmAction(undefined)}>取消</button>
            <button type="button" disabled={busyAction === "delete"} onClick={() => void handleConfirmedDelete()}>
              {busyAction === "delete" ? "删除中…" : "确认仅删除私有云成长档案"}
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
