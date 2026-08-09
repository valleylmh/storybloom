"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CloudChildSummary {
  id: string;
  displayName: string;
}

export interface CloudAccountSummary {
  cloudSyncEnabled: boolean;
  children: CloudChildSummary[];
  counts: {
    children: number;
    characters: number;
    stories: number;
    growthRecords: number;
    photos: number;
  };
}

async function countRows(
  supabase: SupabaseClient,
  table: string,
  userId: string,
) {
  const result = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return result.count || 0;
}

export async function loadCloudAccountSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<CloudAccountSummary> {
  const [settings, children, characters, stories, growthRecords, photos] =
    await Promise.all([
      supabase
        .from("account_settings")
        .select("cloud_sync_enabled")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("child_profiles")
        .select("id,display_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      countRows(supabase, "family_characters", userId),
      countRows(supabase, "saved_stories", userId),
      countRows(supabase, "growth_records", userId),
      countRows(supabase, "growth_record_photos", userId),
    ]);

  if (settings.error) throw settings.error;
  if (children.error) throw children.error;

  const childRows = (children.data || []) as Array<{
    id: string;
    display_name: string;
  }>;

  return {
    cloudSyncEnabled: Boolean(settings.data?.cloud_sync_enabled),
    children: childRows.map((child) => ({
      id: child.id,
      displayName: child.display_name,
    })),
    counts: {
      children: childRows.length,
      characters,
      stories,
      growthRecords,
      photos,
    },
  };
}

export async function updateCloudSyncPreference(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
) {
  const { error } = await supabase.from("account_settings").upsert(
    {
      user_id: userId,
      cloud_sync_enabled: enabled,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
