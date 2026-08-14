import type {
  GrowthRecord,
  GrowthRecordDraft,
  GrowthRecordPhoto,
  GrowthStoryContext,
} from "@/lib/growth-records";
import {
  hasValidOptionalGrowthAssetMetadata,
  type GrowthAssetMimeType,
} from "@/lib/growth-asset-metadata";
import type {
  AgeGroup,
  GenerateResponse,
  GrowthStoryTreatment,
  IllustrationStyle,
} from "@/types";

export const GROWTH_MOMENT_SCHEMA_VERSION = 1 as const;
export const STORYBOOK_VERSION_SCHEMA_VERSION = 1 as const;

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;
const MAX_ASSETS = 4;
const MAX_ID_LENGTH = 180;

export interface GrowthMomentAsset {
  assetId: string;
  kind: "photo";
  name: string;
  dataUrl: string;
  mimeType?: GrowthAssetMimeType;
  byteSize?: number;
  checksumSha256?: string;
}

export interface GrowthMoment
  extends Pick<GrowthStoryContext, "parentFacts" | "allowedImaginations"> {
  schemaVersion: typeof GROWTH_MOMENT_SCHEMA_VERSION;
  momentId: string;
  clientMomentId: string;
  childKey: string;
  childName: string;
  childAvatarDataUrl?: string;
  occurredOn: string;
  parentNote: string;
  sourceIdea: string;
  originalAssets: GrowthMomentAsset[];
  confirmedTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StorybookVersion {
  schemaVersion: typeof STORYBOOK_VERSION_SCHEMA_VERSION;
  versionId: string;
  momentId: string;
  storyId: string;
  result: GenerateResponse;
  readingStage: AgeGroup;
  style: IllustrationStyle;
  storyTreatment?: GrowthStoryTreatment;
  /** A visual character may be selected for one version without owning the Moment. */
  characterReferenceId?: string;
  promptVersion?: string;
  textModel?: string;
  imageProviders?: string[];
  characterBibleVersion?: string;
  source: "generated" | "legacy-growth-record";
  createdAt: string;
  updatedAt: string;
}

export interface GrowthMomentBundle {
  moment: GrowthMoment;
  storybookVersions: StorybookVersion[];
  activeStorybookVersionId?: string;
}

export interface StorybookVersionCreateOptions {
  versionId?: string;
  storyTreatment?: GrowthStoryTreatment;
  characterReferenceId?: string;
  promptVersion?: string;
  textModel?: string;
  imageProviders?: string[];
  characterBibleVersion?: string;
  source?: StorybookVersion["source"];
  createdAt?: string;
  updatedAt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validId(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    !/[\u0000-\u001f]/.test(value)
  );
}

function validTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function optionalText(value: unknown, maximum: number) {
  return value === undefined || (typeof value === "string" && value.length <= maximum);
}

function optionalId(value: unknown) {
  return value === undefined || validId(value);
}

function optionalImageDataUrl(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" &&
      value.length <= 4_000_000 &&
      value.startsWith("data:image/"))
  );
}

function validReadingStage(value: unknown): value is AgeGroup {
  return value === "2-3" || value === "4-5" || value === "6-8";
}

function validStoryTreatment(
  value: unknown,
): value is GrowthStoryTreatment | undefined {
  return (
    value === undefined ||
    value === "documentary" ||
    value === "warm-imagination" ||
    value === "fairytale"
  );
}

function validStyle(value: unknown): value is IllustrationStyle {
  return value === "watercolor" || value === "cartoon" || value === "fairytale";
}

function validGenerateResponse(value: unknown): value is GenerateResponse {
  if (!isRecord(value)) return false;
  return (
    validId(value.storyId) &&
    isRecord(value.input) &&
    typeof value.coverTitle === "string" &&
    Array.isArray(value.pages) &&
    typeof value.totalPages === "number" &&
    Number.isInteger(value.totalPages)
  );
}

function isGrowthMomentAsset(value: unknown): value is GrowthMomentAsset {
  if (!isRecord(value)) return false;
  return (
    validId(value.assetId) &&
    value.kind === "photo" &&
    typeof value.name === "string" &&
    typeof value.dataUrl === "string" &&
    value.dataUrl.startsWith("data:image/") &&
    hasValidOptionalGrowthAssetMetadata(value)
  );
}

