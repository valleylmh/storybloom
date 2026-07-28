import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGeminiTtsPrompt,
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
});
