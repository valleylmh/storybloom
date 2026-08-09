import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createZipBlob } from "@/lib/client-zip";
import {
  type AccountDataRow,
  type AccountDataSnapshot,
  type AccountStorageBucket,
  type AccountStorageObject,
  getStorageArchivePath,
} from "@/lib/account/account-data";

export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1 as const;

export interface AccountExportEntry {
  name: string;
  data: Blob | Uint8Array | string;
}

export interface AccountExportDownloadFailure {
  bucket: AccountStorageBucket;
  storagePath: string;
  detail: string;
}

export interface AccountExportReport {
  schemaVersion: typeof ACCOUNT_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  status: "complete" | "partial";
  storageObjects: {
    total: number;
    referenced: number;
    orphaned: number;
    downloaded: number;
    failed: number;
  };
  issues: unknown[];
}

const SENSITIVE_KEYS = new Set([
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "service_role_key",
  "serviceRoleKey",
  "delete_token",
  "deleteToken",
  "characterReferenceId",
  "character_reference_id",
  "confirm_token_hash",
  "unsubscribe_token_hash",
  "authorization",
  "cookie",
  "password",
  "secret",
]);

function isRecord(value: unknown): value is AccountDataRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeText(value: string) {
  return value
    .replace(/data:[^\s"'<>]+/gi, "[removed]")
    .replace(
      /https?:\/\/[^\s"'<>]*(?:token|signature|secret|key)=[^\s"'<>]*/gi,
      "[removed]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [removed]");
}

function isSensitiveKey(key: string) {
  return (
    SENSITIVE_KEYS.has(key) ||
    /(?:^|_)(?:token|secret|password|credential)(?:$|_)/i.test(key)
  );
}

/** Recursively remove credentials and scrub accidental signed/data URLs. */
export function redactSensitiveExportValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(redactSensitiveExportValue);
  if (!isRecord(value)) return value;

  const result: AccountDataRow = {};
  Object.entries(value).forEach(([key, nested]) => {
    if (isSensitiveKey(key)) return;
    result[key] = redactSensitiveExportValue(nested);
  });
  return result;
}

function json(value: unknown) {
  return `${JSON.stringify(redactSensitiveExportValue(value), null, 2)}\n`;
}

function getString(row: AccountDataRow | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : undefined;
}

function getBoolean(row: AccountDataRow | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function getNumber(row: AccountDataRow | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getStorageObject(
  snapshot: AccountDataSnapshot,
  bucket: AccountStorageBucket,
  storagePath: unknown,
) {
  if (typeof storagePath !== "string" || storagePath.length === 0) return undefined;
  return snapshot.storageObjects.find(
    (object) => object.bucket === bucket && object.storagePath === storagePath,
  );
}

function storageRef(
  snapshot: AccountDataSnapshot,
  bucket: AccountStorageBucket,
  storagePath: unknown,
) {
  if (typeof storagePath !== "string" || storagePath.length === 0) return null;
  const object = getStorageObject(snapshot, bucket, storagePath);
  return {
    bucket,
    storagePath,
    exportPath: object?.archivePath || null,
    available: Boolean(object),
  };
}

function mapFamilyProfile(row: AccountDataRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    locale: row.locale,
    guardianConsentAt: row.guardian_consent_at,
    guardianConsentVersion: row.guardian_consent_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccountSettings(row: AccountDataRow | null) {
  if (!row) return null;
  return {
    cloudSyncEnabled: getBoolean(row, "cloud_sync_enabled") ?? false,
    retentionDays: getNumber(row, "retention_days") ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChild(row: AccountDataRow) {
  return {
    id: row.id,
    familyProfileId: row.family_profile_id,
    clientChildId: row.client_child_id,
    displayName: row.display_name,
    primaryCharacterId: row.primary_character_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCharacter(snapshot: AccountDataSnapshot, row: AccountDataRow) {
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    relationship: row.relationship,
    kind: row.kind,
    description: row.description,
    sourcePhoto: storageRef(snapshot, "family-photos", row.source_photo_path),
    canonicalPhoto: storageRef(
      snapshot,
      "family-photos",
      row.canonical_photo_path,
    ),
    sourceCrop: row.source_crop,
    canonicalCrop: row.canonical_crop,
    cartoonize: getBoolean(row, "cartoonize"),
    canonicalGenerationCount: getNumber(row, "canonical_generation_count"),
    status: row.status,
    errorMessage:
      typeof row.error_message === "string"
        ? sanitizeText(row.error_message)
        : row.error_message,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVoice(snapshot: AccountDataSnapshot, row: AccountDataRow) {
  return {
    id: row.id,
    familyCharacterId: row.family_character_id,
    profileId: row.profile_id,
    sampleAudio: storageRef(
      snapshot,
      "family-voice-samples",
      row.sample_audio_path,
    ),
    sampleDurationSeconds: row.sample_duration_seconds,
    // A voice_id is account data, not a credential. It is intentionally kept
    // in this authenticated private export so the enrollment can be audited.
    voiceId: getString(row, "voice_id") ?? null,
    targetModel: row.target_model,
    status: row.status,
    errorMessage:
      typeof row.error_message === "string"
        ? sanitizeText(row.error_message)
        : row.error_message,
    consentConfirmedAt: row.consent_confirmed_at,
    consentVersion: row.consent_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function storyAssetsFor(snapshot: AccountDataSnapshot, storyId: unknown) {
  if (typeof storyId !== "string") return [];
  return snapshot.storageObjects
    .filter(
      (object) =>
        object.bucket === "story-archive" &&
        object.references.some(
          (reference) => reference.kind === "story" && reference.ownerId === storyId,
        ),
    )
    .map((object) => ({
      bucket: object.bucket,
      storagePath: object.storagePath,
      exportPath: object.archivePath,
      available: true,
      byteSize: object.byteSize,
      contentType: object.contentType,
      references: object.references.map((reference) => reference.field),
    }));
}

function mapStory(snapshot: AccountDataSnapshot, row: AccountDataRow) {
  const id = row.id;
  const normalizedAssets = snapshot.storyAssets
    .filter((asset) => asset.saved_story_id === id)
    .map((asset) => ({
      id: asset.id,
      assetKey: asset.asset_key,
      storagePath: asset.storage_path,
      mimeType: asset.mime_type,
      byteSize: asset.byte_size,
      checksumSha256: asset.checksum_sha256,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
      exportPath: storageRef(snapshot, "story-archive", asset.storage_path)?.exportPath || null,
    }));
  return {
    id,
    childProfileId: row.child_profile_id,
    clientStoryId: row.client_story_id,
    title: row.title,
    status: row.status,
    storySnapshot: row.story_snapshot,
    assetManifest: row.asset_manifest,
    assets: normalizedAssets.length > 0 ? normalizedAssets : storyAssetsFor(snapshot, id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGrowthRecord(snapshot: AccountDataSnapshot, row: AccountDataRow) {
  const id = row.id;
  const photos = snapshot.growthRecordPhotos
    .filter((photo) => photo.growth_record_id === id)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((photo) => ({
      id: photo.id,
      clientPhotoId: photo.client_photo_id,
      originalName: photo.original_name,
      sortOrder: photo.sort_order,
      mimeType: photo.mime_type,
      byteSize: photo.byte_size,
      checksumSha256: photo.checksum_sha256,
      storagePath: photo.storage_path,
      exportPath: storageRef(snapshot, "growth-record-photos", photo.storage_path)?.exportPath || null,
      createdAt: photo.created_at,
      updatedAt: photo.updated_at,
    }));
  return {
    id,
    childProfileId: row.child_profile_id,
    savedStoryId: row.saved_story_id,
    clientRecordId: row.client_record_id,
    occurredOn: row.occurred_on,
    note: row.note,
    idea: row.idea,
    photos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStorageIndex(snapshot: AccountDataSnapshot) {
  return snapshot.storageObjects.map((object) => ({
    bucket: object.bucket,
    storagePath: object.storagePath,
    exportPath: object.archivePath,
    referenced: object.referenced,
    references: object.references.map((reference) => ({
      kind: reference.kind,
      ownerId: reference.ownerId,
      field: reference.field,
    })),
    byteSize: object.byteSize,
    contentType: object.contentType,
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
  }));
}

function getShanghaiDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getAccountExportFilename(date = new Date()) {
  return `storybloom-export-${getShanghaiDateKey(date)}.zip`;
}

export function buildAccountExportEntries(
  snapshot: AccountDataSnapshot,
  exportedAt = new Date().toISOString(),
): AccountExportEntry[] {
  const profile = {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    exportedAt,
    account: {
      id: snapshot.user.id,
      email: snapshot.user.email || null,
      emailConfirmedAt: snapshot.user.email_confirmed_at || null,
      createdAt: snapshot.user.created_at || null,
      updatedAt: snapshot.user.updated_at || null,
      lastSignInAt: snapshot.user.last_sign_in_at || null,
    },
    familyProfile: mapFamilyProfile(snapshot.familyProfile),
    accountSettings: mapAccountSettings(snapshot.accountSettings),
    counts: {
      children: snapshot.children.length,
      characters: snapshot.characters.length,
      voices: snapshot.voices.length,
      stories: snapshot.stories.length,
      growthRecords: snapshot.growthRecords.length,
      storageObjects: snapshot.storageObjects.length,
    },
    storageIssues: snapshot.storageIssues,
  };
  const entries: AccountExportEntry[] = [
    { name: "profile.json", data: json(profile) },
    {
      name: "children.json",
      data: json(snapshot.children.map(mapChild)),
    },
    {
      name: "characters.json",
      data: json(snapshot.characters.map((row) => mapCharacter(snapshot, row))),
    },
    {
      name: "voices.json",
      data: json(snapshot.voices.map((row) => mapVoice(snapshot, row))),
    },
    {
      name: "stories/index.json",
      data: json(
        snapshot.stories.map((row) => ({
          id: row.id,
          clientStoryId: row.client_story_id,
          childProfileId: row.child_profile_id,
          title: row.title,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          file: `stories/${String(row.id)}.json`,
        })),
      ),
    },
    {
      name: "stories/shared.json",
      data: json(snapshot.sharedStories),
    },
    {
      name: "growth-records/index.json",
      data: json(
        snapshot.growthRecords.map((row) => ({
          id: row.id,
          clientRecordId: row.client_record_id,
          childProfileId: row.child_profile_id,
          occurredOn: row.occurred_on,
          file: `growth-records/${String(row.id)}.json`,
        })),
      ),
    },
    {
      name: "photos/index.json",
      data: json({
        schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
        objects: mapStorageIndex(snapshot),
        issues: snapshot.storageIssues,
      }),
    },
  ];

  snapshot.stories.forEach((row) => {
    entries.push({
      name: `stories/${String(row.id)}.json`,
      data: json(mapStory(snapshot, row)),
    });
  });
  snapshot.growthRecords.forEach((row) => {
    entries.push({
      name: `growth-records/${String(row.id)}.json`,
      data: json(mapGrowthRecord(snapshot, row)),
    });
  });

  return entries;
}

export async function createAccountExport(
  supabase: SupabaseClient<any>,
  snapshot: AccountDataSnapshot,
  options: { exportedAt?: string } = {},
) {
  const exportedAt = options.exportedAt || new Date().toISOString();
  const entries = buildAccountExportEntries(snapshot, exportedAt);
  const usedEntryNames = new Set(entries.map((entry) => entry.name));
  const failures: AccountExportDownloadFailure[] = [];
  let downloaded = 0;

  for (const object of snapshot.storageObjects) {
    if (usedEntryNames.has(object.archivePath)) {
      failures.push({
        bucket: object.bucket,
        storagePath: object.storagePath,
        detail: "ZIP 路径与元数据文件冲突，已跳过对象",
      });
      continue;
    }
    const { data, error } = await supabase.storage
      .from(object.bucket)
      .download(object.storagePath);
    if (error || !data) {
      failures.push({
        bucket: object.bucket,
        storagePath: object.storagePath,
        detail: error?.message || "Storage 对象下载失败",
      });
      continue;
    }
    entries.push({ name: object.archivePath, data });
    usedEntryNames.add(object.archivePath);
    downloaded += 1;
  }

  const report: AccountExportReport = {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    exportedAt,
    status: failures.length === 0 && snapshot.storageIssues.length === 0 ? "complete" : "partial",
    storageObjects: {
      total: snapshot.storageObjects.length,
      referenced: snapshot.storageObjects.filter((object) => object.referenced).length,
      orphaned: snapshot.storageObjects.filter((object) => !object.referenced).length,
      downloaded,
      failed: failures.length,
    },
    issues: [
      ...snapshot.storageIssues,
      ...failures,
    ],
  };
  entries.push({ name: "export-report.json", data: json(report) });

  const blob = await createZipBlob(entries);
  return {
    blob,
    fileName: getAccountExportFilename(new Date(exportedAt)),
    report,
  };
}
