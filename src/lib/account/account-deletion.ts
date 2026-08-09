import "server-only";

import { z } from "zod";
import {
  deleteBailianClonedVoice,
  discoverBailianClonedVoiceIdsSince,
} from "@/lib/bailian-voice-cloning-server";
import {
  createFamilyVoiceEnrollmentPrefix,
  isFamilyVoiceAmbiguousAbsenceGraceElapsed,
  isFamilyVoiceProcessingStale,
} from "@/lib/family-voice";

export const CHILD_DELETION_CONFIRMATION = "DELETE_CHILD_DATA";
export const CLOUD_DELETION_CONFIRMATION = "DELETE_CLOUD_DATA";
export const ACCOUNT_DELETION_CONFIRMATION = "DELETE_STORYBLOOM_ACCOUNT";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_PAGE_SIZE = 1000;
const STORAGE_REMOVE_BATCH_SIZE = 100;
const DATABASE_ID_BATCH_SIZE = 200;

const rawDeletionRequestSchema = z.object({
  scope: z.enum(["child", "cloud"]),
  childId: z.string().uuid().optional(),
  deleteAuthUser: z.boolean().optional().default(false),
  confirmation: z.string(),
});

export type AccountDeletionRequest =
  | {
      scope: "child";
      childId: string;
      deleteAuthUser: false;
      confirmation: typeof CHILD_DELETION_CONFIRMATION;
    }
  | {
      scope: "cloud";
      deleteAuthUser: boolean;
      confirmation:
        | typeof CLOUD_DELETION_CONFIRMATION
        | typeof ACCOUNT_DELETION_CONFIRMATION;
    };

export type AccountDeletionStepStatus = "completed" | "skipped" | "failed";
export type AccountDeletionReportStatus = "complete" | "partial" | "failed";

export interface AccountDeletionFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AccountDeletionStepReport {
  key: string;
  kind: "discovery" | "provider" | "storage" | "database" | "auth";
  status: AccountDeletionStepStatus;
  discovered: number;
  deleted: number;
  optional?: boolean;
  reason?: string;
  error?: AccountDeletionFailure;
}

export interface AccountDeletionReport {
  version: 1;
  requestId: string;
  scope: AccountDeletionRequest["scope"];
  childId?: string;
  deleteAuthUserRequested: boolean;
  authUserDeleted: boolean;
  status: AccountDeletionReportStatus;
  retryable: boolean;
  startedAt: string;
  completedAt: string;
  steps: AccountDeletionStepReport[];
  warnings: string[];
}

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
  statusCode?: string;
};

type StorageListItem = {
  id?: string | null;
  name: string;
  metadata?: unknown;
};

interface AccountDeletionStorageBucket {
  list(
    path?: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: "asc" | "desc" };
    },
  ): Promise<{ data: StorageListItem[] | null; error: SupabaseLikeError | null }>;
  remove(paths: string[]): Promise<{ data?: unknown; error: SupabaseLikeError | null }>;
}

export interface AccountDeletionAdminClient {
  from(table: string): any;
  storage: {
    from(bucket: string): AccountDeletionStorageBucket;
  };
  auth: {
    admin: {
      deleteUser(
        userId: string,
        shouldSoftDelete?: boolean,
      ): Promise<{ data?: unknown; error: SupabaseLikeError | null }>;
    };
  };
}

type SavedStoryRow = {
  id: string;
  client_story_id: string;
  child_profile_id: string | null;
  asset_manifest: unknown;
};

type GrowthRecordRow = {
  id: string;
  child_profile_id: string;
  saved_story_id: string | null;
};

type GrowthPhotoRow = {
  id: string;
  growth_record_id: string;
  storage_path: string;
};

type SavedStoryAssetRow = {
  id: string;
  saved_story_id: string;
  storage_path: string;
};

type FamilyCharacterRow = {
  id: string;
  source_photo_path: string | null;
  canonical_photo_path: string | null;
};

type FamilyCharacterVoiceRow = {
  id: string;
  family_character_id: string;
  sample_audio_path: string;
  voice_id: string | null;
  status: "processing" | "ready" | "failed" | "deleting";
  updated_at: string;
  retired_voice_ids: string[] | null;
  previous_ready_voice: unknown;
  retired_sample_paths: string[] | null;
  provider_voice_ids_before_attempt: string[] | null;
};

type SharedStoryRow = {
  share_id: string;
};

type DeletionSnapshot = {
  counts: Record<string, number>;
  savedStories: SavedStoryRow[];
  growthRecords: GrowthRecordRow[];
  growthPhotos: GrowthPhotoRow[];
  savedStoryAssets: SavedStoryAssetRow[];
  savedStoryAssetsAvailable: boolean;
  familyCharacters: FamilyCharacterRow[];
  familyCharacterVoices: FamilyCharacterVoiceRow[];
  familyCharacterVoicesAvailable: boolean;
  sharedStories: SharedStoryRow[];
};

export class AccountDeletionInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "AccountDeletionInputError";
  }
}

export class AccountDeletionNotFoundError extends Error {
  readonly status = 404;

  constructor(message = "没有找到这个孩子档案。") {
    super(message);
    this.name = "AccountDeletionNotFoundError";
  }
}

class AccountDeletionOperationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AccountDeletionOperationError";
    this.code = options.code || "account-deletion-operation-failed";
    this.retryable = options.retryable ?? true;
  }
}

