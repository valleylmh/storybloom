import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpaqueToken,
  createSignedUnsubscribeToken,
  decodeActionToken,
  encodeActionToken,
  hashOpaqueToken,
  signedUnsubscribeTokenMatches,
  tokenMatches,
} from "../src/lib/email/tokens";
import {
  generateDailyInspiration,
  getFallbackDailyInspiration,
  getShanghaiDateKey,
} from "../src/lib/email/daily-inspiration";

afterEach(() => {
  delete process.env.CPA_API_KEY;
  delete process.env.CPA_BASE_URL;
  delete process.env.CPA_TEXT_MODEL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("newsletter action tokens", () => {
  it("stores and verifies only token hashes", () => {
    const token = createOpaqueToken();
    const hash = hashOpaqueToken(token);
    expect(token).toHaveLength(43);
    expect(hash).toHaveLength(64);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(`${token}x`, hash)).toBe(false);
  });

  it("round-trips a subscription action token", () => {
    const id = "019d0123-4567-789a-bcde-0123456789ab";
    const token = createOpaqueToken();
    expect(decodeActionToken(encodeActionToken(id, token))).toEqual({ id, token });
    expect(decodeActionToken("invalid")).toBeNull();
  });

  it("creates a reusable signed unsubscribe token", () => {
    process.env.NEWSLETTER_ACTION_SECRET = "test-newsletter-action-secret";
    const id = "019d0123-4567-789a-bcde-0123456789ab";
    const token = createSignedUnsubscribeToken(id, "Parent@Example.com");

    expect(token.startsWith("v1.")).toBe(true);
    expect(
      signedUnsubscribeTokenMatches(token, id, "parent@example.com"),
    ).toBe(true);
    expect(
      signedUnsubscribeTokenMatches(token, id, "someone@example.com"),
    ).toBe(false);
    delete process.env.NEWSLETTER_ACTION_SECRET;
  });
});

describe("daily newsletter inspiration", () => {
  it("uses the Shanghai calendar date", () => {
    expect(getShanghaiDateKey(new Date("2026-07-12T16:30:00.000Z"))).toBe(
      "2026-07-13",
    );
  });

  it("provides stable curated fallback content", () => {
    const first = getFallbackDailyInspiration("2026-07-13");
    const second = getFallbackDailyInspiration("2026-07-13");

    expect(second).toEqual(first);
    expect(first.source).toBe("fallback");
    expect(first.questions_zh).toHaveLength(3);
    expect(first.questions_en).toHaveLength(3);
    expect(first.story_prompt_zh.length).toBeGreaterThan(8);
  });

  it("uses the configured CPA OpenAI-compatible endpoint and model", async () => {
    process.env.CPA_API_KEY = "test-cpa-key";
    process.env.CPA_BASE_URL = "https://example.com/v1/";
    process.env.CPA_TEXT_MODEL = "gemini-3-flash";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  theme: "勇气与尝试",
                  title_zh: "会唱歌的小台阶",
                  title_en: "The Singing Steps",
                  opening_zh: "孩子发现每走上一级台阶，就会响起一种新的声音，于是决定慢慢走到最高处。",
                  opening_en: "A child discovers that every step plays a new note and decides to climb slowly to the top.",
                  questions_zh: ["你最喜欢什么声音？", "害怕时可以怎样慢慢来？", "最高处会有什么？"],
                  questions_en: ["What sound do you like most?", "How can you go slowly when nervous?", "What might be waiting at the top?"],
                  story_prompt_zh: "孩子沿着会唱歌的台阶慢慢向上，在音乐中找到尝试新事物的勇气",
                  story_prompt_en: "A child climbs singing steps and finds courage in each new note",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const inspiration = await generateDailyInspiration("2026-07-14");

    expect(inspiration.source).toBe("generated");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-cpa-key",
    );
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("gemini-3-flash");
  });

  it("falls back to curated content when CPA rejects the model", async () => {
    process.env.CPA_API_KEY = "test-cpa-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message:
                "Model @cf/zai-org/glm-5.2 requires a Workers Paid plan",
            },
          ],
          success: false,
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const inspiration = await generateDailyInspiration("2026-07-14");

    expect(inspiration.source).toBe("fallback");
    expect(inspiration.questions_zh).toHaveLength(3);
  });
});
