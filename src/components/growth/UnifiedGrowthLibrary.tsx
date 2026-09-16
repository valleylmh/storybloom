"use client";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import AccountSyncStatus from "@/components/sync/AccountSyncStatus";
import GrowthJournal from "./GrowthJournal";
export default function UnifiedGrowthLibrary() {
  const sync = useAccountSync();
  return <main><GrowthJournal records={sync.growth} loading={sync.loading} />
    <details className="growth-sync-details" open={sync.needsPhotoConsent || undefined}><summary>{sync.loading ? "正在同步记录…" : sync.message === "账号记录已同步" ? "记录已同步 · 查看详情" : "同步需要留意 · 查看详情"}</summary><AccountSyncStatus /></details>
  </main>;
}
