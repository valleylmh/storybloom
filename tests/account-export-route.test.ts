import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  readAccountData: vi.fn(),
  createAccountExport: vi.fn(),
}));

vi.mock("@/lib/supabase/server-auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {
    readonly status = 401;
  },
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

vi.mock("@/lib/account/account-data", () => ({
  readAccountData: mocks.readAccountData,
}));

vi.mock("@/lib/account/account-export", () => ({
  createAccountExport: mocks.createAccountExport,
}));

import { GET } from "@/app/api/account/export/route";
import { AuthenticationError } from "@/lib/supabase/server-auth";

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
    });
    mocks.getSupabaseAdmin.mockReturnValue({ name: "admin" });
    mocks.readAccountData.mockResolvedValue({ name: "snapshot" });
    mocks.createAccountExport.mockResolvedValue({
      blob: new Blob(["zip"], { type: "application/zip" }),
      fileName: "storybloom-export-2026-08-09.zip",
      report: { status: "complete" },
    });
  });

  it("returns a private no-store ZIP for the authenticated user", async () => {
    const request = new Request("http://localhost/api/account/export", {
      headers: { Authorization: "Bearer access-token" },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "storybloom-export-2026-08-09.zip",
    );
    expect(response.headers.get("x-storybloom-export-status")).toBe("complete");
    expect(mocks.readAccountData).toHaveBeenCalledWith(
      { name: "admin" },
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("returns 401 without exposing export internals when auth expires", async () => {
    mocks.requireAuthenticatedUser.mockRejectedValue(
      new AuthenticationError("expired"),
    );

    const response = await GET(
      new Request("http://localhost/api/account/export"),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("请先登录");
    expect(mocks.readAccountData).not.toHaveBeenCalled();
    expect(mocks.createAccountExport).not.toHaveBeenCalled();
  });
});
