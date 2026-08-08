import { describe, expect, it, vi } from "vitest";
import { requestStoryGeneration } from "@/lib/client-story-generation";

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
});
