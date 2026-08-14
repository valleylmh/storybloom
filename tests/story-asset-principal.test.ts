import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server-auth", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

import {
  STORY_ASSET_SESSION_COOKIE,
  StoryAssetPrincipalConfigurationError,
  attachStoryAssetSessionCookie,
  createAnonymousStoryAssetPrincipal,
  createUserStoryAssetPrincipal,
  isOpaqueStoryAssetPrincipalId,
  resolveStoryAssetRequestPrincipal,
} from "@/lib/story-asset-principal";

const SECRET = "asset-principal-secret-with-at-least-32-chars";
const SESSION = "A".repeat(32);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("story asset request principals", () => {
  it("derives stable opaque ids without retaining source identifiers", () => {
    vi.stubEnv("STORYBLOOM_ASSET_PRINCIPAL_SECRET", SECRET);

    const anonymous = createAnonymousStoryAssetPrincipal(SESSION);
    const user = createUserStoryAssetPrincipal(
      "22222222-2222-4222-8222-222222222222",
    );

    expect(anonymous.type).toBe("anonymous");
    expect(user.type).toBe("user");
    expect(isOpaqueStoryAssetPrincipalId(anonymous.id)).toBe(true);
    expect(isOpaqueStoryAssetPrincipalId(user.id)).toBe(true);
    expect(anonymous.id).not.toContain(SESSION);
    expect(user.id).not.toContain("22222222");
    expect(createAnonymousStoryAssetPrincipal(SESSION)).toEqual(anonymous);
  });

  it("fails closed when the dedicated HMAC secret is absent or weak", () => {
    vi.stubEnv("STORYBLOOM_ASSET_PRINCIPAL_SECRET", "short");
    expect(() => createAnonymousStoryAssetPrincipal(SESSION)).toThrow(
      StoryAssetPrincipalConfigurationError,
    );
  });

  it("creates an anonymous session and keeps the raw token only in an HttpOnly cookie", async () => {
    vi.stubEnv("STORYBLOOM_ASSET_PRINCIPAL_SECRET", SECRET);
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    const request = new NextRequest("https://storybloom.example/api/generate");

    const resolved = await resolveStoryAssetRequestPrincipal(request);
    const response = attachStoryAssetSessionCookie(
      NextResponse.json({ ok: true }),
      resolved,
    );

    expect(resolved.principal).toEqual(resolved.anonymousPrincipal);
    expect(resolved.createdAnonymousSession).toBe(true);
    const cookie = response.cookies.get(STORY_ASSET_SESSION_COOKIE);
    expect(cookie?.value).toBe(resolved.anonymousSessionToken);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(JSON.stringify(resolved.principal)).not.toContain(
      resolved.anonymousSessionToken,
    );
  });

  it("prefers an authenticated user principal while retaining the same-device grant", async () => {
    vi.stubEnv("STORYBLOOM_ASSET_PRINCIPAL_SECRET", SECRET);
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
    });
    const request = new NextRequest("https://storybloom.example/api/generate", {
      headers: {
        cookie: `${STORY_ASSET_SESSION_COOKIE}=${SESSION}`,
        authorization: "Bearer private-token",
      },
    });

    const resolved = await resolveStoryAssetRequestPrincipal(request);

    expect(resolved.principal.type).toBe("user");
    expect(resolved.userPrincipal).toEqual(resolved.principal);
    expect(resolved.anonymousPrincipal.type).toBe("anonymous");
    expect(resolved.createdAnonymousSession).toBe(false);
  });
});
