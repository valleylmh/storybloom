"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import { createCloudGrowthRepository } from "@/lib/repositories/cloud-growth-repository";
import { createLocalDataImportController } from "@/lib/sync/local-data-import";
import { createIndexedDbSyncMetaStore } from "@/lib/sync/sync-meta";
import { claimRecord } from "@/lib/sync/account-ownership";
import { mergeAccountRows, shouldUpload } from "@/lib/sync/account-sync-model";
import { accountCache, type AccountSnapshot } from "@/lib/sync/account-cache";
import { GUARDIAN_CONSENT_VERSION } from "@/lib/auth/guardian-consent";
import type { GrowthRecord } from "@/lib/growth-records";

const growthId = (row: GrowthRecord) => row.clientRecordId || row.id;
const empty: AccountSnapshot = { stories: [], growth: [] };
type SyncContext = AccountSnapshot & {
  loading: boolean; message: string; needsPhotoConsent: boolean;
  refresh: () => Promise<void>; allowPhotos: () => void;
  mutate: (operation: () => Promise<void>) => Promise<void>;
};
const Context = createContext<SyncContext | null>(null);
export function useAccountSync() {
  const context = useContext(Context);
  if (!context) throw new Error("account-sync-provider-missing");
  return context;
}
export default function AccountSyncProvider({ children }: { children: ReactNode }) {
  const { supabase, session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const ownerRef = useRef(userId); ownerRef.current = userId;
  const [data, setData] = useState<AccountSnapshot & { owner?: string }>({ ...empty });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [needsPhotoConsent, setNeedsPhotoConsent] = useState(false);
  const controller = useMemo(() => {
    if (!userId || !supabase) return null;
    const cloudStories = createCloudStoryRepository(supabase, userId);
    const cloudGrowth = createCloudGrowthRepository(supabase, userId);
    const metaStore = createIndexedDbSyncMetaStore(userId);
    const consentKey = `storybloom.local-import.guardian-consent.${GUARDIAN_CONSENT_VERSION}.${userId}`;
    let active = true;
    let running: Promise<void> = Promise.resolve();
    let refreshQueued: Promise<void> | null = null;
    function enqueue(operation: () => Promise<void>) {
      const next = running.then(operation, operation);
      running = next.catch(() => {});
      return next;
    }
    const current = () => active && ownerRef.current === userId;
    const localStories = { ...localStoryRepository, list: async () => (await localStoryRepository.list()).filter(row => claimRecord("story", row.clientStoryId, userId)) };
    const localGrowth = { ...localGrowthRepository, list: async () => (await localGrowthRepository.list()).filter(row => claimRecord("growth", growthId(row), userId)) };
    const engine = createLocalDataImportController({ supabase, userId, localStories, localGrowthRecords: localGrowth });
    async function sync() {
      if (!current()) return;
      setLoading(true); setMessage("正在同步账号记录…");
      try {
        const [stories, growth, cached] = await Promise.all([localStories.list(), localGrowth.list(), accountCache(userId!).catch(() => undefined)]);
        if (!current()) return;
        const initialMeta = await metaStore.list();
        const display = (cloud: AccountSnapshot, meta = initialMeta) => {
          if (!current()) return;
          const childAliases = new Map<string, string>();
          for (const row of growth) {
            const remote = cloud.growth.find(item => growthId(item) === growthId(row));
            if (remote) childAliases.set(row.childKey, remote.childKey);
          }
          setData({ owner: userId,
            stories: mergeAccountRows(stories, cloud.stories, row => row.clientStoryId, row => row.updatedAt, meta.filter(row => row.entityType === "story")),
            growth: mergeAccountRows(growth.map(row => ({ ...row, childKey: childAliases.get(row.childKey) || row.childKey })), cloud.growth, growthId, row => row.updatedAt, meta.filter(row => row.entityType === "growth-record")),
          });
        };
        display(cached || empty, cached ? initialMeta : []);
        if (!navigator.onLine) { setMessage("当前离线，显示已保存记录；联网后自动同步，部分图片可能暂不可用。"); return; }
        let remote = { stories: await cloudStories.list(), growth: await cloudGrowth.list() };
        if (!current()) return;
        display(remote);
        const metas = new Map(initialMeta.map(row => [`${row.entityType}:${row.localId}`, row]));
        const storyIds = new Set(remote.stories.map(row => row.clientStoryId));
        const growthIds = new Set(remote.growth.map(growthId));
        const pendingStories = stories.filter(row => shouldUpload(row.clientStoryId, row.updatedAt, storyIds, metas.get(`story:${row.clientStoryId}`)));
        const pendingGrowth = growth.filter(row => shouldUpload(growthId(row), row.updatedAt, growthIds, metas.get(`growth-record:${growthId(row)}`)));
        const consent = localStorage.getItem(consentKey) !== null;
        const withheld = pendingGrowth.some(row => row.photos.length > 0) && !consent;
        setNeedsPhotoConsent(withheld);
        // Importing a growth record also imports its linked story. Do not revive
        // a book that another device has already deleted.
        const deletedLinkedStory = (row: GrowthRecord) => !storyIds.has(row.storyId) && !!metas.get(`story:${row.storyId}`)?.lastSyncedAt;
        const blockedGrowth = pendingGrowth.some(deletedLinkedStory);
        const allowedGrowth = pendingGrowth.filter(row => (consent || row.photos.length === 0) && !deletedLinkedStory(row));
        const hasUploads = pendingStories.length > 0 || allowedGrowth.length > 0;
        const result = hasUploads
          ? await engine.startImport({ storyIds: pendingStories.map(row => row.clientStoryId), growthRecordIds: allowedGrowth.map(growthId), guardianConsentConfirmed: consent })
          : { conflicts: [], failedCount: 0, pendingCount: 0 };
        if (!current()) return;
        if (hasUploads) remote = { stories: await cloudStories.list(), growth: await cloudGrowth.list() };
        if (!current()) return;
        const meta = await metaStore.list();
        display(remote, meta);
        await accountCache(userId!, remote).catch(() => {});
        if (!current()) return;
        setMessage(blockedGrowth ? "部分成长记录关联的绘本已删除，已保留记录，未重新上传该绘本。" : result.conflicts.length ? "存在同时修改的记录，已保留两份内容，请在同步详情中选择版本。" : result.failedCount || result.pendingCount ? "部分记录尚未同步成功，内容仍保留，稍后自动重试。" : withheld ? "绘本已同步；含现场照片的成长记录需要一次监护人授权。" : "账号记录已同步");
      } catch {
        if (current()) {
          setData(previous => previous.owner === userId ? previous : { ...empty, owner: userId });
          setMessage("同步暂未完成，请检查网络或账号服务配置；已保存内容不会丢失，可点击重试。");
        }
      } finally { if (current()) setLoading(false); }
    }
    function refresh() {
      if (refreshQueued) return refreshQueued;
      refreshQueued = enqueue(async () => {
        refreshQueued = null;
        await sync();
      });
      return refreshQueued;
    }
    return {
      refresh,
      mutate(operation: () => Promise<void>) {
        return enqueue(async () => {
          if (!current() || !navigator.onLine) throw new Error("请联网后重试，账号修改需要同步到其他设备。");
          try { await operation(); } finally { await sync(); }
        });
      },
      allowPhotos() {
        try { localStorage.setItem(consentKey, new Date().toISOString()); void refresh(); }
        catch { setMessage("授权暂未保存，请确认浏览器允许本站存储后重试。"); }
      },
      activate() { active = true; },
      stop() { active = false; },
    };
  }, [supabase, userId]);
  useEffect(() => {
    if (!controller || authLoading) return;
    controller.activate();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { if (document.visibilityState === "visible") void controller.refresh(); };
    const dirty = () => { clearTimeout(timer); timer = setTimeout(refresh, 1000); };
    refresh();
    window.addEventListener("online", refresh); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("storybloom:account-data-dirty", dirty);
    const interval = setInterval(refresh, 30_000);
    return () => {
      controller.stop(); clearTimeout(timer); clearInterval(interval);
      window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("storybloom:account-data-dirty", dirty);
    };
  }, [controller, authLoading]);
  const visible = userId && data.owner === userId ? data : empty;
  return <Context.Provider value={{ ...visible, loading: authLoading || (!!userId && data.owner !== userId) || loading, message: userId ? message : "登录后，绘本与成长记录自动同步到同一账号。", needsPhotoConsent: !!userId && needsPhotoConsent,
    refresh: controller?.refresh || (async () => {}), allowPhotos: controller?.allowPhotos || (() => {}), mutate: controller?.mutate || (async operation => operation()),
  }}>{children}</Context.Provider>;
}
