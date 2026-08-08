import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoryHistoryStatus } from "@/lib/client-history";
import {
  fromPersistedStorySnapshot,
  isPersistedStoragePath,
  toPersistedStorySnapshot,
  type PersistedStorySnapshot,
} from "@/lib/persistence/story-snapshot";
import {
  createPrivateSignedUrls,
  imageSourceToWebp,
  uploadPrivateWebp,
} from "@/lib/repositories/private-image-storage";
import type {
  SavedStory,
  StoryAssetManifest,
  StoryPatch,
  StoryRepository,
  StorySaveInput,
} from "@/lib/repositories/story-repository";
import type { GenerateResponse } from "@/types";

const STORY_BUCKET = "story-archive" as const;

type SavedStoryRow = {
  id: string;
  user_id: string;
  child_profile_id: string | null;
  client_story_id: string;
  title: string;
  story_snapshot: PersistedStorySnapshot;
  asset_manifest: StoryAssetManifest;
  status: StoryHistoryStatus;
  created_at: string;
  updated_at: string;
};

type SavedStoryAssetRow = {
  id: string;
  asset_key: string;
  storage_path: string;
};

type UploadedStoryAsset = {
  assetKey: string;
  storagePath: string;
  byteSize?: number;
};

function getStoryStatus(result: GenerateResponse): StoryHistoryStatus {
  if (result.pages.some((page) => page.imageStatus === "failed")) return "failed";
  if (
    result.pages.length > 0 &&
    result.pages.every((page) => page.imageStatus === "complete")
  ) {
    return "complete";
  }
  return "generating";
}

function getStoryCompleteness(result: GenerateResponse) {
  const textFields = result.pages.reduce(
    (total, page) =>
      total +
      Number(page.zhText.trim().length > 0) +
      Number(page.enText.trim().length > 0),
    0,
  );
  const completedImages = result.pages.filter(
    (page) => page.imageStatus === "complete" || Boolean(page.imageUrl),
  ).length;
  return [result.pages.length, textFields, completedImages, result.totalPages];
}

