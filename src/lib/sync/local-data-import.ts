import type { SupabaseClient } from "@supabase/supabase-js";
import { recordGuardianConsent } from "@/lib/auth/guardian-consent";
import type { GrowthRecord, GrowthRecordDraft } from "@/lib/growth-records";
import { ensureFamilyProfile } from "@/lib/repositories/family-character-repository";
import {
  createCloudChildRepository,
  type ChildProfile,
  type ChildRepository,
} from "@/lib/repositories/child-repository";
import { createCloudGrowthRepository } from "@/lib/repositories/cloud-growth-repository";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import type {
  GrowthRecordInput,
  GrowthRepository,
} from "@/lib/repositories/growth-repository";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import type {
  SavedStory,
  StoryRepository,
  StorySaveInput,
} from "@/lib/repositories/story-repository";
import {
  createIndexedDbSyncMetaStore,
  getSyncMetaKey,
  type SyncEntityType,
  type SyncMeta,
  type SyncMetaStore,
  type SyncStatus,
} from "@/lib/sync/sync-meta";
import type { GenerateResponse } from "@/types";

const DEFAULT_MAX_ATTEMPTS = 2;

export interface ImportStoryCandidate {
  localId: string;
  title: string;
  updatedAt: string;
  pageCount: number;
  imageCount: number;
  syncStatus?: SyncStatus;
  cloudId?: string;
  error?: string;
}

export interface ImportGrowthRecordCandidate {
  localId: string;
  label: string;
  childName: string;
  occurredOn: string;
  updatedAt: string;
  photoCount: number;
  syncStatus?: SyncStatus;
  cloudId?: string;
  error?: string;
}

export interface LocalImportScan {
  stories: ImportStoryCandidate[];
  growthRecords: ImportGrowthRecordCandidate[];
  storyCount: number;
  growthRecordCount: number;
  photoCount: number;
  pendingCount: number;
  failedCount: number;
}

export type ImportConflictChoice = "keep-local" | "keep-cloud";

export interface ImportConflict {
  conflictKey: string;
  localId: string;
  entityType: SyncEntityType;
  title: string;
  description: string;
  localUpdatedAt?: string;
  cloudUpdatedAt?: string;
}

export type ImportProgressStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "kept-cloud"
  | "failed"
  | "conflict";

export interface ImportProgress {
  current: number;
  total: number;
  localId: string;
  entityType: SyncEntityType;
  status: ImportProgressStatus;
  error?: string;
}

export interface ImportFailure {
  localId: string;
  entityType: SyncEntityType;
  error: string;
}

export interface ImportedEntity {
  localId: string;
  entityType: SyncEntityType;
  cloudId: string;
  action: "uploaded" | "kept-cloud";
}

export interface LocalImportResult {
  attempted: number;
  imported: number;
  importedStories: number;
  importedGrowthRecords: number;
  importedPhotos: number;
  keptCloud: number;
  failed: number;
  failedCount: number;
  pending: number;
  pendingCount: number;
  error?: string;
  synced: ImportedEntity[];
  failures: ImportFailure[];
  conflicts: ImportConflict[];
}

export interface LocalImportSelection {
  storyIds: string[];
  growthRecordIds: string[];
  guardianConsentConfirmed?: boolean;
  conflictResolutions?: Record<string, ImportConflictChoice>;
  onProgress?: (progress: ImportProgress) => void;
}

export interface ResumeLocalImportOptions {
  guardianConsentConfirmed?: boolean;
  conflictResolutions?: Record<string, ImportConflictChoice>;
  onProgress?: (progress: ImportProgress) => void;
}

interface LocalStorySource {
  localId: string;
  result: GenerateResponse;
  status: SavedStory["status"];
  createdAt: string;
  updatedAt: string;
}

interface LocalChildIdentity {
  childKey: string;
  childName: string;
  childCharacterId?: string;
}

function getGrowthLocalId(record: GrowthRecord) {
  return record.clientRecordId || record.id;
}

interface ImportWork {
  stories: Map<string, LocalStorySource>;
  growthRecords: Map<string, GrowthRecord>;
  allGrowthRecords: GrowthRecord[];
}

