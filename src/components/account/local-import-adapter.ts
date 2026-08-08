import type { SupabaseClient } from "@supabase/supabase-js";
import { GUARDIAN_CONSENT_VERSION } from "@/lib/auth/guardian-consent";
import {
  createLocalDataImportController,
  type ImportProgress,
  type LocalImportResult as EngineImportResult,
} from "@/lib/sync/local-data-import";
import type {
  LocalImportController,
  LocalImportProgress,
  LocalImportResult,
  LocalImportSelection,
  LocalImportSnapshot,
} from "./local-import-controller";

function getGuardianConsentAckKey(userId: string) {
  return `storybloom.local-import.guardian-consent.${GUARDIAN_CONSENT_VERSION}.${userId}`;
}

function readGuardianConsentAck(userId: string) {
  try {
    return window.localStorage.getItem(getGuardianConsentAckKey(userId)) !== null;
  } catch {
    return false;
  }
}

function writeGuardianConsentAck(userId: string) {
  try {
    window.localStorage.setItem(
      getGuardianConsentAckKey(userId),
      new Date().toISOString(),
    );
  } catch {
    // The current import still has the explicit checkbox; a disabled local
    // storage must not block local creation or reading.
  }
}

function progressMessage(progress: ImportProgress) {
  const subject = progress.entityType === "story" ? "绘本" : "成长记录";
  const status =
    progress.status === "syncing"
      ? "正在上传"
      : progress.status === "synced"
        ? "已同步"
        : progress.status === "kept-cloud"
          ? "已保留云端版本"
          : progress.status === "conflict"
            ? "等待冲突选择"
            : progress.status === "failed"
              ? "同步失败"
              : "正在准备";
  return `${subject}：${status}`;
}

function mapProgress(
  onProgress: ((progress: LocalImportProgress) => void) | undefined,
) {
  return (progress: ImportProgress) => {
    onProgress?.({
      completed: progress.current,
      total: progress.total,
      message: progress.error
        ? `${progressMessage(progress)}：${progress.error}`
        : progressMessage(progress),
    });
  };
}

function mapResult(
  result: EngineImportResult,
): LocalImportResult {
  return {
    importedStories: result.importedStories,
    importedGrowthRecords: result.importedGrowthRecords,
    importedPhotos: result.importedPhotos,
    pendingCount: result.pendingCount,
    failedCount: result.failedCount,
    error: result.error || result.failures[0]?.error,
    conflicts: result.conflicts,
  };
}

export function createAccountLocalImportController(
  supabase: SupabaseClient,
  userId: string,
): LocalImportController {
  const engine = createLocalDataImportController({ supabase, userId });

  async function scan(): Promise<LocalImportSnapshot> {
    const scanResult = await engine.scanLocalImportCandidates();

    return {
      stories: scanResult.stories.map((story) => ({
        localId: story.localId,
        entityType: "story",
        title: story.title || "未命名绘本",
        detail: `${story.pageCount} 页 · ${story.imageCount} 张插图`,
        updatedAt: story.updatedAt,
        syncStatus: story.syncStatus,
        cloudId: story.cloudId,
        error: story.error,
      })),
      growthRecords: scanResult.growthRecords.map((record) => ({
        localId: record.localId,
        entityType: "growth-record",
        title: record.label || `${record.childName}的成长记录`,
        detail: `${record.childName} · ${record.occurredOn}`,
        updatedAt: record.updatedAt,
        photoCount: record.photoCount,
        syncStatus: record.syncStatus,
        cloudId: record.cloudId,
        error: record.error,
      })),
      photoCount: scanResult.photoCount,
      pendingCount: scanResult.pendingCount,
      failedCount: scanResult.failedCount,
    };
  }

  async function importSelected(
    selection: LocalImportSelection,
    onProgress?: (progress: LocalImportProgress) => void,
  ) {
    if (selection.guardianConsentConfirmed) writeGuardianConsentAck(userId);
    const result = await engine.startImport({
      storyIds: selection.storyIds,
      growthRecordIds: selection.growthRecordIds,
      guardianConsentConfirmed: selection.guardianConsentConfirmed,
      onProgress: mapProgress(onProgress),
    });
    return mapResult(result);
  }

  async function resumePending(
    onProgress?: (progress: LocalImportProgress) => void,
  ) {
    const result = await engine.resumePendingImport({
      guardianConsentConfirmed: readGuardianConsentAck(userId),
      onProgress: mapProgress(onProgress),
    });
    return mapResult(result);
  }

  return {
    scan,
    importSelected,
    resumePending,
    resolveConflict: async (conflictKey, choice, onProgress) => {
      const result = await engine.resolveConflict(
        conflictKey,
        choice,
        mapProgress(onProgress),
      );
      return mapResult(result);
    },
  };
}
