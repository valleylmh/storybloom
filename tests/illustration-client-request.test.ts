import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchIllustrationApi,
  ILLUSTRATION_HTTP_TIMEOUT_MS,
} from "@/lib/illustration-client-request";

describe("illustration client requests", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a hung illustration request so another page can continue", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchIllustrationApi("/api/illustration");
    const rejected = expect(request).rejects.toThrow("插图请求超时，请重试。");
    await vi.advanceTimersByTimeAsync(ILLUSTRATION_HTTP_TIMEOUT_MS);

    await rejected;
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });

  it("returns a successful illustration response before the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));

    const response = await fetchIllustrationApi("/api/illustration");

    expect(response.ok).toBe(true);
  });
});
