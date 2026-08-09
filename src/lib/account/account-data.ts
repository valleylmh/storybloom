import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export const ACCOUNT_STORAGE_BUCKETS = [
  "family-photos",
  "story-archive",
  "growth-record-photos",
] as const;

export type AccountStorageBucket = (typeof ACCOUNT_STORAGE_BUCKETS)[number];

export type AccountDataRow = Record<string, unknown>;

export type StorageReferenceKind = "character" | "story" | "growth-record";

export interface StorageReference {
  bucket: AccountStorageBucket;
  storagePath: string;
  kind: StorageReferenceKind;
  ownerId: string;
  field: string;
}

export interface AccountStorageObject {
  bucket: AccountStorageBucket;
  storagePath: string;
  fileName: string;
  entityId: string;
  archivePath: string;
  referenced: boolean;
  references: StorageReference[];
  byteSize?: number;
  contentType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AccountStorageIssueCode =
  | "invalid-reference-path"
  | "invalid-object-path"
  | "missing-object"
  | "archive-name-collision";

export interface AccountStorageIssue {
  code: AccountStorageIssueCode;
  bucket: AccountStorageBucket;
  storagePath: string;
  detail: string;
}

export interface AccountDataSnapshot {
  user: User;
  familyProfile: AccountDataRow | null;
  accountSettings: AccountDataRow | null;
  children: AccountDataRow[];
  characters: AccountDataRow[];
  stories: AccountDataRow[];
  storyAssets: AccountDataRow[];
  growthRecords: AccountDataRow[];
  growthRecordPhotos: AccountDataRow[];
  sharedStories: AccountDataRow[];
  storageObjects: AccountStorageObject[];
  storageIssues: AccountStorageIssue[];
}

export interface ListedStorageObject {
  bucket: AccountStorageBucket;
  storagePath: string;
  byteSize?: number;
  contentType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class InvalidAccountStoragePathError extends Error {
  readonly code = "invalid-account-storage-path";

  constructor(message = "账户 Storage 路径无效") {
    super(message);
    this.name = "InvalidAccountStoragePathError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function isRecord(value: unknown): value is AccountDataRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeOptionalPositiveNumber(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue
    : undefined;
}

function isSafeStorageSegment(segment: string) {
  return (
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("\\") &&
    !segment.includes("?") &&
    !segment.includes("#")
  );
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

/**
 * Validate a private account object path before passing it to Supabase or
 * putting it in a ZIP. The current schema uses exactly uid/entity/file for all
 * three account buckets; keeping this strict prevents path traversal and
 * cross-account reads when the service-role client is used.
 */
export function validateOwnedStoragePath(
  bucket: AccountStorageBucket,
  storagePath: string,
  userId: string,
) {
  if (typeof storagePath !== "string" || storagePath.length === 0) {
    throw new InvalidAccountStoragePathError("Storage 路径为空");
  }
  if (
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    /^(?:data|blob|https?):/i.test(storagePath)
  ) {
    throw new InvalidAccountStoragePathError("Storage 路径不能是 URL 或绝对路径");
  }

  const segments = storagePath.split("/");
  if (segments.length !== 3 || segments.some((segment) => !isSafeStorageSegment(segment))) {
    throw new InvalidAccountStoragePathError("Storage 路径层级或片段无效");
  }
  const [ownerSegment, entityId, fileName] = segments;
  if (ownerSegment !== userId) {
    throw new InvalidAccountStoragePathError("Storage 路径不属于当前账户");
  }
  if (!UUID_PATTERN.test(entityId)) {
    throw new InvalidAccountStoragePathError("Storage 路径中的实体 ID 无效");
  }

  const extension = getFileExtension(fileName);
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new InvalidAccountStoragePathError("账户图片文件类型无效");
  }
  if (
    (bucket === "story-archive" || bucket === "growth-record-photos") &&
    extension !== "webp"
  ) {
    throw new InvalidAccountStoragePathError("绘本或成长图片必须是 WebP");
  }

  return { ownerId: ownerSegment, entityId, fileName };
}

export function sanitizeArchiveFileName(fileName: string) {
  const sanitized = fileName
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+$/, "_")
    .slice(0, 120);
  return sanitized || "object";
}

function bucketArchiveFolder(bucket: AccountStorageBucket) {
  switch (bucket) {
    case "family-photos":
      return "photos/characters";
    case "story-archive":
      return "photos/stories";
    case "growth-record-photos":
      return "photos/growth-records";
  }
}

function bucketOrphanFolder(bucket: AccountStorageBucket) {
  return `photos/orphans/${bucket}`;
}

function storageKey(bucket: AccountStorageBucket, storagePath: string) {
  return `${bucket}:${storagePath}`;
}

function archivePathForObject(
  bucket: AccountStorageBucket,
  entityId: string,
  fileName: string,
  referenced: boolean,
) {
  const folder = referenced ? bucketArchiveFolder(bucket) : bucketOrphanFolder(bucket);
  return `${folder}/${entityId}/${sanitizeArchiveFileName(fileName)}`;
}

export function getStorageArchivePath(
  bucket: AccountStorageBucket,
  storagePath: string,
  userId: string,
) {
  const parsed = validateOwnedStoragePath(bucket, storagePath, userId);
  return archivePathForObject(bucket, parsed.entityId, parsed.fileName, true);
}

function getStorageObjectMetadata(item: unknown) {
  if (!isRecord(item)) return {};
  const metadata = isRecord(item.metadata) ? item.metadata : {};
  const byteSize = normalizeOptionalPositiveNumber(
    metadata.size ?? metadata.contentLength,
  );
  const contentType =
    typeof metadata.mimetype === "string"
      ? metadata.mimetype
      : typeof metadata.contentType === "string"
        ? metadata.contentType
        : undefined;
  return {
    byteSize,
    contentType,
    createdAt: typeof item.created_at === "string" ? item.created_at : undefined,
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : undefined,
  };
}

function isStorageFolderEntry(item: unknown) {
  if (!isRecord(item)) return false;
  // Supabase represents folders with a null id and null metadata. Keep the
  // second condition for lightweight mocks and older SDK responses.
  return item.id === null || (item.id == null && item.metadata == null);
}

export function isOptionalRelationMissing(error: unknown) {
  if (!error) return false;
  const value = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof value.code === "string" ? value.code : "";
  const message = [value.message, value.details]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  );
}

async function readOwnedRows(
  supabase: SupabaseClient<any>,
  table: string,
  ownerColumn: string,
  userId: string,
  options: { select?: string; orderColumn?: string } = {},
) {
  const rows: AccountDataRow[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(options.select || "*")
      .eq(ownerColumn, userId)
      .order(options.orderColumn || "id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = Array.isArray(data)
      ? (data as unknown as AccountDataRow[])
      : [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }

  return rows;
}

async function readOptionalOwnedRows(
  supabase: SupabaseClient<any>,
  table: string,
  ownerColumn: string,
  userId: string,
  options: { select?: string; orderColumn?: string } = {},
) {
  try {
    return await readOwnedRows(supabase, table, ownerColumn, userId, options);
  } catch (error) {
    if (isOptionalRelationMissing(error)) return [];
    throw error;
  }
}

async function readOptionalSingle(
  supabase: SupabaseClient<any>,
  table: string,
  ownerColumn: string,
  userId: string,
) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(ownerColumn, userId)
      .maybeSingle();
    if (error) throw error;
    return (data || null) as AccountDataRow | null;
  } catch (error) {
    if (isOptionalRelationMissing(error)) return null;
    throw error;
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getManifestPaths(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.pages)) return [];
  return value.pages.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const path = getString(entry.storagePath) || getString(entry.storage_path);
    return path ? [path] : [];
  });
}