function compareStoryCompleteness(
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

function shouldKeepExistingStory(
  existing: SavedStoryRow,
  input: StorySaveInput,
) {
  const nextStatus = input.status || getStoryStatus(input.result);
  if (existing.status === "complete" && nextStatus !== "complete") {
    return true;
  }
  return (
    compareStoryCompleteness(
      input.result,
      fromPersistedStorySnapshot(existing.story_snapshot),
    ) < 0
  );
}

function assertOwnedPath(path: string, userId: string, storyId: string) {
  if (!path.startsWith(`${userId}/${storyId}/`) || !isPersistedStoragePath(path)) {
    throw new Error("story-asset-path-invalid");
  }
  return path;
}

function getAssetKey(page: number | "cover") {
  return page === "cover"
    ? "cover"
    : `page-${String(page).padStart(2, "0")}`;
}

async function uploadStoryAssets(
  supabase: SupabaseClient,
  userId: string,
  savedStoryId: string,
  result: GenerateResponse,
) {
  const entries: StoryAssetManifest["pages"] = [];
  const uploadedAssets: UploadedStoryAsset[] = [];
  const archivedPages = [...result.pages];
  let coverBlob: Blob | undefined;

  for (let index = 0; index < result.pages.length; index += 1) {
    const page = result.pages[index];
    if (!page.imageUrl) continue;

    if (
      isPersistedStoragePath(page.imageUrl) &&
      page.imageUrl.startsWith(`${userId}/${savedStoryId}/`)
    ) {
      const storagePath = assertOwnedPath(page.imageUrl, userId, savedStoryId);
      entries.push({ page: page.page, storagePath, mimeType: "image/webp" });
      uploadedAssets.push({
        assetKey: getAssetKey(page.page),
        storagePath,
      });
      continue;
    }

    const blob = await imageSourceToWebp(page.imageUrl);
    const storagePath = `${userId}/${savedStoryId}/page-${String(
      page.page || index + 1,
    ).padStart(2, "0")}.webp`;
    await uploadPrivateWebp(supabase, STORY_BUCKET, storagePath, blob);
    archivedPages[index] = { ...page, imageUrl: storagePath };
    entries.push({ page: page.page, storagePath, mimeType: "image/webp" });
    uploadedAssets.push({
      assetKey: getAssetKey(page.page),
      storagePath,
      byteSize: blob.size,
    });
    coverBlob ||= blob;
  }

  if (coverBlob) {
    const storagePath = `${userId}/${savedStoryId}/cover.webp`;
    await uploadPrivateWebp(supabase, STORY_BUCKET, storagePath, coverBlob);
    entries.unshift({ page: "cover", storagePath, mimeType: "image/webp" });
    uploadedAssets.unshift({
      assetKey: "cover",
      storagePath,
      byteSize: coverBlob.size,
    });
  }

  return {
    archivedResult: { ...result, pages: archivedPages },
    manifest: { version: 1, pages: entries } satisfies StoryAssetManifest,
    uploadedAssets,
  };
}

async function syncStoryAssetRows(
  supabase: SupabaseClient,
  userId: string,
  storyId: string,
  manifest: StoryAssetManifest,
  uploadedAssets: UploadedStoryAsset[],
) {
  const existingResult = await supabase
    .from("saved_story_assets")
    .select("id,asset_key,storage_path")
    .eq("user_id", userId)
    .eq("saved_story_id", storyId);
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data || []) as SavedStoryAssetRow[];
  const uploadedByPath = new Map(
    uploadedAssets.map((asset) => [asset.storagePath, asset]),
  );
  const nextRows = manifest.pages.map((asset) => {
    const uploaded = uploadedByPath.get(asset.storagePath);
    return {
      user_id: userId,
      saved_story_id: storyId,
      asset_key: getAssetKey(asset.page),
      storage_path: assertOwnedPath(asset.storagePath, userId, storyId),
      mime_type: "image/webp",
      byte_size: uploaded?.byteSize ?? null,
    };
  });
  const nextKeys = new Set(nextRows.map((row) => row.asset_key));
  const nextPaths = new Set(nextRows.map((row) => row.storage_path));
  const staleRows = existing.filter((row) => !nextKeys.has(row.asset_key));
  const stalePaths = staleRows
    .map((row) => assertOwnedPath(row.storage_path, userId, storyId))
    .filter((path) => !nextPaths.has(path));

  if (nextRows.length > 0) {
    const upsertResult = await supabase
      .from("saved_story_assets")
      .upsert(nextRows, {
        onConflict: "user_id,saved_story_id,asset_key",
      });
    if (upsertResult.error) throw upsertResult.error;
  }
  if (stalePaths.length > 0) {
    const removal = await supabase.storage.from(STORY_BUCKET).remove(stalePaths);
    if (removal.error) throw removal.error;
  }
  if (staleRows.length > 0) {
    const deletion = await supabase
      .from("saved_story_assets")
      .delete()
      .eq("user_id", userId)
      .eq("saved_story_id", storyId)
      .in(
        "id",
        staleRows.map((row) => row.id),
      );
    if (deletion.error) throw deletion.error;
  }
}