function normalizeText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeImageDataUrl(value: string | undefined) {
  return value?.startsWith("data:image/") ? value : undefined;
}

function clonePhotos(photos: GrowthRecordPhoto[]): GrowthMomentAsset[] {
  return photos.map((photo) => ({
    assetId: photo.id,
    kind: "photo",
    name: photo.name,
    dataUrl: photo.dataUrl,
    ...(photo.mimeType ? { mimeType: photo.mimeType } : {}),
    ...(photo.byteSize !== undefined ? { byteSize: photo.byteSize } : {}),
    ...(photo.checksumSha256
      ? { checksumSha256: photo.checksumSha256 }
      : {}),
  }));
}

function projectPhotos(assets: GrowthMomentAsset[]): GrowthRecordPhoto[] {
  return assets.map((asset) => ({
    id: asset.assetId,
    name: asset.name,
    dataUrl: asset.dataUrl,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.byteSize !== undefined ? { byteSize: asset.byteSize } : {}),
    ...(asset.checksumSha256
      ? { checksumSha256: asset.checksumSha256 }
      : {}),
  }));
}

function normalizeTags(tags: readonly string[] | undefined) {
  const normalized = (tags || [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH);
  return Array.from(new Set(normalized)).slice(0, MAX_TAGS);
}

function collectImageProviders(story: GenerateResponse) {
  const providers = new Set<string>();
  story.pages.forEach((page) => {
    if (page.imageProvider) providers.add(page.imageProvider);
    page.imageAttempts?.forEach((attempt) => {
      if (attempt.provider) providers.add(attempt.provider);
    });
  });
  return providers.size > 0 ? Array.from(providers) : undefined;
}

export function createStorybookVersionId(storyId: string) {
  if (!validId(storyId)) throw new Error("growth-storybook-story-id-invalid");
  return `storybook_${storyId}`;
}

export function createGrowthMoment(
  draft: GrowthRecordDraft,
  input: {
    momentId: string;
    clientMomentId?: string;
    confirmedTags?: string[];
    now?: string;
  },
): GrowthMoment {
  if (!validId(input.momentId)) throw new Error("growth-moment-id-invalid");
  const now = input.now || new Date().toISOString();
  const childAvatarDataUrl = normalizeImageDataUrl(draft.childAvatarDataUrl);
  return {
    schemaVersion: GROWTH_MOMENT_SCHEMA_VERSION,
    momentId: input.momentId,
    clientMomentId: input.clientMomentId || input.momentId,
    childKey: draft.childKey,
    childName: draft.childName,
    ...(childAvatarDataUrl ? { childAvatarDataUrl } : {}),
    occurredOn: draft.occurredOn,
    parentNote: draft.note,
    sourceIdea: draft.idea,
    originalAssets: clonePhotos(draft.photos),
    confirmedTags: normalizeTags(input.confirmedTags),
    ...(normalizeText(draft.parentFacts)
      ? { parentFacts: normalizeText(draft.parentFacts) }
      : {}),
    ...(normalizeText(draft.allowedImaginations)
      ? { allowedImaginations: normalizeText(draft.allowedImaginations) }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function createStorybookVersion(
  momentId: string,
  story: GenerateResponse,
  input: StorybookVersionCreateOptions = {},
): StorybookVersion {
  if (!validId(momentId)) throw new Error("growth-moment-id-invalid");
  const versionId = input.versionId || createStorybookVersionId(story.storyId);
  if (!validId(versionId)) throw new Error("growth-storybook-version-id-invalid");
  const createdAt = input.createdAt || new Date().toISOString();
  const detectedImageProviders = collectImageProviders(story);
  return {
    schemaVersion: STORYBOOK_VERSION_SCHEMA_VERSION,
    versionId,
    momentId,
    storyId: story.storyId,
    result: story,
    readingStage: story.input.ageGroup,
    style: story.input.style,
    ...(input.storyTreatment
      ? { storyTreatment: input.storyTreatment }
      : {}),
    ...(input.characterReferenceId
      ? { characterReferenceId: input.characterReferenceId }
      : {}),
    ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
    ...(input.textModel ? { textModel: input.textModel } : {}),
    ...(input.imageProviders?.length
      ? { imageProviders: normalizeTags(input.imageProviders) }
      : detectedImageProviders
        ? { imageProviders: detectedImageProviders }
        : {}),
    ...(input.characterBibleVersion
      ? { characterBibleVersion: input.characterBibleVersion }
      : {}),
    source: input.source || "generated",
    createdAt,
    updatedAt: input.updatedAt || createdAt,
  };
}

export function migrateLegacyGrowthRecord(record: GrowthRecord): GrowthMomentBundle {
  const momentId = record.momentId || record.clientRecordId || record.id;
  const childAvatarDataUrl = normalizeImageDataUrl(record.childAvatarDataUrl);
  const moment: GrowthMoment = {
    schemaVersion: GROWTH_MOMENT_SCHEMA_VERSION,
    momentId,
    clientMomentId: record.clientRecordId || record.momentId || record.id,
    childKey: record.childKey,
    childName: record.childName,
    ...(childAvatarDataUrl ? { childAvatarDataUrl } : {}),
    occurredOn: record.occurredOn,
    parentNote: record.note,
    sourceIdea: record.idea,
    originalAssets: clonePhotos(record.photos),
    confirmedTags: [],
    ...(normalizeText(record.parentFacts)
      ? { parentFacts: normalizeText(record.parentFacts) }
      : {}),
    ...(normalizeText(record.allowedImaginations)
      ? { allowedImaginations: normalizeText(record.allowedImaginations) }
      : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  const storybookVersion = createStorybookVersion(momentId, record.story, {
    versionId:
      record.activeStorybookVersionId || createStorybookVersionId(record.storyId),
    storyTreatment: record.storyTreatment,
    characterReferenceId: record.childCharacterId,
    source: "legacy-growth-record",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
  return {
    moment,
    storybookVersions: [storybookVersion],
    activeStorybookVersionId: storybookVersion.versionId,
  };
}

export function isGrowthMoment(value: unknown): value is GrowthMoment {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === GROWTH_MOMENT_SCHEMA_VERSION &&
    validId(value.momentId) &&
    validId(value.clientMomentId) &&
    validId(value.childKey) &&
    typeof value.childName === "string" &&
    value.childName.trim().length > 0 &&
    optionalImageDataUrl(value.childAvatarDataUrl) &&
    validDate(value.occurredOn) &&
    typeof value.parentNote === "string" &&
    value.parentNote.length <= 200 &&
    typeof value.sourceIdea === "string" &&
    value.sourceIdea.trim().length > 0 &&
    Array.isArray(value.originalAssets) &&
    value.originalAssets.length <= MAX_ASSETS &&
    value.originalAssets.every(isGrowthMomentAsset) &&
    Array.isArray(value.confirmedTags) &&
    value.confirmedTags.length <= MAX_TAGS &&
    value.confirmedTags.every(
      (tag) => typeof tag === "string" && tag.length > 0 && tag.length <= MAX_TAG_LENGTH,
    ) &&
    optionalText(value.parentFacts, 300) &&
    optionalText(value.allowedImaginations, 300) &&
    validTimestamp(value.createdAt) &&
    validTimestamp(value.updatedAt)
  );
}

export function isStorybookVersion(value: unknown): value is StorybookVersion {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === STORYBOOK_VERSION_SCHEMA_VERSION &&
    validId(value.versionId) &&
    validId(value.momentId) &&
    validId(value.storyId) &&
    validGenerateResponse(value.result) &&
    value.result.storyId === value.storyId &&
    validReadingStage(value.readingStage) &&
    value.result.input.ageGroup === value.readingStage &&
    validStyle(value.style) &&
    value.result.input.style === value.style &&
    validStoryTreatment(value.storyTreatment) &&
    optionalId(value.characterReferenceId) &&
    optionalText(value.promptVersion, 120) &&
    optionalText(value.textModel, 160) &&
    (value.imageProviders === undefined ||
      (Array.isArray(value.imageProviders) &&
        value.imageProviders.length <= MAX_TAGS &&
        value.imageProviders.every(
          (provider) =>
            typeof provider === "string" &&
            provider.length > 0 &&
            provider.length <= MAX_TAG_LENGTH,
        ))) &&
    optionalText(value.characterBibleVersion, 120) &&
    (value.source === "generated" || value.source === "legacy-growth-record") &&
    validTimestamp(value.createdAt) &&
    validTimestamp(value.updatedAt)
  );
}

export function selectActiveStorybookVersion(
  bundle: GrowthMomentBundle,
): StorybookVersion | undefined {
  const explicit = bundle.activeStorybookVersionId
    ? bundle.storybookVersions.find(
        (version) => version.versionId === bundle.activeStorybookVersionId,
      )
    : undefined;
  if (explicit) return explicit;
  return [...bundle.storybookVersions].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      right.versionId.localeCompare(left.versionId),
  )[0];
}

export function addStorybookVersion(
  bundle: GrowthMomentBundle,
  version: StorybookVersion,
  options: { activate?: boolean } = {},
): GrowthMomentBundle {
  if (version.momentId !== bundle.moment.momentId) {
    throw new Error("growth-storybook-moment-mismatch");
  }
  const storybookVersions = bundle.storybookVersions.filter(
    (candidate) =>
      candidate.versionId !== version.versionId &&
      candidate.storyId !== version.storyId,
  );
  storybookVersions.push(version);
  return {
    moment: {
      ...bundle.moment,
      updatedAt:
        Date.parse(version.updatedAt) > Date.parse(bundle.moment.updatedAt)
          ? version.updatedAt
          : bundle.moment.updatedAt,
    },
    storybookVersions,
    activeStorybookVersionId:
      options.activate === false
        ? bundle.activeStorybookVersionId
        : version.versionId,
  };
}

export function removeStorybookVersion(
  bundle: GrowthMomentBundle,
  versionId: string,
): GrowthMomentBundle {
  const storybookVersions = bundle.storybookVersions.filter(
    (version) => version.versionId !== versionId,
  );
  const next = {
    ...bundle,
    storybookVersions,
    activeStorybookVersionId:
      bundle.activeStorybookVersionId === versionId
        ? undefined
        : bundle.activeStorybookVersionId,
  };
  const active = selectActiveStorybookVersion(next);
  return {
    ...next,
    ...(active ? { activeStorybookVersionId: active.versionId } : {}),
  };
}

export function clearGrowthMomentOriginalAssets(
  bundle: GrowthMomentBundle,
  now = new Date().toISOString(),
): GrowthMomentBundle {
  return {
    ...bundle,
    moment: {
      ...bundle.moment,
      originalAssets: [],
      updatedAt: now,
    },
  };
}

export function projectGrowthMomentBundle(
  bundle: GrowthMomentBundle,
): GrowthRecord | null {
  const active = selectActiveStorybookVersion(bundle);
  if (!active) return null;
  return {
    id: bundle.moment.momentId,
    momentId: bundle.moment.momentId,
    activeStorybookVersionId: active.versionId,
    storybookVersionCount: bundle.storybookVersions.length,
    clientRecordId: bundle.moment.clientMomentId,
    storyId: active.storyId,
    childKey: bundle.moment.childKey,
    childName: bundle.moment.childName,
    ...(active.characterReferenceId
      ? { childCharacterId: active.characterReferenceId }
      : {}),
    ...(bundle.moment.childAvatarDataUrl
      ? { childAvatarDataUrl: bundle.moment.childAvatarDataUrl }
      : {}),
    occurredOn: bundle.moment.occurredOn,
    note: bundle.moment.parentNote,
    idea: bundle.moment.sourceIdea,
    photos: projectPhotos(bundle.moment.originalAssets),
    readingStage: active.readingStage,
    ...(active.storyTreatment
      ? { storyTreatment: active.storyTreatment }
      : {}),
    ...(bundle.moment.parentFacts
      ? { parentFacts: bundle.moment.parentFacts }
      : {}),
    ...(bundle.moment.allowedImaginations
      ? { allowedImaginations: bundle.moment.allowedImaginations }
      : {}),
    story: active.result,
    createdAt: bundle.moment.createdAt,
    updatedAt:
      Date.parse(active.updatedAt) > Date.parse(bundle.moment.updatedAt)
        ? active.updatedAt
        : bundle.moment.updatedAt,
  };
}
