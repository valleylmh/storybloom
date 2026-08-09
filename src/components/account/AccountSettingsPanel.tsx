"use client";

import Link from "next/link";
import {
  CloudArrowUp,
  DeviceMobile,
  DownloadSimple,
  EnvelopeSimple,
  SignOut,
  Trash,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import {
  loadCloudAccountSummary,
  updateCloudSyncPreference,
  type CloudAccountSummary,
} from "@/lib/account/client-account-data";
import { clearCurrentDeviceData } from "@/lib/account/local-device-data";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import styles from "./AccountSettings.module.css";

interface LocalCounts {
  stories: number;
  growthRecords: number;
  children: number;
  photos: number;
}

type Notice = { tone: "status" | "error" | "success"; message: string };

type RememberedShare = {
  shareId: string;
  deleteToken: string;
  url?: string;
};

const SHARE_STORAGE_KEY = "storybloom.shareLinks.v1";

function countLabel(value: number | undefined, suffix: string) {
  return typeof value === "number" ? `${value} ${suffix}` : "—";
}

function getResponseError(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const value = body as { error?: unknown; message?: unknown };
  if (typeof value.error === "string") return value.error;
  if (typeof value.message === "string") return value.message;
  return fallback;
}

function getDeletionWarnings(body: unknown) {
  if (!body || typeof body !== "object") return [];
  const outer = body as Record<string, unknown>;
  const record =
    outer.report && typeof outer.report === "object"
      ? (outer.report as Record<string, unknown>)
      : outer;
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((item): item is string => typeof item === "string")
    : [];
  if (Array.isArray(record.steps)) {
    warnings.push(
      ...record.steps.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const step = item as Record<string, unknown>;
        if (step.status !== "failed" || !step.error || typeof step.error !== "object") {
          return [];
        }
        const message = (step.error as Record<string, unknown>).message;
        return typeof message === "string" ? [message] : [];
      }),
    );
  }
  const candidates = [record.failures, record.errors, record.failed];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    warnings.push(...candidate.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      const message = value.message || value.error;
      return typeof message === "string" ? [message] : [];
    }));
  }
  return Array.from(new Set(warnings));
}

function getDownloadFileName(response: Response) {
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the plain filename.
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] || "storybloom-export.zip";
}

function readRememberedShares() {
  try {
    const raw = window.localStorage.getItem(SHARE_STORAGE_KEY);
    if (!raw) return {} as Record<string, RememberedShare>;
    const parsed = JSON.parse(raw) as Record<string, Partial<RememberedShare>>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([storyId, value]) =>
        value &&
        typeof value.shareId === "string" &&
        typeof value.deleteToken === "string"
          ? [[storyId, value as RememberedShare]]
          : [],
      ),
    );
  } catch {
    return {} as Record<string, RememberedShare>;
  }
}

async function deleteRememberedShares() {
  const shares = readRememberedShares();
  const remaining = { ...shares };
  let deleted = 0;
  let failed = 0;

  for (const [storyId, share] of Object.entries(shares)) {
    try {
      const response = await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId: share.shareId,
          deleteToken: share.deleteToken,
        }),
      });
      if (!response.ok && response.status !== 404) throw new Error("share-delete-failed");
      delete remaining[storyId];
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  try {
    if (Object.keys(remaining).length > 0) {
      window.localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(remaining));
    } else {
      window.localStorage.removeItem(SHARE_STORAGE_KEY);
    }
  } catch {
    // Deletion already happened server-side; a stale local token is harmless.
  }

  return { deleted, failed };
}

