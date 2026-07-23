import "server-only";

import { Resend } from "resend";
import { getEmailConfig } from "./config";

let client: Resend | undefined;

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing required environment variable: RESEND_API_KEY");
  client ??= new Resend(apiKey);
  return client;
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  idempotencyKey: string;
  headers?: Record<string, string>;
}) {
  const config = getEmailConfig();
  const { data, error } = await getResend().emails.send(
    {
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
    },
    { idempotencyKey: input.idempotencyKey },
  );
  if (error) throw new Error(`Resend email failed: ${error.message}`);
  return data;
}

export async function addNewsletterContact(email: string) {
  const { topicId } = getEmailConfig();
  const { data, error } = await getResend().contacts.create({
    email,
    unsubscribed: false,
    topics: [{ id: topicId, subscription: "opt_in" }],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Resend contact sync failed: ${error.message}`);
  }
  if (!error) {
    return data;
  }

  const { error: topicError } = await getResend().contacts.topics.update({
    email,
    topics: [{ id: topicId, subscription: "opt_in" }],
  });
  if (topicError) {
    throw new Error(`Resend topic opt-in failed: ${topicError.message}`);
  }
  const existing = await getResend().contacts.get({ email });
  return existing.data ? { id: existing.data.id, object: "contact" as const } : null;
}

export async function removeNewsletterContact(email: string) {
  const { topicId } = getEmailConfig();
  const { error } = await getResend().contacts.topics.update({
    email,
    topics: [{ id: topicId, subscription: "opt_out" }],
  });
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`Resend topic opt-out failed: ${error.message}`);
  }
}