function buildStorageReferences(
  userId: string,
  characters: AccountDataRow[],
  stories: AccountDataRow[],
  storyAssets: AccountDataRow[],
  growthRecords: AccountDataRow[],
  growthPhotos: AccountDataRow[],
) {
  const references: StorageReference[] = [];
  const add = (
    bucket: AccountStorageBucket,
    path: unknown,
    kind: StorageReferenceKind,
    ownerId: unknown,
    field: string,
  ) => {
    const storagePath = getString(path);
    const id = getString(ownerId);
    if (storagePath && id) {
      references.push({ bucket, storagePath, kind, ownerId: id, field });
    }
  };

  characters.forEach((row) => {
    add("family-photos", row.source_photo_path, "character", row.id, "sourcePhoto");
    add(
      "family-photos",
      row.canonical_photo_path,
      "character",
      row.id,
      "canonicalPhoto",
    );
  });
  stories.forEach((row) => {
    getManifestPaths(row.asset_manifest).forEach((path) =>
      add("story-archive", path, "story", row.id, "assetManifest"),
    );
  });
  storyAssets.forEach((row) =>
    add("story-archive", row.storage_path, "story", row.saved_story_id || row.id, "asset"),
  );
  growthPhotos.forEach((row) =>
    add("growth-record-photos", row.storage_path, "growth-record", row.growth_record_id, "photo"),
  );

  // Keep the user id in this helper's signature so future references cannot be
  // accidentally assembled from another account. The actual validation is
  // performed by buildStorageInventory below.
  void userId;
  return references;
}

