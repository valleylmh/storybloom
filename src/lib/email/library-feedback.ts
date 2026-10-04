import "server-only";

import { z } from "zod";

export function getLibraryFeedbackConfig() {
  const to = process.env.STORYBLOOM_FEEDBACK_EMAIL?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!to || !z.string().email().safeParse(to).success || !from || !process.env.RESEND_API_KEY?.trim()) {
    return null;
  }
  return { to, from };
}
