import type { SyncMeta } from "./sync-meta";
export function shouldUpload(localId: string, updatedAt: string, cloudIds: ReadonlySet<string>, meta?: SyncMeta) {
  // An absent previously synced row was deleted on another device; do not resurrect it.
  if (meta?.lastSyncedAt && !cloudIds.has(localId)) return false;
  return !meta?.lastSyncedAt || meta.status !== "synced" || Date.parse(updatedAt) > Date.parse(meta.lastSyncedAt);
}
export function mergeAccountRows<T>(local: T[], cloud: T[], id: (row: T) => string, updated: (row: T) => string, meta: SyncMeta[]) {
  const result = new Map(cloud.map(row => [id(row), row]));
  const byId = new Map(meta.map(row => [row.localId, row]));
  for (const row of local) {
    const key = id(row), status = byId.get(key), remote = result.get(key);
    if (!remote && status?.lastSyncedAt) continue;
    if (!remote || (shouldUpload(key, updated(row), new Set(result.keys()), status) && Date.parse(updated(row)) > Date.parse(updated(remote)))) result.set(key, row);
  }
  return [...result.values()].sort((a, b) => Date.parse(updated(b)) - Date.parse(updated(a)));
}
