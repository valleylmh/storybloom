import type { SupabaseClient } from "@supabase/supabase-js";

export const GUARDIAN_CONSENT_VERSION = "2026-08";

export async function recordGuardianConsent(
  supabase: SupabaseClient,
  userId: string,
) {
  const { error } = await supabase
    .from("family_profiles")
    .update({
      guardian_consent_at: new Date().toISOString(),
      guardian_consent_version: GUARDIAN_CONSENT_VERSION,
    })
    .eq("user_id", userId);

  if (error) throw error;
}