export function parseAccountDeletionRequest(value: unknown): AccountDeletionRequest {
  const parsed = rawDeletionRequestSchema.safeParse(value);
  if (!parsed.success) {
    throw new AccountDeletionInputError(
      parsed.error.issues[0]?.message || "删除请求参数不完整。",
    );
  }

  if (parsed.data.scope === "child") {
    if (!parsed.data.childId) {
      throw new AccountDeletionInputError("删除孩子档案时必须提供 childId。 ");
    }
    if (parsed.data.deleteAuthUser) {
      throw new AccountDeletionInputError("删除单个孩子档案不能同时删除账户。 ");
    }
    if (parsed.data.confirmation !== CHILD_DELETION_CONFIRMATION) {
      throw new AccountDeletionInputError("孩子档案删除确认文本不匹配。 ");
    }
    return {
      scope: "child",
      childId: parsed.data.childId,
      deleteAuthUser: false,
      confirmation: CHILD_DELETION_CONFIRMATION,
    };
  }

  const expectedConfirmation = parsed.data.deleteAuthUser
    ? ACCOUNT_DELETION_CONFIRMATION
    : CLOUD_DELETION_CONFIRMATION;
  if (parsed.data.confirmation !== expectedConfirmation) {
    throw new AccountDeletionInputError("云端数据删除确认文本不匹配。 ");
  }

  return {
    scope: "cloud",
    deleteAuthUser: parsed.data.deleteAuthUser,
    confirmation: expectedConfirmation,
  };
}

export function isMissingOptionalTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as SupabaseLikeError;
  const code = candidate.code?.toUpperCase();
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist/.test(message) ||
    /could not find (?:the )?table/.test(message) ||
    /schema cache/.test(message)
  );
}

function isMissingOptionalStorageBucketError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as SupabaseLikeError & { cause?: unknown };
  const cause =
    candidate.cause && typeof candidate.cause === "object"
      ? (candidate.cause as SupabaseLikeError)
      : undefined;
  const code = String(candidate.code || cause?.code || "").toLowerCase();
  const status = Number(
    candidate.status ?? candidate.statusCode ?? cause?.status ?? cause?.statusCode,
  );
  const message = [candidate.message, cause?.message]
    .filter(Boolean)
    .join(" ");
  return (
    code === "nosuchbucket" ||
    code === "bucket_not_found" ||
    status === 404 ||
    /bucket .*not found|bucket does not exist|not found.*bucket/i.test(message)
  );
}

export function getAccountDeletionReportStatus(
  steps: AccountDeletionStepReport[],
): AccountDeletionReportStatus {
  if (!steps.some((step) => step.status === "failed")) return "complete";
  return steps.some((step) => step.deleted > 0) ? "partial" : "failed";
}

function normalizePrefix(prefix: string) {
  return prefix
    .split("/")
    .filter(Boolean)
    .join("/");
}

function joinStoragePath(prefix: string, name: string) {
  const safeName = name.trim();
  if (!safeName || safeName === "." || safeName === ".." || safeName.includes("/")) {
    throw new AccountDeletionOperationError("Storage 返回了无效对象名称。", {
      code: "storage-object-name-invalid",
      retryable: false,
    });
  }
  const normalizedPrefix = normalizePrefix(prefix);
  return normalizedPrefix ? `${normalizedPrefix}/${safeName}` : safeName;
}

export async function listStoragePathsRecursively(
  bucket: AccountDeletionStorageBucket,
  prefix: string,
) {
  const root = normalizePrefix(prefix);
  const paths: string[] = [];
  const pending = [root];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const folder = pending.shift()!;
    if (visited.has(folder)) continue;
    visited.add(folder);
    if (visited.size > 50_000) {
      throw new AccountDeletionOperationError("Storage 目录数量超过安全上限。", {
        code: "storage-folder-limit-exceeded",
        retryable: false,
      });
    }

    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(folder, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new AccountDeletionOperationError(
          error.message || "无法读取 Storage 对象列表。",
          { code: error.code || "storage-list-failed", cause: error },
        );
      }

      const items = data || [];
      for (const item of items) {
        const path = joinStoragePath(folder, item.name);
        if (item.id === null) pending.push(path);
        else paths.push(path);
      }

      if (items.length < STORAGE_PAGE_SIZE) break;
      offset += items.length;
    }
  }

  return Array.from(new Set(paths)).sort();
}

function isOwnedStoragePath(path: string, userId: string, resourceId?: string) {
  if (!path || path.includes("..") || /^(?:data|blob|https?):/i.test(path)) return false;
  const prefix = resourceId ? `${userId}/${resourceId}/` : `${userId}/`;
  return path.startsWith(prefix);
}

export function extractOwnedStoryAssetPaths(
  assetManifest: unknown,
  userId: string,
  savedStoryId: string,
) {
  if (!assetManifest || typeof assetManifest !== "object") return [];
  const pages = (assetManifest as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return [];
  return Array.from(
    new Set(
      pages.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const path = (entry as { storagePath?: unknown }).storagePath;
        return typeof path === "string" &&
          isOwnedStoragePath(path, userId, savedStoryId)
          ? [path]
          : [];
      }),
    ),
  ).sort();
}

function toFailure(error: unknown): AccountDeletionFailure {
  if (error instanceof AccountDeletionOperationError) {
    return {
      code: error.code,
      message: error.message.slice(0, 500),
      retryable: error.retryable,
    };
  }
  if (error && typeof error === "object") {
    const candidate = error as SupabaseLikeError;
    return {
      code: candidate.code || candidate.statusCode || "account-deletion-failed",
      message: (candidate.message || "删除操作失败。 ").slice(0, 500),
      retryable: true,
    };
  }
  return {
    code: "account-deletion-failed",
    message: error instanceof Error ? error.message.slice(0, 500) : "删除操作失败。 ",
    retryable: true,
  };
}

