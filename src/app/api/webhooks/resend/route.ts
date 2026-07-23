import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { recordNewsletterDeliveryEvent } from "@/lib/email/newsletter";

export const runtime = "nodejs";

type ResendWebhook = {
  type: string;
  created_at?: string;
  data?: { to?: string[] | string };
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  const payload = await request.text();
  let event: ResendWebhook;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") || "",
      "svix-timestamp": request.headers.get("svix-timestamp") || "",
      "svix-signature": request.headers.get("svix-signature") || "",
    }) as ResendWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const status = event.type === "email.bounced" ? "bounced" : event.type === "email.complained" ? "complained" : null;
  if (!status) return NextResponse.json({ ok: true, ignored: true });
  const recipients = Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : [];
  try {
    await Promise.all(recipients.map((email) => recordNewsletterDeliveryEvent({ email, status, occurredAt: event.created_at })));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
