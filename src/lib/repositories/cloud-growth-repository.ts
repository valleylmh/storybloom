import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isValidGrowthDate,
  type GrowthRecord,
  type GrowthRecordPhoto,
} from "@/lib/growth-records";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import type {
  GrowthRecordInput,
  GrowthRecordPatch,
  GrowthRepository,
} from "@/lib/repositories/growth-repository";
import {
  createPrivateSignedUrls,
  imageSourceToWebp,
  uploadPrivateWebp,
} from "@/lib/repositories/private-image-storage";
import type { GenerateResponse } from "@/types";

const GROWTH_PHOTO_BUCKET = "growth-record-photos" as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GrowthRecordRow = {
  id: string;
  user_id: string;
  child_profile_id: string;
  saved_story_id: string | null;
  client_record_id: string;
  occurred_on: string;
  note: string;
  idea: string;
  created_at: string;
  updated_at: string;
};

type GrowthPhotoRow = {
  id: string;
  user_id: string;
  growth_record_id: string;
  storage_path: string;
  original_name: string;
  sort_order: number;
  created_at: string;
};

function assertOwnedPhotoPath(path: string, userId: string, recordId: string) {
  if (!path.startsWith(`${userId}/${recordId}/`) || path.includes("..")) {
    throw new Error("growth-photo-path-invalid");
  }
  return path;
}

function createStoryFallback(
  row: GrowthRecordRow,
  childName: string,
): GenerateResponse {
  return {
    storyId: row.client_record_id,
    input: {
      childName,
      ageGroup: "4-5",
      theme: "custom",
      customTheme: row.idea,
      style: "fairytale",
      language: "zh-en",
    },
    coverTitle: row.idea || `${childName}的成长记录`,
    pages: [],
    totalPages: 0,
    generationMode: "live",
    freeChanceLabel: "",
  };
}

