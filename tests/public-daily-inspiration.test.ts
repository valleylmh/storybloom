import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: supabaseMocks.from }),
}));

import {
  getFallbackPublicDailyInspiration,
  getPublicDailyInspirationForDate,
  getTodayPublicDailyInspiration,
  PUBLIC_DAILY_INSPIRATION_COLUMNS,
} from "@/lib/inspiration/public-daily-inspiration";

const ROW = {
  id: "019d0123-4567-789a-bcde-0123456789ab",
  issue_date: "2026-08-09",
  theme: "勇气与尝试",
  title_zh: "会唱歌的小台阶",
  title_en: "The Singing Steps",
  opening_zh: "孩子发现每走上一级台阶，就会响起一种新的声音，于是决定慢慢走到最高处。",
  opening_en: "A child discovers that every step plays a new note and decides to climb slowly to the top.",
  questions_zh: ["你最喜欢什么声音？", "害怕时可以怎样慢慢来？", "最高处会有什么？"],
  questions_en: ["What sound do you like most?", "How can you go slowly when nervous?", "What might be waiting at the top?"],
  story_prompt_zh: "孩子沿着会唱歌的台阶慢慢向上，在音乐中找到尝试新事物的勇气",
  story_prompt_en: "A child climbs singing steps and finds courage in each new note",
  source: "generated",
  created_at: "2026-08-09T00:00:00.000Z",
  updated_at: "2026-08-09T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMocks.from.mockReturnValue({ select: supabaseMocks.select });
  supabaseMocks.select.mockReturnValue({ eq: supabaseMocks.eq });
  supabaseMocks.eq.mockReturnValue({ maybeSingle: supabaseMocks.maybeSingle });
});

describe("public daily inspiration reader", () => {
  it("uses an explicit public-column allowlist and maps rows to camelCase", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: ROW, error: null });

    const result = await getPublicDailyInspirationForDate("2026-08-09");

    expect(supabaseMocks.from).toHaveBeenCalledWith("daily_story_inspirations");
    expect(supabaseMocks.select).toHaveBeenCalledWith(
      PUBLIC_DAILY_INSPIRATION_COLUMNS,
    );
    expect(supabaseMocks.eq).toHaveBeenCalledWith("issue_date", "2026-08-09");
    expect(result).toEqual({
      id: ROW.id,
      issueDate: ROW.issue_date,
      theme: ROW.theme,
      titleZh: ROW.title_zh,
      titleEn: ROW.title_en,
      openingZh: ROW.opening_zh,
      openingEn: ROW.opening_en,
      questionsZh: ROW.questions_zh,
      questionsEn: ROW.questions_en,
      storyPromptZh: ROW.story_prompt_zh,
      storyPromptEn: ROW.story_prompt_en,
    });
    expect(result).not.toHaveProperty("source");
    expect(result).not.toHaveProperty("created_at");
  });

  it("returns a stable Shanghai-date fallback when today's row is absent", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const first = await getPublicDailyInspirationForDate("2026-08-09");
    const second = await getPublicDailyInspirationForDate("2026-08-09");

    expect(first).toEqual(second);
    expect(first).toEqual(getFallbackPublicDailyInspiration("2026-08-09"));
    expect(first.id).toBe("fallback-2026-08-09");
    expect(first.questionsZh).toHaveLength(3);
    expect(first.questionsEn).toHaveLength(3);
  });

  it("uses the Shanghai calendar date for the today reader", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await getTodayPublicDailyInspiration(new Date("2026-08-08T16:30:00.000Z"));

    expect(supabaseMocks.eq).toHaveBeenCalledWith("issue_date", "2026-08-09");
  });

  it("does not turn a database error into generated or emailed content", async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: null,
      error: new Error("database unavailable"),
    });

    await expect(
      getPublicDailyInspirationForDate("2026-08-09"),
    ).rejects.toThrow("database unavailable");
  });
});
