import { createZipBlob } from "@/lib/client-zip";
import { growthAssetDataUrlToBytes } from "@/lib/growth-asset-metadata";
import type { GrowthMomentBundle } from "@/lib/growth-moments";
import type { LocalGrowthRetentionPreference } from "@/lib/growth-archive-retention";
import { toPersistedStorySnapshot } from "@/lib/persistence/story-snapshot";

export const LOCAL_GROWTH_ARCHIVE_SCHEMA_VERSION = 1 as const;

export interface LocalGrowthArchiveEntry {
  name: string;
  data: Blob | Uint8Array | string;
}

interface LocalGrowthArchiveBuildResult {
  archive: LocalGrowthArchiveExport;
  entries: LocalGrowthArchiveEntry[];
}

export interface LocalGrowthArchiveExport {
  schemaVersion: typeof LOCAL_GROWTH_ARCHIVE_SCHEMA_VERSION;
  exportedAt: string;
  source: "current-device";
  retention: LocalGrowthRetentionPreference;
  summary: {
    children: number;
    moments: number;
    originalPhotos: number;
    storybookVersions: number;
    storybookImages: number;
  };
  boundaries: {
    includes: string[];
    excludes: string[];
  };
  fieldGuide: Array<{ field: string; reason: string }>;
  moments: Array<Record<string, unknown>>;
}

