import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BailianVoiceCloningError,
  createBailianClonedVoice,
  deleteBailianClonedVoice,
  extractBailianVoiceId,
  queryBailianClonedVoice,
} from "@/lib/bailian-voice-cloning-server";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.BAILIAN_VOICE_CLONING_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.BAILIAN_VOICE_CLONING_ENDPOINT;
  delete process.env.BAILIAN_VOICE_CLONING_TIMEOUT_MS;
  delete process.env.BAILIAN_VOICE_ABSENCE_RECHECK_MS;
});

describe("Bailian voice cloning adapter", () => {
  it("parses the known voice ID response shapes", () => {
    expect(extractBailianVoiceId({ output: { voice_id: "voice-a" } })).toBe(
      "voice-a",
    );
    expect(extractBailianVoiceId({ output: { voice: "voice-b" } })).toBe(
      "voice-b",
    );
    expect(
      extractBailianVoiceId({ output: { voice: { id: "voice-c" } } }),
    ).toBe("voice-c");
    expect(
      extractBailianVoiceId({
        output: { voice: "https://storage.example.test/private" },
      }),
    ).toBeNull();
  });

  it("sends the conventional enrollment body to the standard DashScope endpoint", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { voice: "sb11111111_voice" },
          request_id: "request-1",
        }),
        { status: 200 },
      ),
    );

    const result = await createBailianClonedVoice({
      sampleUrl: "https://storage.example.test/signed/sample.webm?token=private",
      prefix: "sb11111111",
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization",
    );
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "voice-enrollment",
      input: {
        action: "create_voice",
        target_model: "qwen-audio-3.0-tts-plus",
        prefix: "sb11111111",
        url: "https://storage.example.test/signed/sample.webm?token=private",
      },
    });
    expect(result).toEqual({
      voiceId: "sb11111111_voice",
      requestId: "request-1",
    });
  });

  it("falls back to DASHSCOPE_API_KEY when no dedicated cloning key is configured", async () => {
    process.env.DASHSCOPE_API_KEY = "standard-dashscope-key";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { voice: "sb11111111_voice" },
          request_id: "request-2",
        }),
        { status: 200 },
      ),
    );

    await createBailianClonedVoice({
      sampleUrl: "https://storage.example.test/signed/sample.webm",
      prefix: "sb11111111",
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer standard-dashscope-key",
    });
  });

  it("does not expose a provider-echoed signed URL or API key in errors", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "super-secret-key";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "InvalidParameter",
          message:
            "bad https://storage.example.test/sample?token=private super-secret-key",
        }),
        { status: 400 },
      ),
    );

    let error: Error | null = null;
    try {
      await createBailianClonedVoice({
        sampleUrl: "https://storage.example.test/sample?token=private",
        prefix: "sb11111111",
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error?.message).toContain("InvalidParameter");
    expect(error?.message).not.toContain("storage.example.test");
    expect(error?.message).not.toContain("super-secret-key");
    expect(error?.message).not.toContain("token=private");
  });

  it("marks a provider 5xx create response as ambiguous for reconciliation", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "InternalError" }), {
        status: 500,
      }),
    );

    let error: unknown;
    try {
      await createBailianClonedVoice({
        sampleUrl: "https://storage.example.test/sample.wav",
        prefix: "sb11111111",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BailianVoiceCloningError);
    expect((error as BailianVoiceCloningError).ambiguous).toBe(true);
  });

  it("keeps a provider 4xx create response as a definite rejection", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "InvalidParameter" }), {
        status: 400,
      }),
    );

    let error: unknown;
    try {
      await createBailianClonedVoice({
        sampleUrl: "https://storage.example.test/sample.wav",
        prefix: "sb11111111",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BailianVoiceCloningError);
    expect((error as BailianVoiceCloningError).ambiguous).toBe(false);
  });

  it("deletes a cloned voice with the documented delete_voice action", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {},
          usage: { count: 1 },
          request_id: "delete-request-1",
        }),
        { status: 200 },
      ),
    );

    await expect(
      deleteBailianClonedVoice("qwen-audio-3.0-tts-plus-sb11111111-voice"),
    ).resolves.toEqual({ requestId: "delete-request-1" });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "voice-enrollment",
      input: {
        action: "delete_voice",
        voice_id: "qwen-audio-3.0-tts-plus-sb11111111-voice",
      },
    });
  });

  it("queries the documented provider review status without exposing resource links", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            status: "OK",
            resource_link: "https://provider.example.test/private.wav",
          },
          request_id: "query-request-1",
        }),
        { status: 200 },
      ),
    );

    await expect(
      queryBailianClonedVoice("qwen-audio-3.0-tts-plus-sb11111111-voice"),
    ).resolves.toEqual({ status: "OK", requestId: "query-request-1" });
    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "voice-enrollment",
      input: {
        action: "query_voice",
        voice_id: "qwen-audio-3.0-tts-plus-sb11111111-voice",
      },
    });
  });

  it("treats a failed repeated delete as complete only after list_voice confirms absence", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    process.env.BAILIAN_VOICE_ABSENCE_RECHECK_MS = "1";
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: "InvalidParameter", message: "not found" }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ output: { voice_list: [] }, request_id: "list-1" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ output: { voice_list: [] }, request_id: "list-2" }),
          { status: 200 },
        ),
      );

    await expect(
      deleteBailianClonedVoice(
        "qwen-audio-3.0-tts-plus-sb11111111-missing",
        { allowListAbsenceConfirmation: true },
      ),
    ).resolves.toEqual({ alreadyAbsent: true });
    const [, listOptions] = vi.mocked(global.fetch).mock.calls[1];
    expect(JSON.parse(String(listOptions?.body))).toEqual({
      model: "voice-enrollment",
      input: {
        action: "list_voice",
        prefix: "sb11111111",
        page_size: 10,
        page_index: 0,
      },
    });
  });

  it("does not trust same-request list absence for a newly queued voice", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "InternalError" }), {
        status: 500,
      }),
    );

    await expect(
      deleteBailianClonedVoice(
        "qwen-audio-3.0-tts-plus-sb11111111-newly-queued",
      ),
    ).rejects.toThrow("InternalError");
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("does not hide a delete failure when list_voice still contains the voice", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    const voiceId = "qwen-audio-3.0-tts-plus-sb11111111-existing";
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "InternalError" }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ output: { voice_list: [{ voice_id: voiceId }] } }),
          { status: 200 },
        ),
      );

    await expect(
      deleteBailianClonedVoice(voiceId, {
        allowListAbsenceConfirmation: true,
      }),
    ).rejects.toThrow(
      "InternalError",
    );
  });

  it("rejects a non-HTTPS endpoint override without making a request", async () => {
    process.env.BAILIAN_VOICE_CLONING_API_KEY = "test-token";
    process.env.BAILIAN_VOICE_CLONING_ENDPOINT = "http://localhost/customization";
    global.fetch = vi.fn();

    await expect(
      createBailianClonedVoice({
        sampleUrl: "https://storage.example.test/sample.webm",
        prefix: "sb11111111",
      }),
    ).rejects.toThrow("必须使用 HTTPS");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
