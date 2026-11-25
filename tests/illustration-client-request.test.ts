import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchIllustrationApi,
  ILLUSTRATION_HTTP_TIMEOUT_MS,
  pollIllustrationPage,
  requestIllustrationPage,
} from "@/lib/illustration-client-request";
import {
  ILLUSTRATION_REQUEST_TIMEOUT_ERROR,
  ILLUSTRATION_STALE_THRESHOLD_MS,
} from "@/lib/illustration-request-policy";
import type { StoryPage } from "@/types";

const demoPage: StoryPage = {
  page: 2,
  zhText: "第二页",
  enText: "Page two",
  illustrationPrompt: "A storybook page",
  imageStatus: "demo",
};
const pendingPage: StoryPage = {
  ...demoPage,
  imageStatus: "pending",
  imageStartedAt: "2026-11-25T08:00:00.000Z",
  imageRequestCount: 1,
};
const completedPage: StoryPage = {
  ...pendingPage,
  imageStatus: "complete",
  imageUrl: "/story-assets/completed.webp",
};

function hangUntilAborted(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

function createRequest(page = demoPage) {
  return {
    storyId: "story-123",
    page,
    onPending: vi.fn(),
    isActive: () => true,
  };
}

function pageResponse(page: StoryPage, status = 200) {
  return Response.json({ page }, { status });
}

describe("illustration client requests", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a hung illustration request so another page can continue", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(hangUntilAborted);
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchIllustrationApi("/api/illustration");
    await vi.advanceTimersByTimeAsync(ILLUSTRATION_HTTP_TIMEOUT_MS);

    await expect(request).resolves.toBeNull();
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });

  it("returns a successful illustration response before the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));

    const response = await fetchIllustrationApi("/api/illustration");

    expect(response?.ok).toBe(true);
  });

  it("recovers a timed-out submission by polling the same page without a second POST", async () => {
    vi.useFakeTimers({ now: new Date(pendingPage.imageStartedAt!) });
    const fetchMock = vi.fn(hangUntilAborted)
      .mockImplementationOnce(hangUntilAborted)
      .mockResolvedValueOnce(pageResponse(demoPage))
      .mockResolvedValueOnce(pageResponse(pendingPage))
      .mockResolvedValueOnce(pageResponse(completedPage));
    vi.stubGlobal("fetch", fetchMock);
    const input = createRequest();

    const result = requestIllustrationPage(input);
    await vi.advanceTimersByTimeAsync(ILLUSTRATION_HTTP_TIMEOUT_MS + 10_000);

    await expect(result).resolves.toEqual({ page: completedPage, recovered: true });
    expect(input.onPending).toHaveBeenCalledExactlyOnceWith(pendingPage);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET"))
      .toEqual(["POST", "GET", "GET", "GET"]);
    expect(fetchMock.mock.calls.slice(1).map(([url]) => url))
      .toEqual(Array(3).fill("/api/illustration?storyId=story-123&page=2"));
  });

  it("keeps checking after a timed-out poll and a gateway error past the old deadline", async () => {
    const startedAt = Date.parse(pendingPage.imageStartedAt!);
    vi.useFakeTimers({ now: startedAt });
    const fetchMock = vi.fn<typeof fetch>(async () =>
      pageResponse(Date.now() - startedAt < 240_000 ? pendingPage : completedPage),
    )
      .mockResolvedValueOnce(pageResponse(pendingPage, 202))
      .mockImplementationOnce(hangUntilAborted)
      .mockResolvedValueOnce(new Response(null, { status: 504 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = requestIllustrationPage(createRequest());
    await vi.advanceTimersByTimeAsync(240_000 + 5_000);

    await expect(result).resolves.toEqual({ page: completedPage, recovered: true });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"))
      .toHaveLength(1);
  });

  it("waits for a new attempt when a manual redraw times out and GET still shows the old image", async () => {
    vi.useFakeTimers();
    const newImage = {
      ...completedPage,
      imageRequestCount: 2,
      imageUrl: "/story-assets/redrawn.webp",
    };
    const fetchMock = vi.fn(hangUntilAborted)
      .mockResolvedValueOnce(new Response(null, { status: 504 }))
      .mockResolvedValueOnce(pageResponse(completedPage))
      .mockResolvedValueOnce(pageResponse(newImage));
    vi.stubGlobal("fetch", fetchMock);

    const result = requestIllustrationPage({
      ...createRequest(completedPage),
      useFreeFallback: true,
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toEqual({ page: newImage, recovered: true });
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET"))
      .toEqual(["POST", "GET", "GET"]);
  });

  it("restores an older page marked as failed by a browser timeout using only GET", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(pageResponse(completedPage));
    vi.stubGlobal("fetch", fetchMock);

    const result = pollIllustrationPage(createRequest({
      ...pendingPage,
      imageStatus: "failed",
      imageError: ILLUSTRATION_REQUEST_TIMEOUT_ERROR,
    }));
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toMatchObject({ page: completedPage });
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET"))
      .toEqual(["GET"]);
  });

  it("reports a missing submission after the server still shows an unstarted page", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(async () => pageResponse(demoPage))
      .mockImplementationOnce(hangUntilAborted);
    vi.stubGlobal("fetch", fetchMock);
    const result = requestIllustrationPage(createRequest());
    const rejected = expect(result).rejects.toThrow("后台未收到本页的插图生成请求");

    await vi.advanceTimersByTimeAsync(ILLUSTRATION_STALE_THRESHOLD_MS + 5_000);

    await rejected;
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"))
      .toHaveLength(1);
  });

  it("stops polling after the preview closes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(hangUntilAborted);
    vi.stubGlobal("fetch", fetchMock);
    const input = createRequest(pendingPage);
    const isActive = vi.fn().mockReturnValue(true);
    const result = pollIllustrationPage({ ...input, isActive });
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(3_000);
    isActive.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(40_000);

    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(input.onPending).not.toHaveBeenCalled();
  });
});
