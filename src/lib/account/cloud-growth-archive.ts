import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createZipBlob } from "@/lib/client-zip";
import {
  DELETE_ALL_CLOUD_GROWTH_CONFIRMATION,
  DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
  isCloudGrowthRetentionDays,
  type CloudGrowthArchiveDeleteRequest,
  type CloudGrowthArchiveSummary,
  type CloudGrowthRetentionDays,
} from "@/lib/account/cloud-growth-archive-contract";
import { isOptionalRelationMissing } from "@/lib/account/account-data";
import { redactSensitiveExportValue } from "@/lib/account/account-export";

const GROWTH_ASSET_BUCKET = "growth-record-photos" as const;
const PAGE_SIZE = 500;
const DELETE_BATCH_SIZE = 200;
const STORAGE_BATCH_SIZE = 100;

type AccountRow = Record<string, unknown>;

interface OptionalRows {
  available: boolean;
  rows: AccountRow[];
}

export interface CloudGrowthArchiveSnapshot {
  userId: string;
  retentionDays: CloudGrowthRetentionDays;
  children: AccountRow[];
  savedStories: AccountRow[];
  savedStoryAssets: AccountRow[];
  legacyRecords: AccountRow[];
  legacyPhotos: AccountRow[];
  growthMoments: AccountRow[];
  growthMomentAssets: AccountRow[];
  storybookVersions: AccountRow[];
  foundationAvailable: boolean;
}

export interface CloudGrowthArchiveDownloadSpec {
  bucket: typeof GROWTH_ASSET_BUCKET | "story-archive";
  storagePath: string;
  exportPath: string;
}

export interface CloudGrowthArchiveExportBuild {
  archive: Record<string, unknown>;
  entries: Array<{ name: string; data: Blob | Uint8Array | string }>;
  downloads: CloudGrowthArchiveDownloadSpec[];
}

export interface CloudGrowthArchiveDeletionReport {
  version: 1;
  scope: CloudGrowthArchiveDeleteRequest["scope"];
  status: "complete" | "partial" | "failed";
  cutoffDate?: string;
  discovered: {
    legacyGrowthRecords: number;
    growthMoments: number;
    storageObjects: number;
  };
  deleted: {
    legacyGrowthRecords: number;
    growthMoments: number;
    storageObjects: number;
  };
  warnings: string[];
}

export class CloudGrowthArchiveInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "CloudGrowthArchiveInputError";
  }
}

function getString(row: AccountRow | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : undefined;
}

function getStringArray(row: AccountRow | undefined, key: string) {
  const value = row?.[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function getPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function sanitizeText(value: unknown) {
  return typeof value === "string"
    ? (redactSensitiveExportValue(value) as string)
    : undefined;
}

function json(value: unknown) {
  return `${JSON.stringify(redactSensitiveExportValue(value), null, 2)}\n`;
}

async function readOwnedRows(
  supabase: SupabaseClient<any>,
  table: string,
  userId: string,
) {
  const rows: AccountRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as AccountRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    offset += page.length;
  }
}

async function readOptionalOwnedRows(
  supabase: SupabaseClient<any>,
  table: string,
  userId: string,
): Promise<OptionalRows> {
  try {
    return { available: true, rows: await readOwnedRows(supabase, table, userId) };
  } catch (error) {
    if (isOptionalRelationMissing(error)) return { available: false, rows: [] };
    throw error;
  }
}

async function readOwnedRowsByIds(
  supabase: SupabaseClient<any>,
  table: string,
  userId: string,
  column: string,
  ids: string[],
  optional = false,
) {
  const rows: AccountRow[] = [];
  for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
    const batch = ids.slice(index, index + DELETE_BATCH_SIZE);
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .in(column, batch)
      .order("id", { ascending: true });
    if (error) {
      if (optional && isOptionalRelationMissing(error)) return [];
      throw error;
    }
    rows.push(...((data || []) as AccountRow[]));
  }
  return rows;
}