export default function AccountSettingsPanel() {
  const { supabase, session, loading, signOut } = useAuth();
  const [localCounts, setLocalCounts] = useState<LocalCounts>();
  const [cloudSummary, setCloudSummary] = useState<CloudAccountSummary>();
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [pendingChildId, setPendingChildId] = useState<string>();
  const [confirmCloudDelete, setConfirmCloudDelete] = useState(false);
  const [deleteAuthUser, setDeleteAuthUser] = useState(false);
  const [confirmLocalClear, setConfirmLocalClear] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterTouched, setNewsletterTouched] = useState(false);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterNotice, setNewsletterNotice] = useState<Notice>();

  const refreshLocal = useCallback(async () => {
    const [stories, growthRecords] = await Promise.all([
      localStoryRepository.list(),
      localGrowthRepository.list(),
    ]);
    setLocalCounts({
      stories: stories.length,
      growthRecords: growthRecords.length,
      children: new Set(growthRecords.map((record) => record.childKey)).size,
      photos: growthRecords.reduce(
        (total, record) => total + record.photos.length,
        0,
      ),
    });
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!supabase || !session) {
      setCloudSummary(undefined);
      setCloudError("");
      return;
    }
    setCloudLoading(true);
    setCloudError("");
    try {
      setCloudSummary(
        await loadCloudAccountSummary(supabase, session.user.id),
      );
    } catch (cause) {
      setCloudSummary(undefined);
      setCloudError(
        cause instanceof Error ? cause.message : "暂时无法读取云端数据。",
      );
    } finally {
      setCloudLoading(false);
    }
  }, [session, supabase]);

  useEffect(() => {
    void refreshLocal();
    window.addEventListener("focus", refreshLocal);
    return () => window.removeEventListener("focus", refreshLocal);
  }, [refreshLocal]);

  useEffect(() => {
    void refreshCloud();
  }, [refreshCloud]);

  useEffect(() => {
    if (!newsletterTouched && session?.user.email) {
      setNewsletterEmail(session.user.email);
    }
  }, [newsletterTouched, session?.user.email]);

  async function handleNewsletterSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) return;

    setNewsletterBusy(true);
    setNewsletterNotice(undefined);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale: "zh-CN",
          source: "account-settings",
          marketingConsent: true,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getResponseError(body, "暂时无法订阅，请稍后再试。"));
      }
      setNewsletterNotice({
        tone: "success",
        message: "确认邮件已发送。只有完成邮箱确认后，才会收到每日灵感。",
      });
    } catch (cause) {
      setNewsletterNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "暂时无法订阅。",
      });
    } finally {
      setNewsletterBusy(false);
    }
  }

  async function handleSyncToggle() {
    if (!supabase || !session || !cloudSummary) return;
    const enabled = !cloudSummary.cloudSyncEnabled;
    setSyncBusy(true);
    setNotice(undefined);
    try {
      await updateCloudSyncPreference(supabase, session.user.id, enabled);
      setCloudSummary((current) =>
        current ? { ...current, cloudSyncEnabled: enabled } : current,
      );
      setNotice({
        tone: "success",
        message: enabled
          ? "云同步偏好已开启。登录仍不会自动上传，请继续逐项选择要导入的内容。"
          : "云同步偏好已关闭。云端已有资料不会自动删除。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "同步设置保存失败。",
      });
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleExport() {
    if (!session) return;
    setExportBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch("/api/account/export", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(getResponseError(body, "导出失败，请稍后再试。"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getDownloadFileName(response);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice({ tone: "success", message: "数据导出已开始下载。" });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "导出失败。",
      });
    } finally {
      setExportBusy(false);
    }
  }

  async function requestDeletion(payload: Record<string, unknown>) {
    if (!session) throw new Error("请重新登录后再试。");
    const response = await fetch("/api/account/data", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(getResponseError(body, "删除失败，请稍后再试。"));
    }
    return { body, warnings: getDeletionWarnings(body) };
  }

  async function handleDeleteChild(childId: string) {
    setDeletionBusy(true);
    setNotice(undefined);
    try {
      const { warnings } = await requestDeletion({
        scope: "child",
        childId,
        confirmation: "DELETE_CHILD_DATA",
      });
      setPendingChildId(undefined);
      await refreshCloud();
      setNotice({
        tone: warnings.length ? "status" : "success",
        message: warnings.length
          ? `孩子档案已删除，但有 ${warnings.length} 项 Storage 清理需要稍后重试。`
          : "孩子档案、关联成长记录与云端绘本已删除。家庭角色仍保留，可单独管理。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "孩子档案删除失败。",
      });
    } finally {
      setDeletionBusy(false);
    }
  }

  async function handleDeleteAllCloudData() {
    setDeletionBusy(true);
    setNotice(undefined);
    try {
      const rememberedShares = await deleteRememberedShares();
      if (deleteAuthUser && rememberedShares.failed > 0) {
        throw new Error(
          `有 ${rememberedShares.failed} 个早期匿名分享链接未能删除。为避免丢失删除凭据，登录账户暂未删除，请稍后重试。`,
        );
      }
      const { warnings } = await requestDeletion({
        scope: "cloud",
        deleteAuthUser,
        confirmation: deleteAuthUser
          ? "DELETE_STORYBLOOM_ACCOUNT"
          : "DELETE_CLOUD_DATA",
      });
      setConfirmCloudDelete(false);
      if (deleteAuthUser) {
        try {
          await signOut();
        } catch {
          // The auth user may already be gone; clear navigation state below.
        }
        window.location.assign("/");
        return;
      }
      await refreshCloud();
      const warningCount = warnings.length + rememberedShares.failed;
      setNotice({
        tone: warningCount ? "status" : "success",
        message: warningCount
          ? `账户绑定的云端档案已删除，但仍有 ${warningCount} 项 Storage 或早期分享链接需要稍后重试。账户仍保留。`
          : "全部可识别的云端档案与分享链接已删除，登录账户和邮件订阅授权保持不变。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "云端档案删除失败。",
      });
    } finally {
      setDeletionBusy(false);
    }
  }

  async function handleClearLocalData() {
    setDeletionBusy(true);
    setNotice(undefined);
    try {
      const report = await clearCurrentDeviceData(session?.user.id);
      await refreshLocal();
      setConfirmLocalClear(false);
      setNotice({
        tone: report.errors.length ? "status" : "success",
        message: report.errors.length
          ? "本地内容已尽量清理，个别浏览器数据库仍被其他页面占用，请关闭其他 StoryBloom 页面后重试。"
          : "当前设备上的绘本、成长记录、照片缓存和分享凭据已清除。",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "本地数据清理失败。",
      });
    } finally {
      setDeletionBusy(false);
    }
  }

  async function handleSignOut() {
    setSignOutBusy(true);
    setNotice(undefined);
    try {
      await signOut();
      setNotice({ tone: "success", message: "已退出登录，本地内容仍保留在当前设备。" });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "退出失败。",
      });
    } finally {
      setSignOutBusy(false);
    }
  }

  const cloudCounts = cloudSummary?.counts;

  return (
    <main className={styles.panel}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>DATA & PRIVACY</p>
        <h2>知道资料保存在哪里，也能随时带走或删除</h2>
        <p className={styles.lead}>
          当前设备内容与云端档案分开管理。登录不会自动上传；每日灵感邮件也必须单独订阅并完成邮箱确认。
        </p>
        <div className={styles.identityRow}>
          <span>
            <span className={styles.identityLabel}>
              {session ? "账户邮箱" : "账户状态"}
            </span>
            <strong className={styles.identityValue}>
              {loading
                ? "正在读取账户状态"
                : session?.user.email || "未登录，仅使用当前设备"}
            </strong>
          </span>
          {session ? <UserCircle size={28} /> : <DeviceMobile size={27} />}
        </div>
        {!loading && !session ? (
          <div className={styles.loginPrompt}>
            <span>登录后可查看、导出或删除自己的云端档案。</span>
            <Link href={buildLoginPath("/me/settings")}>登录账户</Link>
          </div>
        ) : null}
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>CURRENT DEVICE</p>
        <h2>当前设备数据</h2>
        <div className={styles.stats}>
          <div className={styles.stat}><span>最近绘本</span><strong>{countLabel(localCounts?.stories, "本")}</strong></div>
          <div className={styles.stat}><span>成长记录</span><strong>{countLabel(localCounts?.growthRecords, "条")}</strong></div>
          <div className={styles.stat}><span>孩子档案</span><strong>{countLabel(localCounts?.children, "个")}</strong></div>
          <div className={styles.stat}><span>成长照片</span><strong>{countLabel(localCounts?.photos, "张")}</strong></div>
        </div>
        <p className={styles.hint}>
          本地清理不会退出登录，也不会重置语言偏好、设备标识或免费生成次数。已公开的分享链接不会因此下线，但本机保存的删除凭据会被移除。
        </p>
        {!confirmLocalClear ? (
          <div className={styles.actionRow}>
            <button className={styles.buttonSecondary} onClick={() => setConfirmLocalClear(true)} type="button">
              <Trash /> 清除当前设备数据
            </button>
          </div>
        ) : (
          <div className={styles.confirmBox}>
            <p>确认清除当前浏览器中的绘本、成长记录、照片缓存、朗读缓存和分享凭据？此操作不可恢复。</p>
            <div className={styles.confirmActions}>
              <button className={styles.buttonDanger} disabled={deletionBusy} onClick={() => void handleClearLocalData()} type="button">
                确认清除
              </button>
              <button className={styles.buttonText} disabled={deletionBusy} onClick={() => setConfirmLocalClear(false)} type="button">
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>DAILY INSPIRATION EMAIL</p>
        <h2>每日灵感邮件</h2>
        <p className={styles.lead}>
          登录邮箱只用于预填。点击订阅并完成确认邮件之前，我们不会把它加入每日灵感邮件。
        </p>
        <form className={styles.subscribeForm} onSubmit={handleNewsletterSubscribe}>
          <input
            aria-label="每日灵感订阅邮箱"
            autoComplete="email"
            onChange={(event) => {
              setNewsletterTouched(true);
              setNewsletterEmail(event.target.value);
            }}
            placeholder="你的邮箱"
            required
            type="email"
            value={newsletterEmail}
          />
          <button className={styles.button} disabled={newsletterBusy} type="submit">
            <EnvelopeSimple /> {newsletterBusy ? "发送中" : "主动订阅并发送确认邮件"}
          </button>
        </form>
        {newsletterNotice ? (
          <p className={styles[newsletterNotice.tone]}>{newsletterNotice.message}</p>
        ) : null}
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>CLOUD ARCHIVE</p>
        <h2>云端数据</h2>
        {!session ? (
          <p className={styles.empty}>未登录时不会读取任何云端家庭资料。</p>
        ) : cloudLoading ? (
          <p className={styles.status}>正在读取云端数据数量…</p>
        ) : cloudError ? (
          <p className={styles.error}>{cloudError}</p>
        ) : cloudSummary ? (
          <>
            <div className={styles.toggleRow}>
              <span className={styles.toggleCopy}>
                <strong>云同步开关</strong>
                <span>保存账户偏好。开启后仍由你逐项选择要导入的本地内容，不会因登录自动上传。</span>
              </span>
              <button
                aria-checked={cloudSummary.cloudSyncEnabled}
                aria-label="云同步开关"
                className={`${styles.switch} ${cloudSummary.cloudSyncEnabled ? styles.switchOn : ""}`}
                disabled={syncBusy}
                onClick={() => void handleSyncToggle()}
                role="switch"
                type="button"
              />
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}><span>孩子档案</span><strong>{countLabel(cloudCounts?.children, "个")}</strong></div>
              <div className={styles.stat}><span>家庭角色</span><strong>{countLabel(cloudCounts?.characters, "个")}</strong></div>
              <div className={styles.stat}><span>保存绘本</span><strong>{countLabel(cloudCounts?.stories, "本")}</strong></div>
              <div className={styles.stat}><span>成长记录</span><strong>{countLabel(cloudCounts?.growthRecords, "条")}</strong></div>
              <div className={styles.stat}><span>成长照片</span><strong>{countLabel(cloudCounts?.photos, "张")}</strong></div>
            </div>
            <div className={styles.actionRow}>
              <button className={styles.button} disabled={exportBusy} onClick={() => void handleExport()} type="button">
                <DownloadSimple /> {exportBusy ? "正在打包" : "导出全部数据（ZIP）"}
              </button>
            </div>
            <p className={styles.smallNote}>导出文件包含账户资料、孩子、家庭角色、绘本、成长记录和可读取的照片；不会包含登录令牌或邮件确认令牌。</p>
          </>
        ) : null}
      </section>

      {session && cloudSummary ? (
        <section className={styles.card}>
          <p className={styles.eyebrow}>CHILD PROFILES</p>
          <h2>删除某个孩子档案</h2>
          <p className={styles.lead}>
            会同时删除该孩子关联的云端成长记录、成长照片和保存绘本；家庭角色会保留，方便你单独检查和处理照片。
          </p>
          <div className={styles.children}>
            {cloudSummary.children.length ? cloudSummary.children.map((child) => (
              <div className={styles.childRow} key={child.id}>
                <span className={styles.childName}>{child.displayName}</span>
                {pendingChildId === child.id ? (
                  <div className={styles.confirmActions}>
                    <button className={styles.buttonDanger} disabled={deletionBusy} onClick={() => void handleDeleteChild(child.id)} type="button">确认删除</button>
                    <button className={styles.buttonText} disabled={deletionBusy} onClick={() => setPendingChildId(undefined)} type="button">取消</button>
                  </div>
                ) : (
                  <button className={styles.buttonText} onClick={() => setPendingChildId(child.id)} type="button">删除档案</button>
                )}
              </div>
            )) : <p className={styles.empty}>目前没有云端孩子档案。</p>}
          </div>
        </section>
      ) : null}

      <section className={`${styles.card} ${styles.danger}`}>
        <div className={styles.dangerHeader}>
          <span>
            <p className={styles.eyebrow}>DANGER ZONE</p>
            <h2>删除全部云端档案</h2>
          </span>
          <WarningCircle size={28} />
        </div>
        <p className={styles.lead}>
          会显式清理私有绘本图片、成长照片、记录、绘本、孩子档案、家庭角色照片与账户设置。数据库级联不会被当作 Storage 清理的替代。
        </p>
        <p className={styles.smallNote}>
          当前设备记住的早期匿名分享链接也会先按删除凭据清理；账户绑定的分享链接由服务器一并删除。
        </p>
        {!session ? (
          <p className={styles.empty}>需要登录后才能删除云端档案。</p>
        ) : !confirmCloudDelete ? (
          <div className={styles.actionRow}>
            <button className={styles.buttonDanger} onClick={() => setConfirmCloudDelete(true)} type="button">
              删除全部云端档案
            </button>
          </div>
        ) : (
          <div className={styles.confirmBox}>
            <p>此操作不可恢复。邮件订阅授权与登录身份分开管理，不会因为保留账户而自动新增或取消订阅。</p>
            <label className={styles.checkboxRow}>
              <input checked={deleteAuthUser} onChange={(event) => setDeleteAuthUser(event.target.checked)} type="checkbox" />
              <span>同时永久删除 StoryBloom 登录账户。勾选后完成删除会退出登录。</span>
            </label>
            <div className={styles.confirmActions}>
              <button className={styles.buttonDanger} disabled={deletionBusy} onClick={() => void handleDeleteAllCloudData()} type="button">
                {deleteAuthUser ? "确认删除档案和账户" : "确认删除全部云端档案"}
              </button>
              <button className={styles.buttonText} disabled={deletionBusy} onClick={() => { setConfirmCloudDelete(false); setDeleteAuthUser(false); }} type="button">取消</button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>SESSION</p>
        <h2>退出登录</h2>
        <p className={styles.lead}>退出不会删除当前设备或云端资料，也不会改变每日灵感邮件授权。</p>
        <div className={styles.actionRow}>
          {session ? (
            <button className={styles.buttonSecondary} disabled={signOutBusy} onClick={() => void handleSignOut()} type="button">
              <SignOut /> {signOutBusy ? "退出中" : "退出登录"}
            </button>
          ) : (
            <Link href={buildLoginPath("/me/settings")}>登录账户</Link>
          )}
        </div>
      </section>

      {notice ? <p className={styles[notice.tone]}>{notice.message}</p> : null}
      <p className={styles.smallNote}>
        <CloudArrowUp /> 登录、云端档案与营销邮件授权是三个独立状态；任何一个都不会自动开启另一个。
      </p>
    </main>
  );
}
