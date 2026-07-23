import "server-only";

import { getEmailConfig } from "./config";
import {
  generateDailyInspiration,
  type DailyInspirationContent,
} from "./daily-inspiration";
import { sendEmail } from "./resend";
import { getSupabaseAdmin } from "./supabase-admin";
import { dailyInspirationTemplate } from "./templates";
import {
  createSignedUnsubscribeToken,
  encodeActionToken,
} from "./tokens";

type DailyInspirationRecord = DailyInspirationContent & {
  id: string;
};

type SubscriptionRecipient = {
  id: string;
  email: string;
  locale: string | null;
};

export type DailyDeliverySummary = {
  issueDate: string;
  inspirationId: string;
  source: DailyInspirationContent["source"];
  recipients: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
};

const INSPIRATION_TABLE = "daily_story_inspirations";
const DELIVERY_TABLE = "newsletter_deliveries";
const SUBSCRIPTION_TABLE = "newsletter_subscriptions";

async function getOrCreateDailyInspiration(issueDate: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from(INSPIRATION_TABLE)
    .select("*")
    .eq("issue_date", issueDate)
    .maybeSingle<DailyInspirationRecord>();
  if (findError) throw findError;
  if (existing) return existing;

  const generated = await generateDailyInspiration(issueDate);
  const { error: insertError } = await supabase
    .from(INSPIRATION_TABLE)
    .upsert(generated, {
      onConflict: "issue_date",
      ignoreDuplicates: true,
    });
  if (insertError) throw insertError;

  const { data: inspiration, error: loadError } = await supabase
    .from(INSPIRATION_TABLE)
    .select("*")
    .eq("issue_date", issueDate)
    .single<DailyInspirationRecord>();
  if (loadError) throw loadError;
  return inspiration;
}

async function listConfirmedSubscriptions() {
  const supabase = getSupabaseAdmin();
  const recipients: SubscriptionRecipient[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(SUBSCRIPTION_TABLE)
      .select("id,email,locale")
      .eq("status", "confirmed")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as SubscriptionRecipient[];
    recipients.push(...page);
    if (page.length < pageSize) break;
  }

  return recipients;
}

async function claimDelivery(
  inspirationId: string,
  recipient: SubscriptionRecipient,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "claim_newsletter_delivery",
    {
      p_inspiration_id: inspirationId,
      p_subscription_id: recipient.id,
      p_recipient_email: recipient.email,
    },
  );
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

function localizedContent(
  inspiration: DailyInspirationRecord,
  locale: string | null,
) {
  const english = locale?.startsWith("en");
  return english
    ? {
        theme: "Family story idea",
        title: inspiration.title_en,
        opening: inspiration.opening_en,
        questions: inspiration.questions_en,
        storyPrompt: inspiration.story_prompt_en,
      }
    : {
        theme: inspiration.theme,
        title: inspiration.title_zh,
        opening: inspiration.opening_zh,
        questions: inspiration.questions_zh,
        storyPrompt: inspiration.story_prompt_zh,
      };
}

function localizedIssueDate(issueDate: string, locale: string | null) {
  const english = locale?.startsWith("en");
  return new Date(issueDate + "T12:00:00Z").toLocaleDateString(
    english ? "en-US" : "zh-CN",
    {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

async function updateDelivery(
  deliveryId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await getSupabaseAdmin()
    .from(DELIVERY_TABLE)
    .update(patch)
    .eq("id", deliveryId);
  if (error) throw error;
}

function getConcurrency() {
  const parsed = Number.parseInt(
    process.env.NEWSLETTER_SEND_CONCURRENCY || "5",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 5;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await task(item);
      }
    }),
  );
}

export async function runDailyInspirationDelivery(
  issueDate: string,
): Promise<DailyDeliverySummary> {
  const inspiration = await getOrCreateDailyInspiration(issueDate);
  const recipients = await listConfirmedSubscriptions();
  const { appUrl } = getEmailConfig();
  const summary: DailyDeliverySummary = {
    issueDate,
    inspirationId: inspiration.id,
    source: inspiration.source,
    recipients: recipients.length,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  await runWithConcurrency(recipients, getConcurrency(), async (recipient) => {
    let deliveryId: string | null = null;
    try {
      deliveryId = await claimDelivery(inspiration.id, recipient);
      if (!deliveryId) {
        summary.skipped += 1;
        return;
      }
      summary.claimed += 1;

      const localized = localizedContent(inspiration, recipient.locale);
      const generateUrl =
        appUrl +
        "/?mode=minimal&idea=" +
        encodeURIComponent(localized.storyPrompt);
      const unsubscribeToken = encodeActionToken(
        recipient.id,
        createSignedUnsubscribeToken(recipient.id, recipient.email),
      );
      const unsubscribeUrl =
        appUrl +
        "/api/newsletter/unsubscribe?token=" +
        encodeURIComponent(unsubscribeToken);
      const result = await sendEmail({
        to: recipient.email,
        subject:
          (recipient.locale?.startsWith("en")
            ? "Today's story idea | "
            : "今日绘本灵感｜") + localized.title,
        html: dailyInspirationTemplate({
          issueDate: localizedIssueDate(issueDate, recipient.locale),
          theme: localized.theme,
          title: localized.title,
          opening: localized.opening,
          questions: localized.questions,
          generateUrl,
          unsubscribeUrl,
          locale: recipient.locale || undefined,
        }),
        headers: {
          "List-Unsubscribe": "<" + unsubscribeUrl + ">",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        idempotencyKey:
          "daily-inspiration-" + issueDate + "-" + recipient.id,
      });
      await updateDelivery(deliveryId, {
        status: "sent",
        resend_email_id: result?.id || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error";
      console.error("Daily newsletter delivery failed", {
        subscriptionId: recipient.id,
        deliveryId,
        error,
      });
      if (deliveryId) {
        try {
          await updateDelivery(deliveryId, {
            status: "failed",
            error_message: message,
          });
        } catch (updateError) {
          console.error("Unable to mark daily newsletter delivery as failed", {
            deliveryId,
            error: updateError,
          });
        }
      }
    }
  });

  return summary;
}