async function readRetentionDays(
  supabase: SupabaseClient<any>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("account_settings")
    .select("retention_days")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return getPositiveInteger(data?.retention_days);
}

export async function readCloudGrowthArchiveSnapshot(
  supabase: SupabaseClient<any>,
  userId: string,
  options: { includeExportData?: boolean } = {},
): Promise<CloudGrowthArchiveSnapshot> {
  const [
    retentionDays,
    legacyRecords,
    legacyPhotos,
    moments,
    momentAssets,
    versions,
  ] = await Promise.all([
    readRetentionDays(supabase, userId),
    readOwnedRows(supabase, "growth_records", userId),
    readOwnedRows(supabase, "growth_record_photos", userId),
    readOptionalOwnedRows(supabase, "growth_moments", userId),
    readOptionalOwnedRows(supabase, "growth_moment_assets", userId),
    readOptionalOwnedRows(supabase, "storybook_versions", userId),
  ]);

  const childIds = Array.from(
    new Set(
      [...legacyRecords, ...moments.rows].flatMap((row) => {
        const id = getString(row, "child_profile_id");
        return id ? [id] : [];
      }),
    ),
  );
  const storyIds = Array.from(
    new Set(
      [...legacyRecords, ...versions.rows].flatMap((row) => {
        const id = getString(row, "saved_story_id");
        return id ? [id] : [];
      }),
    ),
  );
  const [children, savedStories, savedStoryAssets] = options.includeExportData
    ? await Promise.all([
        readOwnedRowsByIds(
          supabase,
          "child_profiles",
          userId,
          "id",
          childIds,
        ),
        readOwnedRowsByIds(
          supabase,
          "saved_stories",
          userId,
          "id",
          storyIds,
        ),
        readOwnedRowsByIds(
          supabase,
          "saved_story_assets",
          userId,
          "saved_story_id",
          storyIds,
          true,
        ),
      ])
    : [[], [], []];

  return {
    userId,
    retentionDays,
    children,
    savedStories,
    savedStoryAssets,
    legacyRecords,
    legacyPhotos,
    growthMoments: moments.rows,
    growthMomentAssets: momentAssets.rows,
    storybookVersions: versions.rows,
    foundationAvailable:
      moments.available && momentAssets.available && versions.available,
  };
}

