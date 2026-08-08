import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChildProfile {
  id: string;
  familyProfileId: string;
  userId: string;
  displayName: string;
  primaryCharacterId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChildProfileInput {
  familyProfileId: string;
  displayName: string;
  primaryCharacterId?: string;
}

export interface ChildProfilePatch {
  displayName?: string;
  primaryCharacterId?: string | null;
}

export interface ChildRepository {
  list(): Promise<ChildProfile[]>;
  get(id: string): Promise<ChildProfile | undefined>;
  save(input: ChildProfileInput): Promise<ChildProfile>;
  update(id: string, patch: ChildProfilePatch): Promise<ChildProfile>;
  remove(id: string): Promise<void>;
}

type ChildProfileRow = {
  id: string;
  family_profile_id: string;
  user_id: string;
  display_name: string;
  primary_character_id: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    familyProfileId: row.family_profile_id,
    userId: row.user_id,
    displayName: row.display_name,
    primaryCharacterId: row.primary_character_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCloudChildRepository(
  supabase: SupabaseClient,
  userId: string,
): ChildRepository {
  return {
    async list() {
      const { data, error } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as ChildProfileRow[]).map(fromRow);
    },

    async get(id) {
      const { data, error } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as ChildProfileRow) : undefined;
    },

    async save(input) {
      const { data, error } = await supabase
        .from("child_profiles")
        .insert({
          user_id: userId,
          family_profile_id: input.familyProfileId,
          display_name: input.displayName.trim(),
          primary_character_id: input.primaryCharacterId || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return fromRow(data as ChildProfileRow);
    },

    async update(id, patch) {
      const payload: Record<string, string | null> = {};
      if (patch.displayName !== undefined) {
        payload.display_name = patch.displayName.trim();
      }
      if (patch.primaryCharacterId !== undefined) {
        payload.primary_character_id = patch.primaryCharacterId;
      }
      const { data, error } = await supabase
        .from("child_profiles")
        .update(payload)
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return fromRow(data as ChildProfileRow);
    },

    async remove(id) {
      const { error } = await supabase
        .from("child_profiles")
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