export function createCloudGrowthRepository(
  supabase: SupabaseClient,
  userId: string,
): GrowthRepository {
  const storyRepository = createCloudStoryRepository(supabase, userId);

  async function getRows(childProfileId?: string) {
    let query = supabase
      .from("growth_records")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .order("updated_at", { ascending: false });
    if (childProfileId) query = query.eq("child_profile_id", childProfileId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as GrowthRecordRow[];
  }

  async function hydrateRows(rows: GrowthRecordRow[]): Promise<GrowthRecord[]> {
    if (rows.length === 0) return [];
    const recordIds = rows.map((row) => row.id);
    const childIds = Array.from(new Set(rows.map((row) => row.child_profile_id)));
    const [photosResult, childrenResult] = await Promise.all([
      supabase
        .from("growth_record_photos")
        .select("*")
        .eq("user_id", userId)
        .in("growth_record_id", recordIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("child_profiles")
        .select("id,display_name,primary_character_id")
        .eq("user_id", userId)
        .in("id", childIds),
    ]);
    if (photosResult.error) throw photosResult.error;
    if (childrenResult.error) throw childrenResult.error;

    const photoRows = (photosResult.data || []) as GrowthPhotoRow[];
    const signedUrls = await createPrivateSignedUrls(
      supabase,
      GROWTH_PHOTO_BUCKET,
      photoRows.map((photo) =>
        assertOwnedPhotoPath(photo.storage_path, userId, photo.growth_record_id),
      ),
    );
    const childNames = new Map(
      (childrenResult.data || []).map((child) => [child.id, child.display_name]),
    );
    const storyIds = Array.from(
      new Set(rows.flatMap((row) => (row.saved_story_id ? [row.saved_story_id] : []))),
    );
    const savedStories = new Map(
      (
        await Promise.all(
          storyIds.map(async (id) => [id, await storyRepository.get(id)] as const),
        )
      ).flatMap(([id, story]) => (story ? [[id, story] as const] : [])),
    );

    return rows.map((row) => {
      const childName = childNames.get(row.child_profile_id) || "孩子";
      const savedStory = row.saved_story_id
        ? savedStories.get(row.saved_story_id)
        : undefined;
      const photos: GrowthRecordPhoto[] = photoRows
        .filter((photo) => photo.growth_record_id === row.id)
        .map((photo) => ({
          id: photo.id,
          name: photo.original_name,
          dataUrl: signedUrls.get(photo.storage_path) || "",
        }))
        .filter((photo) => photo.dataUrl.length > 0);

      return {
        id: row.id,
        storyId: savedStory?.clientStoryId || row.client_record_id,
        childKey: row.child_profile_id,
        childName,
        occurredOn: row.occurred_on,
        note: row.note,
        idea: row.idea,
        photos,
        story: savedStory?.result || createStoryFallback(row, childName),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async function getRow(id: string) {
    const { data, error } = await supabase
      .from("growth_records")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as GrowthRecordRow | null;
  }

  async function replacePhotos(
    growthRecordId: string,
    photos: GrowthRecordPhoto[],
  ) {
    if (photos.length > 4) throw new Error("growth-photos-invalid");
    const existingResult = await supabase
      .from("growth_record_photos")
      .select("*")
      .eq("user_id", userId)
      .eq("growth_record_id", growthRecordId);
    if (existingResult.error) throw existingResult.error;
    const existing = (existingResult.data || []) as GrowthPhotoRow[];
    const nextRows: Array<{
      id: string;
      user_id: string;
      growth_record_id: string;
      storage_path: string;
      original_name: string;
      sort_order: number;
    }> = [];

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const photoId = UUID_PATTERN.test(photo.id) ? photo.id : crypto.randomUUID();
      const storagePath = `${userId}/${growthRecordId}/${photoId}.webp`;
      const blob = await imageSourceToWebp(photo.dataUrl, {
        maxDimension: 1600,
        quality: 0.86,
      });
      await uploadPrivateWebp(
        supabase,
        GROWTH_PHOTO_BUCKET,
        storagePath,
        blob,
      );
      nextRows.push({
        id: photoId,
        user_id: userId,
        growth_record_id: growthRecordId,
        storage_path: storagePath,
        original_name: photo.name,
        sort_order: index,
      });
    }

    const deleteRows = await supabase
      .from("growth_record_photos")
      .delete()
      .eq("user_id", userId)
      .eq("growth_record_id", growthRecordId);
    if (deleteRows.error) throw deleteRows.error;
    if (nextRows.length > 0) {
      const insertRows = await supabase.from("growth_record_photos").insert(nextRows);
      if (insertRows.error) throw insertRows.error;
    }
    const nextPaths = new Set(nextRows.map((row) => row.storage_path));
    const stalePaths = existing
      .map((photo) =>
        assertOwnedPhotoPath(photo.storage_path, userId, growthRecordId),
      )
      .filter((path) => !nextPaths.has(path));
    if (stalePaths.length > 0) {
      const removal = await supabase.storage
        .from(GROWTH_PHOTO_BUCKET)
        .remove(stalePaths);
      if (removal.error) throw removal.error;
    }
  }

  async function hydrateOne(row: GrowthRecordRow) {
    const [record] = await hydrateRows([row]);
    if (!record) throw new Error("cloud-growth-hydration-failed");
    return record;
  }

  return {
    async list() {
      return hydrateRows(await getRows());
    },

    async getByChild(childId) {
      return hydrateRows(await getRows(childId));
    },

    async save(input: GrowthRecordInput) {
      if (!input.childProfileId) {
        throw new Error("cloud-growth-child-profile-required");
      }
      if (!isValidGrowthDate(input.draft.occurredOn)) {
        throw new Error("growth-date-invalid");
      }
      const savedStoryId =
        input.savedStoryId ||
        (
          await storyRepository.save({
            result: input.story,
            childProfileId: input.childProfileId,
          })
        ).id;
      const existing = await supabase
        .from("growth_records")
        .select("id")
        .eq("user_id", userId)
        .eq("client_record_id", input.clientRecordId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      const growthRecordId = existing.data?.id || crypto.randomUUID();
      const { data, error } = await supabase
        .from("growth_records")
        .upsert(
          {
            id: growthRecordId,
            user_id: userId,
            child_profile_id: input.childProfileId,
            saved_story_id: savedStoryId,
            client_record_id: input.clientRecordId,
            occurred_on: input.draft.occurredOn,
            note: input.draft.note,
            idea: input.draft.idea,
          },
          { onConflict: "user_id,client_record_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      await replacePhotos(growthRecordId, input.draft.photos);
      return hydrateOne(data as GrowthRecordRow);
    },

    async update(id: string, patch: GrowthRecordPatch) {
      const existing = await getRow(id);
      if (!existing) throw new Error("cloud-growth-not-found");
      if (patch.occurredOn !== undefined && !isValidGrowthDate(patch.occurredOn)) {
        throw new Error("growth-date-invalid");
      }
      const storyIdToUpdate = patch.savedStoryId || existing.saved_story_id;
      if (patch.story && storyIdToUpdate) {
        await storyRepository.update(storyIdToUpdate, {
          result: patch.story,
        });
      }
      const payload: Record<string, string | null> = {};
      if (patch.occurredOn !== undefined) payload.occurred_on = patch.occurredOn;
      if (patch.note !== undefined) payload.note = patch.note;
      if (patch.idea !== undefined) payload.idea = patch.idea;
      if (patch.savedStoryId !== undefined) {
        payload.saved_story_id = patch.savedStoryId;
      }
      let row = existing;
      if (Object.keys(payload).length > 0) {
        const { data, error } = await supabase
          .from("growth_records")
          .update(payload)
          .eq("user_id", userId)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        row = data as GrowthRecordRow;
      }
      if (patch.photos) await replacePhotos(id, patch.photos);
      return hydrateOne(row);
    },

    async remove(id) {
      const photos = await supabase
        .from("growth_record_photos")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("growth_record_id", id);
      if (photos.error) throw photos.error;
      const paths = (photos.data || []).map((photo) =>
        assertOwnedPhotoPath(photo.storage_path, userId, id),
      );
      const { error } = await supabase
        .from("growth_records")
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      if (error) throw error;
      if (paths.length > 0) {
        const removal = await supabase.storage
          .from(GROWTH_PHOTO_BUCKET)
          .remove(paths);
        if (removal.error) throw removal.error;
      }
    },
  };
}
