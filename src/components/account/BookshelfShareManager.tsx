"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, LinkSimple, SpinnerGap, Trash } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import {
  forgetStoredShare,
  listOwnedShareSummaries,
  readStoredShares,
  SHARE_LINKS_CHANGED_EVENT,
  type OwnedShareSummary,
  type StoredShare,
} from "@/lib/client-share-management";

type ManagedShare = {
  storyId?: string;
  coverTitle: string;
  share: StoredShare;
  revokedAt?: string;
};

function formatDate(value?: string) {
  if (!value) return "永久有效";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "有效期未知";
  return date.getTime() <= Date.now()
    ? `${date.toLocaleDateString("zh-CN")} 已过期`
    : `${date.toLocaleDateString("zh-CN")} 到期`;
}

function mergeShares(
  local: Record<string, StoredShare>,
  owned: OwnedShareSummary[],
) {
  const merged = new Map<string, ManagedShare>();
  owned.forEach((share) => {
    merged.set(share.shareId, {
      storyId: share.clientStoryId,
      coverTitle: share.coverTitle,
      revokedAt: share.revokedAt,
      share: {
        shareId: share.shareId,
        deleteToken: "",
        url: `${window.location.origin}/s/${share.shareId}`,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      },
    });
  });
  Object.entries(local).forEach(([storyId, share]) => {
    const ownedShare = merged.get(share.shareId);
    merged.set(share.shareId, {
      storyId,
      coverTitle: share.coverTitle || "家庭专属绘本",
      share,
      revokedAt: ownedShare?.revokedAt,
    });
  });
  return [...merged.values()].sort((left, right) =>
    (right.share.createdAt || "").localeCompare(left.share.createdAt || ""),
  );
}

export default function BookshelfShareManager() {
  const { session } = useAuth();
  const [local, setLocal] = useState<Record<string, StoredShare>>({});
  const [owned, setOwned] = useState<OwnedShareSummary[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLocal(readStoredShares());
    if (!session?.access_token) {
      setOwned([]);
      return;
    }
    try {
      setOwned(await listOwnedShareSummaries(session.access_token));
      setError("");
    } catch {
      setError("账户分享列表暂时无法读取，本浏览器保存的撤销凭据仍然可用。");
    }
  }, [session?.access_token]);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(SHARE_LINKS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(SHARE_LINKS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  const entries = useMemo(() => mergeShares(local, owned), [local, owned]);
  if (entries.length === 0) return null;

  async function handleRevoke(entry: ManagedShare) {
    if (!window.confirm(`撤销《${entry.coverTitle}》的家庭分享吗？`)) return;
    setBusyId(entry.share.shareId);
    setError("");
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
          shareId: entry.share.shareId,
          ...(entry.share.deleteToken
            ? { deleteToken: entry.share.deleteToken }
            : {}),
        }),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("share-revoke-failed");
      }
      if (entry.storyId) forgetStoredShare(entry.storyId);
      await refresh();
    } catch {
      setError("撤销或公开图片清理尚未完成。管理凭据已保留，请稍后重试。");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="bookshelf-share-manager" aria-label="分享管理">
      <header>
        <p>主动分享</p>
        <h2>分享管理</h2>
        <span>家庭作品默认私有；这里只有你主动创建的公开链接。</span>
      </header>
      <div className="bookshelf-share-list">
        {entries.map((entry) => (
          <article key={entry.share.shareId}>
            <div>
              <strong>{entry.coverTitle}</strong>
              <span>
                {entry.share.createdAt
                  ? `${new Date(entry.share.createdAt).toLocaleDateString("zh-CN")} 创建 · `
                  : ""}
                {entry.revokedAt
                  ? "已撤销，等待完成公开资源清理"
                  : formatDate(entry.share.expiresAt)}
              </span>
            </div>
            <div>
              <a href={entry.share.url} target="_blank" rel="noreferrer">
                <LinkSimple /> 打开预览
              </a>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(entry.share.url)
                }
              >
                <Copy /> 复制
              </button>
              <button
                type="button"
                className="bookshelf-share-revoke"
                disabled={busyId === entry.share.shareId}
                onClick={() => void handleRevoke(entry)}
              >
                {busyId === entry.share.shareId ? (
                  <SpinnerGap className="spin" />
                ) : (
                  <Trash />
                )}
                撤销
              </button>
            </div>
          </article>
        ))}
      </div>
      {error ? (
        <p className="tool-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
