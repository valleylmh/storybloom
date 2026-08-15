"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowsClockwise, CloudCheck, DeviceMobile } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import {
  listCloudFavoriteRecords,
  listCloudReadingProgress,
  mergeFavoriteCollections,
  mergeReadingProgressCollections,
  upsertCloudFavoriteRecords,
  upsertCloudReadingProgress,
} from "@/lib/cloud-reading-state";
import {
  listFavoriteRecords,
  saveFavoriteRecord,
} from "@/lib/favorites";
import {
  listReadingProgress,
  saveReadingProgress,
} from "@/lib/reading-progress";
import {
  isReadingSyncEnabled,
  READING_SYNC_CHANGED_EVENT,
  setReadingSyncEnabled,
} from "@/lib/reading-sync-preference";

function syncErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error || "");
  if (/reading_progress|favorites|relation .* does not exist/i.test(message)) {
    return "跨设备阅读表尚未部署；本机进度和收藏仍然安全保留。";
  }
  return "同步暂时失败；本机进度和收藏没有丢失，请稍后重试。";
}

export default function ReadingSyncControl() {
  const { supabase, user, loading } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => setEnabled(isReadingSyncEnabled());
    refresh();
    window.addEventListener(READING_SYNC_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(READING_SYNC_CHANGED_EVENT, refresh);
  }, []);

  async function enableSync() {
    if (!supabase || !user) return;
    setBusy(true);
    setMessage("");
    try {
      const [localProgress, localFavorites, cloudProgress, cloudFavorites] =
        await Promise.all([
          listReadingProgress(),
          Promise.resolve(listFavoriteRecords({ includeDeleted: true })),
          listCloudReadingProgress(supabase, user.id),
          listCloudFavoriteRecords(supabase, user.id),
        ]);
      const mergedProgress = mergeReadingProgressCollections(
        localProgress,
        cloudProgress,
      );
      const mergedFavorites = mergeFavoriteCollections(
        localFavorites,
        cloudFavorites,
      );
      await Promise.all([
        ...mergedProgress.map(saveReadingProgress),
        ...mergedFavorites.map((record) =>
          Promise.resolve(saveFavoriteRecord(record)),
        ),
        upsertCloudReadingProgress(supabase, user.id, mergedProgress),
        upsertCloudFavoriteRecords(supabase, user.id, mergedFavorites),
      ]);
      setReadingSyncEnabled(true);
      setMessage("已合并本机与账号记录；以后会跨设备保存阅读进度和收藏。");
    } catch (error) {
      setReadingSyncEnabled(false);
      setMessage(syncErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <section className="library-sync-card" aria-label="跨设备阅读同步">
        <DeviceMobile aria-hidden="true" />
        <div>
          <strong>当前进度和收藏只保存在这台设备</strong>
          <p>登录后可由家长主动选择合并，不会因为登录自动上传。</p>
        </div>
        <Link href={buildLoginPath("/library")}>登录账户</Link>
      </section>
    );
  }

  return (
    <section className="library-sync-card" aria-label="跨设备阅读同步">
      {enabled ? <CloudCheck aria-hidden="true" /> : <DeviceMobile aria-hidden="true" />}
      <div>
        <strong>{enabled ? "阅读记录已跨设备保存" : "本机记录尚未同步到账户"}</strong>
        <p>
          {enabled
            ? "收藏和阅读进度会保存到账户；私人作品仍不会自动上传。"
            : "只有家长点击开启后，才会合并本机与账号记录。"}
        </p>
        {message ? <span role="status">{message}</span> : null}
      </div>
      {enabled ? (
        <button
          type="button"
          onClick={() => {
            setReadingSyncEnabled(false);
            setMessage("已停止自动同步；账号中已有记录不会被删除。");
          }}
        >
          停止自动同步
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void enableSync()}>
          {busy ? <ArrowsClockwise className="spin" /> : null}
          {busy ? "正在合并…" : "合并并开启同步"}
        </button>
      )}
    </section>
  );
}
