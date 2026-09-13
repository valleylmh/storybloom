"use client";
import { useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import AccountSyncStatus from "@/components/sync/AccountSyncStatus";
import { createCloudGrowthRepository } from "@/lib/repositories/cloud-growth-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import type { GrowthRepository } from "@/lib/repositories/growth-repository";
import type { GrowthRecord } from "@/lib/growth-records";
import { openAccountStory } from "@/lib/sync/open-account-story";
import GrowthTimeline from "./GrowthTimeline";
const key = (row: GrowthRecord) => row.clientRecordId || row.id;
export default function UnifiedGrowthTimeline({ childKey }: { childKey: string }) {
  const { supabase, session } = useAuth();
  const sync = useAccountSync();
  const latestGrowth = useRef(sync.growth);
  latestGrowth.current = sync.growth;
  const revision = sync.growth.map(row => `${row.id}:${row.updatedAt}:${row.childKey}`).join("|");
  const repository = useMemo<GrowthRepository>(() => ({
    list: async () => latestGrowth.current,
    getByChild: async id => {
      // Old bookmarks use the device child id; resolve through a paired record.
      const local = await localGrowthRepository.getByChild(id);
      const ids = new Set(local.map(key));
      return latestGrowth.current.filter(row => row.childKey === id || ids.has(key(row)));
    },
    save: async () => { throw new Error("请从创作页保存成长记录"); },
    update: async (id, patch) => {
      const record = latestGrowth.current.find(row => row.id === id);
      if (!supabase || !session || !record) throw new Error("record-missing");
      let updated = record;
      await sync.mutate(async () => {
        const cloud = createCloudGrowthRepository(supabase, session.user.id);
        const remote = (await cloud.list()).find(row => key(row) === key(record));
        updated = remote ? await cloud.update(remote.id, patch) : await localGrowthRepository.update(record.id, patch);
      });
      return { ...updated, id };
    },
    remove: async id => {
      const record = latestGrowth.current.find(row => row.id === id);
      if (!supabase || !session || !record) throw new Error("record-missing");
      await sync.mutate(async () => {
        const cloud = createCloudGrowthRepository(supabase, session.user.id);
        const remote = (await cloud.list()).find(row => key(row) === key(record));
        if (remote) await cloud.remove(remote.id);
        const local = (await localGrowthRepository.list()).find(row => key(row) === key(record));
        if (local) await localGrowthRepository.remove(local.id);
      });
    },
  }), [supabase, session, revision, sync.mutate]);
  return <><AccountSyncStatus /><GrowthTimeline childKey={childKey} repository={repository} source="account" embedded basePath="/me/growth" onOpenStory={async record => {
    if (!supabase || !session) return;
    const story = navigator.onLine
      ? (await createCloudStoryRepository(supabase, session.user.id).list()).find(row => row.clientStoryId === record.storyId)
      : await localStoryRepository.get(record.storyId);
    await openAccountStory(story?.result || record.story, session.user.id, navigator.onLine ? story?.id : undefined);
  }} /></>;
}
