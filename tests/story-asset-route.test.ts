import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  readTemporaryStoryAsset: vi.fn(),
  resolveStoryAssetRequestPrincipal: vi.fn(),
  createUserStoryAssetPrincipal: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  logGenerationEvent: vi.fn(),
}));

vi.mock("@/lib/temporary-story-asset-store", () => ({
  readTemporaryStoryAsset: mocks.readTemporaryStoryAsset,
}));

vi.mock("@/lib/story-asset-principal", () => ({
  StoryAssetPrincipalConfigurationError: class extends Error {},
  resolveStoryAssetRequestPrincipal: mocks.resolveStoryAssetRequestPrincipal,
  createUserStoryAssetPrincipal: mocks.createUserStoryAssetPrincipal,
}));

vi.mock("@/lib/supabase/server-auth", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock("@/lib/generation-observability", () => ({
  classifyGenerationError: () => "storage_unavailable",
  logGenerationEvent: mocks.logGenerationEvent,
}));

import { GET } from "@/app/api/story-assets/[assetId]/route";

const ASSET_ID = "A".repeat(32);
const anonymousPrincipal = { type: "anonymous" as const, id: `v1_${"a".repeat(64)}` };
const userPrincipal = { type: "user" as const, id: `v1_${"b".repeat(64)}` };

function request(headers?: HeadersInit) {
  return new NextRequest(`https://storybloom.example/api/story-assets/${ASSET_ID}`, {
    headers,
  });
}

function context(assetId = ASSET_ID) {
  return { params: Promise.resolve({ assetId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveStoryAssetRequestPrincipal.mockResolvedValue({
    anonymousPrincipal,
  });
  mocks.getAuthenticatedUser.mockResolvedValue(null);
  mocks.createUserStoryAssetPrincipal.mockReturnValue(userPrincipal);
});

describe("GET /api/story-assets/[assetId]", () => {
  it("returns an authorized committed image with private security headers", async () => {
    mocks.readTemporaryStoryAsset.mockResolvedValue({
      assetId: ASSET_ID,
      storyId: "story-1",
      page: 1,
      state: "committed",
      contentType: "image/png",
      byteSize: 4,
      sha256: "c".repeat(64),
      etag: `"${"c".repeat(64)}"`,
      createdAt: 1,
      updatedAt: 2,
      expiresAt: Date.now() + 1_000,
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it("uses ETag revalidation without exposing bytes", async () => {
    const etag = `"${"d".repeat(64)}"`;
    mocks.readTemporaryStoryAsset.mockResolvedValue({
      assetId: ASSET_ID,
      contentType: "image/webp",
      byteSize: 12,
      etag,
      bytes: Buffer.alloc(12),
    });

    const response = await GET(request({ "if-none-match": etag }), context());

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(etag);
    expect(await response.text()).toBe("");
  });

  it("allows an explicit authenticated request to try a user grant", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-id" });
    mocks.readTemporaryStoryAsset
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        assetId: ASSET_ID,
        contentType: "image/jpeg",
        byteSize: 2,
        etag: '"etag"',
        bytes: Buffer.from([0xff, 0xd9]),
      });

    const response = await GET(
      request({ authorization: "Bearer private-token" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mocks.readTemporaryStoryAsset).toHaveBeenNthCalledWith(1, {
      assetId: ASSET_ID,
      principal: anonymousPrincipal,
    });
    expect(mocks.readTemporaryStoryAsset).toHaveBeenNthCalledWith(2, {
      assetId: ASSET_ID,
      principal: userPrincipal,
    });
  });

  it.each([
    ["invalid id", "short"],
    ["missing", ASSET_ID],
    ["unauthorized", ASSET_ID],
  ])("returns the same 404 shape for %s", async (_label, assetId) => {
    mocks.readTemporaryStoryAsset.mockResolvedValue(null);
    const response = await GET(request(), context(assetId));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed without leaking storage or principal errors", async () => {
    mocks.resolveStoryAssetRequestPrincipal.mockRejectedValue(
      new Error("secret or storage details"),
    );

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("secret");
  });
});