function createStep(
  key: string,
  kind: AccountDeletionStepReport["kind"],
  discovered = 0,
): AccountDeletionStepReport {
  return { key, kind, status: "completed", discovered, deleted: 0 };
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function applyFilters(query: any, filters: Array<["eq" | "in", string, unknown]>) {
  return filters.reduce((current, [operation, column, value]) => {
    if (operation === "eq") return current.eq(column, value);
    return current.in(column, value);
  }, query);
}

async function selectRows<T>(
  client: AccountDeletionAdminClient,
  table: string,
  columns: string,
  filters: Array<["eq" | "in", string, unknown]>,
  options: { optionalTable?: boolean; orderColumn?: string } = {},
): Promise<{ rows: T[]; available: boolean }> {
  const rows: T[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    let query = applyFilters(client.from(table).select(columns), filters);
    const supportsRange = typeof query.range === "function";
    if (supportsRange) {
      if (typeof query.order === "function") {
        query = query.order(
          options.orderColumn ||
            (table === "shared_stories"
              ? "share_id"
              : table === "account_settings"
                ? "user_id"
                : "id"),
          { ascending: true },
        );
      }
      query = query.range(offset, offset + pageSize - 1);
    }

    const { data, error } = (await query) as {
      data: T[] | null;
      error: SupabaseLikeError | null;
    };
    if (error) {
      if (options.optionalTable && isMissingOptionalTableError(error)) {
        return { rows: [], available: false };
      }
      throw new AccountDeletionOperationError(
        error.message || `无法读取 ${table}。`,
        { code: error.code || `select-${table}-failed`, cause: error },
      );
    }

    const page = data || [];
    rows.push(...page);
    if (!supportsRange || page.length < pageSize) break;
    offset += page.length;
  }

  return { rows, available: true };
}

async function selectRowsByIds<T>(
  client: AccountDeletionAdminClient,
  table: string,
  columns: string,
  idColumn: string,
  ids: string[],
  userId: string,
  options: { optionalTable?: boolean } = {},
) {
  if (ids.length === 0) return { rows: [] as T[], available: true };
  const rows: T[] = [];
  let available = true;
  for (const idBatch of chunk(Array.from(new Set(ids)), DATABASE_ID_BATCH_SIZE)) {
    const result = await selectRows<T>(
      client,
      table,
      columns,
      [
        ["eq", "user_id", userId],
        ["in", idColumn, idBatch],
      ],
      options,
    );
    if (!result.available) {
      available = false;
      break;
    }
    rows.push(...result.rows);
  }
  return { rows, available };
}

async function acquireAccountVoiceDeletionLock(
  client: AccountDeletionAdminClient,
  userId: string,
  operationId: string,
) {
  const query = client.from("account_voice_deletion_locks").upsert(
    {
      user_id: userId,
      operation_id: operationId,
      locked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  const { data, error } = (await query
    .select("user_id")
    .maybeSingle()) as {
    data: { user_id: string } | null;
    error: SupabaseLikeError | null;
  };
  if (error) {
    if (isMissingOptionalTableError(error)) {
      throw new AccountDeletionOperationError(
        "家庭声音生命周期迁移尚未部署，已安全中止账户删除。",
        {
          code: "account-voice-lifecycle-migration-required",
          retryable: false,
          cause: error,
        },
      );
    }
    throw new AccountDeletionOperationError(
      error.message || "无法锁定家庭声音删除状态。",
      { code: error.code || "account-voice-deletion-lock-failed", cause: error },
    );
  }
  if (!data) {
    throw new AccountDeletionOperationError("无法锁定家庭声音删除状态。", {
      code: "account-voice-deletion-lock-empty",
    });
  }
  return true;
}

async function releaseAccountVoiceDeletionLock(
  client: AccountDeletionAdminClient,
  userId: string,
  operationId: string,
) {
  const { error } = (await client
    .from("account_voice_deletion_locks")
    .delete()
    .eq("user_id", userId)
    .eq("operation_id", operationId)) as {
    error: SupabaseLikeError | null;
  };
  if (error && !isMissingOptionalTableError(error)) {
    throw new AccountDeletionOperationError(
      error.message || "无法解除家庭声音删除锁。",
      { code: error.code || "account-voice-deletion-unlock-failed", cause: error },
    );
  }
}

async function ensureOwnedChild(
  client: AccountDeletionAdminClient,
  userId: string,
  childId: string,
) {
  const { data, error } = (await client
    .from("child_profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("id", childId)
    .maybeSingle()) as {
    data: { id: string } | null;
    error: SupabaseLikeError | null;
  };
  if (error) {
    throw new AccountDeletionOperationError(
      error.message || "无法读取孩子档案。 ",
      { code: error.code || "select-child-profile-failed", cause: error },
    );
  }
  if (!data) throw new AccountDeletionNotFoundError();
}

async function discoverChildSnapshot(
  client: AccountDeletionAdminClient,
  userId: string,
  childId: string,
): Promise<DeletionSnapshot> {
  await ensureOwnedChild(client, userId, childId);

  const growthRecords = (
    await selectRows<GrowthRecordRow>(
      client,
      "growth_records",
      "id,child_profile_id,saved_story_id",
      [
        ["eq", "user_id", userId],
        ["eq", "child_profile_id", childId],
      ],
    )
  ).rows;
  const directSavedStories = (
    await selectRows<SavedStoryRow>(
      client,
      "saved_stories",
      "id,client_story_id,child_profile_id,asset_manifest",
      [
        ["eq", "user_id", userId],
        ["eq", "child_profile_id", childId],
      ],
    )
  ).rows;
  const linkedStoryIds = growthRecords.flatMap((record) =>
    record.saved_story_id ? [record.saved_story_id] : [],
  );
  const missingLinkedIds = linkedStoryIds.filter(
    (id) => !directSavedStories.some((story) => story.id === id),
  );
  const linkedSavedStories = (
    await selectRowsByIds<SavedStoryRow>(
      client,
      "saved_stories",
      "id,client_story_id,child_profile_id,asset_manifest",
      "id",
      missingLinkedIds,
      userId,
    )
  ).rows;
  const savedStories = Array.from(
    new Map(
      [...directSavedStories, ...linkedSavedStories].map((story) => [story.id, story]),
    ).values(),
  );
  const growthRecordIds = growthRecords.map((record) => record.id);
  const savedStoryIds = savedStories.map((story) => story.id);
  const growthPhotos = (
    await selectRowsByIds<GrowthPhotoRow>(
      client,
      "growth_record_photos",
      "id,growth_record_id,storage_path",
      "growth_record_id",
      growthRecordIds,
      userId,
    )
  ).rows;
  const storyAssetsResult = await selectRowsByIds<SavedStoryAssetRow>(
    client,
    "saved_story_assets",
    "id,saved_story_id,storage_path",
    "saved_story_id",
    savedStoryIds,
    userId,
    { optionalTable: true },
  );

  return {
    counts: {
      child_profiles: 1,
      growth_records: growthRecords.length,
      growth_record_photos: growthPhotos.length,
      saved_stories: savedStories.length,
      saved_story_assets: storyAssetsResult.rows.length,
    },
    savedStories,
    growthRecords,
    growthPhotos,
    savedStoryAssets: storyAssetsResult.rows,
    savedStoryAssetsAvailable: storyAssetsResult.available,
    familyCharacters: [],
    familyCharacterVoices: [],
    familyCharacterVoicesAvailable: true,
    sharedStories: [],
  };
}

async function discoverCloudSnapshot(
  client: AccountDeletionAdminClient,
  userId: string,
): Promise<DeletionSnapshot> {
  const savedStories = (
    await selectRows<SavedStoryRow>(
      client,
      "saved_stories",
      "id,client_story_id,child_profile_id,asset_manifest",
      [["eq", "user_id", userId]],
    )
  ).rows;
  const growthRecords = (
    await selectRows<GrowthRecordRow>(
      client,
      "growth_records",
      "id,child_profile_id,saved_story_id",
      [["eq", "user_id", userId]],
    )
  ).rows;
  const growthPhotos = (
    await selectRows<GrowthPhotoRow>(
      client,
      "growth_record_photos",
      "id,growth_record_id,storage_path",
      [["eq", "user_id", userId]],
    )
  ).rows;
  const storyAssetsResult = await selectRows<SavedStoryAssetRow>(
    client,
    "saved_story_assets",
    "id,saved_story_id,storage_path",
    [["eq", "user_id", userId]],
    { optionalTable: true },
  );
  const familyCharacters = (
    await selectRows<FamilyCharacterRow>(
      client,
      "family_characters",
      "id,source_photo_path,canonical_photo_path",
      [["eq", "user_id", userId]],
    )
  ).rows;
  const familyCharacterVoicesResult = await selectRows<FamilyCharacterVoiceRow>(
    client,
    "family_character_voices",
    "id,family_character_id,sample_audio_path,voice_id,status,updated_at,retired_voice_ids,previous_ready_voice,retired_sample_paths,provider_voice_ids_before_attempt",
    [["eq", "user_id", userId]],
    { optionalTable: true },
  );
  const sharedStories = (
    await selectRows<SharedStoryRow>(
      client,
      "shared_stories",
      "share_id",
      [["eq", "owner_user_id", userId]],
    )
  ).rows;

  const countTables = [
    "account_settings",
    "child_profiles",
    "family_profiles",
  ] as const;
  const counts: Record<string, number> = {
    saved_stories: savedStories.length,
    growth_records: growthRecords.length,
    growth_record_photos: growthPhotos.length,
    saved_story_assets: storyAssetsResult.rows.length,
    family_characters: familyCharacters.length,
    family_character_voices: familyCharacterVoicesResult.rows.length,
    shared_stories: sharedStories.length,
  };
  for (const table of countTables) {
    const result = await selectRows<{ id?: string; user_id?: string }>(
      client,
      table,
      table === "account_settings" ? "user_id" : "id",
      [["eq", "user_id", userId]],
    );
    counts[table] = result.rows.length;
  }

  return {
    counts,
    savedStories,
    growthRecords,
    growthPhotos,
    savedStoryAssets: storyAssetsResult.rows,
    savedStoryAssetsAvailable: storyAssetsResult.available,
    familyCharacters,
    familyCharacterVoices: familyCharacterVoicesResult.rows,
    familyCharacterVoicesAvailable: familyCharacterVoicesResult.available,
    sharedStories,
  };
}

async function executeStorageStep(
  report: AccountDeletionReport,
  client: AccountDeletionAdminClient,
  input: {
    key: string;
    bucket: string;
    paths: () => Promise<string[]>;
    optionalBucket?: boolean;
  },
) {
  const step = createStep(input.key, "storage");
  step.optional = input.optionalBucket || undefined;
  report.steps.push(step);
  try {
    const paths = Array.from(new Set(await input.paths())).sort();
    step.discovered = paths.length;
    const bucket = client.storage.from(input.bucket);
    for (const pathBatch of chunk(paths, STORAGE_REMOVE_BATCH_SIZE)) {
      const { error } = await bucket.remove(pathBatch);
      if (error) {
        throw new AccountDeletionOperationError(
          error.message || `无法清理 ${input.bucket}。`,
          { code: error.code || `storage-remove-${input.bucket}-failed`, cause: error },
        );
      }
      step.deleted += pathBatch.length;
    }
    return true;
  } catch (error) {
    if (input.optionalBucket && isMissingOptionalStorageBucketError(error)) {
      step.status = "skipped";
      step.reason = "bucket_not_available";
      return true;
    }
    step.status = "failed";
    step.error = toFailure(error);
    return false;
  }
}

async function executeProviderVoiceDeletionStep(
  report: AccountDeletionReport,
  client: AccountDeletionAdminClient,
  userId: string,
  snapshot: DeletionSnapshot,
) {
  let reconciliationFailure: unknown = null;
  const freshlyQueuedVoiceRows = new Set<string>();
  for (const voice of snapshot.familyCharacterVoices) {
    if (
      (voice.status !== "processing" && voice.status !== "deleting") ||
      voice.voice_id ||
      !Array.isArray(voice.provider_voice_ids_before_attempt)
    ) {
      continue;
    }
    try {
      const discoveredVoiceIds = await discoverBailianClonedVoiceIdsSince(
        createFamilyVoiceEnrollmentPrefix(voice.family_character_id),
        voice.provider_voice_ids_before_attempt,
      );
      if (discoveredVoiceIds.length === 0) {
        if (
          voice.status === "deleting" &&
          isFamilyVoiceAmbiguousAbsenceGraceElapsed(voice.updated_at)
        ) {
          continue;
        }
        if (voice.status === "processing") {
          const { data, error } = (await client
            .from("family_character_voices")
            .update({ status: "deleting", error_message: null })
            .eq("id", voice.id)
            .eq("user_id", userId)
            .eq("status", "processing")
            .eq("updated_at", voice.updated_at)
            .select("id")
            .maybeSingle()) as {
            data: { id: string } | null;
            error: SupabaseLikeError | null;
          };
          if (error || !data) {
            throw new AccountDeletionOperationError(
              error?.message || "无法保存家庭声音对账状态。",
              {
                code:
                  error?.code ||
                  "family-voice-ambiguous-tombstone-save-failed",
                cause: error || undefined,
              },
            );
          }
          voice.status = "deleting";
        }
        throw new AccountDeletionOperationError(
          "百炼尚未返回在途家庭声音，无法安全完成账户删除，请稍后重试。",
          {
            code: "family-voice-ambiguous-create-still-pending",
          },
        );
      }
      voice.retired_voice_ids = Array.from(
        new Set([...(voice.retired_voice_ids || []), ...discoveredVoiceIds]),
      );
      const { data, error } = (await client
        .from("family_character_voices")
        .update({
          status: "deleting",
          retired_voice_ids: voice.retired_voice_ids,
          provider_voice_ids_before_attempt: null,
        })
        .eq("id", voice.id)
        .eq("user_id", userId)
        .eq("status", voice.status)
        .eq("updated_at", voice.updated_at)
        .select("id")
        .maybeSingle()) as {
        data: { id: string } | null;
        error: SupabaseLikeError | null;
      };
      if (error || !data) {
        throw new AccountDeletionOperationError(
          error?.message || "无法保存家庭声音撤销队列。",
          {
            code:
              error?.code || "family-voice-ambiguous-queue-save-failed",
            cause: error || undefined,
          },
        );
      }
      voice.status = "deleting";
      voice.provider_voice_ids_before_attempt = null;
      freshlyQueuedVoiceRows.add(voice.id);
    } catch (error) {
      reconciliationFailure =
        error instanceof AccountDeletionOperationError
          ? error
          : new AccountDeletionOperationError(
              "无法确认在途家庭声音，请稍后重试账户删除。",
              {
                code: "family-voice-ambiguous-create-reconciliation-failed",
                cause: error,
              },
            );
      break;
    }
  }
  const voiceIds = Array.from(
    new Set(snapshot.familyCharacterVoices.flatMap(getVoiceIds)),
  );
  if (!snapshot.familyCharacterVoicesAvailable) {
    addSkippedStep(
      report,
      "provider.family-character-voices",
      "provider",
      0,
      "table_not_available",
      true,
    );
    return true;
  }

  const step = createStep(
    "provider.family-character-voices",
    "provider",
    voiceIds.length,
  );
  report.steps.push(step);
  if (reconciliationFailure) {
    step.status = "failed";
    step.error = toFailure(reconciliationFailure);
    return false;
  }
  const confirmedDeleted = new Set<string>();
  try {
    for (const voice of snapshot.familyCharacterVoices) {
      const queuedVoiceIds = getVoiceIds(voice);
      let allowListAbsenceConfirmation =
        voice.status === "deleting" &&
        !freshlyQueuedVoiceRows.has(voice.id) &&
        isFamilyVoiceAmbiguousAbsenceGraceElapsed(voice.updated_at);
      if (queuedVoiceIds.length > 0 && voice.status !== "deleting") {
        const { data, error } = (await client
          .from("family_character_voices")
          .update({
            status: "deleting",
            error_message: null,
            provider_voice_ids_before_attempt: null,
          })
          .eq("id", voice.id)
          .eq("user_id", userId)
          .eq("status", voice.status)
          .eq("updated_at", voice.updated_at)
          .select("id")
          .maybeSingle()) as {
          data: { id: string } | null;
          error: SupabaseLikeError | null;
        };
        if (error || !data) {
          throw new AccountDeletionOperationError(
            error?.message || "无法锁定家庭声音撤销状态。",
            {
              code: error?.code || "family-voice-provider-claim-failed",
              cause: error || undefined,
            },
          );
        }
        voice.status = "deleting";
        voice.provider_voice_ids_before_attempt = null;
        allowListAbsenceConfirmation = false;
      }
      let activeVoiceId = voice.voice_id;
      let retiredVoiceIds = Array.isArray(voice.retired_voice_ids)
        ? voice.retired_voice_ids.filter(
            (voiceId): voiceId is string => typeof voiceId === "string",
          )
        : [];
      let previousReadyVoice =
        voice.previous_ready_voice &&
        typeof voice.previous_ready_voice === "object" &&
        !Array.isArray(voice.previous_ready_voice)
          ? (voice.previous_ready_voice as Record<string, unknown>)
          : null;

      for (const voiceId of queuedVoiceIds) {
        if (!confirmedDeleted.has(voiceId)) {
          await deleteBailianClonedVoice(voiceId, {
            allowListAbsenceConfirmation,
          });
          confirmedDeleted.add(voiceId);
          step.deleted += 1;
        }
        if (activeVoiceId === voiceId) activeVoiceId = null;
        retiredVoiceIds = retiredVoiceIds.filter((id) => id !== voiceId);
        if (previousReadyVoice?.voice_id === voiceId) {
          previousReadyVoice = null;
        }
        const { data, error } = (await client
          .from("family_character_voices")
          .update({
            status: "deleting",
            voice_id: activeVoiceId,
            retired_voice_ids: retiredVoiceIds,
            previous_ready_voice: previousReadyVoice,
            provider_voice_ids_before_attempt: null,
          })
          .eq("id", voice.id)
          .eq("user_id", userId)
          .select("id")
          .maybeSingle()) as {
          data: { id: string } | null;
          error: SupabaseLikeError | null;
        };
        if (error || !data) {
          throw new AccountDeletionOperationError(
            error?.message || "无法保存家庭声音撤销进度。",
            {
              code: error?.code || "family-voice-provider-progress-save-failed",
              cause: error || undefined,
            },
          );
        }
      }
    }
    return true;
  } catch (error) {
    step.status = "failed";
    step.error = toFailure(error);
    return false;
  }
}

function getVoiceIds(voice: FamilyCharacterVoiceRow) {
  return Array.from(
    new Set([
      ...(typeof voice.voice_id === "string" ? [voice.voice_id] : []),
      ...(Array.isArray(voice.retired_voice_ids)
        ? voice.retired_voice_ids.filter(
            (voiceId): voiceId is string => typeof voiceId === "string",
          )
        : []),
      ...(voice.previous_ready_voice &&
      typeof voice.previous_ready_voice === "object" &&
      !Array.isArray(voice.previous_ready_voice) &&
      typeof (voice.previous_ready_voice as { voice_id?: unknown }).voice_id ===
        "string"
        ? [(voice.previous_ready_voice as { voice_id: string }).voice_id]
        : []),
    ]),
  );
}

async function executeDatabaseStep(
  report: AccountDeletionReport,
  client: AccountDeletionAdminClient,
  input: {
    key: string;
    table: string;
    discovered: number;
    selectColumn?: string;
    filters?: Array<["eq" | "in", string, unknown]>;
    idColumn?: string;
    ids?: string[];
    optionalTable?: boolean;
  },
) {
  const step = createStep(input.key, "database", input.discovered);
  step.optional = input.optionalTable || undefined;
  report.steps.push(step);

  if (input.optionalTable && input.ids && input.ids.length === 0 && input.discovered === 0) {
    return true;
  }

  try {
    const batches = input.ids
      ? chunk(Array.from(new Set(input.ids)), DATABASE_ID_BATCH_SIZE)
      : [null];
    for (const idBatch of batches) {
      if (Array.isArray(idBatch) && idBatch.length === 0) continue;
      let query = client.from(input.table).delete();
      query = applyFilters(query, input.filters || []);
      if (idBatch) query = query.in(input.idColumn || "id", idBatch);
      const { data, error } = (await query.select(input.selectColumn || "id")) as {
        data: Array<{ id?: string }> | null;
        error: SupabaseLikeError | null;
      };
      if (error) {
        if (input.optionalTable && isMissingOptionalTableError(error)) {
          step.status = "skipped";
          step.reason = "table_not_available";
          step.deleted = 0;
          return true;
        }
        throw new AccountDeletionOperationError(
          error.message || `无法删除 ${input.table}。`,
          { code: error.code || `delete-${input.table}-failed`, cause: error },
        );
      }
      step.deleted += Array.isArray(data)
        ? data.length
        : idBatch?.length || input.discovered;
    }
    return true;
  } catch (error) {
    step.status = "failed";
    step.error = toFailure(error);
    return false;
  }
}

function addSkippedStep(
  report: AccountDeletionReport,
  key: string,
  kind: AccountDeletionStepReport["kind"],
  discovered: number,
  reason: string,
  optional = false,
) {
  report.steps.push({
    key,
    kind,
    status: "skipped",
    discovered,
    deleted: 0,
    optional: optional || undefined,
    reason,
  });
}

async function childStoryStoragePaths(
  client: AccountDeletionAdminClient,
  userId: string,
  snapshot: DeletionSnapshot,
) {
  const bucket = client.storage.from("story-archive");
  const paths = new Set<string>();
  snapshot.savedStories.forEach((story) => {
    extractOwnedStoryAssetPaths(story.asset_manifest, userId, story.id).forEach((path) =>
      paths.add(path),
    );
  });
  snapshot.savedStoryAssets.forEach((asset) => {
    if (isOwnedStoragePath(asset.storage_path, userId, asset.saved_story_id)) {
      paths.add(asset.storage_path);
    }
  });
  for (const story of snapshot.savedStories) {
    (await listStoragePathsRecursively(bucket, `${userId}/${story.id}`)).forEach((path) =>
      paths.add(path),
    );
  }
  return Array.from(paths);
}

async function childGrowthStoragePaths(
  client: AccountDeletionAdminClient,
  userId: string,
  snapshot: DeletionSnapshot,
) {
  const bucket = client.storage.from("growth-record-photos");
  const paths = new Set<string>();
  snapshot.growthPhotos.forEach((photo) => {
    if (isOwnedStoragePath(photo.storage_path, userId, photo.growth_record_id)) {
      paths.add(photo.storage_path);
    }
  });
  for (const record of snapshot.growthRecords) {
    (
      await listStoragePathsRecursively(bucket, `${userId}/${record.id}`)
    ).forEach((path) => paths.add(path));
  }
  return Array.from(paths);
}

async function cloudBucketPaths(
  client: AccountDeletionAdminClient,
  bucketName: string,
  userId: string,
) {
  return listStoragePathsRecursively(client.storage.from(bucketName), userId);
}

async function sharedStoryStoragePaths(
  client: AccountDeletionAdminClient,
  snapshot: DeletionSnapshot,
) {
  const bucket = client.storage.from("story-shares");
  const paths = new Set<string>();
  for (const share of snapshot.sharedStories) {
    (await listStoragePathsRecursively(bucket, share.share_id)).forEach((path) =>
      paths.add(path),
    );
  }
  return Array.from(paths);
}

function createInitialReport(
  request: AccountDeletionRequest,
  now: () => Date,
): AccountDeletionReport {
  const startedAt = now().toISOString();
  return {
    version: 1,
    requestId: crypto.randomUUID(),
    scope: request.scope,
    childId: request.scope === "child" ? request.childId : undefined,
    deleteAuthUserRequested:
      request.scope === "cloud" && request.deleteAuthUser,
    authUserDeleted: false,
    status: "failed",
    retryable: true,
    startedAt,
    completedAt: startedAt,
    steps: [],
    warnings: [],
  };
}

function finalizeReport(report: AccountDeletionReport, now: () => Date) {
  report.status = getAccountDeletionReportStatus(report.steps);
  report.retryable = report.status !== "complete" && !report.authUserDeleted;
  report.completedAt = now().toISOString();
  return report;
}

async function executeChildDeletion(
  client: AccountDeletionAdminClient,
  userId: string,
  request: Extract<AccountDeletionRequest, { scope: "child" }>,
  report: AccountDeletionReport,
) {
  const snapshot = await discoverChildSnapshot(client, userId, request.childId);
  report.steps.push({
    ...createStep("discover.child", "discovery"),
    deleted: 0,
    discovered: Object.values(snapshot.counts).reduce((sum, count) => sum + count, 0),
  });

  const storageSucceeded = [
    await executeStorageStep(report, client, {
      key: "storage.story-archive",
      bucket: "story-archive",
      paths: () => childStoryStoragePaths(client, userId, snapshot),
    }),
    await executeStorageStep(report, client, {
      key: "storage.growth-record-photos",
      bucket: "growth-record-photos",
      paths: () => childGrowthStoragePaths(client, userId, snapshot),
    }),
  ].every(Boolean);

  const databasePlan = [
    {
      key: "database.growth_record_photos",
      table: "growth_record_photos",
      discovered: snapshot.counts.growth_record_photos,
      idColumn: "growth_record_id",
      ids: snapshot.growthRecords.map((record) => record.id),
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.growth_records",
      table: "growth_records",
      discovered: snapshot.counts.growth_records,
      ids: snapshot.growthRecords.map((record) => record.id),
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.saved_story_assets",
      table: "saved_story_assets",
      discovered: snapshot.counts.saved_story_assets,
      idColumn: "saved_story_id",
      ids: snapshot.savedStories.map((story) => story.id),
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
      optionalTable: true,
    },
    {
      key: "database.saved_stories",
      table: "saved_stories",
      discovered: snapshot.counts.saved_stories,
      ids: snapshot.savedStories.map((story) => story.id),
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.child_profiles",
      table: "child_profiles",
      discovered: 1,
      ids: [request.childId],
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
  ];

  if (!storageSucceeded) {
    databasePlan.forEach((step) =>
      addSkippedStep(
        report,
        step.key,
        "database",
        step.discovered,
        "blocked_by_storage_error",
        step.optionalTable,
      ),
    );
    return;
  }

  let databaseSucceeded = true;
  for (const step of databasePlan) {
    if (!databaseSucceeded) {
      addSkippedStep(
        report,
        step.key,
        "database",
        step.discovered,
        "blocked_by_database_error",
        step.optionalTable,
      );
      continue;
    }
    if (step.optionalTable && !snapshot.savedStoryAssetsAvailable) {
      addSkippedStep(
        report,
        step.key,
        "database",
        step.discovered,
        "table_not_available",
        true,
      );
      continue;
    }
    databaseSucceeded = await executeDatabaseStep(report, client, step);
  }
  addSkippedStep(report, "auth.user", "auth", 0, "not_requested");
}

async function executeCloudDeletion(
  client: AccountDeletionAdminClient,
  userId: string,
  request: Extract<AccountDeletionRequest, { scope: "cloud" }>,
  report: AccountDeletionReport,
) {
  const voiceDeletionLockAcquired = await acquireAccountVoiceDeletionLock(
    client,
    userId,
    report.requestId,
  );
  const snapshot = await discoverCloudSnapshot(client, userId);
  report.steps.push({
    ...createStep("discover.cloud", "discovery"),
    deleted: 0,
    discovered: Object.values(snapshot.counts).reduce((sum, count) => sum + count, 0),
  });

  const freshVoiceOperations = snapshot.familyCharacterVoices.filter(
    (voice) =>
      (voice.status === "processing" ||
        (voice.status === "deleting" &&
          !Array.isArray(voice.provider_voice_ids_before_attempt))) &&
      !isFamilyVoiceProcessingStale(voice.updated_at),
  );
  let providerSucceeded: boolean;
  if (freshVoiceOperations.length > 0) {
    const step = createStep(
      "provider.family-character-voices",
      "provider",
      freshVoiceOperations.length,
    );
    step.status = "failed";
    step.error = {
      code: "family-voice-operation-in-progress",
      message: "家庭声音仍在创建或删除，请稍后重试账户删除。",
      retryable: true,
    };
    report.steps.push(step);
    providerSucceeded = false;
  } else {
    providerSucceeded = await executeProviderVoiceDeletionStep(
      report,
      client,
      userId,
      snapshot,
    );
  }
  if (!providerSucceeded) {
    [
      "storage.story-archive",
      "storage.growth-record-photos",
      "storage.family-photos",
      "storage.family-voice-samples",
      "storage.story-shares",
    ].forEach((key) =>
      addSkippedStep(report, key, "storage", 0, "blocked_by_provider_error"),
    );
    [
      ["database.shared_stories", snapshot.counts.shared_stories],
      ["database.growth_record_photos", snapshot.counts.growth_record_photos],
      ["database.growth_records", snapshot.counts.growth_records],
      ["database.saved_story_assets", snapshot.counts.saved_story_assets],
      ["database.saved_stories", snapshot.counts.saved_stories],
      ["database.child_profiles", snapshot.counts.child_profiles],
      [
        "database.family_character_voices",
        snapshot.counts.family_character_voices,
      ],
      ["database.family_characters", snapshot.counts.family_characters],
      ["database.family_profiles", snapshot.counts.family_profiles],
      ["database.account_settings", snapshot.counts.account_settings],
    ].forEach(([key, discovered]) =>
      addSkippedStep(
        report,
        String(key),
        "database",
        Number(discovered),
        "blocked_by_provider_error",
      ),
    );
    addSkippedStep(
      report,
      "auth.user",
      "auth",
      request.deleteAuthUser ? 1 : 0,
      request.deleteAuthUser ? "blocked_by_provider_error" : "not_requested",
    );
    return;
  }

  const storageSucceeded = [
    await executeStorageStep(report, client, {
      key: "storage.story-archive",
      bucket: "story-archive",
      paths: () => cloudBucketPaths(client, "story-archive", userId),
    }),
    await executeStorageStep(report, client, {
      key: "storage.growth-record-photos",
      bucket: "growth-record-photos",
      paths: () => cloudBucketPaths(client, "growth-record-photos", userId),
    }),
    await executeStorageStep(report, client, {
      key: "storage.family-photos",
      bucket: "family-photos",
      paths: () => cloudBucketPaths(client, "family-photos", userId),
    }),
    await executeStorageStep(report, client, {
      key: "storage.family-voice-samples",
      bucket: "family-voice-samples",
      paths: () => cloudBucketPaths(client, "family-voice-samples", userId),
      optionalBucket: true,
    }),
    await executeStorageStep(report, client, {
      key: "storage.story-shares",
      bucket: "story-shares",
      paths: () => sharedStoryStoragePaths(client, snapshot),
    }),
  ].every(Boolean);

  const databasePlan = [
    {
      key: "database.shared_stories",
      table: "shared_stories",
      discovered: snapshot.counts.shared_stories,
      selectColumn: "share_id",
      filters: [["eq", "owner_user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.growth_record_photos",
      table: "growth_record_photos",
      discovered: snapshot.counts.growth_record_photos,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.growth_records",
      table: "growth_records",
      discovered: snapshot.counts.growth_records,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.saved_story_assets",
      table: "saved_story_assets",
      discovered: snapshot.counts.saved_story_assets,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
      optionalTable: true,
    },
    {
      key: "database.saved_stories",
      table: "saved_stories",
      discovered: snapshot.counts.saved_stories,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.child_profiles",
      table: "child_profiles",
      discovered: snapshot.counts.child_profiles,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.family_character_voices",
      table: "family_character_voices",
      discovered: snapshot.counts.family_character_voices,
      idColumn: "id",
      ids: snapshot.familyCharacterVoices.map((voice) => voice.id),
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
      optionalTable: true,
    },
    {
      key: "database.family_characters",
      table: "family_characters",
      discovered: snapshot.counts.family_characters,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.family_profiles",
      table: "family_profiles",
      discovered: snapshot.counts.family_profiles,
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
    {
      key: "database.account_settings",
      table: "account_settings",
      discovered: snapshot.counts.account_settings,
      selectColumn: "user_id",
      filters: [["eq", "user_id", userId]] as Array<["eq" | "in", string, unknown]>,
    },
  ];

  if (!storageSucceeded) {
    databasePlan.forEach((step) =>
      addSkippedStep(
        report,
        step.key,
        "database",
        step.discovered,
        "blocked_by_storage_error",
        step.optionalTable,
      ),
    );
    addSkippedStep(
      report,
      "auth.user",
      "auth",
      request.deleteAuthUser ? 1 : 0,
      request.deleteAuthUser ? "blocked_by_storage_error" : "not_requested",
    );
    return;
  }

  let databaseSucceeded = true;
  for (const step of databasePlan) {
    if (!databaseSucceeded) {
      addSkippedStep(
        report,
        step.key,
        "database",
        step.discovered,
        "blocked_by_database_error",
        step.optionalTable,
      );
      continue;
    }
    if (
      step.optionalTable &&
      ((step.table === "saved_story_assets" &&
        !snapshot.savedStoryAssetsAvailable) ||
        (step.table === "family_character_voices" &&
          !snapshot.familyCharacterVoicesAvailable))
    ) {
      addSkippedStep(
        report,
        step.key,
        "database",
        step.discovered,
        "table_not_available",
        true,
      );
      continue;
    }
    databaseSucceeded = await executeDatabaseStep(report, client, step);
  }

  if (!request.deleteAuthUser) {
    addSkippedStep(report, "auth.user", "auth", 0, "not_requested");
    if (databaseSucceeded && voiceDeletionLockAcquired) {
      const unlockStep = createStep(
        "database.account_voice_deletion_locks",
        "database",
        1,
      );
      report.steps.push(unlockStep);
      try {
        await releaseAccountVoiceDeletionLock(
          client,
          userId,
          report.requestId,
        );
        unlockStep.deleted = 1;
      } catch (error) {
        unlockStep.status = "failed";
        unlockStep.error = toFailure(error);
      }
    }
    return;
  }
  if (!databaseSucceeded) {
    addSkippedStep(report, "auth.user", "auth", 1, "blocked_by_database_error");
    return;
  }

  const authStep = createStep("auth.user", "auth", 1);
  report.steps.push(authStep);
  try {
    const { error } = await client.auth.admin.deleteUser(userId, false);
    if (error) {
      throw new AccountDeletionOperationError(
        error.message || "无法删除 Supabase Auth 用户。 ",
        { code: error.code || "auth-user-delete-failed", cause: error },
      );
    }
    authStep.deleted = 1;
    report.authUserDeleted = true;
  } catch (error) {
    authStep.status = "failed";
    authStep.error = toFailure(error);
  }
}

export async function deleteAccountData(
  client: AccountDeletionAdminClient,
  userId: string,
  request: AccountDeletionRequest,
  options: { now?: () => Date } = {},
) {
  if (!UUID_PATTERN.test(userId)) {
    throw new AccountDeletionInputError("登录用户 ID 无效。 ");
  }
  const now = options.now || (() => new Date());
  const report = createInitialReport(request, now);

  try {
    if (request.scope === "child") {
      await executeChildDeletion(client, userId, request, report);
    } else {
      await executeCloudDeletion(client, userId, request, report);
    }
  } catch (error) {
    if (error instanceof AccountDeletionNotFoundError) throw error;
    report.steps.push({
      key: "discover",
      kind: "discovery",
      status: "failed",
      discovered: 0,
      deleted: 0,
      error: toFailure(error),
    });
    if (request.scope === "cloud" && request.deleteAuthUser) {
      addSkippedStep(report, "auth.user", "auth", 1, "blocked_by_discovery_error");
    }
  }

  return finalizeReport(report, now);
}
