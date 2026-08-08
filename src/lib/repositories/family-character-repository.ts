import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureFamilyProfile(
  supabase: SupabaseClient,
  userId: string,
  options: { displayName?: string; locale?: string } = {},
) {
  const existing = await supabase
    .from("family_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from("family_profiles")
    .upsert(
      {
        user_id: userId,
        display_name: options.displayName || "我的家庭",
        locale: options.locale || "zh-CN",
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

export async function listFamilyCharacters<T>(
  supabase: SupabaseClient,
  filter: { userId?: string; profileId?: string },
) {
  let query = supabase.from("family_characters").select("*").order("sort_order");
  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.profileId) query = query.eq("profile_id", filter.profileId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as T[];
}

export async function countFamilyCharacters(
  supabase: SupabaseClient,
  userId: string,
) {
  const profile = await supabase
    .from("family_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) return 0;
  const result = await supabase
    .from("family_characters")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.data.id);
  if (result.error) throw result.error;
  return result.count || 0;
}

export async function upsertFamilyCharacter(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("family_characters").upsert(payload);
  if (error) throw error;
}

export async function updateFamilyCharacter(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("family_characters")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteFamilyCharacter(
  supabase: SupabaseClient,
  userId: string,
  id: string,
) {
  const { error } = await supabase
    .from("family_characters")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function uploadFamilyPhoto(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
) {
  const { error } = await supabase.storage
    .from("family-photos")
    .upload(path, blob, { contentType: "image/webp", upsert: true });
  if (error) throw error;
}

export async function removeFamilyPhotos(
  supabase: SupabaseClient,
  paths: string[],
) {
  if (paths.length === 0) return;
  await supabase.storage.from("family-photos").remove(paths);
}

export async function createFamilyPhotoUrls(
  supabase: SupabaseClient,
  paths: string[],
) {
  const urls: Record<string, string> = {};
  if (paths.length === 0) return urls;
  const { data, error } = await supabase.storage
    .from("family-photos")
    .createSignedUrls(paths, 3600);
  if (error) return urls;
  data?.forEach((item, index) => {
    if (item.signedUrl) urls[paths[index]] = item.signedUrl;
  });
  return urls;
}
