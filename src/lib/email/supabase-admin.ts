import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "./config";

// Database types are generated after the first linked Supabase deployment.
// Keep this server-only client schema-agnostic so fresh environments can run migrations first.
let client: ReturnType<typeof createClient<any>> | undefined;

export function getSupabaseAdmin() {
  if (!client) {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    client = createClient<any>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