function getDateParts(date: Date, timeZone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function toDateKey(date: Date) {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getCloudGrowthRetentionCutoff(
  retentionDays: CloudGrowthRetentionDays,
  now = new Date(),
  timeZone = "UTC",
) {
  if (!retentionDays) return undefined;
  const { year, month, day } = getDateParts(now, timeZone);
  const years =
    retentionDays === 365
      ? 1
      : retentionDays === 1095
        ? 3
        : retentionDays === 1825
          ? 5
          : undefined;
  if (years) {
    const lastDay = new Date(Date.UTC(year - years, month, 0)).getUTCDate();
    return toDateKey(
      new Date(Date.UTC(year - years, month - 1, Math.min(day, lastDay))),
    );
  }
  const cutoff = new Date(Date.UTC(year, month - 1, day));
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return toDateKey(cutoff);
}

function representedLegacyRecordIds(snapshot: CloudGrowthArchiveSnapshot) {
  return new Set(
    snapshot.growthMoments.flatMap((moment) => {
      const id = getString(moment, "legacy_growth_record_id");
      return id ? [id] : [];
    }),
  );
}

function visibleLegacyRecords(snapshot: CloudGrowthArchiveSnapshot) {
  const represented = representedLegacyRecordIds(snapshot);
  return snapshot.legacyRecords.filter(
    (record) => !represented.has(getString(record, "id") || ""),
  );
}

function countArchiveSet(
  snapshot: CloudGrowthArchiveSnapshot,
  legacyRecords: AccountRow[],
  growthMoments: AccountRow[],
) {
  const legacyIds = new Set(
    legacyRecords.flatMap((record) => {
      const id = getString(record, "id");
      return id ? [id] : [];
    }),
  );
  const momentIds = new Set(
    growthMoments.flatMap((moment) => {
      const id = getString(moment, "id");
      return id ? [id] : [];
    }),
  );
  return {
    moments: legacyRecords.length + growthMoments.length,
    photos:
      snapshot.legacyPhotos.filter((photo) =>
        legacyIds.has(getString(photo, "growth_record_id") || ""),
      ).length +
      snapshot.growthMomentAssets.filter((asset) =>
        momentIds.has(getString(asset, "growth_moment_id") || ""),
      ).length,
    storybookVersions:
      legacyRecords.filter((record) => Boolean(getString(record, "saved_story_id")))
        .length +
      snapshot.storybookVersions.filter((version) =>
        momentIds.has(getString(version, "growth_moment_id") || ""),
      ).length,
  };
}

export function summarizeCloudGrowthArchive(
  snapshot: CloudGrowthArchiveSnapshot,
  now = new Date(),
  timeZone = "UTC",
): CloudGrowthArchiveSummary {
  const legacyRecords = visibleLegacyRecords(snapshot);
  const cutoffDate = getCloudGrowthRetentionCutoff(
    snapshot.retentionDays,
    now,
    timeZone,
  );
  const expiredLegacy = cutoffDate
    ? legacyRecords.filter(
        (record) => (getString(record, "occurred_on") || "") <= cutoffDate,
      )
    : [];
  const expiredMoments = cutoffDate
    ? snapshot.growthMoments.filter(
        (moment) => (getString(moment, "occurred_on") || "") <= cutoffDate,
      )
    : [];
  const childIds = new Set(
    [...legacyRecords, ...snapshot.growthMoments].flatMap((row) => {
      const id = getString(row, "child_profile_id");
      return id ? [id] : [];
    }),
  );

  return {
    version: 1,
    source: "private-cloud",
    retentionDays: snapshot.retentionDays,
    ...(cutoffDate ? { cutoffDate } : {}),
    counts: {
      children: childIds.size,
      legacyGrowthRecords: legacyRecords.length,
      growthMoments: snapshot.growthMoments.length,
      ...countArchiveSet(snapshot, legacyRecords, snapshot.growthMoments),
    },
    expired: countArchiveSet(snapshot, expiredLegacy, expiredMoments),
    foundation: snapshot.foundationAvailable ? "available" : "not-deployed",
    productionVerified: false,
  };
}

function portableStorySnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const story = value as AccountRow;
  const input =
    story.input && typeof story.input === "object" && !Array.isArray(story.input)
      ? (story.input as AccountRow)
      : {};
  const pages = Array.isArray(story.pages) ? story.pages : [];
  return redactSensitiveExportValue({
    version: story.version,
    storyId: sanitizeText(story.storyId),
    coverTitle: sanitizeText(story.coverTitle),
    input: {
      childName: sanitizeText(input.childName),
      narrativePerspective: input.narrativePerspective,
      ageGroup: input.ageGroup,
      favoriteToy: sanitizeText(input.favoriteToy),
      favoriteFood: sanitizeText(input.favoriteFood),
      bestFriend: sanitizeText(input.bestFriend),
      otherDetails: sanitizeText(input.otherDetails),
      theme: input.theme,
      customTheme: sanitizeText(input.customTheme),
      parentFacts: sanitizeText(input.parentFacts),
      allowedImaginations: sanitizeText(input.allowedImaginations),
      storyTreatment: input.storyTreatment,
      style: input.style,
      language: input.language,
      dedication: sanitizeText(input.dedication),
    },
    pages: pages.flatMap((page) => {
      if (!page || typeof page !== "object" || Array.isArray(page)) return [];
      const row = page as AccountRow;
      return [
        {
          page: row.page,
          zhText: sanitizeText(row.zhText),
          enText: sanitizeText(row.enText),
          illustrationPrompt: sanitizeText(row.illustrationPrompt),
          imageStatus: row.imageStatus,
        },
      ];
    }),
    totalPages: story.totalPages,
    generationMode: story.generationMode,
  });
}

function extractStoragePaths(value: unknown) {
  const paths = new Set<string>();
  const visit = (entry: unknown, depth: number) => {
    if (depth > 12 || !entry) return;
    if (Array.isArray(entry)) {
      entry.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof entry !== "object") return;
    Object.entries(entry as AccountRow).forEach(([key, nested]) => {
      if (key === "storagePath" && typeof nested === "string") paths.add(nested);
      else visit(nested, depth + 1);
    });
  };
  visit(value, 0);
  return Array.from(paths);
}

function isOwnedAssetPath(path: string, userId: string) {
  return (
    path.startsWith(`${userId}/`) &&
    !path.includes("..") &&
    !/^(?:data|blob|https?):/i.test(path) &&
    path.toLowerCase().endsWith(".webp")
  );
}

function readme(exportedAt: string) {
  return [
    "StoryBloom 私有云成长档案导出",
    "",
    `导出时间：${exportedAt}`,
    "",
    "archive.json 包含当前账户私有云中的成长时刻、家长确认字段、绘本正文和版本来源。",
    "assets/ 包含导出时仍能从私有 Storage 读取的成长照片与关联绘本插图。",
    "",
    "此导出不包含登录令牌、签名 URL、Provider 任务 ID、旁白音频、家庭角色库、真实声音或公开分享凭据。",
    "导出不会开启云同步，也不会上传当前设备中的本机成长档案。",
    "删除私有云成长档案不会自动删除当前设备副本或普通绘本馆中的独立副本。",
    "",
  ].join("\n");
}

export function buildCloudGrowthArchiveExport(
  snapshot: CloudGrowthArchiveSnapshot,
  exportedAt = new Date().toISOString(),
): CloudGrowthArchiveExportBuild {
  const childNames = new Map(
    snapshot.children.flatMap((child) => {
      const id = getString(child, "id");
      return id ? [[id, getString(child, "display_name") || "孩子"] as const] : [];
    }),
  );
  const stories = new Map(
    snapshot.savedStories.flatMap((story) => {
      const id = getString(story, "id");
      return id ? [[id, story] as const] : [];
    }),
  );
  const downloads: CloudGrowthArchiveDownloadSpec[] = [];
  const downloadPaths = new Map<string, string>();
  const addDownload = (
    bucket: CloudGrowthArchiveDownloadSpec["bucket"],
    storagePath: unknown,
    exportPath: string,
  ) => {
    if (
      typeof storagePath !== "string" ||
      !isOwnedAssetPath(storagePath, snapshot.userId)
    ) {
      return undefined;
    }
    const key = `${bucket}:${storagePath}`;
    const existing = downloadPaths.get(key);
    if (existing) return existing;
    downloadPaths.set(key, exportPath);
    downloads.push({ bucket, storagePath, exportPath });
    return exportPath;
  };

  const represented = representedLegacyRecordIds(snapshot);
  const items = [
    ...snapshot.growthMoments.map((row) => ({ kind: "moment" as const, row })),
    ...snapshot.legacyRecords
      .filter((row) => !represented.has(getString(row, "id") || ""))
      .map((row) => ({ kind: "legacy" as const, row })),
  ].sort(
    (left, right) =>
      (getString(left.row, "occurred_on") || "").localeCompare(
        getString(right.row, "occurred_on") || "",
      ) ||
      (getString(left.row, "id") || "").localeCompare(
        getString(right.row, "id") || "",
      ),
  );

  const moments = items.map((item, momentIndex) => {
    const number = String(momentIndex + 1).padStart(4, "0");
    const id = getString(item.row, "id") || "";
    const childProfileId = getString(item.row, "child_profile_id") || "";
    const assets =
      item.kind === "moment"
        ? snapshot.growthMomentAssets.filter(
            (asset) => getString(asset, "growth_moment_id") === id,
          )
        : snapshot.legacyPhotos.filter(
            (asset) => getString(asset, "growth_record_id") === id,
          );
    const originalAssets = assets
      .sort(
        (left, right) =>
          Number(left.sort_order || 0) - Number(right.sort_order || 0),
      )
      .map((asset, assetIndex) => ({
        assetId:
          getString(asset, "client_asset_id") ||
          getString(asset, "client_photo_id") ||
          getString(asset, "id"),
        kind: getString(asset, "asset_kind") || "photo",
        originalName: sanitizeText(asset.original_name),
        mimeType: asset.mime_type,
        byteSize: asset.byte_size,
        checksumSha256: asset.checksum_sha256,
        exportPath: addDownload(
          GROWTH_ASSET_BUCKET,
          asset.storage_path,
          `assets/moment-${number}/photo-${String(assetIndex + 1).padStart(2, "0")}.webp`,
        ),
      }));

    const versionRows =
      item.kind === "moment"
        ? snapshot.storybookVersions.filter(
            (version) => getString(version, "growth_moment_id") === id,
          )
        : [];
    const legacyStoryId =
      item.kind === "legacy" ? getString(item.row, "saved_story_id") : undefined;
    const versions = [
      ...versionRows.map((version) => ({
        row: version,
        story: getString(version, "saved_story_id")
          ? stories.get(getString(version, "saved_story_id") || "")
          : undefined,
        snapshot: version.story_snapshot,
      })),
      ...(legacyStoryId && stories.get(legacyStoryId)
        ? [
            {
              row: item.row,
              story: stories.get(legacyStoryId),
              snapshot: stories.get(legacyStoryId)?.story_snapshot,
            },
          ]
        : []),
    ].map((version, versionIndex) => {
      const savedStoryId = getString(version.story, "id");
      const assetPaths = new Set<string>();
      extractStoragePaths(version.row.asset_manifest).forEach((path) =>
        assetPaths.add(path),
      );
      extractStoragePaths(version.story?.asset_manifest).forEach((path) =>
        assetPaths.add(path),
      );
      extractStoragePaths(version.snapshot).forEach((path) => assetPaths.add(path));
      if (savedStoryId) {
        snapshot.savedStoryAssets
          .filter((asset) => getString(asset, "saved_story_id") === savedStoryId)
          .forEach((asset) => {
            const path = getString(asset, "storage_path");
            if (path) assetPaths.add(path);
          });
      }
      const exportedAssets = Array.from(assetPaths)
        .sort()
        .flatMap((path, imageIndex) => {
          const exportPath = addDownload(
            "story-archive",
            path,
            `assets/moment-${number}/storybook-${String(versionIndex + 1).padStart(2, "0")}/image-${String(imageIndex + 1).padStart(2, "0")}.webp`,
          );
          return exportPath ? [{ exportPath, mimeType: "image/webp" }] : [];
        });
      return {
        versionId:
          getString(version.row, "client_version_id") ||
          getString(version.row, "id") ||
          getString(version.story, "client_story_id"),
        storyId:
          getString(version.row, "client_story_id") ||
          getString(version.story, "client_story_id"),
        readingStage: version.row.reading_stage,
        style: version.row.illustration_style,
        storyTreatment: version.row.story_treatment,
        promptVersion: sanitizeText(version.row.prompt_version),
        textModel: sanitizeText(version.row.text_model),
        imageProviders: getStringArray(version.row, "image_providers"),
        characterBibleVersion: sanitizeText(version.row.character_bible_version),
        source: getString(version.row, "source") || "legacy-growth-record",
        createdAt:
          getString(version.row, "created_at") ||
          getString(version.story, "created_at"),
        updatedAt:
          getString(version.row, "updated_at") ||
          getString(version.story, "updated_at"),
        story: portableStorySnapshot(version.snapshot),
        assets: exportedAssets,
      };
    });

    return {
      archiveId: `moment-${number}`,
      sourceSchema: item.kind === "moment" ? "growth-moment" : "legacy-growth-record",
      clientMomentId:
        getString(item.row, "client_moment_id") ||
        getString(item.row, "client_record_id"),
      childName: childNames.get(childProfileId) || "孩子",
      occurredOn: getString(item.row, "occurred_on"),
      parentNote:
        sanitizeText(item.row.parent_note) || sanitizeText(item.row.note) || "",
      sourceIdea:
        sanitizeText(item.row.source_idea) || sanitizeText(item.row.idea) || "",
      parentFacts: sanitizeText(item.row.parent_facts),
      allowedImaginations: sanitizeText(item.row.allowed_imaginations),
      confirmedTags: getStringArray(item.row, "confirmed_tags"),
      originalAssets,
      storybookVersions: versions,
      createdAt: getString(item.row, "created_at"),
      updatedAt: getString(item.row, "updated_at"),
    };
  });

  const summary = summarizeCloudGrowthArchive(snapshot);
  const archive = {
    schemaVersion: 1,
    exportedAt,
    source: "private-cloud",
    retentionDays: snapshot.retentionDays,
    summary: summary.counts,
    boundaries: {
      includes: [
        "家长主动导入到私有云的成长时刻、事实、备注和标签",
        "私有 Storage 中仍可读取的成长照片",
        "关联绘本正文、可读取插图和必要版本来源元数据",
      ],
      excludes: [
        "登录令牌、临时签名 URL、Provider 任务 ID和旁白音频",
        "当前设备本机副本、家庭角色库、真实声音、公开分享凭据和无关绘本馆内容",
      ],
    },
    fieldGuide: [
      { field: "childName", reason: "标明成长时刻属于哪个私有云孩子档案" },
      { field: "occurredOn", reason: "按真实发生日期排序并生成保留期限预览" },
      { field: "parentFacts / parentNote", reason: "保留家长确认的事实和补充说明" },
      { field: "originalAssets", reason: "保留家长明确选择上传的成长现场照片" },
      { field: "storybookVersions", reason: "保存与成长时刻关联的绘本正文和版本来源" },
    ],
    moments,
  };

  return {
    archive,
    entries: [{ name: "README.txt", data: readme(exportedAt) }],
    downloads,
  };
}

export async function createCloudGrowthArchiveExport(
  supabase: SupabaseClient<any>,
  snapshot: CloudGrowthArchiveSnapshot,
  exportedAt = new Date().toISOString(),
  timeZone = "UTC",
) {
  const built = buildCloudGrowthArchiveExport(snapshot, exportedAt);
  const failures: Array<{
    bucket: string;
    exportPath: string;
    detail: string;
  }> = [];
  let downloaded = 0;
  for (const item of built.downloads) {
    const { data, error } = await supabase.storage
      .from(item.bucket)
      .download(item.storagePath);
    if (error || !data) {
      failures.push({
        bucket: item.bucket,
        exportPath: item.exportPath,
        detail: error?.message || "Storage 对象下载失败",
      });
      continue;
    }
    built.entries.push({ name: item.exportPath, data });
    downloaded += 1;
  }
  const report = {
    status: failures.length ? "partial" : "complete",
    planned: built.downloads.length,
    downloaded,
    failed: failures.length,
    failures,
  };
  built.entries.unshift({ name: "archive.json", data: json(built.archive) });
  built.entries.push({ name: "export-report.json", data: json(report) });
  const fileDate = toDateKey(
    new Date(
      Date.UTC(
        getDateParts(new Date(exportedAt), timeZone).year,
        getDateParts(new Date(exportedAt), timeZone).month - 1,
        getDateParts(new Date(exportedAt), timeZone).day,
      ),
    ),
  );
  return {
    blob: await createZipBlob(built.entries),
    fileName: `storybloom-cloud-growth-archive-${fileDate}.zip`,
    report,
  };
}

const deleteRequestSchema = z.object({
  scope: z.enum(["all", "expired"]),
  confirmation: z.string(),
});

export function parseCloudGrowthArchiveDeleteRequest(
  value: unknown,
): CloudGrowthArchiveDeleteRequest {
  const parsed = deleteRequestSchema.safeParse(value);
  if (!parsed.success) {
    throw new CloudGrowthArchiveInputError("私有云成长档案删除请求不完整。 ");
  }
  if (
    parsed.data.scope === "all" &&
    parsed.data.confirmation !== DELETE_ALL_CLOUD_GROWTH_CONFIRMATION
  ) {
    throw new CloudGrowthArchiveInputError("完整删除确认文本不匹配。 ");
  }
  if (
    parsed.data.scope === "expired" &&
    parsed.data.confirmation !== DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION
  ) {
    throw new CloudGrowthArchiveInputError("到期删除确认文本不匹配。 ");
  }
  return parsed.data as CloudGrowthArchiveDeleteRequest;
}

export function selectCloudGrowthArchiveDeletionTargets(
  snapshot: CloudGrowthArchiveSnapshot,
  scope: CloudGrowthArchiveDeleteRequest["scope"],
  now = new Date(),
  timeZone = "UTC",
) {
  const cutoffDate =
    scope === "expired"
      ? getCloudGrowthRetentionCutoff(snapshot.retentionDays, now, timeZone)
      : undefined;
  if (scope === "expired" && !cutoffDate) {
    throw new CloudGrowthArchiveInputError(
      "请先保存私有云成长档案保留期限，再删除到期内容。",
    );
  }
  const legacyRecords = snapshot.legacyRecords.filter(
    (record) =>
      scope === "all" || (getString(record, "occurred_on") || "") <= cutoffDate!,
  );
  const growthMoments = snapshot.growthMoments.filter(
    (moment) =>
      scope === "all" || (getString(moment, "occurred_on") || "") <= cutoffDate!,
  );
  const legacyIds = new Set(
    legacyRecords.flatMap((record) => {
      const id = getString(record, "id");
      return id ? [id] : [];
    }),
  );
  const momentIds = new Set(
    growthMoments.flatMap((moment) => {
      const id = getString(moment, "id");
      return id ? [id] : [];
    }),
  );
  const legacyStoragePaths = Array.from(
    new Set(
      snapshot.legacyPhotos.flatMap((photo) =>
        legacyIds.has(getString(photo, "growth_record_id") || "") &&
        isOwnedAssetPath(getString(photo, "storage_path") || "", snapshot.userId)
          ? [getString(photo, "storage_path")!]
          : [],
      ),
    ),
  );
  const momentStoragePaths = Array.from(
    new Set(
      snapshot.growthMomentAssets.flatMap((asset) =>
        momentIds.has(getString(asset, "growth_moment_id") || "") &&
        isOwnedAssetPath(getString(asset, "storage_path") || "", snapshot.userId)
          ? [getString(asset, "storage_path")!]
          : [],
      ),
    ),
  );
  return {
    ...(cutoffDate ? { cutoffDate } : {}),
    legacyIds: Array.from(legacyIds),
    momentIds: Array.from(momentIds),
    legacyStoragePaths,
    momentStoragePaths,
    storagePaths: Array.from(
      new Set([...legacyStoragePaths, ...momentStoragePaths]),
    ),
  };
}

async function deleteIds(
  supabase: SupabaseClient<any>,
  table: string,
  userId: string,
  ids: string[],
  optional: boolean,
) {
  for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
    const batch = ids.slice(index, index + DELETE_BATCH_SIZE);
    if (batch.length === 0) continue;
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", batch);
    if (error) {
      if (optional && isOptionalRelationMissing(error)) return;
      throw error;
    }
  }
}

