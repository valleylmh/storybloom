import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrowthRecordDraft } from "@/lib/growth-records";
import type { PersistedStorySnapshot } from "@/lib/persistence/story-snapshot";
import type { StoryAssetManifest } from "@/lib/repositories/story-repository";

export interface LegacyGrowthRecordMirrorRow {
  id: string;
  child_profile_id: string;
  saved_story_id: string;
  client_record_id: string;
  occurred_on: string;
  note: string;
  idea: string;
  created_at: string;
  updated_at: string;
}

export interface LegacyGrowthPhotoMirrorRow {
  id: string;
  client_photo_id: string | null;
  storage_path: string;
  original_name: string;
  sort_order: number;
  mime_type: string;
  byte_size: number | null;
  checksum_sha256: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SavedStoryMirrorRow {
  id: string;
  story_snapshot: PersistedStorySnapshot;
  asset_manifest: StoryAssetManifest;
  created_at: string;
  updated_at: string;
}

export interface CloudGrowthMomentMirrorInput {
  record: LegacyGrowthRecordMirrorRow;
  photos: LegacyGrowthPhotoMirrorRow[];
  savedStory: SavedStoryMirrorRow;
  draft: GrowthRecordDraft;
  clientVersionId?: string;
  imageProviders?: string[];
}

interface ExistingMirrorIds {
  versionRowId: string;
  assetRowIds: ReadonlyMap<string, string>;
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : String(error || "");
}

export function isGrowthMomentFoundationMissing(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /(?:growth_moments|growth_moment_assets|storybook_versions).*(?:does not exist|schema cache)/i.test(
      message,
    )
  );
}

function optionalText(value: string | undefined) {
  const normalized = value ? sanitizeFoundationText(value).trim() : "";
  return normalized || null;
}

function sanitizeFoundationText(value: string) {
  return value
    .replace(/data:[^\s"'<>]+/gi, "[removed]")
    .replace(/blob:[^\s"'<>]+/gi, "[removed]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[removed]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [removed]");
}

function sanitizeFoundationValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeFoundationText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFoundationValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeFoundationValue(item),
      ]),
    ) as T;
  }
  return value;
}

function normalizedProviders(values: readonly string[] | undefined) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value.length <= 40),
    ),
  ).slice(0, 12);
}

function getSourceIdea(input: CloudGrowthMomentMirrorInput) {
  return sanitizeFoundationText(
    input.record.idea.trim() ||
      input.savedStory.story_snapshot.input.customTheme?.trim() ||
      input.savedStory.story_snapshot.coverTitle.trim() ||
      "成长记录",
  );
}

export function buildCloudGrowthMomentMirrorRows(
  userId: string,
  input: CloudGrowthMomentMirrorInput,
  ids: ExistingMirrorIds,
) {
  const momentId = input.record.id;
  const clientVersionId =
    input.clientVersionId?.trim() ||
    `storybook_${input.savedStory.story_snapshot.storyId}`;
  const now = input.record.updated_at || new Date().toISOString();

  return {
    moment: {
      id: momentId,
      user_id: userId,
      child_profile_id: input.record.child_profile_id,
      legacy_growth_record_id: input.record.id,
      client_moment_id: input.record.client_record_id,
      occurred_on: input.record.occurred_on,
      parent_note: sanitizeFoundationText(input.record.note),
      source_idea: getSourceIdea(input),
      parent_facts: optionalText(input.draft.parentFacts),
      allowed_imaginations: optionalText(input.draft.allowedImaginations),
      confirmed_tags: [],
      created_at: input.record.created_at,
      updated_at: now,
    },
    version: {
      id: ids.versionRowId,
      user_id: userId,
      growth_moment_id: momentId,
      saved_story_id: input.record.saved_story_id,
      character_reference_id: null,
      character_profile_id: null,
      client_version_id: clientVersionId,
      client_story_id: input.savedStory.story_snapshot.storyId,
      story_snapshot: sanitizeFoundationValue(input.savedStory.story_snapshot),
      asset_manifest: sanitizeFoundationValue(input.savedStory.asset_manifest),
      reading_stage: input.savedStory.story_snapshot.input.ageGroup,
      illustration_style: input.savedStory.story_snapshot.input.style,
      story_treatment:
        input.draft.storyTreatment ||
        input.savedStory.story_snapshot.input.storyTreatment ||
        null,
      prompt_version: null,
      text_model: null,
      image_providers: normalizedProviders(input.imageProviders),
      character_bible_version: null,
      source: "legacy-growth-record" as const,
      generation_metadata: {},
      created_at: input.savedStory.created_at,
      updated_at: input.savedStory.updated_at,
    },
    assets: input.photos.map((photo) => ({
      id: ids.assetRowIds.get(photo.client_photo_id || photo.id) || photo.id,
      user_id: userId,
      growth_moment_id: momentId,
      client_asset_id: photo.client_photo_id || photo.id,
      asset_kind: "photo" as const,
      storage_path: photo.storage_path,
      original_name: photo.original_name,
      mime_type: "image/webp" as const,
      byte_size: photo.byte_size,
      checksum_sha256: photo.checksum_sha256,
      sort_order: photo.sort_order,
      created_at: photo.created_at || input.record.created_at,
      updated_at: photo.updated_at || now,
    })),
  };
}

