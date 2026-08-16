"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Copy,
  LinkSimple,
  SpinnerGap,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import {
  createShareManagementCode,
  forgetStoredShare,
  getStoredShare,
  isStoredShareExpired,
  listOwnedShareSummaries,
  restoreShareManagementCode,
  storeShare,
  type OwnedShareSummary,
  type StoredShare,
} from "@/lib/client-share-management";
import type { GenerateResponse } from "@/types";

type ShareStatus = "idle" | "creating" | "ready" | "copied" | "revoking";
type ShareExpiry = "7d" | "30d" | "never";

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatExpiry(value?: string) {
  if (!value) return "永久（由家长主动选择或旧分享）";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "有效期未知";
  if (date.getTime() <= Date.now()) {
    return `${date.toLocaleDateString("zh-CN")} 已过期`;
  }
  return `${date.toLocaleDateString("zh-CN")} 到期`;
}

export default function ShareLinkPanel({ result }: { result: GenerateResponse }) {
  const { session } = useAuth();
  const [stored, setStored] = useState<StoredShare | undefined>();
  const [ownedShare, setOwnedShare] = useState<OwnedShareSummary | undefined>();
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [expiry, setExpiry] = useState<ShareExpiry>("30d");
  const [riskConfirmed, setRiskConfirmed] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    setStored(getStoredShare(result.storyId));
    setOwnedShare(undefined);
    setStatus(getStoredShare(result.storyId) ? "ready" : "idle");
    const token = session?.access_token;
    if (!token) return;
    let active = true;
    void listOwnedShareSummaries(token)
      .then((shares) => {
        if (!active) return;
        setOwnedShare(
          shares.find(
            (share) =>
              share.clientStoryId === result.storyId && !share.revokedAt,
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [result.storyId, session?.access_token]);

  const activeShare = useMemo(() => {
    if (stored) return stored;
    if (!ownedShare || typeof window === "undefined") return undefined;
    return {
      shareId: ownedShare.shareId,
      deleteToken: "",
      url: `${window.location.origin}/s/${ownedShare.shareId}`,
      createdAt: ownedShare.createdAt,
      expiresAt: ownedShare.expiresAt,
    } satisfies StoredShare;
  }, [ownedShare, stored]);

  async function copyOrShareLink(share: StoredShare) {
    const copied = await copyText(share.url);
    if (navigator.share && !copied) {
      try {
        await navigator.share({ title: result.coverTitle, url: share.url });
      } catch {
        // The system sheet can be dismissed without changing share state.
      }
    }
    setStatus(copied ? "copied" : "ready");
  }

  async function handlePrimaryAction() {
    setError(null);
    if (activeShare) {
      if (isStoredShareExpired(activeShare)) {
        setError("这个分享已经过期，请先撤销清理，再创建新的链接。");
        return;
      }
      await copyOrShareLink(activeShare);
      return;
    }
    setPreviewOpen(true);
  }

  async function handleCreate() {
    if (!riskConfirmed) return;
    setStatus("creating");
    setError(null);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          clientStoryId: result.storyId,
          coverTitle: result.coverTitle,
          childName: result.input.childName,
          language: result.input.language,
          expiry,
          pages: result.pages.map((page) => ({
            page: page.page,
            zhText: page.zhText,
            enText: page.enText,
            imageUrl: page.imageUrl,
          })),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "分享链接生成失败，请稍后再试。");
      }

      const body = (await response.json()) as {
        shareId: string;
        deleteToken: string;
        expiresAt: string | null;
      };
      const share: StoredShare = {
        shareId: body.shareId,
        deleteToken: body.deleteToken,
        url: `${window.location.origin}/s/${body.shareId}`,
        createdAt: new Date().toISOString(),
        expiresAt: body.expiresAt || undefined,
        coverTitle: result.coverTitle,
      };
      const remembered = storeShare(result.storyId, share);
      setStored(share);
      setPreviewOpen(false);
      setRiskConfirmed(false);
      if (!remembered) {
        setError("浏览器未能保存撤销凭据，请立即复制下方管理码。");
      }
      await copyOrShareLink(share);
    } catch (creationError) {
      setStatus("idle");
      setError(
        creationError instanceof Error
          ? creationError.message
          : "分享链接生成失败，请稍后再试。",
      );
    }
  }

  async function handleDelete() {
    if (!activeShare) return;
    if (!window.confirm("撤销后家人将无法再打开这个公开链接。确定撤销吗？")) {
      return;
    }
    setStatus("revoking");
    setError(null);
    try {
      const response = await fetch("/api/share", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          shareId: activeShare.shareId,
          ...(activeShare.deleteToken
            ? { deleteToken: activeShare.deleteToken }
            : {}),
        }),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("分享已尝试撤销，但清理尚未完成，请保留管理码并重试。");
      }
      forgetStoredShare(result.storyId);
      setStored(undefined);
      setOwnedShare(undefined);
      setStatus("idle");
    } catch (revocationError) {
      // Never discard the only anonymous revocation credential on failure.
      setStatus("ready");
      setError(
        revocationError instanceof Error
          ? revocationError.message
          : "分享撤销失败，请稍后重试。",
      );
    }
  }

  function handleRestore() {
    const restored = restoreShareManagementCode(
      result.storyId,
      recoveryCode,
      window.location.origin,
    );
    if (!restored) {
      setError("管理码格式不正确，请复制完整内容后重试。");
      return;
    }
    setStored(restored);
    setRecoveryOpen(false);
    setRecoveryCode("");
    setStatus("ready");
    setError(null);
  }

  async function handleCopyManagementCode() {
    if (!managementCode) return;
    if (await copyText(managementCode)) {
      setError("管理码已复制。它等同撤销凭据，请只交给家长保管。");
      return;
    }
    setError(`请手动保存管理码：${managementCode}`);
  }

  const managementCode = stored?.deleteToken
    ? createShareManagementCode(stored)
    : "";

  return (
    <div className="share-link-panel">
      <div className="share-link-row">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void handlePrimaryAction()}
          disabled={status === "creating" || status === "revoking"}
        >
          {status === "creating" || status === "revoking" ? (
            <SpinnerGap aria-hidden="true" className="spin" />
          ) : activeShare ? (
            <Copy aria-hidden="true" />
          ) : (
            <LinkSimple aria-hidden="true" />
          )}
          {status === "creating"
            ? "正在创建私密分享…"
            : status === "revoking"
              ? "正在撤销…"
              : status === "copied"
                ? "链接已复制"
                : activeShare && isStoredShareExpired(activeShare)
                  ? "分享已过期"
                  : activeShare
                    ? "复制阅读链接"
                    : "创建家庭分享"}
        </button>
        {activeShare ? (
          <button
            type="button"
            className="secondary-btn share-link-delete"
            onClick={() => void handleDelete()}
            aria-label="撤销分享链接"
            title="撤销分享链接"
          >
            <Trash aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="share-recovery-toggle"
            onClick={() => setRecoveryOpen((value) => !value)}
          >
            已有管理码
          </button>
        )}
      </div>

      {activeShare ? (
        <div className="share-link-details" aria-live="polite">
          <span className="share-link-url">{activeShare.url}</span>
          <span>{formatExpiry(activeShare.expiresAt)}</span>
          {managementCode ? (
            <button
              type="button"
              onClick={() => void handleCopyManagementCode()}
              title="管理码等同撤销凭据，请只交给家长保管"
            >
              复制管理码
            </button>
          ) : null}
        </div>
      ) : null}

      {recoveryOpen && !activeShare ? (
        <div className="share-recovery-row">
          <input
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value)}
            placeholder="粘贴 shareId.deleteToken 管理码"
            aria-label="分享管理码"
          />
          <button type="button" onClick={handleRestore}>
            恢复管理
          </button>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="share-privacy-preview" role="dialog" aria-modal="true">
          <div>
            <WarningCircle aria-hidden="true" />
            <h4>创建前确认公开内容</h4>
          </div>
          <p>
            链接持有者将看到《{result.coverTitle}》、角色昵称“{result.input.childName}”、
            {result.pages.length} 页图文。请确认插图和文字中没有真实姓名、学校、住址、照片或其他家庭隐私。
          </p>
          <label>
            分享有效期
            <select
              value={expiry}
              onChange={(event) => setExpiry(event.target.value as ShareExpiry)}
            >
              <option value="7d">7 天</option>
              <option value="30d">30 天（默认）</option>
              <option value="never">永久，需主动撤销</option>
            </select>
          </label>
          <label className="share-risk-confirmation">
            <input
              type="checkbox"
              checked={riskConfirmed}
              onChange={(event) => setRiskConfirmed(event.target.checked)}
            />
            <span>
              <CheckCircle /> 我已检查即将公开的昵称、图片和家庭信息
            </span>
          </label>
          <div className="share-preview-actions">
            <button type="button" onClick={() => setPreviewOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="cta-btn"
              disabled={!riskConfirmed || status === "creating"}
              onClick={() => void handleCreate()}
            >
              确认并创建分享
            </button>
          </div>
        </div>
      ) : null}
      {error ? <span className="tool-error">{error}</span> : null}
    </div>
  );
}
