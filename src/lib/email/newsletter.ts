import "server-only";

import { getEmailConfig } from "./config";
import { addNewsletterContact, removeNewsletterContact, sendEmail } from "./resend";
import { getSupabaseAdmin } from "./supabase-admin";
import { newsletterConfirmationTemplate, newsletterWelcomeTemplate } from "./templates";
import {
  createOpaqueToken,
  encodeActionToken,
  hashOpaqueToken,
  signedUnsubscribeTokenMatches,
  tokenMatches,
} from "./tokens";

export type NewsletterStatus = "pending" | "confirmed" | "unsubscribed" | "bounced" | "complained";

type Subscription = {
  id: string;
  email: string;
  status: NewsletterStatus;
  locale: string | null;
  confirm_token_hash: string | null;
  unsubscribe_token_hash: string;
  resend_contact_id: string | null;
};

const TABLE = "newsletter_subscriptions";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function actionUrls(id: string, confirmToken: string, unsubscribeToken: string) {
  const { appUrl } = getEmailConfig();
  return {
    confirmUrl: `${appUrl}/api/newsletter/confirm?token=${encodeURIComponent(encodeActionToken(id, `${confirmToken}~${unsubscribeToken}`))}`,
    unsubscribeUrl: `${appUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(encodeActionToken(id, unsubscribeToken))}`,
  };
}

export async function requestNewsletterSubscription(input: {
  email: string;
  parentName?: string;
  locale?: string;
  source?: string;
  consentVersion: string;
}) {
  const email = normalizeEmail(input.email);
  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase.from(TABLE).select("*").eq("email", email).maybeSingle<Subscription>();
  if (findError) throw findError;
  if (existing?.status === "confirmed") return { status: "confirmed" as const };

  const confirmToken = createOpaqueToken();
  const unsubscribeToken = createOpaqueToken();
  const now = new Date().toISOString();
  const record = {
    email,
    status: "pending" as const,
    parent_name: input.parentName?.trim() || null,
    locale: input.locale?.trim() || "zh-CN",
    source: input.source?.trim() || "website",
    consent_version: input.consentVersion,
    consent_at: now,
    confirm_token_hash: hashOpaqueToken(confirmToken),
    unsubscribe_token_hash: hashOpaqueToken(unsubscribeToken),
    confirmed_at: null,
    unsubscribed_at: null,
    updated_at: now,
  };
  const query = existing
    ? supabase.from(TABLE).update(record).eq("id", existing.id).select("*").single<Subscription>()
    : supabase.from(TABLE).insert(record).select("*").single<Subscription>();
  const { data: subscription, error } = await query;
  if (error) throw error;

  const urls = actionUrls(subscription.id, confirmToken, unsubscribeToken);
  await sendEmail({
    to: email,
    subject: subscription.locale?.startsWith("en") ? "Confirm your StoryBloom subscription" : "确认订阅 StoryBloom",
    html: newsletterConfirmationTemplate({ ...urls, locale: subscription.locale || undefined }),
    idempotencyKey: `newsletter-confirm-${subscription.id}-${record.confirm_token_hash.slice(0, 16)}`,
  });
  return { status: "pending" as const };
}

export async function confirmNewsletterSubscription(id: string, token: string) {
  const supabase = getSupabaseAdmin();
  const { data: subscription, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle<Subscription>();
  if (error) throw error;
  const [confirmToken, unsubscribeToken] = token.split("~", 2);
  if (!subscription || !confirmToken || !unsubscribeToken || !subscription.confirm_token_hash || !tokenMatches(confirmToken, subscription.confirm_token_hash) || !tokenMatches(unsubscribeToken, subscription.unsubscribe_token_hash)) return null;
  if (subscription.status === "confirmed") return subscription;
  if (subscription.status !== "pending") return null;

  const contact = await addNewsletterContact(subscription.email);
  const now = new Date().toISOString();
  const { data: confirmed, error: updateError } = await supabase
    .from(TABLE)
    .update({
      status: "confirmed",
      confirmed_at: now,
      confirm_token_hash: null,
      resend_contact_id: contact?.id || subscription.resend_contact_id || null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle<Subscription>();
  if (updateError) throw updateError;
  if (!confirmed) return subscription;

  const { appUrl } = getEmailConfig();
  const unsubscribeUrl =
    appUrl +
    "/api/newsletter/unsubscribe?token=" +
    encodeURIComponent(encodeActionToken(id, unsubscribeToken));
  await sendEmail({
    to: confirmed.email,
    subject: confirmed.locale?.startsWith("en") ? "Welcome to StoryBloom" : "欢迎来到 StoryBloom",
    html: newsletterWelcomeTemplate({
      unsubscribeUrl,
      familyUrl: `${appUrl}/family`,
      locale: confirmed.locale || undefined,
    }),
    idempotencyKey: `newsletter-welcome-${id}`,
  });
  return confirmed;
}

export async function unsubscribeNewsletter(id: string, token: string) {
  const supabase = getSupabaseAdmin();
  const { data: subscription, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle<Subscription>();
  if (error) throw error;
  if (
    !subscription ||
    (!tokenMatches(token, subscription.unsubscribe_token_hash) &&
      !signedUnsubscribeTokenMatches(token, subscription.id, subscription.email))
  ) return null;
  if (subscription.status === "unsubscribed") return subscription;
  await removeNewsletterContact(subscription.email);
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from(TABLE)
    .update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now })
    .eq("id", id)
    .select("*")
    .single<Subscription>();
  if (updateError) throw updateError;
  return updated;
}

export async function recordNewsletterDeliveryEvent(input: {
  email: string;
  status: Extract<NewsletterStatus, "bounced" | "complained">;
  occurredAt?: string;
}) {
  const email = normalizeEmail(input.email);
  const now = input.occurredAt || new Date().toISOString();
  const patch = input.status === "bounced"
    ? { status: input.status, bounce_at: now, last_event_at: now, updated_at: now }
    : { status: input.status, complaint_at: now, last_event_at: now, updated_at: now };
  const { error } = await getSupabaseAdmin().from(TABLE).update(patch).eq("email", email);
  if (error) throw error;
  await removeNewsletterContact(email);
}
