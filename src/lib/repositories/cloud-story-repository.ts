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

function assertOwnedPath(path: string, userId: string, storyId: string) {
  if (!path.startsWith(`${userId}/${storyId}/`) || !isPersistedStoragePath(path)) {
    throw new Error("story-asset-path-invalid");
  }
  return path;
}

async function uploadStoryAssets(
  supabase: SupabaseClient,
  userId: string,
  savedStoryId: string,
  result: GenerateResponse,
) {
  const entries: StoryAssetManifest["pages"] = [];
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
      continue;
    }

    const blob = await imageSourceToWebp(page.imageUrl);
    const storagePath = `${userId}/${savedStoryId}/page-${String(
      page.page || index + 1,
    ).padStart(2, "0")}.webp`;
    await uploadPrivateWebp(supabase, STORY_BUCKET, storagePath, blob);
    archivedPages[index] = { ...page, imageUrl: storagePath };
    entries.push({ page: page.page, storagePath, mimeType: "image/webp" });
    coverBlob ||= blob;
  }

  if (coverBlob) {
    const storagePath = `${userId}/${savedStoryId}/cover.webp`;
    await uploadPrivateWebp(supabase, STORY_BUCKET, storagePath, coverBlob);
    entries.unshift({ page: "cover", storagePath, mimeType: "image/webp" });
  }

  return {
    archivedResult: { ...result, pages: archivedPages },
    manifest: { version: 1, pages: entries } satisfies StoryAssetManifest,
  };
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
      .select("id,child_profile_id")
      .eq("user_id", userId)
      .eq("client_story_id", input.result.storyId)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;
    const savedStoryId = existingResult.data?.id || crypto.randomUUID();
    const { archivedResult, manifest } = await uploadStoryAssets(
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
              : existingResult.data?.child_profile_id ?? null,
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
    return hydrateRow(supabase, userId, data as SavedStoryRow);
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
