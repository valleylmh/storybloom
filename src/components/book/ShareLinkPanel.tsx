"use client";

import { useState } from "react";
import { LinkSimple, SpinnerGap, Trash } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import type { GenerateResponse } from "@/types";

const SHARE_STORAGE_KEY = "storybloom.shareLinks.v1";

type StoredShare = { shareId: string; deleteToken: string; url: string };

function readStoredShares(): Record<string, StoredShare> {
  try {
    const raw = window.localStorage.getItem(SHARE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredShare>) : {};
  } catch {
    return {};
  }
}

function writeStoredShares(shares: Record<string, StoredShare>) {
  try {
    window.localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(shares));
  } catch {
    // Storage full/unavailable — the link still works, it just won't be remembered.
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  return false;
}

export default function ShareLinkPanel({ result }: { result: GenerateResponse }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<"idle" | "creating" | "ready" | "copied">(
    () =>
      typeof window !== "undefined" && readStoredShares()[result.storyId]
        ? "ready"
        : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const stored =
    typeof window !== "undefined" ? readStoredShares()[result.storyId] : undefined;

  async function handleCreateOrCopy() {
    setError(null);

    const existing = readStoredShares()[result.storyId];
    if (existing) {
      const copied = await copyText(existing.url);
      if (navigator.share && !copied) {
        try {
          await navigator.share({ title: result.coverTitle, url: existing.url });
        } catch {
          // user dismissed the sheet
        }
      }
      setStatus(copied ? "copied" : "ready");
      return;
    }

    setStatus("creating");
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
          coverTitle: result.coverTitle,
          childName: result.input.childName,
          language: result.input.language,
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

      const { shareId, deleteToken } = (await response.json()) as {
        shareId: string;
        deleteToken: string;
      };
      const url = `${window.location.origin}/s/${shareId}`;
      const shares = readStoredShares();
      shares[result.storyId] = { shareId, deleteToken, url };
      writeStoredShares(shares);

      const copied = await copyText(url);
      setStatus(copied ? "copied" : "ready");
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
    const existing = readStoredShares()[result.storyId];
    if (!existing) return;
    setError(null);

    try {
      await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId: existing.shareId,
          deleteToken: existing.deleteToken,
        }),
      });
    } catch {
      // Even if the request fails, drop it locally so the user can retry cleanly.
    }
    const shares = readStoredShares();
    delete shares[result.storyId];
    writeStoredShares(shares);
    setStatus("idle");
  }

  return (
    <div className="share-link-row">
      <button
        type="button"
        className="secondary-btn"
        onClick={handleCreateOrCopy}
        disabled={status === "creating"}
      >
        {status === "creating" ? (
          <SpinnerGap aria-hidden="true" className="spin" />
        ) : (
          <LinkSimple aria-hidden="true" />
        )}
        {status === "creating"
          ? "正在生成阅读链接..."
          : status === "copied"
            ? "链接已复制，发给家人吧"
            : stored
              ? "复制阅读链接"
              : "生成阅读链接"}
      </button>
      {stored ? (
        <button
          type="button"
          className="secondary-btn share-link-delete"
          onClick={handleDelete}
          aria-label="删除分享链接"
          title="删除分享链接"
        >
          <Trash aria-hidden="true" />
        </button>
      ) : null}
      {stored && status !== "creating" ? (
        <span className="share-link-url">{stored.url}</span>
      ) : null}
      {error ? <span className="tool-error">{error}</span> : null}
    </div>
  );
}