export interface LocalDataImportDependencies {
  userId: string;
  localStories: StoryRepository;
  localGrowthRecords: GrowthRepository;
  cloudStories: StoryRepository;
  cloudGrowthRecords: GrowthRepository;
  cloudChildren: ChildRepository;
  syncMeta: SyncMetaStore;
  ensureFamilyProfileId: () => Promise<string>;
  recordGuardianConsent?: () => Promise<void>;
  now?: () => Date;
  isOnline?: () => boolean;
  maxAttempts?: number;
  deriveCloudId?: (scope: string) => Promise<string>;
}

export interface LocalDataImportControllerOptions {
  supabase: SupabaseClient;
  userId: string;
  syncMeta?: SyncMetaStore;
}

function normalizeError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error);
  return message
    .replace(/data:[^\s"'<>]+/gi, "[removed]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [removed]")
    .replace(/https?:\/\/\S+/gi, "[url removed]")
    .slice(0, 240) || "local-import-failed";
}

function isForeignKeyError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "23503" ||
    /foreign key|primary_character_id|child_profiles_primary_character/i.test(
      message,
    )
  );
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "");
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function bytesToUuid(bytes: Uint8Array) {
  const next = bytes.slice(0, 16);
  next[6] = (next[6] & 0x0f) | 0x50;
  next[8] = (next[8] & 0x3f) | 0x80;
  const hex = Array.from(next, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

function fallbackHashBytes(value: string) {
  const bytes = new Uint8Array(16);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    first ^= value.charCodeAt(index);
    first = Math.imul(first, 0x01000193);
    second ^= first + value.charCodeAt(index) + (second << 6) + (second >>> 2);
  }
  for (let index = 0; index < bytes.length; index += 1) {
    first = Math.imul(first ^ (first >>> 13), 0x5bd1e995);
    second = Math.imul(second ^ (second >>> 15), 0x27d4eb2d);
    bytes[index] = (first ^ second) & 0xff;
  }
  return bytes;
}

export async function deriveStableCloudId(scope: string) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(scope),
    );
    return bytesToUuid(new Uint8Array(digest));
  }
  return bytesToUuid(fallbackHashBytes(scope));
}

function getStoryStatus(result: GenerateResponse): SavedStory["status"] {
  if (result.pages.some((page) => page.imageStatus === "failed")) return "failed";
  if (
    result.pages.length > 0 &&
    result.pages.every((page) => page.imageStatus === "complete")
  ) {
    return "complete";
  }
  return "generating";
}

function toLocalStorySource(story: SavedStory): LocalStorySource {
  return {
    localId: story.clientStoryId || story.storyId,
    result: story.result,
    status: story.status,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  };
}

function toGrowthStorySource(record: GrowthRecord): LocalStorySource {
  return {
    localId: record.story.storyId,
    result: record.story,
    status: getStoryStatus(record.story),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function getStoryCompleteness(result: GenerateResponse) {
  const completeTextPages = result.pages.filter(
    (page) => page.zhText.trim().length > 0 && page.enText.trim().length > 0,
  ).length;
  const populatedTextFields = result.pages.reduce(
    (total, page) =>
      total + Number(page.zhText.trim().length > 0) + Number(page.enText.trim().length > 0),
    0,
  );
  const completedImages = result.pages.filter(
    (page) => page.imageStatus === "complete" || Boolean(page.imageUrl),
  ).length;
  return [
    result.pages.length,
    completeTextPages,
    populatedTextFields,
    completedImages,
    result.totalPages,
  ];
}

export function compareStoryCompleteness(
  left: GenerateResponse,
  right: GenerateResponse,
) {
  const leftScore = getStoryCompleteness(left);
  const rightScore = getStoryCompleteness(right);
  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) {
      return leftScore[index] > rightScore[index] ? 1 : -1;
    }
  }
  return 0;
}

function chooseMoreCompleteLocalStory(
  current: LocalStorySource | undefined,
  candidate: LocalStorySource,
) {
  if (!current) return candidate;
  if (current.status === "complete" && candidate.status === "generating") {
    return current;
  }
  if (candidate.status === "complete" && current.status === "generating") {
    return candidate;
  }
  const completeness = compareStoryCompleteness(candidate.result, current.result);
  if (completeness !== 0) return completeness > 0 ? candidate : current;
  return isUpdatedAfter(candidate.updatedAt, current.updatedAt) ? candidate : current;
}

function didChangeAfter(updatedAt: string | undefined, lastSyncedAt: string) {
  if (!updatedAt) return false;
  const updated = Date.parse(updatedAt);
  const synced = Date.parse(lastSyncedAt);
  return Number.isFinite(updated) && Number.isFinite(synced) && updated > synced;
}

