import type { GrowthRecord } from "@/lib/growth-records";

export type GrowthDataSource = "local" | "cloud";

export interface GrowthCopyRow {
  clientRecordId: string;
  local?: GrowthRecord;
  cloud?: GrowthRecord;
}

function timestamp(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function preferLatest(left: GrowthRecord, right: GrowthRecord) {
  return timestamp(right.updatedAt) > timestamp(left.updatedAt) ? right : left;
}

export function getGrowthClientRecordId(record: GrowthRecord) {
  return record.clientRecordId || record.id;
}

export function mergeGrowthCopies(
  localRecords: GrowthRecord[],
  cloudRecords: GrowthRecord[],
): GrowthCopyRow[] {
  const rows = new Map<string, GrowthCopyRow>();

  localRecords.forEach((record) => {
    const clientRecordId = getGrowthClientRecordId(record);
    const current = rows.get(clientRecordId);
    rows.set(clientRecordId, {
      clientRecordId,
      local: current?.local ? preferLatest(current.local, record) : record,
      cloud: current?.cloud,
    });
  });

  cloudRecords.forEach((record) => {
    const clientRecordId = getGrowthClientRecordId(record);
    const current = rows.get(clientRecordId);
    rows.set(clientRecordId, {
      clientRecordId,
      local: current?.local,
      cloud: current?.cloud ? preferLatest(current.cloud, record) : record,
    });
  });

  return Array.from(rows.values()).sort((left, right) => {
    const leftTime = Math.max(
      timestamp(left.local?.updatedAt),
      timestamp(left.cloud?.updatedAt),
    );
    const rightTime = Math.max(
      timestamp(right.local?.updatedAt),
      timestamp(right.cloud?.updatedAt),
    );
    return rightTime - leftTime || left.clientRecordId.localeCompare(right.clientRecordId);
  });
}

export function getPairedGrowthRecordIds(rows: GrowthCopyRow[]) {
  return new Set(
    rows
      .filter((row) => row.local && row.cloud)
      .map((row) => row.clientRecordId),
  );
}

export function chooseInitialGrowthSource({
  requested,
  localCount,
  cloudCount,
  signedIn,
}: {
  requested?: GrowthDataSource;
  localCount: number;
  cloudCount: number;
  signedIn: boolean;
}): GrowthDataSource {
  if (requested) return requested;
  if (signedIn && localCount === 0 && cloudCount > 0) return "cloud";
  return "local";
}

export function normalizeGrowthSource(value?: string): GrowthDataSource {
  return value === "cloud" ? "cloud" : "local";
}

export function buildGrowthChildHref(
  basePath: string,
  childKey: string,
  source: GrowthDataSource,
) {
  const path = `${basePath}/${encodeURIComponent(childKey)}`;
  return source === "cloud" ? `${path}?source=cloud` : path;
}
