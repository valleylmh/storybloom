import { NextResponse } from "next/server";
import { z } from "zod";
import { requestNewsletterSubscription } from "@/lib/email/newsletter";
import { canRequestNewsletter } from "@/lib/email/subscription-rate-limit";
import crypto from "node:crypto";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(254),
  parentName: z.string().trim().max(80).optional(),
  locale: z.string().trim().max(16).optional(),
  source: z.string().trim().max(64).optional(),
  marketingConsent: z.literal(true),
  consentVersion: z.string().trim().min(1).max(32).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid subscription request" }, { status: 400 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const identifier = crypto.createHash("sha256").update(ip).digest("hex");
    if (!(await canRequestNewsletter(identifier))) {
      return NextResponse.json({ error: "Too many subscription requests" }, { status: 429 });
    }
    await requestNewsletterSubscription({
      ...parsed.data,
      consentVersion:
        parsed.data.consentVersion || process.env.NEWSLETTER_CONSENT_VERSION || "2026-07",
    });
    // Keep the public response generic so callers cannot enumerate confirmed emails.
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (error) {
    console.error("Newsletter subscription failed", error);
    return NextResponse.json({ error: "Unable to process subscription" }, { status: 500 });
  }
}