function isUpdatedAfter(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime > rightTime;
  }
  return left > right;
}

function getStoryConflictTitle(source: LocalStorySource) {
  return source.result.coverTitle || "本地绘本";
}

function decideStoryDirection(
  local: LocalStorySource,
  cloud: SavedStory | undefined,
  meta: SyncMeta,
  resolution?: ImportConflictChoice,
) {
  if (!cloud) return { action: "upload" as const };
  if (cloud.status === "complete" && local.status === "generating") {
    return { action: "keep-cloud" as const };
  }

  if (meta.lastSyncedAt) {
    const localChanged = didChangeAfter(local.updatedAt, meta.lastSyncedAt);
    const cloudChanged = didChangeAfter(cloud.updatedAt, meta.lastSyncedAt);
    if (localChanged && cloudChanged && !resolution) {
      return {
        action: "conflict" as const,
        conflict: {
          conflictKey: getSyncMetaKey("story", local.localId),
          localId: local.localId,
          entityType: "story" as const,
          title: getStoryConflictTitle(local),
          description: "本地与云端绘本都在上次同步后发生了变化。",
          localUpdatedAt: local.updatedAt,
          cloudUpdatedAt: cloud.updatedAt,
        } satisfies ImportConflict,
      };
    }
    if (resolution === "keep-local") return { action: "upload" as const };
    if (resolution === "keep-cloud") return { action: "keep-cloud" as const };
    if (cloudChanged && !localChanged) return { action: "keep-cloud" as const };
    if (localChanged && !cloudChanged) return { action: "upload" as const };
    if (!localChanged && !cloudChanged) return { action: "keep-cloud" as const };
  } else if (resolution === "keep-local") {
    return { action: "upload" as const };
  } else if (resolution === "keep-cloud") {
    return { action: "keep-cloud" as const };
  }

  const completeness = compareStoryCompleteness(local.result, cloud.result);
  if (completeness > 0) return { action: "upload" as const };
  if (completeness < 0) return { action: "keep-cloud" as const };
  return isUpdatedAfter(local.updatedAt, cloud.updatedAt)
    ? { action: "upload" as const }
    : { action: "keep-cloud" as const };
}

function decideGrowthDirection(
  local: GrowthRecord,
  cloud: GrowthRecord | undefined,
  meta: SyncMeta,
  resolution?: ImportConflictChoice,
) {
  if (!cloud) return { action: "upload" as const };
  if (meta.lastSyncedAt) {
    const localChanged = didChangeAfter(local.updatedAt, meta.lastSyncedAt);
    const cloudChanged = didChangeAfter(cloud.updatedAt, meta.lastSyncedAt);
    if (localChanged && cloudChanged && !resolution) {
      return {
        action: "conflict" as const,
        conflict: {
          conflictKey: getSyncMetaKey("growth-record", getGrowthLocalId(local)),
          localId: getGrowthLocalId(local),
          entityType: "growth-record" as const,
          title: local.idea || `${local.childName}的成长记录`,
          description: "成长日期或家长备注在本地与云端都发生了变化。",
          localUpdatedAt: local.updatedAt,
          cloudUpdatedAt: cloud.updatedAt,
        } satisfies ImportConflict,
      };
    }
    if (resolution === "keep-local") return { action: "upload" as const };
    if (resolution === "keep-cloud") return { action: "keep-cloud" as const };
    if (cloudChanged && !localChanged) return { action: "keep-cloud" as const };
    if (localChanged && !cloudChanged) return { action: "upload" as const };
    if (!localChanged && !cloudChanged) return { action: "keep-cloud" as const };
  } else if (resolution === "keep-local") {
    return { action: "upload" as const };
  } else if (resolution === "keep-cloud") {
    return { action: "keep-cloud" as const };
  }
  return isUpdatedAfter(local.updatedAt, cloud.updatedAt)
    ? { action: "upload" as const }
    : { action: "keep-cloud" as const };
}

function metaByKey(meta: SyncMeta[]) {
  return new Map(
    meta.map((record) => [getSyncMetaKey(record.entityType, record.localId), record]),
  );
}

