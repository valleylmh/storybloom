import type { GrowthMomentBundle } from "@/lib/growth-moments";

export const LOCAL_GROWTH_RETENTION_KEY =
  "storybloom.growth-archive.retention.v1";
export const LOCAL_GROWTH_RETENTION_VERSION = 1 as const;

export type LocalGrowthRetentionPolicy =
  | "keep-forever"
  | "1-year"
  | "3-years"
  | "5-years";

export interface LocalGrowthRetentionPreference {
  version: typeof LOCAL_GROWTH_RETENTION_VERSION;
  policy: LocalGrowthRetentionPolicy;
  updatedAt: string;
}

export interface LocalGrowthRetentionPreview {
  policy: LocalGrowthRetentionPolicy;
  cutoffDate?: string;
  momentIds: string[];
  momentCount: number;
  photoCount: number;
  storybookVersionCount: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const RETENTION_YEARS: Partial<Record<LocalGrowthRetentionPolicy, number>> = {
  "1-year": 1,
  "3-years": 3,
  "5-years": 5,
};

export function isLocalGrowthRetentionPolicy(
  value: unknown,
): value is LocalGrowthRetentionPolicy {
  return (
    value === "keep-forever" ||
    value === "1-year" ||
    value === "3-years" ||
    value === "5-years"
  );
}

export function createDefaultLocalGrowthRetentionPreference(
  now = new Date().toISOString(),
): LocalGrowthRetentionPreference {
  return {
    version: LOCAL_GROWTH_RETENTION_VERSION,
    policy: "keep-forever",
    updatedAt: now,
  };
}

function isLocalGrowthRetentionPreference(
  value: unknown,
): value is LocalGrowthRetentionPreference {
  if (!value || typeof value !== "object") return false;
  const preference = value as Partial<LocalGrowthRetentionPreference>;
  return (
    preference.version === LOCAL_GROWTH_RETENTION_VERSION &&
    isLocalGrowthRetentionPolicy(preference.policy) &&
    typeof preference.updatedAt === "string" &&
    Number.isFinite(Date.parse(preference.updatedAt))
  );
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readLocalGrowthRetentionPreference(
  storage: StorageLike | undefined = getBrowserStorage(),
  now = new Date().toISOString(),
) {
  if (!storage) return createDefaultLocalGrowthRetentionPreference(now);
  try {
    const parsed = JSON.parse(
      storage.getItem(LOCAL_GROWTH_RETENTION_KEY) || "null",
    ) as unknown;
    return isLocalGrowthRetentionPreference(parsed)
      ? parsed
      : createDefaultLocalGrowthRetentionPreference(now);
  } catch {
    return createDefaultLocalGrowthRetentionPreference(now);
  }
}

export function writeLocalGrowthRetentionPreference(
  policy: LocalGrowthRetentionPolicy,
  storage: StorageLike | undefined = getBrowserStorage(),
  now = new Date().toISOString(),
) {
  if (!storage || !isLocalGrowthRetentionPolicy(policy)) return undefined;
  const preference: LocalGrowthRetentionPreference = {
    version: LOCAL_GROWTH_RETENTION_VERSION,
    policy,
    updatedAt: now,
  };
  try {
    storage.setItem(LOCAL_GROWTH_RETENTION_KEY, JSON.stringify(preference));
    return preference;
  } catch {
    return undefined;
  }
}

function toDateKey(date: Date) {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function getLocalGrowthRetentionCutoff(
  policy: LocalGrowthRetentionPolicy,
  now = new Date(),
) {
  const years = RETENTION_YEARS[policy];
  if (!years) return undefined;
  const cutoff = new Date(
    now.getFullYear() - years,
    now.getMonth(),
    now.getDate(),
  );
  return toDateKey(cutoff);
}

export function createLocalGrowthRetentionPreview(
  bundles: readonly GrowthMomentBundle[],
  policy: LocalGrowthRetentionPolicy,
  now = new Date(),
): LocalGrowthRetentionPreview {
  const cutoffDate = getLocalGrowthRetentionCutoff(policy, now);
  const expired = cutoffDate
    ? bundles.filter((bundle) => bundle.moment.occurredOn <= cutoffDate)
    : [];
  return {
    policy,
    ...(cutoffDate ? { cutoffDate } : {}),
    momentIds: expired.map((bundle) => bundle.moment.momentId),
    momentCount: expired.length,
    photoCount: expired.reduce(
      (total, bundle) => total + bundle.moment.originalAssets.length,
      0,
    ),
    storybookVersionCount: expired.reduce(
      (total, bundle) => total + bundle.storybookVersions.length,
      0,
    ),
  };
}