export function buildStorageInventory(
  userId: string,
  listedObjects: ListedStorageObject[],
  references: StorageReference[],
) {
  const issues: AccountStorageIssue[] = [];
  const referenceMap = new Map<string, StorageReference[]>();

  references.forEach((reference) => {
    try {
      validateOwnedStoragePath(reference.bucket, reference.storagePath, userId);
      const key = storageKey(reference.bucket, reference.storagePath);
      const current = referenceMap.get(key) || [];
      current.push(reference);
      referenceMap.set(key, current);
    } catch (error) {
      issues.push({
        code: "invalid-reference-path",
        bucket: reference.bucket,
        storagePath: reference.storagePath,
        detail: error instanceof Error ? error.message : "路径校验失败",
      });
    }
  });

  const sortedObjects = [...listedObjects].sort((a, b) =>
    storageKey(a.bucket, a.storagePath).localeCompare(storageKey(b.bucket, b.storagePath)),
  );
  const seenObjectKeys = new Set<string>();
  const seenReferences = new Set<string>();
  const usedArchivePaths = new Set<string>();
  const objects: AccountStorageObject[] = [];

  sortedObjects.forEach((listed) => {
    const key = storageKey(listed.bucket, listed.storagePath);
    if (seenObjectKeys.has(key)) return;
    seenObjectKeys.add(key);

    let parsed: ReturnType<typeof validateOwnedStoragePath>;
    try {
      parsed = validateOwnedStoragePath(listed.bucket, listed.storagePath, userId);
    } catch (error) {
      issues.push({
        code: "invalid-object-path",
        bucket: listed.bucket,
        storagePath: listed.storagePath,
        detail: error instanceof Error ? error.message : "路径校验失败",
      });
      return;
    }

    const matchingReferences = referenceMap.get(key) || [];
    matchingReferences.forEach(() => seenReferences.add(key));
    const referenced = matchingReferences.length > 0;
    let archivePath = archivePathForObject(
      listed.bucket,
      parsed.entityId,
      parsed.fileName,
      referenced,
    );
    if (usedArchivePaths.has(archivePath)) {
      const extension = getFileExtension(archivePath);
      const stem = extension ? archivePath.slice(0, -(extension.length + 1)) : archivePath;
      let suffix = 2;
      while (usedArchivePaths.has(`${stem}-${suffix}${extension ? `.${extension}` : ""}`)) {
        suffix += 1;
      }
      archivePath = `${stem}-${suffix}${extension ? `.${extension}` : ""}`;
      issues.push({
        code: "archive-name-collision",
        bucket: listed.bucket,
        storagePath: listed.storagePath,
        detail: `ZIP 文件名已重命名为 ${archivePath}`,
      });
    }
    usedArchivePaths.add(archivePath);
    objects.push({
      bucket: listed.bucket,
      storagePath: listed.storagePath,
      fileName: parsed.fileName,
      entityId: parsed.entityId,
      archivePath,
      referenced,
      references: matchingReferences,
      byteSize: listed.byteSize,
      contentType: listed.contentType,
      createdAt: listed.createdAt,
      updatedAt: listed.updatedAt,
    });
  });

  referenceMap.forEach((matchingReferences, key) => {
    if (seenReferences.has(key)) return;
    const [bucket, ...pathParts] = key.split(":");
    const storagePath = pathParts.join(":");
    if (!ACCOUNT_STORAGE_BUCKETS.includes(bucket as AccountStorageBucket)) return;
    issues.push({
      code: "missing-object",
      bucket: bucket as AccountStorageBucket,
      storagePath,
      detail: `数据库引用的对象不存在（${matchingReferences.map((reference) => reference.field).join(", ")}）`,
    });
  });

  return { objects, issues };
}

