"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  BookOpenText,
  Cloud,
  CloudArrowDown,
  DeviceMobile,
  PencilSimple,
  ShareNetwork,
  Trash,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import { imageUrlToDataUrl } from "@/lib/client-images";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import type { SavedStory } from "@/lib/repositories/story-repository";
import {
  listReadingProgress,
  READING_PROGRESS_CHANGED_EVENT,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";
import {
  listOwnedShareSummaries,
  isStoredShareExpired,
  readStoredShares,
  revokeSharesBeforeStoryDeletion,
  SHARE_LINKS_CHANGED_EVENT,
} from "@/lib/client-share-management";
import {
  getStoryVisibility,
  mergeStoryCopies,
  type StoryVisibilityRow,
} from "./device-cloud-story-library-model";
import styles from "./DeviceCloudStoryLibrary.module.css";

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(story: SavedStory) {
  if (story.status === "complete") return "已完成";
  if (story.status === "failed") return "有页面需重试";
  return "生成中";
}

async function createLocalCopyFromCloud(story: SavedStory) {
  const pages = await Promise.all(
    story.result.pages.map(async (page) => {
      if (!page.imageUrl) {
        if (page.imageStatus === "complete") {
          throw new Error("cloud-story-image-missing");
        }
        return { ...page };
      }

      const dataUrl = await imageUrlToDataUrl(page.imageUrl);
      if (!dataUrl?.startsWith("data:image/")) {
        throw new Error("cloud-story-image-download-failed");
      }
      return { ...page, imageUrl: dataUrl };
    }),
  );

  return { ...story.result, pages };
}

function StoryCard({
  story,
  source,
  paired,
  disabled,
  busyAction,
  shared,
  readingProgress,
  onOpen,
  onRename,
  onDelete,
  onDeleteAll,
}: {
  story: SavedStory;
  source: "local" | "cloud";
  paired: boolean;
  disabled: boolean;
  busyAction: string;
  shared: boolean;
  readingProgress?: ReadingProgressRecord;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDeleteAll?: () => void;
}) {
  const actionPrefix = `${source}:${story.clientStoryId}`;
  const opening = busyAction === `open:${actionPrefix}`;
  const deleting = busyAction === `delete:${actionPrefix}`;
  const renaming = busyAction === `rename:${actionPrefix}`;
  const deletingAll = busyAction === `delete-all:${story.clientStoryId}`;

  return (
    <article className={styles.storyCard} data-source={source}>
      <div className={styles.storyCardTopline}>
        <span className={styles.sourceBadge}>
          {source === "local" ? <DeviceMobile /> : <Cloud />}
          {source === "local" ? "本机副本" : "云端副本"}
        </span>
        <span className={styles.statusBadge} data-status={story.status}>
          {getStatusLabel(story)}
        </span>
      </div>

      <div className={styles.storyIdentity}>
        <span className={styles.storyIcon} aria-hidden="true">
          <BookOpenText />
        </span>
        <div>
          <h3>{story.result.coverTitle}</h3>
          <p>
            {story.result.input.childName} · {story.imageProgress.complete}/
            {story.imageProgress.total} 页图片
          </p>
        </div>
      </div>

      <div className={styles.storyMeta}>
        <span>创建于 {formatTime(story.createdAt)}</span>
        <span>
          {readingProgress
            ? `最近阅读 ${formatTime(readingProgress.lastReadAt)} · ${Math.round(
                readingProgress.progressPercent,
              )}%`
            : `更新于 ${formatTime(story.updatedAt)}`}
        </span>
        {readingProgress?.completedAt ? <strong>已读完</strong> : null}
        {story.result.input.protagonistFamilyCharacterId ? (
          <strong>家庭角色系列</strong>
        ) : null}
        {shared ? <strong><ShareNetwork /> 已创建分享</strong> : null}
        {paired ? <strong>当前设备与云端都有副本</strong> : null}
      </div>

      <div className={styles.storyActions}>
        <button
          type="button"
          className={styles.renameButton}
          disabled={disabled}
          onClick={onRename}
        >
          <PencilSimple /> {renaming ? "保存中…" : "改标题"}
        </button>
        <button
          type="button"
          className={styles.openButton}
          disabled={disabled}
          onClick={onOpen}
        >
          {source === "cloud" ? <CloudArrowDown /> : <BookOpenText />}
          {opening
            ? "正在保存图片…"
            : source === "cloud"
              ? "保存到本机并打开"
              : "打开本机副本"}
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash />
          {deleting
            ? "删除中…"
            : source === "cloud"
              ? "仅删除云端"
              : "仅删除本机"}
        </button>
        {source === "local" && paired && onDeleteAll ? (
          <button
            type="button"
            className={styles.deleteAllButton}
            disabled={disabled}
            onClick={onDeleteAll}
          >
            <Trash /> {deletingAll ? "全部删除中…" : "全部删除"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MissingCopy({
  source,
  signedIn,
  loading,
}: {
  source: "local" | "cloud";
  signedIn: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className={styles.missingCopy} aria-live="polite">
        <ArrowsClockwise className={styles.spin} />
        <span>{source === "cloud" ? "正在读取云端账户" : "正在读取当前设备"}</span>
      </div>
    );
  }

  if (source === "cloud" && !signedIn) {
    return (
      <div className={styles.missingCopy}>
        <Cloud />
        <span>登录后查看主动导入到云端的绘本</span>
        <Link href={buildLoginPath("/me/books")}>登录账户</Link>
      </div>
    );
  }

  return (
    <div className={styles.missingCopy}>
      {source === "cloud" ? <Cloud /> : <DeviceMobile />}
      <span>
        {source === "cloud" ? "这本尚未导入云端" : "此设备尚无这本绘本的副本"}
      </span>
    </div>
  );
}

export default function DeviceCloudStoryLibrary() {
  const { supabase, session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const requestIdRef = useRef(0);
  const [localStories, setLocalStories] = useState<SavedStory[]>([]);
  const [cloudStories, setCloudStories] = useState<SavedStory[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [sharedStoryIds, setSharedStoryIds] = useState<Set<string>>(new Set());
  const [readingProgress, setReadingProgress] = useState<
    Map<string, ReadingProgressRecord>
  >(new Map());

  const refreshReadingProgress = useCallback(async () => {
    const records = await listReadingProgress();
    setReadingProgress(
      new Map(
        records
          .filter((record) => record.contentType === "personalized")
          .map((record) => [record.contentId, record] as const),
      ),
    );
  }, []);

  const loadStories = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLocalLoading(true);
    setCloudLoading(Boolean(userId));
    setLocalError("");
    setCloudError("");
    // Signed URLs belong to the active account. Never keep a previous
    // account's hydrated cloud rows visible while the next session loads.
    setCloudStories([]);

    const localTask = localStoryRepository.list();
    const cloudTask: Promise<SavedStory[]> =
      userId && supabase
        ? createCloudStoryRepository(supabase, userId).list()
        : Promise.resolve([]);
    const shareTask = session?.access_token
      ? listOwnedShareSummaries(session.access_token)
      : Promise.resolve([]);
    const progressTask = listReadingProgress();
    const [localResult, cloudResult, shareResult, progressResult] =
      await Promise.allSettled([
        localTask,
        cloudTask,
        shareTask,
        progressTask,
      ]);

    if (requestIdRef.current !== requestId) return;

    if (localResult.status === "fulfilled") {
      setLocalStories(localResult.value);
    } else {
      setLocalError("当前设备里的绘本暂时读取失败，请刷新后重试。");
    }
    setLocalLoading(false);

    const localSharedIds = Object.entries(readStoredShares()).flatMap(
      ([storyId, share]) => (isStoredShareExpired(share) ? [] : [storyId]),
    );
    const ownedSharedIds =
      shareResult.status === "fulfilled"
        ? shareResult.value.flatMap((share) =>
            share.clientStoryId &&
            !share.revokedAt &&
            (!share.expiresAt ||
              new Date(share.expiresAt).getTime() > Date.now())
              ? [share.clientStoryId]
              : [],
          )
        : [];
    setSharedStoryIds(new Set([...localSharedIds, ...ownedSharedIds]));
    if (progressResult.status === "fulfilled") {
      setReadingProgress(
        new Map(
          progressResult.value
            .filter((record) => record.contentType === "personalized")
            .map((record) => [record.contentId, record] as const),
        ),
      );
    }

    if (!userId) {
      setCloudStories([]);
      setCloudLoading(false);
      return;
    }
    if (!supabase) {
      setCloudStories([]);
      setCloudError("账户服务尚未准备好，请稍后重试。");
      setCloudLoading(false);
      return;
    }
    if (cloudResult.status === "fulfilled") {
      setCloudStories(cloudResult.value);
    } else {
      setCloudStories([]);
      setCloudError("云端绘本暂时读取失败；本机阅读不会受到影响。");
    }
    setCloudLoading(false);
  }, [session?.access_token, supabase, userId]);

  useEffect(() => {
    if (authLoading) return;
    const refresh = () => void loadStories();
    const refreshProgress = () => void refreshReadingProgress();
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(SHARE_LINKS_CHANGED_EVENT, refresh);
    window.addEventListener(READING_PROGRESS_CHANGED_EVENT, refreshProgress);
    return () => {
      requestIdRef.current += 1;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(SHARE_LINKS_CHANGED_EVENT, refresh);
      window.removeEventListener(
        READING_PROGRESS_CHANGED_EVENT,
        refreshProgress,
      );
    };
  }, [authLoading, loadStories, refreshReadingProgress]);

  const rows = useMemo(
    () => mergeStoryCopies(localStories, cloudStories),
    [cloudStories, localStories],
  );
  const actionsDisabled = Boolean(busyAction);

  async function handleOpenCloud(story: SavedStory) {
    const key = `open:cloud:${story.clientStoryId}`;
    setBusyAction(key);
    setActionError("");
    try {
      if (!userId || !supabase) throw new Error("cloud-session-required");
      // Refresh the row so an hour-old signed URL is never persisted after it
      // has expired while this page stayed open.
      const currentStory = await createCloudStoryRepository(
        supabase,
        userId,
      ).get(story.id);
      if (!currentStory) throw new Error("cloud-story-not-found");
      const localResult = await createLocalCopyFromCloud(currentStory);
      await localStoryRepository.save({ result: localResult });
      window.location.href = `/?book=${encodeURIComponent(
        currentStory.clientStoryId,
      )}`;
    } catch {
      setActionError(
        "云端绘本的私有图片未能完整保存到本机，请检查网络后重试。云端副本没有被修改。",
      );
      setBusyAction("");
    }
  }

  function handleOpenLocal(story: SavedStory) {
    window.location.href = `/?book=${encodeURIComponent(story.clientStoryId)}`;
  }

  async function handleRename(story: SavedStory, source: "local" | "cloud") {
    const nextTitle = window.prompt("输入新的绘本标题", story.result.coverTitle)?.trim();
    if (!nextTitle || nextTitle === story.result.coverTitle) return;
    if (nextTitle.length > 120) {
      setActionError("标题不能超过 120 个字符。");
      return;
    }
    setBusyAction(`rename:${source}:${story.clientStoryId}`);
    setActionError("");
    try {
      if (source === "cloud") {
        if (!userId || !supabase) throw new Error("cloud-session-required");
        await createCloudStoryRepository(supabase, userId).update(story.id, {
          title: nextTitle,
        });
      } else {
        await localStoryRepository.update(story.clientStoryId, {
          title: nextTitle,
        });
      }
      await loadStories();
    } catch {
      setActionError("标题修改失败，请稍后重试。另一份副本没有被修改。");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteLocal(story: SavedStory, revokeShares: boolean) {
    if (!window.confirm(`仅删除当前设备里的《${story.result.coverTitle}》吗？`)) {
      return;
    }
    setBusyAction(`delete:local:${story.clientStoryId}`);
    setActionError("");
    try {
      if (revokeShares) {
        await revokeSharesBeforeStoryDeletion({
          storyId: story.clientStoryId,
          accessToken: session?.access_token,
        });
      }
      await localStoryRepository.remove(story.clientStoryId);
      await loadStories();
    } catch {
      setActionError("本机副本删除失败，请稍后重试。云端副本没有被修改。");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteCloud(story: SavedStory, revokeShares: boolean) {
    if (!userId || !supabase) return;
    if (!window.confirm(`仅删除云端账户里的《${story.result.coverTitle}》吗？`)) {
      return;
    }
    setBusyAction(`delete:cloud:${story.clientStoryId}`);
    setActionError("");
    try {
      if (revokeShares) {
        await revokeSharesBeforeStoryDeletion({
          storyId: story.clientStoryId,
          accessToken: session?.access_token,
        });
      }
      await createCloudStoryRepository(supabase, userId).remove(story.id);
      await loadStories();
    } catch {
      setActionError("云端副本删除失败，请稍后重试。本机副本没有被修改。");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteAll(row: StoryVisibilityRow) {
    if (!row.local || !row.cloud || !userId || !supabase) return;
    const firstConfirmed = window.confirm(
      `第一次确认：要同时删除《${row.local.result.coverTitle}》的本机和云端副本吗？`,
    );
    if (!firstConfirmed) return;
    const secondConfirmed = window.confirm(
      "第二次确认：两份副本都会删除，另一台设备之后也无法再读取云端副本。确定继续吗？",
    );
    if (!secondConfirmed) return;

    setBusyAction(`delete-all:${row.clientStoryId}`);
    setActionError("");
    try {
      await revokeSharesBeforeStoryDeletion({
        storyId: row.clientStoryId,
        accessToken: session?.access_token,
      });
      // Delete the cloud copy first so a network failure leaves the reliable
      // local copy untouched.
      await createCloudStoryRepository(supabase, userId).remove(row.cloud.id);
      await localStoryRepository.remove(row.local.clientStoryId);
      await loadStories();
    } catch {
      setActionError(
        "全部删除未能完整完成。页面已保留现状提示，请刷新确认仍存在的副本。",
      );
      await loadStories();
    } finally {
      setBusyAction("");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <div>
          <p>DEVICE + CLOUD LIBRARY</p>
          <h2>本机与云端，副本边界清楚可见</h2>
          <span>
            登录不会自动上传。本机和云端副本彼此独立；打开云端绘本时，会先把私有图片保存到当前设备，再进入阅读。
          </span>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          disabled={localLoading || cloudLoading || actionsDisabled}
          onClick={() => void loadStories()}
        >
          <ArrowsClockwise /> 刷新
        </button>
      </section>

      {actionError ? (
        <div className={styles.errorBanner} role="alert">
          {actionError}
        </div>
      ) : null}

      <div className={styles.columnHeaders}>
        <section className={styles.columnHeader} data-source="local">
          <span className={styles.columnIcon}>
            <DeviceMobile />
          </span>
          <div>
            <p>当前设备</p>
            <span>退出登录后仍会保留</span>
          </div>
          <strong>{localLoading ? "…" : `${localStories.length} 本`}</strong>
        </section>
        <section className={styles.columnHeader} data-source="cloud">
          <span className={styles.columnIcon}>
            <Cloud />
          </span>
          <div>
            <p>云端账户</p>
            <span>{userId ? "其他设备登录后可见" : "登录后按需使用"}</span>
          </div>
          <strong>
            {authLoading || cloudLoading
              ? "…"
              : userId
                ? `${cloudStories.length} 本`
                : "未登录"}
          </strong>
        </section>
      </div>

      {localError || cloudError ? (
        <div className={styles.sourceErrors} role="status">
          {localError ? <p>{localError}</p> : <span />}
          {cloudError ? <p>{cloudError}</p> : <span />}
        </div>
      ) : null}

      <section className={styles.storyRows} aria-label="本机与云端绘本副本">
        {rows.length === 0 && !localLoading && !cloudLoading && !authLoading ? (
          <div className={styles.emptyLibrary}>
            <BookOpenText />
            <h3>还没有可显示的绘本</h3>
            <p>完成第一本绘本后会先保存在当前设备；只有主动导入的内容才会出现在云端账户。</p>
            <Link href="/?mode=minimal">创作第一本绘本</Link>
          </div>
        ) : null}

        {rows.map((row) => {
          const visibility = getStoryVisibility(row);
          const paired = visibility === "both";
          return (
            <Fragment key={row.clientStoryId}>
              <div className={styles.storyRow} data-visibility={visibility}>
                <div className={styles.storyCell}>
                  <div className={styles.mobileSourceLabel}>
                    <DeviceMobile /> 当前设备
                  </div>
                  {row.local ? (
                    <StoryCard
                      story={row.local}
                      source="local"
                      paired={paired}
                      shared={sharedStoryIds.has(row.clientStoryId)}
                      readingProgress={readingProgress.get(row.clientStoryId)}
                      disabled={actionsDisabled}
                      busyAction={busyAction}
                      onOpen={() => handleOpenLocal(row.local!)}
                      onRename={() => void handleRename(row.local!, "local")}
                      onDelete={() => void handleDeleteLocal(row.local!, !paired)}
                      onDeleteAll={
                        paired ? () => void handleDeleteAll(row) : undefined
                      }
                    />
                  ) : (
                    <MissingCopy
                      source="local"
                      signedIn={Boolean(userId)}
                      loading={localLoading}
                    />
                  )}
                </div>
                <div className={styles.storyCell}>
                  <div className={styles.mobileSourceLabel}>
                    <Cloud /> 云端账户
                  </div>
                  {row.cloud ? (
                    <StoryCard
                      story={row.cloud}
                      source="cloud"
                      paired={paired}
                      shared={sharedStoryIds.has(row.clientStoryId)}
                      readingProgress={readingProgress.get(row.clientStoryId)}
                      disabled={actionsDisabled}
                      busyAction={busyAction}
                      onOpen={() => void handleOpenCloud(row.cloud!)}
                      onRename={() => void handleRename(row.cloud!, "cloud")}
                      onDelete={() => void handleDeleteCloud(row.cloud!, !paired)}
                    />
                  ) : (
                    <MissingCopy
                      source="cloud"
                      signedIn={Boolean(userId)}
                      loading={authLoading || cloudLoading}
                    />
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </section>
    </main>
  );
}
