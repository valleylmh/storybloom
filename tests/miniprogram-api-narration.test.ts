import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiNarrationSource } from "../miniprogram/src/core/api-narration";
import { NarrationController, type NarrationSource } from "../miniprogram/src/core/narration";
import type { BookPage } from "../miniprogram/src/core/types";
const page = (text: string): BookPage => ({ zh: text, en: "English", image: "", audio: { zh: "", en: "" } });
afterEach(() => vi.unstubAllGlobals());
function setup(text: string) {
  const requests: Array<{ data: unknown; success: (response: unknown) => void; fail: () => void }> = [];
  const abort = vi.fn();
  const writeFile = vi.fn((options: { success: () => void }) => options.success());
  vi.stubGlobal("wx", { env: { USER_DATA_PATH: "/tmp/test" },
    request: vi.fn(options => { requests.push(options); return { abort }; }),
    getFileSystemManager: () => ({ writeFile, unlink: vi.fn() }),
  });
  const source = new ApiNarrationSource("https://example.com/api/audio", [page(text)]);
  return { source, requests, abort, writeFile };
}
describe("mini existing website audio API", () => {
  it("sends only the public page and mode, and briefly caches the returned HTTPS audio", async () => {
    const { source, requests } = setup("request-cache");
    const pending = source.resolve(0, "zh");
    expect(requests[0].data).toEqual({ text: "request-cache", mode: "zh", sampleRate: 24000 });
    requests[0].success({ statusCode: 200, data: { audioUrl: "https://media.example.com/signed.mp3?token=test" } });
    expect(await pending).toContain("signed.mp3");
    expect(await source.resolve(0, "zh")).toContain("signed.mp3");
    expect(requests).toHaveLength(1);
  });
  it("aborts old requests and ignores a late successful response", async () => {
    const { source, requests, abort } = setup("cancel-request");
    const pending = source.resolve(0, "zh");
    const rejected = expect(pending).rejects.toThrow("暂停");
    source.cancel();
    requests[0].success({ statusCode: 200, data: { audioUrl: "https://media.example.com/old.mp3" } });
    await rejected; expect(abort).toHaveBeenCalledOnce();
  });
  it("converts inline audio to a local playable file", async () => {
    const { source, requests, writeFile } = setup("inline-audio");
    const pending = source.resolve(0, "zh");
    requests[0].success({ statusCode: 200, data: { audioUrl: "data:audio/mpeg;base64,YXVkaW8=" } });
    expect(await pending).toMatch(/^\/tmp\/test\/storybloom-audio-.*\.mp3$/);
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ data: "YXVkaW8=", encoding: "base64" }));
  });
  it("reports throttling without exposing provider errors", async () => {
    const { source, requests } = setup("throttled");
    const pending = source.resolve(0, "zh");
    requests[0].success({ statusCode: 429, data: { error: "private provider detail" } });
    await expect(pending).rejects.toThrow("请求较多");
  });
  it("rejects unsupported audio payloads", async () => {
    const { source, requests } = setup("bad-result");
    const pending = source.resolve(0, "zh");
    requests[0].success({ statusCode: 200, data: { audioUrl: "javascript:alert(1)" } });
    await expect(pending).rejects.toThrow("格式不支持");
  });
  it("does not start a track when an asynchronous generation finishes after pause", async () => {
    let resolve!: (url: string) => void;
    const source: NarrationSource = { resolve: () => new Promise<string>(done => { resolve = done; }), cancel: vi.fn() };
    const createAudio = vi.fn();
    const controller = new NarrationController([page("pending")], createAudio, () => {}, 0, source);
    controller.play(); controller.pause(); resolve("https://example.com/old.mp3");
    await Promise.resolve();
    expect(createAudio).not.toHaveBeenCalled();
    expect(controller.state.active).toBe(false);
    controller.destroy();
  });
});