export async function mirrorLegacyGrowthRecordToMoment(
  supabase: SupabaseClient,
  userId: string,
  input: CloudGrowthMomentMirrorInput,
) {
  const existingByLegacy = await supabase
    .from("growth_moments")
    .select("id")
    .eq("user_id", userId)
    .eq("legacy_growth_record_id", input.record.id)
    .maybeSingle();
  if (existingByLegacy.error) {
    if (isGrowthMomentFoundationMissing(existingByLegacy.error)) {
      return { foundationAvailable: false as const };
    }
    throw existingByLegacy.error;
  }

  let existingMomentId = existingByLegacy.data?.id as string | undefined;
  if (!existingMomentId) {
    const existingByClient = await supabase
      .from("growth_moments")
      .select("id")
      .eq("user_id", userId)
      .eq("client_moment_id", input.record.client_record_id)
      .maybeSingle();
    if (existingByClient.error) throw existingByClient.error;
    existingMomentId = existingByClient.data?.id as string | undefined;
  }
  if (existingMomentId && existingMomentId !== input.record.id) {
    throw new Error("cloud-growth-moment-client-id-conflict");
  }

  const clientVersionId =
    input.clientVersionId?.trim() ||
    `storybook_${input.savedStory.story_snapshot.storyId}`;
  const [existingVersion, existingAssets] = await Promise.all([
    supabase
      .from("storybook_versions")
      .select("id,client_version_id")
      .eq("user_id", userId)
      .eq("growth_moment_id", input.record.id)
      .eq("client_story_id", input.savedStory.story_snapshot.storyId)
      .maybeSingle(),
    supabase
      .from("growth_moment_assets")
      .select("id,client_asset_id")
      .eq("user_id", userId)
      .eq("growth_moment_id", input.record.id),
  ]);
  if (existingVersion.error) throw existingVersion.error;
  if (existingAssets.error) throw existingAssets.error;

  const assetRowIds = new Map(
    (existingAssets.data || []).flatMap((asset) => [
      [String(asset.client_asset_id), String(asset.id)] as const,
      [String(asset.id), String(asset.id)] as const,
    ]),
  );
  const rows = buildCloudGrowthMomentMirrorRows(userId, input, {
    versionRowId: existingVersion.data?.id || crypto.randomUUID(),
    assetRowIds,
  });
  rows.version.client_version_id =
    input.clientVersionId?.trim() ||
    existingVersion.data?.client_version_id ||
    clientVersionId;

  const momentResult = await supabase
    .from("growth_moments")
    .upsert(rows.moment, { onConflict: "user_id,client_moment_id" })
    .select("id")
    .single();
  if (momentResult.error) throw momentResult.error;

  const versionResult = await supabase
    .from("storybook_versions")
    .upsert(rows.version, {
      onConflict: "user_id,growth_moment_id,client_story_id",
    })
    .select("id")
    .single();
  if (versionResult.error) throw versionResult.error;

  if (rows.assets.length > 0) {
    const assetsResult = await supabase
      .from("growth_moment_assets")
      .upsert(rows.assets, {
        onConflict: "user_id,growth_moment_id,client_asset_id",
      });
    if (assetsResult.error) throw assetsResult.error;
  }

  const nextAssetIds = new Set(rows.assets.map((asset) => asset.id));
  const staleAssetIds = (existingAssets.data || [])
    .map((asset) => String(asset.id))
    .filter((id) => !nextAssetIds.has(id));
  if (staleAssetIds.length > 0) {
    const staleResult = await supabase
      .from("growth_moment_assets")
      .delete()
      .eq("user_id", userId)
      .eq("growth_moment_id", input.record.id)
      .in("id", staleAssetIds);
    if (staleResult.error) throw staleResult.error;
  }

  const activeResult = await supabase
    .from("growth_moments")
    .update({ active_storybook_version_id: versionResult.data.id })
    .eq("user_id", userId)
    .eq("id", input.record.id);
  if (activeResult.error) throw activeResult.error;

  return {
    foundationAvailable: true as const,
    momentId: input.record.id,
    versionId: String(versionResult.data.id),
  };
}

export async function removeMirroredGrowthMoment(
  supabase: SupabaseClient,
  userId: string,
  legacyGrowthRecordId: string,
) {
  const existing = await supabase
    .from("growth_moments")
    .select("id")
    .eq("user_id", userId)
    .eq("legacy_growth_record_id", legacyGrowthRecordId)
    .maybeSingle();
  if (existing.error) {
    if (isGrowthMomentFoundationMissing(existing.error)) return false;
    throw existing.error;
  }
  let momentId = existing.data?.id as string | undefined;
  if (!momentId) {
    const existingById = await supabase
      .from("growth_moments")
      .select("id")
      .eq("user_id", userId)
      .eq("id", legacyGrowthRecordId)
      .maybeSingle();
    if (existingById.error) {
      if (isGrowthMomentFoundationMissing(existingById.error)) return false;
      throw existingById.error;
    }
    momentId = existingById.data?.id as string | undefined;
  }
  if (!momentId) return false;
  const deleted = await supabase
    .from("growth_moments")
    .delete()
    .eq("user_id", userId)
    .eq("id", momentId);
  if (deleted.error) throw deleted.error;
  return true;
}
