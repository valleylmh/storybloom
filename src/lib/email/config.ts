import "server-only";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getEmailConfig() {
  return {
    appUrl: requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, ""),
    from: requireEnv("RESEND_FROM_EMAIL"),
    replyTo: process.env.RESEND_REPLY_TO_EMAIL?.trim() || undefined,
    topicId: requireEnv("RESEND_TOPIC_ID"),
  };
}

export function getSupabaseAdminConfig() {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
