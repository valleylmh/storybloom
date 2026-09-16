import { afterEach, describe, it, expect, vi } from "vitest";
import {
  customImageConfig,
  requestCustomImage,
} from "@/lib/custom-book/provider";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("custom workbench GPT routing", () => {
  it("uses GPT Image 2 independently of the existing CPA model setting", () => {
    vi.stubEnv("CUSTOM_BOOK_IMAGE_MODEL", "");
    vi.stubEnv("CPA_IMAGE_MODEL", "gemini-3.1-flash-image");
    vi.stubEnv("CPA_API_KEY", "test");
    expect(customImageConfig().model).toBe("gpt-image-2");
  });
  it("calls the edit endpoint with references and refuses an invalid payload without fallback", async () => {
    vi.stubEnv("CPA_API_KEY", "test");
    vi.stubEnv("CPA_BASE_URL", "https://image.example/v1");
    vi.stubEnv("CUSTOM_BOOK_IMAGE_BASE_URL", "");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ url: "http://127.0.0.1/private" }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      requestCustomImage(
        "prompt",
        [{ bytes: new Uint8Array([1, 2, 3]), label: "hero" }],
        "1536x1024",
        "gpt-image-2",
      ),
    ).rejects.toThrow("未返回有效图片");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://image.example/v1/images/edits",
    );
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get("model")).toBe("gpt-image-2");
    expect(form.get("size")).toBe("1536x1024");
    expect(form.getAll("image[]")).toHaveLength(1);
  });
});
