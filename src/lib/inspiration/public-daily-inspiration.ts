import "server-only";

import { z } from "zod";
import {
  getFallbackDailyInspiration,
  getShanghaiDateKey,
} from "@/lib/email/daily-inspiration";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import type { PublicDailyInspiration } from "./types";

const DAILY_INSPIRATION_TABLE = "daily_story_inspirations";

export const PUBLIC_DAILY_INSPIRATION_COLUMNS = [
  "id",
  "issue_date",
  "theme",
  "title_zh",
  "title_en",
  "opening_zh",
  "opening_en",
  "questions_zh",
  "questions_en",
  "story_prompt_zh",
  "story_prompt_en",
].join(",");

const dailyInspirationRowSchema = z.object({
  id: z.string().uuid(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.string(),
  title_zh: z.string(),
  title_en: z.string(),
  opening_zh: z.string(),
  opening_en: z.string(),
  questions_zh: z.array(z.string()),
  questions_en: z.array(z.string()),
  story_prompt_zh: z.string(),
  story_prompt_en: z.string(),
});

type DailyInspirationRow = z.infer<typeof dailyInspirationRowSchema>;

export function toPublicDailyInspiration(
  input: DailyInspirationRow,
): PublicDailyInspiration {
  return {
    id: input.id,
    issueDate: input.issue_date,
    theme: input.theme,
    titleZh: input.title_zh,
    titleEn: input.title_en,
    openingZh: input.opening_zh,
    openingEn: input.opening_en,
    questionsZh: input.questions_zh,
    questionsEn: input.questions_en,
    storyPromptZh: input.story_prompt_zh,
    storyPromptEn: input.story_prompt_en,
  };
}

export function getFallbackPublicDailyInspiration(
  issueDate: string,
): PublicDailyInspiration {
  const fallback = getFallbackDailyInspiration(issueDate);
  return {
    id: `fallback-${issueDate}`,
    issueDate,
    theme: fallback.theme,
    titleZh: fallback.title_zh,
    titleEn: fallback.title_en,
    openingZh: fallback.opening_zh,
    openingEn: fallback.opening_en,
    questionsZh: fallback.questions_zh,
    questionsEn: fallback.questions_en,
    storyPromptZh: fallback.story_prompt_zh,
    storyPromptEn: fallback.story_prompt_en,
  };
}

export async function getPublicDailyInspirationForDate(
  issueDate: string,
): Promise<PublicDailyInspiration> {
  const { data, error } = await getSupabaseAdmin()
    .from(DAILY_INSPIRATION_TABLE)
    .select(PUBLIC_DAILY_INSPIRATION_COLUMNS)
    .eq("issue_date", issueDate)
    .maybeSingle();

  if (error) throw error;
  if (!data) return getFallbackPublicDailyInspiration(issueDate);

  return toPublicDailyInspiration(dailyInspirationRowSchema.parse(data));
}

export function getTodayPublicDailyInspiration(date = new Date()) {
  return getPublicDailyInspirationForDate(getShanghaiDateKey(date));
}
