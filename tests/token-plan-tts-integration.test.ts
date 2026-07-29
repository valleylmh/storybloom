import { describe, expect, it } from "vitest";
import { synthesizeTokenPlanTtsAudio } from "@/lib/token-plan-tts-server";

const runIntegration = process.env.RUN_TOKEN_PLAN_TTS_INTEGRATION === "1";

describe("Token Plan TTS integration", () => {
  it.runIf(runIntegration)("generates real Chinese MP3 audio", async () => {
    const result = await synthesizeTokenPlanTtsAudio({
      text: "我家的后面有一个很大的花园。",
      voice: "longanlingxin",
      model: "qwen-audio-3.0-tts-plus",
    });

    expect(result.contentType).toBe("audio/mpeg");
    expect(result.bytes.length).toBeGreaterThan(10_000);
    expect(result.bytes.subarray(0, 3).toString("ascii")).toBe("ID3");
  }, 30_000);
});
