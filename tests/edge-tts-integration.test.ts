import { describe, expect, it } from "vitest";
import {
  prepareNarrationAudio,
  resolveNarrationRequest,
} from "@/lib/narration-audio-server";

const runIntegration = process.env.RUN_EDGE_TTS_INTEGRATION === "1";

describe("Edge TTS integration", () => {
  it.runIf(runIntegration)("generates real MP3 audio for eight story pages", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const pages = [
      "小云朵第一次离开妈妈，去看看远方的山。",
      "它在树林上空遇见了一只迷路的小鸟。",
      "小云朵轻轻落下细雨，帮小鸟找到回家的河流。",
      "太阳出来了，天空挂起一道明亮的彩虹。",
      "小鸟邀请新朋友一起飞过绿色的山谷。",
      "傍晚时，它们在金色的云边说再见。",
      "小云朵带着今天的故事，慢慢飘回妈妈身边。",
      "妈妈抱住它说，勇敢就是温柔地帮助别人。",
    ];

    for (const text of pages) {
      const request = await resolveNarrationRequest({
        text,
        mode: "zh",
        model: "edge-tts",
        format: "mp3",
        sampleRate: 24_000,
      });
      const result = await prepareNarrationAudio(request);

      expect(result.model).toBe("edge-tts");
      expect(result.voice).toBe("zh-CN-XiaoxiaoNeural");
      expect(result.bytes).toBeGreaterThan(1_000);
      expect(result.audioUrl).toMatch(/^data:audio\/mpeg;base64,/);
      const audio = Buffer.from(result.audioUrl.split(",", 2)[1], "base64");
      expect(audio.length).toBe(result.bytes);
      expect(
        audio.subarray(0, 3).toString("ascii") === "ID3" ||
          (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0),
      ).toBe(true);
    }
  }, 120_000);
});
