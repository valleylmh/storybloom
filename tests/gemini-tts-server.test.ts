import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGeminiTtsPrompt,
  parseGeminiApiKeys,
  synthesizeGeminiTtsAudio,
  wrapPcm16LeAsWav,
} from "@/lib/gemini-tts-server";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_TTS_BASE_URL;
  delete process.env.GEMINI_TTS_MAX_ATTEMPTS;
});

describe("Gemini TTS server", () => {
  it("wraps 24 kHz mono PCM in a valid WAV container", () => {
    const pcm = Buffer.from([0x00, 0x00, 0xff, 0x7f]);
    const wav = wrapPcm16LeAsWav(pcm);

    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it("adds picture-book delivery guidance without changing the supplied text", () => {
    const prompt = buildGeminiTtsPrompt("小云朵回家了。", "zh");

    expect(prompt).toContain("儿童绘本旁白");
    expect(prompt.endsWith("小云朵回家了。")).toBe(true);
  });

  it("parses comma-separated Gemini API keys and removes blanks and duplicates", () => {
    expect(parseGeminiApiKeys(" key-one, key-two ,,key-one,  key-three ")).toEqual([
      "key-one",
      "key-two",
      "key-three",
    ]);
  });

  it("calls Gemini generateContent and returns playable WAV bytes", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_TTS_BASE_URL = "https://gemini.example/v1beta";
    process.env.GEMINI_TTS_MAX_ATTEMPTS = "1";
    const pcm = Buffer.from([0x00, 0x00, 0x10, 0x00]);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/L16;codec=pcm;rate=24000",
                      data: pcm.toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 34,
            totalTokenCount: 46,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await synthesizeGeminiTtsAudio({
      text: "你好。",
      voice: "Leda",
      mode: "zh",
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain(
      "/models/gemini-2.5-flash-preview-tts:generateContent",
    );
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "test-key" });
    expect(result.contentType).toBe("audio/wav");
    expect(result.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.usage.outputTokens).toBe(34);
  });

  it("tries comma-separated API keys from left to right", async () => {
    process.env.GEMINI_API_KEY = "first-key, second-key, first-key";
    process.env.GEMINI_TTS_MAX_ATTEMPTS = "1";
    const pcm = Buffer.from([0x00, 0x00, 0x10, 0x00]);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "audio/L16;codec=pcm;rate=24000",
                        data: pcm.toString("base64"),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await synthesizeGeminiTtsAudio({
      text: "你好。",
      voice: "Leda",
      mode: "zh",
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(global.fetch).mock.calls.map(([, options]) =>
        (options?.headers as Record<string, string>)["x-goog-api-key"],
      ),
    ).toEqual(["first-key", "second-key"]);
    expect(result.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("fails only after every configured API key has been tried", async () => {
    process.env.GEMINI_API_KEY = "first-key,second-key";
    process.env.GEMINI_TTS_MAX_ATTEMPTS = "1";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 403, message: "Invalid key" } }),
        { status: 403 },
      ),
    );

    await expect(
      synthesizeGeminiTtsAudio({ text: "你好。", voice: "Leda", mode: "zh" }),
    ).rejects.toThrow("Gemini TTS 请求失败");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
