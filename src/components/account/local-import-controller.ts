export type LocalImportEntityType = "story" | "growth-record";

export type LocalImportSyncStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed";

export interface LocalImportCandidate {
  localId: string;
  entityType: LocalImportEntityType;
  title: string;
  detail?: string;
  updatedAt?: string;
  photoCount?: number;
  syncStatus?: LocalImportSyncStatus;
  error?: string;
}

export interface LocalImportSnapshot {
  stories: LocalImportCandidate[];
  growthRecords: LocalImportCandidate[];
  photoCount?: number;
  pendingCount?: number;
  failedCount?: number;
}

export interface LocalImportSelection {
  storyIds: string[];
  growthRecordIds: string[];
  guardianConsentConfirmed?: boolean;
}

export interface LocalImportProgress {
  completed: number;
  total: number;
  message?: string;
}

export interface LocalImportConflict {
  conflictKey: string;
  localId: string;
  entityType: LocalImportEntityType;
  title: string;
  description?: string;
  localUpdatedAt?: string;
  cloudUpdatedAt?: string;
}

export type LocalImportConflictChoice = "keep-local" | "keep-cloud";

export interface LocalImportResult {
  importedStories: number;
  importedGrowthRecords: number;
  importedPhotos: number;
  pendingCount?: number;
  failedCount?: number;
  error?: string;
  conflicts?: LocalImportConflict[];
}

export interface LocalImportController {
  scan: () => Promise<LocalImportSnapshot>;
  importSelected: (
    selection: LocalImportSelection,
    onProgress?: (progress: LocalImportProgress) => void,
  ) => Promise<LocalImportResult>;
  resumePending: (
    onProgress?: (progress: LocalImportProgress) => void,
  ) => Promise<LocalImportResult>;
  resolveConflict?: (
    conflictKey: string,
    choice: LocalImportConflictChoice,
    onProgress?: (progress: LocalImportProgress) => void,
  ) => Promise<LocalImportResult>;
}

export interface LocalImportCounts {
  stories: number;
  growthRecords: number;
  photos: number;
  pending: number;
  failed: number;
}

export function isLocalOnlyCandidate(candidate: LocalImportCandidate) {
  return candidate.syncStatus === undefined;
}

export function getLocalOnlyCandidates(snapshot: LocalImportSnapshot) {
  return {
    stories: snapshot.stories.filter(isLocalOnlyCandidate),
    growthRecords: snapshot.growthRecords.filter(isLocalOnlyCandidate),
  };
}

export function getLocalImportCounts(
  snapshot: LocalImportSnapshot,
): LocalImportCounts {
  const localOnly = getLocalOnlyCandidates(snapshot);
  const candidates = [...snapshot.stories, ...snapshot.growthRecords];
  const localPhotoCount = localOnly.growthRecords.reduce(
    (total, record) => total + (record.photoCount || 0),
    0,
  );
  const hasLocalPhotoCounts = localOnly.growthRecords.every(
    (record) => typeof record.photoCount === "number",
  );

  return {
    stories: localOnly.stories.length,
    growthRecords: localOnly.growthRecords.length,
    photos: hasLocalPhotoCounts
      ? localPhotoCount
      : localOnly.growthRecords.length === snapshot.growthRecords.length
        ? snapshot.photoCount ?? localPhotoCount
        : localPhotoCount,
    pending:
      snapshot.pendingCount ??
      candidates.filter(
        (candidate) =>
          candidate.syncStatus === "pending" ||
          candidate.syncStatus === "syncing",
      ).length,
    failed:
      snapshot.failedCount ??
      candidates.filter((candidate) => candidate.syncStatus === "failed")
        .length,
  };
}

export function createEmptyLocalImportSelection(): LocalImportSelection {
  return { storyIds: [], growthRecordIds: [] };
}

export function toggleLocalImportSelection(
  selection: LocalImportSelection,
  entityType: LocalImportEntityType,
  localId: string,
): LocalImportSelection {
  const key = entityType === "story" ? "storyIds" : "growthRecordIds";
  const values = selection[key];
  const nextValues = values.includes(localId)
    ? values.filter((id) => id !== localId)
    : [...values, localId];

  return { ...selection, [key]: nextValues };
}

export function countLocalImportSelection(selection: LocalImportSelection) {
  return selection.storyIds.length + selection.growthRecordIds.length;
}

export function countSelectedImportPhotos(
  snapshot: LocalImportSnapshot,
  selection: LocalImportSelection,
) {
  const selectedGrowthIds = new Set(selection.growthRecordIds);
  return getLocalOnlyCandidates(snapshot).growthRecords.reduce(
    (total, candidate) =>
      selectedGrowthIds.has(candidate.localId)
        ? total + (candidate.photoCount || 0)
        : total,
    0,
  );
}

export function hasLocalImportWork(snapshot: LocalImportSnapshot) {
  const counts = getLocalImportCounts(snapshot);
  return (
    counts.stories > 0 ||
    counts.growthRecords > 0 ||
    counts.pending > 0 ||
    counts.failed > 0
  );
}

export function getLocalImportDismissKey(userId: string) {
  return `storybloom.local-import.dismissed.${userId}`;
}
