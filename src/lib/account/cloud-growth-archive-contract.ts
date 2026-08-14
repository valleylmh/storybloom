export const CLOUD_GROWTH_RETENTION_OPTIONS = [
  null,
  365,
  1095,
  1825,
] as const;

export type CloudGrowthRetentionDays = number | null;

export const DELETE_ALL_CLOUD_GROWTH_CONFIRMATION =
  "DELETE_CLOUD_GROWTH_ARCHIVE";
export const DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION =
  "DELETE_EXPIRED_CLOUD_GROWTH";

export interface CloudGrowthArchiveCountSet {
  moments: number;
  photos: number;
  storybookVersions: number;
}

export interface CloudGrowthArchiveSummary {
  version: 1;
  source: "private-cloud";
  retentionDays: CloudGrowthRetentionDays;
  cutoffDate?: string;
  counts: CloudGrowthArchiveCountSet & {
    children: number;
    legacyGrowthRecords: number;
    growthMoments: number;
  };
  expired: CloudGrowthArchiveCountSet;
  foundation: "available" | "not-deployed";
  productionVerified: false;
}

export type CloudGrowthArchiveDeleteRequest =
  | {
      scope: "all";
      confirmation: typeof DELETE_ALL_CLOUD_GROWTH_CONFIRMATION;
    }
  | {
      scope: "expired";
      confirmation: typeof DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION;
    };

export function isCloudGrowthRetentionDays(
  value: unknown,
): value is CloudGrowthRetentionDays {
  return CLOUD_GROWTH_RETENTION_OPTIONS.some((option) => option === value);
}

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