function getListedItemPath(prefix: string, name: string) {
  if (!isSafeStorageSegment(name)) {
    throw new InvalidAccountStoragePathError("Storage 文件夹名称无效");
  }
  return `${prefix}/${name}`;
}

async function listStorageFolder(
  supabase: SupabaseClient<any>,
  bucket: AccountStorageBucket,
  prefix: string,
  result: ListedStorageObject[],
  visitedFolders: Set<string>,
) {
  if (visitedFolders.has(prefix)) return;
  visitedFolders.add(prefix);
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    for (const item of page) {
      const name = isRecord(item) && typeof item.name === "string" ? item.name : "";
      if (!name) continue;
      const path = getListedItemPath(prefix, name);
      if (isStorageFolderEntry(item)) {
        await listStorageFolder(supabase, bucket, path, result, visitedFolders);
        continue;
      }
      const metadata = getStorageObjectMetadata(item);
      result.push({ bucket, storagePath: path, ...metadata });
    }
    if (page.length < pageSize) break;
    offset += page.length;
  }
}

export async function listUserStorageObjects(
  supabase: SupabaseClient<any>,
  userId: string,
  bucket: AccountStorageBucket,
) {
  const result: ListedStorageObject[] = [];
  await listStorageFolder(supabase, bucket, userId, result, new Set());
  return result;
}

export async function readAccountData(
  supabase: SupabaseClient<any>,
  user: User,
): Promise<AccountDataSnapshot> {
  const userId = user.id;
  const [familyProfile, accountSettings, children, characters, stories, storyAssets, growthRecords, growthRecordPhotos, sharedStories] =
    await Promise.all([
      readOptionalSingle(supabase, "family_profiles", "user_id", userId),
      readOptionalSingle(supabase, "account_settings", "user_id", userId),
      readOwnedRows(supabase, "child_profiles", "user_id", userId),
      readOwnedRows(supabase, "family_characters", "user_id", userId),
      readOwnedRows(supabase, "saved_stories", "user_id", userId),
      readOptionalOwnedRows(supabase, "saved_story_assets", "user_id", userId),
      readOwnedRows(supabase, "growth_records", "user_id", userId),
      readOwnedRows(supabase, "growth_record_photos", "user_id", userId),
      readOptionalOwnedRows(
        supabase,
        "shared_stories",
        "owner_user_id",
        userId,
        { select: "share_id,story,owner_user_id,created_at", orderColumn: "share_id" },
      ),
    ]);

  const references = buildStorageReferences(
    userId,
    characters,
    stories,
    storyAssets,
    growthRecords,
    growthRecordPhotos,
  );
  const listedByBucket = await Promise.all(
    ACCOUNT_STORAGE_BUCKETS.map((bucket) =>
      listUserStorageObjects(supabase, userId, bucket),
    ),
  );
  const inventory = buildStorageInventory(
    userId,
    listedByBucket.flat(),
    references,
  );

  return {
    user,
    familyProfile,
    accountSettings,
    children,
    characters,
    stories,
    storyAssets,
    growthRecords,
    growthRecordPhotos,
    sharedStories,
    storageObjects: inventory.objects,
    storageIssues: inventory.issues,
  };
}
