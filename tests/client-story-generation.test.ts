import { describe, expect, it, vi } from "vitest";
import {
  confirmStoryOutline,
  prepareStoryGenerationRequest,
  requestStoryGeneration,
  requestStoryGenerationTask,
} from "@/lib/client-story-generation";

function createResponse(status: number) {
  return new Response(JSON.stringify({ status }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("story generation authentication retry", () => {
  it("refreshes an expired family session and retries once", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse(401))
      .mockResolvedValueOnce(createResponse(200));
    const refreshAccessToken = vi.fn().mockResolvedValue("fresh-token");

    const response = await requestStoryGeneration({
      payload: {
        childName: "童童",
        familyCharacterIds: ["character-id"],
      },
      accessToken: "expired-token",
      refreshAccessToken,
      fetcher,
    });

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer expired-token",
      },
    });
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fresh-token",
      },
    });
  });

  it("does not refresh anonymous generation without family characters", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse(401));
    const refreshAccessToken = vi.fn().mockResolvedValue("fresh-token");

    const response = await requestStoryGeneration({
      payload: { childName: "我" },
      refreshAccessToken,
      fetcher,
    });

    expect(response.status).toBe(401);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("returns the original 401 when the session cannot be refreshed", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse(401));

    const response = await requestStoryGeneration({
      payload: { familyCharacterIds: ["character-id"] },
      accessToken: "expired-token",
      refreshAccessToken: vi.fn().mockResolvedValue(null),
      fetcher,
    });

    expect(response.status).toBe(401);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not refresh a successful family request", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse(200));
    const refreshAccessToken = vi.fn().mockResolvedValue("fresh-token");

    const response = await requestStoryGeneration({
      payload: { familyCharacterIds: ["character-id"] },
      accessToken: "valid-token",
      refreshAccessToken,
      fetcher,
    });

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("strips the local growth draft and photos before calling the generation API", async () => {
    const prepared = prepareStoryGenerationRequest({
      childName: "安安",
      ageGroup: "4-5",
      parentFacts: "安安第一次自己骑车。",
      allowedImaginations: "树叶像在鼓掌。",
      storyTreatment: "warm-imagination",
      supabaseAccessToken: "private-session-token",
      growthRecordDraft: {
        version: 1,
        photos: [
          {
            id: "photo-1",
            name: "bike.webp",
            dataUrl: "data:image/webp;base64,private-growth-photo",
          },
        ],
      },
    });

    expect(prepared.accessToken).toBe("private-session-token");
    expect(prepared.growthRecordDraft).toBeDefined();
    expect(prepared.payload).toMatchObject({
      parentFacts: "安安第一次自己骑车。",
      allowedImaginations: "树叶像在鼓掌。",
      storyTreatment: "warm-imagination",
    });
    expect(prepared.payload).not.toHaveProperty("growthRecordDraft");
    expect(prepared.payload).not.toHaveProperty("supabaseAccessToken");
    expect(JSON.stringify(prepared.payload)).not.toContain("data:image/");

    const fetcher = vi.fn().mockResolvedValue(createResponse(200));
    await requestStoryGeneration({ payload: prepared.payload, fetcher });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject(prepared.payload);
    expect(body).not.toHaveProperty("growthRecordDraft");
    expect(body).not.toHaveProperty("photos");
    expect(JSON.stringify(body)).not.toContain("data:image/");
  });

  it("queries the persisted task without caching a stale response", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse(202));

    await requestStoryGenerationTask({
      taskId: "task_123456789012",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/generate?taskId=task_123456789012",
      { method: "GET", cache: "no-store" },
    );
  });

  it("sends only editable page text when confirming an outline", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse(200));
    const pages = Array.from({ length: 8 }, (_, index) => ({
      page: index + 1,
      zhText: `第 ${index + 1} 页`,
      enText: `Page ${index + 1}`,
      illustrationPrompt: `private prompt ${index + 1}`,
      imageStatus: "demo" as const,
      imageUrl: `data:image/svg+xml,page-${index + 1}`,
    }));

    await confirmStoryOutline({
      taskId: "task_123456789012",
      storyId: "story-1",
      pages,
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(fetcher.mock.calls[0][0]).toBe("/api/generate");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(String(init.body));
    expect(body.pages).toHaveLength(8);
    expect(body.pages[0]).toEqual({
      page: 1,
      zhText: "第 1 页",
      enText: "Page 1",
    });
    expect(JSON.stringify(body)).not.toContain("illustrationPrompt");
    expect(JSON.stringify(body)).not.toContain("data:image/");
  });
});