async function hydrateRow(
  supabase: SupabaseClient,
  userId: string,
  row: SavedStoryRow,
): Promise<SavedStory> {
  const manifest = row.asset_manifest || { version: 1, pages: [] };
  const ownedPaths = manifest.pages.map((asset) =>
    assertOwnedPath(asset.storagePath, userId, row.id),
  );
  const signedUrls = await createPrivateSignedUrls(
    supabase,
    STORY_BUCKET,
    ownedPaths,
  );
  const result = fromPersistedStorySnapshot(row.story_snapshot);

  return {
    id: row.id,
    storyId: row.client_story_id,
    clientStoryId: row.client_story_id,
    childProfileId: row.child_profile_id || undefined,
    result: {
      ...result,
      pages: result.pages.map((page) => ({
        ...page,
        imageUrl: page.imageUrl
          ? signedUrls.get(page.imageUrl) || undefined
          : undefined,
      })),
    },
    assetManifest: manifest,
    status: row.status,
    imageProgress: {
      complete: result.pages.filter((page) => page.imageStatus === "complete").length,
      total: result.pages.length,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCloudStoryRepository(
  supabase: SupabaseClient,
  userId: string,
): StoryRepository {
  async function getRow(id: string) {
    const { data, error } = await supabase
      .from("saved_stories")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as SavedStoryRow | null;
  }

  async function save(input: StorySaveInput) {
    const existingResult = await supabase
      .from("saved_stories")
      .select("*")
      .eq("user_id", userId)
      .eq("client_story_id", input.result.storyId)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;
    const existingRow = existingResult.data as SavedStoryRow | null;
    if (existingRow && shouldKeepExistingStory(existingRow, input)) {
      return hydrateRow(supabase, userId, existingRow);
    }
    const savedStoryId =
      existingRow?.id || input.preferredCloudId || crypto.randomUUID();
    const { archivedResult, manifest, uploadedAssets } = await uploadStoryAssets(
      supabase,
      userId,
      savedStoryId,
      input.result,
    );
    const { data, error } = await supabase
      .from("saved_stories")
      .upsert(
        {
          id: savedStoryId,
          user_id: userId,
          child_profile_id:
            input.childProfileId !== undefined
              ? input.childProfileId
              : existingRow?.child_profile_id ?? null,
          client_story_id: input.result.storyId,
          title: input.result.coverTitle,
          story_snapshot: toPersistedStorySnapshot(archivedResult),
          asset_manifest: manifest,
          status: input.status || getStoryStatus(input.result),
        },
        { onConflict: "user_id,client_story_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    const savedRow = data as SavedStoryRow;
    await syncStoryAssetRows(
      supabase,
      userId,
      savedStoryId,
      savedRow.asset_manifest || manifest,
      uploadedAssets,
    );
    return hydrateRow(supabase, userId, savedRow);
  }

  return {
    async list() {
      const { data, error } = await supabase
        .from("saved_stories")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return Promise.all(
        ((data || []) as SavedStoryRow[]).map((row) =>
          hydrateRow(supabase, userId, row),
        ),
      );
    },

    async get(id) {
      const row = await getRow(id);
      return row ? hydrateRow(supabase, userId, row) : undefined;
    },

    save,

    async update(id: string, patch: StoryPatch) {
      const existing = await getRow(id);
      if (!existing) throw new Error("cloud-story-not-found");
      if (patch.result) {
        if (patch.result.storyId !== existing.client_story_id) {
          throw new Error("cloud-story-client-id-mismatch");
        }
        return save({
          result: patch.result,
          childProfileId:
            patch.childProfileId !== undefined
              ? patch.childProfileId
              : existing.child_profile_id,
          status: patch.status || existing.status,
        });
      }
      const payload: Record<string, string | null> = {};
      if (patch.childProfileId !== undefined) {
        payload.child_profile_id = patch.childProfileId;
      }
      if (patch.status !== undefined) payload.status = patch.status;
      const { data, error } = await supabase
        .from("saved_stories")
        .update(payload)
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return hydrateRow(supabase, userId, data as SavedStoryRow);
    },

    async remove(id) {
      const row = await getRow(id);
      if (!row) return;
      const { error } = await supabase
        .from("saved_stories")
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      if (error) throw error;
      const paths = (row.asset_manifest?.pages || []).map((asset) =>
        assertOwnedPath(asset.storagePath, userId, id),
      );
      if (paths.length > 0) {
        const removal = await supabase.storage.from(STORY_BUCKET).remove(paths);
        if (removal.error) throw removal.error;
      }
    },
  };
}