export async function scanLocalImportCandidates(
  options: {
    localStories?: StoryRepository;
    localGrowthRecords?: GrowthRepository;
    syncMeta?: SyncMetaStore;
  } = {},
): Promise<LocalImportScan> {
  const [stories, growthRecords, syncMeta] = await Promise.all([
    (options.localStories || localStoryRepository).list(),
    (options.localGrowthRecords || localGrowthRepository).list(),
    options.syncMeta?.list() || Promise.resolve([]),
  ]);
  const meta = metaByKey(syncMeta);
  const storyCandidates = stories.map((story) => {
    const record = meta.get(getSyncMetaKey("story", story.clientStoryId));
    return {
      localId: story.clientStoryId,
      title: story.result.coverTitle,
      updatedAt: story.updatedAt,
      pageCount: story.result.pages.length,
      imageCount: story.result.pages.filter((page) => Boolean(page.imageUrl)).length,
      syncStatus: record?.status,
      cloudId: record?.cloudId,
      error: record?.error,
    } satisfies ImportStoryCandidate;
  });
  const growthCandidates = growthRecords.map((growthRecord) => {
    const localId = getGrowthLocalId(growthRecord);
    const record = meta.get(getSyncMetaKey("growth-record", localId));
    return {
      localId,
      label: growthRecord.idea || `${growthRecord.childName}的成长记录`,
      childName: growthRecord.childName,
      occurredOn: growthRecord.occurredOn,
      updatedAt: growthRecord.updatedAt,
      photoCount: growthRecord.photos.length,
      syncStatus: record?.status,
      cloudId: record?.cloudId,
      error: record?.error,
    } satisfies ImportGrowthRecordCandidate;
  });
  const candidateMeta = [...storyCandidates, ...growthCandidates];

  return {
    stories: storyCandidates,
    growthRecords: growthCandidates,
    storyCount: storyCandidates.length,
    growthRecordCount: growthCandidates.length,
    photoCount: growthCandidates.reduce((total, record) => total + record.photoCount, 0),
    pendingCount: candidateMeta.filter(
      (record) => record.syncStatus === "pending" || record.syncStatus === "syncing",
    ).length,
    failedCount: candidateMeta.filter((record) => record.syncStatus === "failed").length,
  };
}

function createEmptyResult(attempted: number): LocalImportResult {
  return {
    attempted,
    imported: 0,
    importedStories: 0,
    importedGrowthRecords: 0,
    importedPhotos: 0,
    keptCloud: 0,
    failed: 0,
    failedCount: 0,
    pending: 0,
    pendingCount: 0,
    synced: [],
    failures: [],
    conflicts: [],
  };
}

function isBrowserOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function createLocalDataImportEngine(
  dependencies: LocalDataImportDependencies,
) {
  const deriveCloudId = dependencies.deriveCloudId || deriveStableCloudId;
  const now = dependencies.now || (() => new Date());
  const maxAttempts = Math.max(
    1,
    Math.min(3, dependencies.maxAttempts || DEFAULT_MAX_ATTEMPTS),
  );
  const childCache = new Map<string, ChildProfile>();
  let childProfiles: ChildProfile[] | undefined;
  let familyProfileId: string | undefined;

  async function getLocalData() {
    const [stories, growthRecords] = await Promise.all([
      dependencies.localStories.list(),
      dependencies.localGrowthRecords.list(),
    ]);
    return { stories, growthRecords };
  }

  async function buildWork(
    storyIds: Iterable<string>,
    growthRecordIds: Iterable<string>,
  ): Promise<ImportWork> {
    const { stories, growthRecords } = await getLocalData();
    const storiesById = new Map(
      stories.map((story) => [story.clientStoryId, toLocalStorySource(story)]),
    );
    growthRecords.forEach((record) => {
      const growthStory = toGrowthStorySource(record);
      storiesById.set(
        growthStory.localId,
        chooseMoreCompleteLocalStory(
          storiesById.get(growthStory.localId),
          growthStory,
        ),
      );
    });
    const growthById = new Map(
      growthRecords.map((record) => [getGrowthLocalId(record), record]),
    );
    const workStories = new Map<string, LocalStorySource>();
    const workGrowth = new Map<string, GrowthRecord>();

    for (const localId of storyIds) {
      const story = storiesById.get(localId);
      if (!story) throw new Error(`local-story-not-found:${localId}`);
      workStories.set(localId, story);
    }
    for (const localId of growthRecordIds) {
      const record = growthById.get(localId);
      if (!record) throw new Error(`local-growth-record-not-found:${localId}`);
      workGrowth.set(localId, record);
      const story = toGrowthStorySource(record);
      workStories.set(
        story.localId,
        chooseMoreCompleteLocalStory(workStories.get(story.localId), story),
      );
      const historyStory = storiesById.get(story.localId);
      if (historyStory) {
        workStories.set(
          story.localId,
          chooseMoreCompleteLocalStory(workStories.get(story.localId), historyStory),
        );
      }
    }

    return {
      stories: workStories,
      growthRecords: workGrowth,
      allGrowthRecords: growthRecords,
    };
  }

  async function preallocateMeta(work: ImportWork) {
    const existing = metaByKey(await dependencies.syncMeta.list());
    const records = await Promise.all([
      ...Array.from(work.stories.keys(), async (localId) => {
        const current = existing.get(getSyncMetaKey("story", localId));
        return {
          localId,
          entityType: "story" as const,
          cloudId:
            current?.cloudId ||
            (await deriveCloudId(`${dependencies.userId}:story:${localId}`)),
          status: "pending" as const,
          lastSyncedAt: current?.lastSyncedAt,
        } satisfies SyncMeta;
      }),
      ...Array.from(work.growthRecords.keys(), async (localId) => {
        const current = existing.get(getSyncMetaKey("growth-record", localId));
        return {
          localId,
          entityType: "growth-record" as const,
          cloudId:
            current?.cloudId ||
            (await deriveCloudId(`${dependencies.userId}:growth-record:${localId}`)),
          status: "pending" as const,
          lastSyncedAt: current?.lastSyncedAt,
        } satisfies SyncMeta;
      }),
    ]);
    await dependencies.syncMeta.putMany(records);
    return metaByKey(records);
  }

  async function retry<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async function getChildProfiles() {
    childProfiles ||= await retry(() => dependencies.cloudChildren.list());
    return childProfiles;
  }

  async function getFamilyProfileId() {
    familyProfileId ||= await retry(dependencies.ensureFamilyProfileId);
    return familyProfileId;
  }

  async function ensureChild(identity: LocalChildIdentity) {
    const cached = childCache.get(identity.childKey);
    if (cached) return cached;
    const profiles = await getChildProfiles();
    const normalizedName = normalizeName(identity.childName);
    const matchingLegacyNames = profiles.filter(
      (profile) =>
        !profile.clientChildId &&
        normalizeName(profile.displayName) === normalizedName,
    );
    const existing =
      profiles.find(
        (profile) =>
          (profile as ChildProfile & { clientChildId?: string }).clientChildId ===
          identity.childKey,
      ) ||
      profiles.find(
        (profile) =>
          Boolean(identity.childCharacterId) &&
          profile.primaryCharacterId === identity.childCharacterId,
      ) ||
      profiles.find(
        (profile) =>
          !profile.clientChildId &&
          matchingLegacyNames.length === 1 &&
          profile.id === matchingLegacyNames[0]?.id,
      );
    if (existing) {
      let matched = existing;
      if (existing.clientChildId !== identity.childKey) {
        matched = await retry(() =>
          dependencies.cloudChildren.update(existing.id, {
            clientChildId: identity.childKey,
          }),
        );
        const index = profiles.findIndex((profile) => profile.id === matched.id);
        if (index >= 0) profiles[index] = matched;
      }
      childCache.set(identity.childKey, matched);
      return matched;
    }

    const preferredCloudId = await deriveCloudId(
      `${dependencies.userId}:child:${identity.childKey}`,
    );
    const baseInput = {
      familyProfileId: await getFamilyProfileId(),
      displayName: identity.childName,
      clientChildId: identity.childKey,
      preferredCloudId,
    };
    let created: ChildProfile;
    try {
      const input = {
        ...baseInput,
        primaryCharacterId: isUuid(identity.childCharacterId)
          ? identity.childCharacterId
          : undefined,
      };
      created = await retry(() => dependencies.cloudChildren.save(input));
    } catch (error) {
      if (!identity.childCharacterId || !isForeignKeyError(error)) throw error;
      // A local character id can belong to a different account on a shared
      // device. The child profile is still importable without that optional FK.
      created = await retry(() => dependencies.cloudChildren.save(baseInput));
    }
    profiles.push(created);
    childCache.set(identity.childKey, created);
    return created;
  }

  function getStoryChild(
    story: LocalStorySource,
    growthRecords: GrowthRecord[],
  ): LocalChildIdentity | undefined {
    const growthRecord = growthRecords.find(
      (record) => record.storyId === story.localId || record.story.storyId === story.localId,
    );
    if (growthRecord) {
      return {
        childKey: growthRecord.childKey,
        childName: growthRecord.childName,
        childCharacterId: growthRecord.childCharacterId,
      };
    }
    const childName = story.result.input.childName.trim();
    if (!childName) return undefined;
    const childCharacterId = story.result.input.protagonistFamilyCharacterId;
    return {
      childKey: childCharacterId || `name:${normalizeName(childName)}`,
      childName,
      childCharacterId,
    };
  }

  async function createStableGrowthDraft(record: GrowthRecord) {
    const photos = await Promise.all(
      record.photos.map(async (photo) => ({
        ...photo,
        id: await deriveCloudId(
          `${dependencies.userId}:growth-photo:${getGrowthLocalId(record)}:${photo.id}`,
        ),
      })),
    );
    return {
      version: 1,
      childKey: record.childKey,
      childName: record.childName,
      childCharacterId: record.childCharacterId,
      childAvatarDataUrl: record.childAvatarDataUrl,
      occurredOn: record.occurredOn,
      note: record.note,
      idea: record.idea,
      photos,
      readingStage: record.readingStage,
      storyTreatment: record.storyTreatment,
      parentFacts: record.parentFacts,
      allowedImaginations: record.allowedImaginations,
    } satisfies GrowthRecordDraft;
  }

  function emitProgress(
    onProgress: ((progress: ImportProgress) => void) | undefined,
    progress: ImportProgress,
  ) {
    onProgress?.(progress);
  }

  async function executeImport(
    work: ImportWork,
    meta: Map<string, SyncMeta>,
    options: ResumeLocalImportOptions,
  ) {
    const total = work.stories.size + work.growthRecords.size;
    const result = createEmptyResult(total);
    if (!(dependencies.isOnline || isBrowserOnline)()) {
      result.pending = total;
      result.pendingCount = total;
      return result;
    }

    const requiresGuardianConsent = Array.from(
      work.growthRecords.values(),
    ).some((record) => record.photos.length > 0);
    if (requiresGuardianConsent && dependencies.recordGuardianConsent) {
      if (!options.guardianConsentConfirmed) {
        const error = new Error(
          "上传成长照片前，请确认你是照片中的本人或其监护人，并已获得明确授权。",
        );
        const message = normalizeError(error);
        const failedMeta = Array.from(meta.values()).map((record) => ({
          ...record,
          status: "failed" as const,
          error: message,
        }));
        await dependencies.syncMeta.putMany(failedMeta);
        result.failed = failedMeta.length;
        result.failedCount = failedMeta.length;
        result.error = message;
        result.failures = failedMeta.map((record) => ({
          localId: record.localId,
          entityType: record.entityType,
          error: message,
        }));
        return result;
      }
      try {
        await retry(dependencies.recordGuardianConsent);
      } catch (error) {
        const message = normalizeError(error);
        const failedMeta = Array.from(meta.values()).map((record) => ({
          ...record,
          status: "failed" as const,
          error: message,
        }));
        await dependencies.syncMeta.putMany(failedMeta);
        result.failed = failedMeta.length;
        result.failedCount = failedMeta.length;
        result.error = message;
        result.failures = failedMeta.map((record) => ({
          localId: record.localId,
          entityType: record.entityType,
          error: message,
        }));
        return result;
      }
    }

    let cloudStories: SavedStory[];
    let cloudGrowthRecords: GrowthRecord[];
    try {
      [cloudStories, cloudGrowthRecords] = await retry(() =>
        Promise.all([
          dependencies.cloudStories.list(),
          dependencies.cloudGrowthRecords.list(),
        ]),
      );
    } catch (error) {
      const message = normalizeError(error);
      const failedMeta = Array.from(meta.values()).map((record) => ({
        ...record,
        status: "failed" as const,
        error: message,
      }));
      await dependencies.syncMeta.putMany(failedMeta);
      result.failed = failedMeta.length;
      result.failedCount = failedMeta.length;
      result.error = message;
      result.failures = failedMeta.map((record) => ({
        localId: record.localId,
        entityType: record.entityType,
        error: message,
      }));
      return result;
    }

    const cloudStoriesByClientId = new Map(
      cloudStories.map((story) => [story.clientStoryId, story]),
    );
    const cloudGrowthByClientId = new Map<string, GrowthRecord>();
    cloudGrowthRecords.forEach((record) => {
      if (record.clientRecordId) {
        cloudGrowthByClientId.set(record.clientRecordId, record);
      }
      cloudGrowthByClientId.set(record.storyId, record);
      cloudGrowthByClientId.set(record.id, record);
    });
    const storyActions = new Map<
      string,
      { status: "synced"; story: SavedStory } | { status: "failed" }
    >();
    let current = 0;

    async function markFailure(metaRecord: SyncMeta, error: unknown) {
      const message = normalizeError(error);
      await dependencies.syncMeta.put({
        ...metaRecord,
        status: "failed",
        error: message,
      });
      result.failed += 1;
      result.failedCount = result.failed;
      result.failures.push({
        localId: metaRecord.localId,
        entityType: metaRecord.entityType,
        error: message,
      });
      emitProgress(options.onProgress, {
        current,
        total,
        localId: metaRecord.localId,
        entityType: metaRecord.entityType,
        status: "failed",
        error: message,
      });
    }

    async function markConflict(metaRecord: SyncMeta, conflict: ImportConflict) {
      await dependencies.syncMeta.put({
        ...metaRecord,
        status: "failed",
        error: "sync-conflict-requires-resolution",
      });
      result.failed += 1;
      result.failedCount = result.failed;
      result.conflicts.push(conflict);
      emitProgress(options.onProgress, {
        current,
        total,
        localId: metaRecord.localId,
        entityType: metaRecord.entityType,
        status: "conflict",
        error: "sync-conflict-requires-resolution",
      });
    }

    async function markSynced(
      metaRecord: SyncMeta,
      cloudId: string,
      action: ImportedEntity["action"],
      photoCount = 0,
    ) {
      await dependencies.syncMeta.put({
        ...metaRecord,
        cloudId,
        status: "synced",
        lastSyncedAt: now().toISOString(),
        error: undefined,
      });
      result.synced.push({
        localId: metaRecord.localId,
        entityType: metaRecord.entityType,
        cloudId,
        action,
      });
      if (action === "uploaded") {
        result.imported += 1;
        if (metaRecord.entityType === "story") {
          result.importedStories += 1;
        } else {
          result.importedGrowthRecords += 1;
          result.importedPhotos += photoCount;
        }
      } else result.keptCloud += 1;
      emitProgress(options.onProgress, {
        current,
        total,
        localId: metaRecord.localId,
        entityType: metaRecord.entityType,
        status: action === "uploaded" ? "synced" : "kept-cloud",
      });
    }

    for (const story of work.stories.values()) {
      current += 1;
      const key = getSyncMetaKey("story", story.localId);
      const metaRecord = meta.get(key);
      if (!metaRecord) continue;
      const syncing = await dependencies.syncMeta.put({
        ...metaRecord,
        status: "syncing",
        error: undefined,
      });
      emitProgress(options.onProgress, {
        current,
        total,
        localId: story.localId,
        entityType: "story",
        status: "syncing",
      });
      const cloud = cloudStoriesByClientId.get(story.localId);
      const direction = decideStoryDirection(
        story,
        cloud,
        syncing,
        options.conflictResolutions?.[key],
      );
      if (direction.action === "conflict") {
        await markConflict(syncing, direction.conflict);
        storyActions.set(story.localId, { status: "failed" });
        continue;
      }
      if (direction.action === "keep-cloud" && cloud) {
        await markSynced(syncing, cloud.id, "kept-cloud");
        storyActions.set(story.localId, { status: "synced", story: cloud });
        continue;
      }

      try {
        const child = getStoryChild(story, work.allGrowthRecords);
        const childProfile = child ? await ensureChild(child) : undefined;
        const input = {
          result: story.result,
          childProfileId: childProfile?.id,
          status: story.status,
          preferredCloudId: syncing.cloudId,
        } satisfies StorySaveInput & { preferredCloudId?: string };
        const saved = await retry(() => dependencies.cloudStories.save(input));
        cloudStoriesByClientId.set(story.localId, saved);
        await markSynced(syncing, saved.id, "uploaded");
        storyActions.set(story.localId, { status: "synced", story: saved });
      } catch (error) {
        await markFailure(syncing, error);
        storyActions.set(story.localId, { status: "failed" });
      }
    }

    for (const record of work.growthRecords.values()) {
      current += 1;
      const localId = getGrowthLocalId(record);
      const key = getSyncMetaKey("growth-record", localId);
      const metaRecord = meta.get(key);
      if (!metaRecord) continue;
      const syncing = await dependencies.syncMeta.put({
        ...metaRecord,
        status: "syncing",
        error: undefined,
      });
      emitProgress(options.onProgress, {
        current,
        total,
        localId,
        entityType: "growth-record",
        status: "syncing",
      });
      const storyAction = storyActions.get(record.story.storyId);
      if (!storyAction || storyAction.status === "failed") {
        await markFailure(syncing, new Error("growth-story-import-failed"));
        continue;
      }
      const cloud = cloudGrowthByClientId.get(localId);
      const direction = decideGrowthDirection(
        record,
        cloud,
        syncing,
        options.conflictResolutions?.[key],
      );
      if (direction.action === "conflict") {
        await markConflict(syncing, direction.conflict);
        continue;
      }
      if (direction.action === "keep-cloud" && cloud) {
        await markSynced(syncing, cloud.id, "kept-cloud");
        continue;
      }

      try {
        const child = await ensureChild({
          childKey: record.childKey,
          childName: record.childName,
          childCharacterId: record.childCharacterId,
        });
        const storyMeta = meta.get(getSyncMetaKey("story", record.story.storyId));
        const input = {
          clientRecordId: localId,
          childProfileId: child.id,
          savedStoryId: storyAction.story.id,
          story: record.story,
          draft: await createStableGrowthDraft(record),
          preferredCloudId: syncing.cloudId,
          preferredStoryCloudId: storyMeta?.cloudId,
        } satisfies GrowthRecordInput & {
          preferredCloudId?: string;
          preferredStoryCloudId?: string;
        };
        const saved = await retry(() => dependencies.cloudGrowthRecords.save(input));
        cloudGrowthByClientId.set(localId, saved);
        await markSynced(syncing, saved.id, "uploaded", record.photos.length);
      } catch (error) {
        await markFailure(syncing, error);
      }
    }

    return result;
  }

  async function startImport(selection: LocalImportSelection) {
    const work = await buildWork(
      new Set(selection.storyIds),
      new Set(selection.growthRecordIds),
    );
    const meta = await preallocateMeta(work);
    return executeImport(work, meta, selection);
  }

  async function resumePendingImport(options: ResumeLocalImportOptions = {}) {
    const records = await dependencies.syncMeta.list();
    const resumable = records.filter((record) => record.status !== "synced");
    const work = await buildWork(
      resumable
        .filter((record) => record.entityType === "story")
        .map((record) => record.localId),
      resumable
        .filter((record) => record.entityType === "growth-record")
        .map((record) => record.localId),
    );
    if (work.stories.size === 0 && work.growthRecords.size === 0) {
      return createEmptyResult(0);
    }
    const meta = await preallocateMeta(work);
    return executeImport(work, meta, options);
  }

  async function resolveConflict(
    conflictKey: string,
    choice: ImportConflictChoice,
    onProgress?: (progress: ImportProgress) => void,
  ) {
    return resumePendingImport({
      conflictResolutions: { [conflictKey]: choice },
      onProgress,
    });
  }

  return {
    scanLocalImportCandidates: () =>
      scanLocalImportCandidates({
        localStories: dependencies.localStories,
        localGrowthRecords: dependencies.localGrowthRecords,
        syncMeta: dependencies.syncMeta,
      }),
    startImport,
    importSelectedLocalData: startImport,
    resumePendingImport,
    resolveConflict,
    getSyncMeta: () => dependencies.syncMeta.list(),
  };
}

export function createLocalDataImportController(
  options: LocalDataImportControllerOptions,
) {
  const cloudStories = createCloudStoryRepository(options.supabase, options.userId);
  return createLocalDataImportEngine({
    userId: options.userId,
    localStories: localStoryRepository,
    localGrowthRecords: localGrowthRepository,
    cloudStories,
    cloudGrowthRecords: createCloudGrowthRepository(
      options.supabase,
      options.userId,
    ),
    cloudChildren: createCloudChildRepository(options.supabase, options.userId),
    syncMeta: options.syncMeta || createIndexedDbSyncMetaStore(options.userId),
    ensureFamilyProfileId: () =>
      ensureFamilyProfile(options.supabase, options.userId),
    recordGuardianConsent: async () => {
      await ensureFamilyProfile(options.supabase, options.userId);
      await recordGuardianConsent(options.supabase, options.userId);
    },
  });
}