async function listStoragePaths(
  supabase: SupabaseClient<any>,
  userId: string,
) {
  const bucket = supabase.storage.from(GROWTH_ASSET_BUCKET);
  const paths: string[] = [];
  const pending = [userId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const prefix = pending.shift()!;
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      const items = data || [];
      items.forEach((item) => {
        const path = `${prefix}/${item.name}`;
        if (item.id === null || (item.id == null && item.metadata == null)) {
          pending.push(path);
        } else if (isOwnedAssetPath(path, userId)) {
          paths.push(path);
        }
      });
      if (items.length < 1000) break;
      offset += items.length;
    }
  }
  return paths;
}

export async function deleteCloudGrowthArchive(
  supabase: SupabaseClient<any>,
  snapshot: CloudGrowthArchiveSnapshot,
  request: CloudGrowthArchiveDeleteRequest,
  now = new Date(),
  timeZone = "UTC",
): Promise<CloudGrowthArchiveDeletionReport> {
  const targets = selectCloudGrowthArchiveDeletionTargets(
    snapshot,
    request.scope,
    now,
    timeZone,
  );
  const warnings: string[] = [];
  let deletedLegacy = 0;
  let deletedMoments = 0;
  let deletedStorage = 0;
  let storagePaths: string[] = [];
  let discoveredStoragePaths = targets.storagePaths;
  let momentDeleteSucceeded = false;
  let legacyDeleteSucceeded = false;

  try {
    await deleteIds(
      supabase,
      "growth_moments",
      snapshot.userId,
      targets.momentIds,
      true,
    );
    deletedMoments = targets.momentIds.length;
    momentDeleteSucceeded = true;
  } catch (error) {
    warnings.push(
      `GrowthMoment 删除失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    await deleteIds(
      supabase,
      "growth_records",
      snapshot.userId,
      targets.legacyIds,
      false,
    );
    deletedLegacy = targets.legacyIds.length;
    legacyDeleteSucceeded = true;
  } catch (error) {
    warnings.push(
      `旧成长记录删除失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (momentDeleteSucceeded) {
    storagePaths.push(...targets.momentStoragePaths);
  }
  if (legacyDeleteSucceeded) {
    storagePaths.push(...targets.legacyStoragePaths);
  }
  storagePaths = Array.from(new Set(storagePaths));

  if (
    request.scope === "all" &&
    momentDeleteSucceeded &&
    legacyDeleteSucceeded
  ) {
    try {
      const listedPaths = await listStoragePaths(supabase, snapshot.userId);
      discoveredStoragePaths = Array.from(
        new Set([...discoveredStoragePaths, ...listedPaths]),
      );
      storagePaths = Array.from(new Set([...storagePaths, ...listedPaths]));
    } catch (error) {
      warnings.push(
        `无法完整盘点成长照片 Storage：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const bucket = supabase.storage.from(GROWTH_ASSET_BUCKET);
  for (let index = 0; index < storagePaths.length; index += STORAGE_BATCH_SIZE) {
    const batch = storagePaths.slice(index, index + STORAGE_BATCH_SIZE);
    const { error } = await bucket.remove(batch);
    if (error) {
      warnings.push(`有 ${batch.length} 个成长照片对象未能删除：${error.message}`);
    } else {
      deletedStorage += batch.length;
    }
  }

  const deletedAnything = deletedLegacy + deletedMoments + deletedStorage > 0;
  return {
    version: 1,
    scope: request.scope,
    status: warnings.length ? (deletedAnything ? "partial" : "failed") : "complete",
    ...(targets.cutoffDate ? { cutoffDate: targets.cutoffDate } : {}),
    discovered: {
      legacyGrowthRecords: targets.legacyIds.length,
      growthMoments: targets.momentIds.length,
      storageObjects: discoveredStoragePaths.length,
    },
    deleted: {
      legacyGrowthRecords: deletedLegacy,
      growthMoments: deletedMoments,
      storageObjects: deletedStorage,
    },
    warnings,
  };
}

export async function updateCloudGrowthRetention(
  supabase: SupabaseClient<any>,
  userId: string,
  retentionDays: unknown,
) {
  if (!isCloudGrowthRetentionDays(retentionDays)) {
    throw new CloudGrowthArchiveInputError("不支持这个私有云保留期限。 ");
  }
  const { error } = await supabase.from("account_settings").upsert(
    { user_id: userId, retention_days: retentionDays },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
