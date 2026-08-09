import { afterEach, describe, expect, it, vi } from "vitest";

const getToday = vi.hoisted(() => vi.fn());

vi.mock("@/lib/inspiration/public-daily-inspiration", () => ({
  getTodayPublicDailyInspiration: getToday,
}));

import { GET } from "@/app/api/inspiration/today/route";

const inspiration = {
  id: "019d0123-4567-789a-bcde-0123456789ab",
  issueDate: "2026-08-09",
  theme: "勇气与尝试",
  titleZh: "会唱歌的小台阶",
  titleEn: "The Singing Steps",
  openingZh: "孩子发现每走上一级台阶，就会响起一种新的声音，于是决定慢慢走到最高处。",
  openingEn: "A child discovers that every step plays a new note and decides to climb slowly to the top.",
  questionsZh: ["你最喜欢什么声音？"],
  questionsEn: ["What sound do you like most?"],
  storyPromptZh: "孩子沿着会唱歌的台阶慢慢向上，在音乐中找到尝试新事物的勇气",
  storyPromptEn: "A child climbs singing steps and finds courage in each new note",
};

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/inspiration/today", () => {
  it("is public and returns only the public inspiration payload", async () => {
    getToday.mockResolvedValue(inspiration);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(inspiration);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("hides server/database errors behind a generic response", async () => {
    getToday.mockRejectedValue(new Error("secret database details"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to load today's inspiration",
    });
  });
});
