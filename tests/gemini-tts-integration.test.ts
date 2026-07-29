import { describe, expect, it } from "vitest";
import { synthesizeGeminiTtsAudio } from "@/lib/gemini-tts-server";

const runIntegration = process.env.RUN_GEMINI_TTS_INTEGRATION === "1";
const runKeyRotation = process.env.RUN_GEMINI_TTS_KEY_ROTATION === "1";

describe("Gemini TTS integration", () => {
  it.runIf(runIntegration).each([
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
  ])("generates real Chinese WAV audio with %s", async (model) => {
    const result = await synthesizeGeminiTtsAudio({
      text: "你好，欢迎来到故事花园。",
      voice: "Leda",
      mode: "zh",
      model,
    });

    expect(result.contentType).toBe("audio/wav");
    expect(result.bytes.length).toBeGreaterThan(10_000);
    expect(result.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(result.bytes.readUInt32LE(24)).toBe(24_000);
  }, 60_000);

  it.runIf(runKeyRotation)(
    "skips an invalid key and generates audio with the next configured key",
    async () => {
      const originalApiKeys = process.env.GEMINI_API_KEY || "";
      process.env.GEMINI_API_KEY = `invalid-test-key,${originalApiKeys}`;

      try {
        const result = await synthesizeGeminiTtsAudio({
          text: "你好，欢迎来到故事花园。",
          voice: "Leda",
          mode: "zh",
          model: "gemini-2.5-flash-preview-tts",
        });

        expect(result.contentType).toBe("audio/wav");
        expect(result.bytes.length).toBeGreaterThan(10_000);
        expect(result.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      } finally {
        process.env.GEMINI_API_KEY = originalApiKeys;
      }
    },
    60_000,
  );
});
