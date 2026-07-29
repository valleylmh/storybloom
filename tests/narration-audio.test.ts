import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCachedStoryMock } = vi.hoisted(() => ({
  getCachedStoryMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getCachedStory: getCachedStoryMock,
}));

import { createNarrationCacheKey } from "@/lib/client-audio-cache";
import {
  NarrationAudioError,
  resolveNarrationRequest,
} from "@/lib/narration-audio-server";
import { SAMPLE_BOOKS } from "@/lib/sample-books";

function resetTtsEnvironment() {
  getCachedStoryMock.mockReset();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_TTS_ENABLED;
  delete process.env.GEMINI_TTS_MODEL;
  delete process.env.GEMINI_TTS_VOICE_ZH;
  delete process.env.GEMINI_TTS_VOICE_EN;
  delete process.env.DASHSCOPE_TOKEN_KEY;
  delete process.env.TOKEN_PLAN_TTS_ENABLED;
  delete process.env.TOKEN_PLAN_TTS_VOICE_ZH;
  delete process.env.TOKEN_PLAN_TTS_VOICE_EN;
  delete process.env.EDGE_TTS_VOICE_ZH;
  delete process.env.EDGE_TTS_VOICE_EN;
}

beforeEach(resetTtsEnvironment);
afterEach(resetTtsEnvironment);

describe("narration request resolution", () => {
  it("uses the cached story instead of client-provided text", async () => {
    getCachedStoryMock.mockResolvedValue({
      pages: [
        { zhText: "第一页中文", enText: "Page one" },
        { zhText: "第二页中文", enText: "Page two" },
      ],
    });

    const request = await resolveNarrationRequest({
      storyId: "story-123",
      text: "不应使用这段客户端文字",
      mode: "zh",
    });

    expect(request.text).toBe("第一页中文\n\n第二页中文");
    expect(request.textSource).toBe("story");
    expect(request.voice).toBe("zh-CN-XiaoxiaoNeural");
    expect(request.model).toBe("edge-tts");
  });

  it("uses the configured Edge TTS voice for Chinese narration", async () => {
    process.env.EDGE_TTS_VOICE_ZH = "zh-CN-XiaoxiaoNeural";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({
      text: "测试",
      mode: "zh",
    });

    expect(request.model).toBe("edge-tts");
    expect(request.voice).toBe("zh-CN-XiaoxiaoNeural");
  });

  it("prefers Gemini 2.5 Flash TTS when GEMINI_API_KEY is configured", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("gemini-2.5-flash-preview-tts");
    expect(request.voice).toBe("Leda");
    expect(request.format).toBe("wav");
  });

  it("prefers Token Plan TTS when DASHSCOPE_TOKEN_KEY is configured", async () => {
    process.env.DASHSCOPE_TOKEN_KEY = "test-token";
    process.env.GEMINI_API_KEY = "test-key";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("qwen-audio-3.0-tts-plus");
    expect(request.voice).toBe("longanlingxin");
    expect(request.format).toBe("mp3");
  });

  it("skips Token Plan TTS when the token is blank", async () => {
    process.env.DASHSCOPE_TOKEN_KEY = "   ";
    process.env.GEMINI_API_KEY = "test-key";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("gemini-2.5-flash-preview-tts");
  });

  it("can disable Token Plan TTS without removing the token", async () => {
    process.env.DASHSCOPE_TOKEN_KEY = "test-token";
    process.env.TOKEN_PLAN_TTS_ENABLED = "0";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("edge-tts");
  });

  it("can select Gemini 3.1 Flash TTS through configuration", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("gemini-3.1-flash-tts-preview");
    expect(request.voice).toBe("Leda");
    expect(request.format).toBe("wav");
  });

  it("can disable Gemini TTS without removing the API key", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_TTS_ENABLED = "false";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("edge-tts");
    expect(request.voice).toBe("zh-CN-XiaoxiaoNeural");
    expect(request.format).toBe("mp3");
  });

  it("treats an empty comma-separated Gemini key list as unconfigured", async () => {
    process.env.GEMINI_API_KEY = " , , ";
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "测试", mode: "zh" });

    expect(request.model).toBe("edge-tts");
  });

  it("selects the English Edge TTS voice for English narration", async () => {
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({ text: "A little cloud", mode: "en" });

    expect(request.model).toBe("edge-tts");
    expect(request.voice).toBe("en-US-AnaNeural");
  });

  it("falls back to supplied text for static books outside the server cache", async () => {
    getCachedStoryMock.mockResolvedValue(null);

    const request = await resolveNarrationRequest({
      storyId: "sample-brave-cloud",
      text: "静态绘本文字",
      mode: "zh",
      model: "edge-tts",
      voice: "zh-CN-XiaoxiaoNeural",
    });

    expect(request.text).toBe("静态绘本文字");
    expect(request.textSource).toBe("text");
    expect(request.voice).toBe("zh-CN-XiaoxiaoNeural");
  });

  it("rejects narration text beyond the provider limit", async () => {
    await expect(
      resolveNarrationRequest({ text: "绘".repeat(5_001), mode: "zh" }),
    ).rejects.toMatchObject({ status: 413 } satisfies Partial<NarrationAudioError>);
  });
});

describe("narration caches and featured assets", () => {
  it("changes the browser cache key when voice or text changes", async () => {
    const first = await createNarrationCacheKey(
      "story-1",
      "zh",
      "longmiao_v3",
      "第一版",
    );
    const second = await createNarrationCacheKey(
      "story-1",
      "zh",
      "longhuhu_v3",
      "第一版",
    );
    const third = await createNarrationCacheKey(
      "story-1",
      "zh",
      "longmiao_v3",
      "第二版",
    );

    expect(new Set([first.key, second.key, third.key])).toHaveLength(3);
  });

  it("declares deterministic Chinese MP3 paths for every static book", () => {
    expect(SAMPLE_BOOKS.map((book) => book.narrationAudio?.url)).toEqual([
      "/sample-books/audio/brave-cloud/zh.mp3",
      "/sample-books/audio/moon-lamp/zh.mp3",
      "/sample-books/audio/garden-mail/zh.mp3",
    ]);
    expect(
      SAMPLE_BOOKS.every(
        (book) =>
          book.narrationAudio?.model === "cosyvoice-v3-flash" &&
          book.narrationAudio.voice === "longmiao_v3" &&
          book.narrationAudio.format === "mp3",
      ),
    ).toBe(true);
  });
});
