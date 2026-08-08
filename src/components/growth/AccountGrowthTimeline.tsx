"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Cloud,
  DeviceMobile,
  SignIn,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import { imageUrlToDataUrl } from "@/lib/client-images";
import type { GrowthRecord } from "@/lib/growth-records";
import { createCloudGrowthRepository } from "@/lib/repositories/cloud-growth-repository";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import type { GrowthRepository } from "@/lib/repositories/growth-repository";
import GrowthTimeline from "./GrowthTimeline";
import {
  getGrowthClientRecordId,
  getPairedGrowthRecordIds,
  mergeGrowthCopies,
  type GrowthCopyRow,
  type GrowthDataSource,
} from "./growth-source-model";
import styles from "./GrowthArchive.module.css";

async function createLocalStoryFromCloud(record: GrowthRecord) {
  const pages = await Promise.all(
    record.story.pages.map(async (page) => {
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

  return { ...record.story, pages };
}

export default function AccountGrowthTimeline({
  childKey,
  source,
}: {
  childKey: string;
  source: GrowthDataSource;
}) {
  const { supabase, session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const cloudRepository = useMemo<GrowthRepository | null>(() => {
    if (!supabase || !userId) return null;
    return createCloudGrowthRepository(supabase, userId);
  }, [supabase, userId]);
  const [copyRows, setCopyRows] = useState<GrowthCopyRow[]>([]);
  const [copyOwnerId, setCopyOwnerId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadCopyRows = useCallback(async () => {
    if (!cloudRepository || !userId) {
      setCopyRows([]);
      setCopyOwnerId(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setCopyRows([]);
    setCopyOwnerId(null);
    const [localResult, cloudResult] = await Promise.allSettled([
      localGrowthRepository.list(),
      cloudRepository.list(),
    ]);
    if (requestId !== requestIdRef.current) return;
    if (localResult.status === "fulfilled" && cloudResult.status === "fulfilled") {
      setCopyRows(mergeGrowthCopies(localResult.value, cloudResult.value));
      setCopyOwnerId(userId);
    } else {
      // Pair-only metadata must never block either source from rendering.
      setCopyRows([]);
    }
  }, [cloudRepository, userId]);

  useEffect(() => {
    if (authLoading) return;
    void loadCopyRows();
    return () => {
      requestIdRef.current += 1;
    };
  }, [authLoading, loadCopyRows]);

  const pairedClientRecordIds = useMemo(
    () =>
      getPairedGrowthRecordIds(
        userId && copyOwnerId === userId ? copyRows : [],
      ),
    [copyOwnerId, copyRows, userId],
  );

  async function openCloudStory(record: GrowthRecord) {
    if (!cloudRepository) throw new Error("cloud-growth-session-required");
    // Refresh immediately before download so signed URLs are current even if
    // this timeline has stayed open longer than their validity period.
    const refreshedRecords = await cloudRepository.getByChild(record.childKey);
    const clientRecordId = getGrowthClientRecordId(record);
    const current = refreshedRecords.find(
      (candidate) =>
        candidate.id === record.id ||
        getGrowthClientRecordId(candidate) === clientRecordId,
    );
    if (!current) throw new Error("cloud-growth-record-not-found");
    const localStory = await createLocalStoryFromCloud(current);
    await localStoryRepository.save({ result: localStory });
    window.location.href = `/?mode=minimal&book=${encodeURIComponent(
      localStory.storyId,
    )}`;
  }

  async function deleteAllCopies(record: GrowthRecord) {
    if (!cloudRepository) throw new Error("cloud-growth-session-required");
    const clientRecordId = getGrowthClientRecordId(record);
    const row = copyRows.find(
      (candidate) => candidate.clientRecordId === clientRecordId,
    );
    if (!row?.local || !row.cloud) {
      throw new Error("growth-copy-pair-not-found");
    }

    // Delete cloud first: if the network fails, the dependable local copy is
    // untouched and the user can retry safely.
    await cloudRepository.remove(row.cloud.id);
    await localGrowthRepository.remove(row.local.id);
    setCopyRows((current) =>
      current.filter((candidate) => candidate.clientRecordId !== clientRecordId),
    );
  }

  return (
    <div className={styles.embeddedPage}>
      <section className={styles.timelineSourceSwitch} aria-label="成长记录来源">
        <Link
          href="/me/growth"
          className={source === "local" ? styles.timelineSourceActive : ""}
          aria-current={source === "local" ? "page" : undefined}
        >
          <DeviceMobile /> 当前设备
        </Link>
        <Link
          href="/me/growth?source=cloud"
          className={source === "cloud" ? styles.timelineSourceActive : ""}
          aria-current={source === "cloud" ? "page" : undefined}
        >
          <Cloud /> 私有云端
        </Link>
      </section>

      {source === "cloud" && authLoading ? (
        <section className={styles.loadingState} aria-label="正在读取账户状态">
          <span />
          <span />
        </section>
      ) : source === "cloud" && !userId ? (
        <section className={styles.emptyState}>
          <Cloud />
          <h1>登录后查看私有云端时间轴</h1>
          <p>当前设备中的成长记录仍然保留，可以切换回本机继续查看。</p>
          <Link href={buildLoginPath(`/me/growth/${encodeURIComponent(childKey)}?source=cloud`)}>
            <SignIn /> 登录账户
          </Link>
        </section>
      ) : source === "cloud" && !cloudRepository ? (
        <section className={styles.emptyState}>
          <BookOpenText />
          <h1>账户服务尚未准备好</h1>
          <p>请稍后刷新；当前设备中的记录不受影响。</p>
          <Link href="/me/growth">查看当前设备</Link>
        </section>
      ) : (
        <GrowthTimeline
          key={`${userId || "anon"}:${source}:${childKey}`}
          childKey={childKey}
          embedded
          basePath={source === "cloud" ? "/me/growth?source=cloud" : "/me/growth"}
          repository={source === "cloud" ? cloudRepository || undefined : localGrowthRepository}
          source={source}
          pairedClientRecordIds={pairedClientRecordIds}
          onOpenStory={source === "cloud" ? openCloudStory : undefined}
          onDeleteAll={userId && cloudRepository ? deleteAllCopies : undefined}
        />
      )}
    </div>
  );
}
