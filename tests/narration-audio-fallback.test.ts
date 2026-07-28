import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCachedStoryMock,
  synthesizeEdgeTtsAudioMock,
  synthesizeGeminiTtsAudioMock,
} = vi.hoisted(() => ({
  getCachedStoryMock: vi.fn(),
  synthesizeEdgeTtsAudioMock: vi.fn(),
  synthesizeGeminiTtsAudioMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getCachedStory: getCachedStoryMock,
}));

vi.mock("@/lib/edge-tts-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/edge-tts-server")>();
  return {
    ...original,
    synthesizeEdgeTtsAudio: synthesizeEdgeTtsAudioMock,
  };
});

vi.mock("@/lib/gemini-tts-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/gemini-tts-server")>();
  return {
    ...original,
    synthesizeGeminiTtsAudio: synthesizeGeminiTtsAudioMock,
  };
});

import { GeminiTtsAudioError } from "@/lib/gemini-tts-server";
import {
  prepareNarrationAudio,
  resolveNarrationRequest,
} from "@/lib/narration-audio-server";

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  getCachedStoryMock.mockResolvedValue(null);
  synthesizeGeminiTtsAudioMock.mockReset();
  synthesizeEdgeTtsAudioMock.mockReset();
  synthesizeGeminiTtsAudioMock.mockRejectedValue(
    new GeminiTtsAudioError("Gemini unavailable", 502),
  );
  synthesizeEdgeTtsAudioMock.mockResolvedValue({
    bytes: Buffer.from([0x49, 0x44, 0x33, 0x04]),
    requestId: "edge-request",
    usage: { characters: 2 },
  });
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  vi.restoreAllMocks();
});

describe("narration provider fallback", () => {
  it("uses Gemini 3.1 when Gemini 2.5 fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    synthesizeGeminiTtsAudioMock
      .mockRejectedValueOnce(new GeminiTtsAudioError("Gemini 2.5 unavailable", 502))
      .mockResolvedValueOnce({
        bytes: Buffer.from("RIFF-test-WAVE"),
        contentType: "audio/wav",
        usage: { characters: 2 },
      });

    const request = await resolveNarrationRequest({ text: "你好", mode: "zh" });
    const result = await prepareNarrationAudio(request);

    expect(synthesizeGeminiTtsAudioMock.mock.calls.map(([input]) => input.model)).toEqual([
      "gemini-2.5-flash-preview-tts",
      "gemini-3.1-flash-tts-preview",
    ]);
    expect(synthesizeEdgeTtsAudioMock).not.toHaveBeenCalled();
    expect(result.model).toBe("gemini-3.1-flash-tts-preview");
    expect(result.format).toBe("wav");
    expect(warn).toHaveBeenCalledWith(
      "[audio] TTS provider failed; using fallback",
      expect.objectContaining({
        model: "gemini-2.5-flash-preview-tts",
        fallbackModel: "gemini-3.1-flash-tts-preview",
      }),
    );
  });

  it("returns correctly labelled Edge MP3 when Gemini fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = await resolveNarrationRequest({ text: "你好", mode: "zh" });
    const result = await prepareNarrationAudio(request);

    expect(synthesizeGeminiTtsAudioMock).toHaveBeenCalledTimes(2);
    expect(synthesizeGeminiTtsAudioMock.mock.calls.map(([input]) => input.model)).toEqual([
      "gemini-2.5-flash-preview-tts",
      "gemini-3.1-flash-tts-preview",
    ]);
    expect(synthesizeEdgeTtsAudioMock).toHaveBeenCalledOnce();
    expect(synthesizeEdgeTtsAudioMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 1 }),
    );
    expect(result.model).toBe("edge-tts");
    expect(result.voice).toBe("zh-CN-XiaoxiaoNeural");
    expect(result.format).toBe("mp3");
    expect(result.audioUrl).toMatch(/^data:audio\/mpeg;base64,/);
    expect(warn).toHaveBeenCalledWith(
      "[audio] TTS provider failed; using fallback",
      expect.objectContaining({
        model: "gemini-3.1-flash-tts-preview",
        fallbackModel: "edge-tts",
      }),
    );
  });
});