function sanitizeText(value: string) {
  return value
    .replace(/data:[^\s"'<>]+/gi, "[removed]")
    .replace(
      /https?:\/\/[^\s"'<>]*(?:token|signature|secret|key|credential)=[^\s"'<>]*/gi,
      "[removed]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [removed]");
}

function optionalText(value: string | undefined) {
  if (!value) return undefined;
  const sanitized = sanitizeText(value);
  return sanitized || undefined;
}

function getDataUrlMimeType(dataUrl: string) {
  const match = /^data:(image\/(?:webp|png|jpeg));base64,/i.exec(dataUrl);
  return match?.[1].toLowerCase();
}

function getImageExtension(mimeType: string | undefined) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "webp";
}

function addDataUrlEntry(
  entries: LocalGrowthArchiveEntry[],
  dataUrl: string | undefined,
  pathWithoutExtension: string,
) {
  if (!dataUrl?.startsWith("data:image/")) return undefined;
  try {
    const mimeType = getDataUrlMimeType(dataUrl);
    if (!mimeType) return undefined;
    const path = `${pathWithoutExtension}.${getImageExtension(mimeType)}`;
    entries.push({ name: path, data: growthAssetDataUrlToBytes(dataUrl) });
    return { exportPath: path, mimeType };
  } catch {
    return undefined;
  }
}

function toExportedStoryInput(
  input: ReturnType<typeof toPersistedStorySnapshot>["input"],
) {
  return {
    childName: input.childName,
    narrativePerspective: input.narrativePerspective,
    ageGroup: input.ageGroup,
    favoriteToy: input.favoriteToy,
    favoriteFood: input.favoriteFood,
    bestFriend: input.bestFriend,
    otherDetails: input.otherDetails,
    theme: input.theme,
    customTheme: input.customTheme,
    parentFacts: input.parentFacts,
    allowedImaginations: input.allowedImaginations,
    storyTreatment: input.storyTreatment,
    style: input.style,
    language: input.language,
    dedication: input.dedication,
  };
}

function createReadme(exportedAt: string) {
  return [
    "StoryBloom 本机成长档案导出",
    "",
    `导出时间：${exportedAt}`,
    "",
    "archive.json 保存家长确认的成长时刻、字段用途、绘本正文和版本元数据。",
    "assets/ 保存当前浏览器中可读取的成长现场照片、孩子头像快照和绘本插图。",
    "",
    "这个 ZIP 不包含登录令牌、临时签名链接、Provider 任务 ID、旁白音频、私有云副本、家庭角色库或公开分享凭据。",
    "导出只在当前浏览器完成，不会因为导出而上传本机资料。",
    "删除本机档案不会自动删除绘本馆独立副本或私有云副本，请分别检查。",
    "",
  ].join("\n");
}

export async function buildLocalGrowthArchiveExport(
  bundles: readonly GrowthMomentBundle[],
  retention: LocalGrowthRetentionPreference,
  exportedAt = new Date().toISOString(),
): Promise<LocalGrowthArchiveBuildResult> {
  const entries: LocalGrowthArchiveEntry[] = [];
  let storybookImageCount = 0;
  const sortedBundles = [...bundles].sort(
    (left, right) =>
      left.moment.occurredOn.localeCompare(right.moment.occurredOn) ||
      left.moment.momentId.localeCompare(right.moment.momentId),
  );
  const moments = sortedBundles.map((bundle, momentIndex) => {
    const momentNumber = String(momentIndex + 1).padStart(4, "0");
    const avatar = addDataUrlEntry(
      entries,
      bundle.moment.childAvatarDataUrl,
      `assets/moment-${momentNumber}/child-avatar`,
    );
    const originalAssets = bundle.moment.originalAssets.map((asset, assetIndex) => {
      const exported = addDataUrlEntry(
        entries,
        asset.dataUrl,
        `assets/moment-${momentNumber}/photo-${String(assetIndex + 1).padStart(
          2,
          "0",
        )}`,
      );
      return {
        assetId: sanitizeText(asset.assetId),
        kind: asset.kind,
        originalName: sanitizeText(asset.name),
        mimeType: asset.mimeType || exported?.mimeType,
        byteSize: asset.byteSize,
        checksumSha256: asset.checksumSha256,
        exportPath: exported?.exportPath,
      };
    });
    const storybookVersions = [...bundle.storybookVersions]
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.versionId.localeCompare(right.versionId),
      )
      .map((version, versionIndex) => {
        const snapshot = toPersistedStorySnapshot(version.result);
        const pages = snapshot.pages.map((page, pageIndex) => {
          const originalPage = version.result.pages[pageIndex];
          const image = addDataUrlEntry(
            entries,
            originalPage?.imageUrl,
            `assets/moment-${momentNumber}/storybook-${String(
              versionIndex + 1,
            ).padStart(2, "0")}/page-${String(page.page).padStart(2, "0")}`,
          );
          if (image) storybookImageCount += 1;
          return {
            page: page.page,
            zhText: page.zhText,
            enText: page.enText,
            illustrationPrompt: page.illustrationPrompt,
            imageStatus: page.imageStatus,
            image,
          };
        });
        return {
          versionId: sanitizeText(version.versionId),
          storyId: sanitizeText(version.storyId),
          readingStage: version.readingStage,
          style: version.style,
          storyTreatment: version.storyTreatment,
          promptVersion: optionalText(version.promptVersion),
          textModel: optionalText(version.textModel),
          imageProviders: version.imageProviders?.map(sanitizeText),
          characterBibleVersion: optionalText(version.characterBibleVersion),
          source: version.source,
          createdAt: version.createdAt,
          updatedAt: version.updatedAt,
          story: {
            storyId: snapshot.storyId,
            coverTitle: snapshot.coverTitle,
            input: toExportedStoryInput(snapshot.input),
            pages,
            totalPages: snapshot.totalPages,
            generationMode: snapshot.generationMode,
          },
        };
      });

    return {
      momentId: sanitizeText(bundle.moment.momentId),
      clientMomentId: sanitizeText(bundle.moment.clientMomentId),
      childKey: sanitizeText(bundle.moment.childKey),
      childName: sanitizeText(bundle.moment.childName),
      childAvatar: avatar,
      occurredOn: bundle.moment.occurredOn,
      parentNote: sanitizeText(bundle.moment.parentNote),
      sourceIdea: sanitizeText(bundle.moment.sourceIdea),
      parentFacts: optionalText(bundle.moment.parentFacts),
      allowedImaginations: optionalText(bundle.moment.allowedImaginations),
      confirmedTags: bundle.moment.confirmedTags.map(sanitizeText),
      originalAssets,
      storybookVersions,
      activeStorybookVersionId: optionalText(bundle.activeStorybookVersionId),
      createdAt: bundle.moment.createdAt,
      updatedAt: bundle.moment.updatedAt,
    };
  });

  const archive: LocalGrowthArchiveExport = {
    schemaVersion: LOCAL_GROWTH_ARCHIVE_SCHEMA_VERSION,
    exportedAt,
    source: "current-device",
    retention,
    summary: {
      children: new Set(sortedBundles.map((bundle) => bundle.moment.childKey)).size,
      moments: sortedBundles.length,
      originalPhotos: sortedBundles.reduce(
        (total, bundle) => total + bundle.moment.originalAssets.length,
        0,
      ),
      storybookVersions: sortedBundles.reduce(
        (total, bundle) => total + bundle.storybookVersions.length,
        0,
      ),
      storybookImages: storybookImageCount,
    },
    boundaries: {
      includes: [
        "家长确认的成长时刻、日期、事实、备注和标签",
        "当前浏览器可读取的成长照片与孩子头像快照",
        "绘本正文、可读取插图和版本来源元数据",
      ],
      excludes: [
        "登录令牌、删除令牌、临时签名链接和 Provider 任务 ID",
        "私有云副本、家庭角色库、真实声音、公开分享凭据和普通绘本馆副本",
      ],
    },
    fieldGuide: [
      { field: "childName / childKey", reason: "在当前设备中区分孩子的成长时间轴" },
      { field: "occurredOn", reason: "按真实发生日期排序并计算保留期限预览" },
      { field: "parentFacts / parentNote", reason: "保存家长确认的事实和补充说明" },
      { field: "originalAssets", reason: "保留家长选择的成长现场照片" },
      { field: "storybookVersions", reason: "允许同一真实时刻保留多个独立绘本版本" },
    ],
    moments,
  };
  entries.unshift(
    { name: "README.txt", data: createReadme(exportedAt) },
    { name: "archive.json", data: `${JSON.stringify(archive, null, 2)}\n` },
  );
  return { archive, entries };
}

export async function createLocalGrowthArchiveZip(
  bundles: readonly GrowthMomentBundle[],
  retention: LocalGrowthRetentionPreference,
  exportedAt = new Date().toISOString(),
) {
  const built = await buildLocalGrowthArchiveExport(
    bundles,
    retention,
    exportedAt,
  );
  return {
    ...built,
    blob: await createZipBlob(built.entries),
    filename: `storybloom-growth-archive-${exportedAt.slice(0, 10)}.zip`,
  };
}
