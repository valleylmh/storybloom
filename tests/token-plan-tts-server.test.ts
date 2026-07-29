import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasTokenPlanTtsConfig,
  isTrustedTokenPlanAudioUrl,
  synthesizeTokenPlanTtsAudio,
} from "@/lib/token-plan-tts-server";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.DASHSCOPE_TOKEN_KEY;
  delete process.env.TOKEN_PLAN_TTS_ENDPOINT;
  delete process.env.TOKEN_PLAN_TTS_TIMEOUT_MS;
});

describe("Token Plan TTS server", () => {
  it("treats a blank token as unconfigured", () => {
    process.env.DASHSCOPE_TOKEN_KEY = "   ";
    expect(hasTokenPlanTtsConfig()).toBe(false);
  });

  it("accepts only trusted Beijing OSS audio URLs", () => {
    expect(
      isTrustedTokenPlanAudioUrl(
        "http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio/test.mp3",
      ),
    ).toBe(true);
    expect(isTrustedTokenPlanAudioUrl("https://example.com/audio/test.mp3")).toBe(false);
  });

  it("generates and downloads a valid MP3", async () => {
    process.env.DASHSCOPE_TOKEN_KEY = "test-token";
    const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: {
              audio: {
                id: "audio-1",
                expires_at: 1_800_000_000,
                url: "http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio/test.mp3",
              },
              finish_reason: "stop",
            },
            usage: { characters: 7 },
            request_id: "request-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(mp3, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
      );

    const result = await synthesizeTokenPlanTtsAudio({
      text: "花园里的故事。",
      voice: "longanlingxin",
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [requestUrl, requestOptions] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(requestUrl)).toContain("token-plan.cn-beijing.maas.aliyuncs.com");
    expect(requestOptions?.headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
    const requestBody = JSON.parse(String(requestOptions?.body));
    expect(requestBody).toMatchObject({
      model: "qwen-audio-3.0-tts-plus",
      input: {
        voice: "longanlingxin",
        format: "mp3",
        sample_rate: 24_000,
      },
    });
    expect(String(vi.mocked(global.fetch).mock.calls[1][0])).toMatch(/^https:/);
    expect(result.bytes).toEqual(mp3);
    expect(result.requestId).toBe("request-1");
    expect(result.usage.characters).toBe(7);
  });

  it("rejects an untrusted audio download URL", async () => {
    process.env.DASHSCOPE_TOKEN_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            audio: { url: "https://example.com/not-trusted.mp3" },
            finish_reason: "stop",
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      synthesizeTokenPlanTtsAudio({ text: "测试", voice: "longanlingxin" }),
    ).rejects.toThrow("不可信的音频地址");
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
