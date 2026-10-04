import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { send, allowRequest } = vi.hoisted(() => ({ send: vi.fn(), allowRequest: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ getResend: () => ({ emails: { send } }) }));
vi.mock("@/lib/request-rate-limit", () => ({ allowIpRequest: allowRequest }));

import { POST } from "@/app/api/library/feedback/route";

const body = {
  contentId: "chengyu/shou-zhu-dai-tu",
  page: 2,
  type: "文字",
  message: "第二页的英文有个拼写问题。",
  requestId: "ed6f3de5-9c17-4148-a534-9a05353c94d3",
};

function request(payload: unknown = body, origin = "https://storybloom.example") {
  return new Request("https://storybloom.example/api/library/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.stubEnv("STORYBLOOM_FEEDBACK_EMAIL", "support@example.com");
  vi.stubEnv("RESEND_FROM_EMAIL", "StoryBloom <hello@example.com>");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  send.mockReset().mockResolvedValue({ data: { id: "test-message" }, error: null });
  allowRequest.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("library feedback submission", () => {
  it("uses the configured recipient and real book metadata in the email", async () => {
    const response = await POST(request({ ...body, title: "伪造标题", to: "attacker@example.com" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const [email] = send.mock.calls[0];
    expect(email.to).toBe("support@example.com");
    expect(email.subject).toContain("守株待兔");
    expect(email.text).toContain("第 2 页");
    expect(email.text).toContain(body.message);
    expect(email.text).toContain("https://storybloom.example/library/chengyu/shou-zhu-dai-tu");
    expect(email.text).not.toContain("伪造标题");
  });

  it("reuses an idempotency key for unchanged retries and changes it for edited drafts", async () => {
    await POST(request());
    await POST(request());
    await POST(request({ ...body, message: "修改后的反馈" }));
    const keys = send.mock.calls.map((call) => call[1].idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[2]);
  });

  it.each([
    { ...body, message: "   " },
    { ...body, message: "字".repeat(1001) },
    { ...body, page: 99 },
    { ...body, contentId: "chengyu/unknown-book" },
    { ...body, type: "unknown" },
  ])("rejects invalid feedback without sending mail", async (payload) => {
    expect((await POST(request(payload))).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    expect((await POST(request(body, "https://other.example"))).status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies even when Content-Length is absent", async () => {
    const response = await POST(request({ ...body, extra: "x".repeat(9000) }));
    expect(response.status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("https://storybloom.example/api/library/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
    }));
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps missing configuration unavailable instead of claiming submission", async () => {
    vi.stubEnv("STORYBLOOM_FEEDBACK_EMAIL", "");
    expect((await POST(request())).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it("enforces the existing request limiter", async () => {
    allowRequest.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { message: "provider rejected" } },
    { data: null, error: null },
  ])("requires a provider message id before reporting success", async (result) => {
    send.mockResolvedValue(result);
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect((await response.json()).ok).toBeUndefined();
  });

  it("hides provider exceptions and recipient details from public responses", async () => {
    send.mockRejectedValue(new Error("secret support@example.com provider key"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("support@example.com");
  });
});
