import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  deleteAccountData: vi.fn(),
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

vi.mock("@/lib/account/account-deletion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account/account-deletion")>(
    "@/lib/account/account-deletion",
  );
  return { ...actual, deleteAccountData: mocks.deleteAccountData };
});

import { DELETE } from "@/app/api/account/data/route";
import { AuthenticationError } from "@/lib/supabase/server-auth";

const USER_ID = "22222222-2222-4222-8222-222222222222";

function report(status: "complete" | "partial" | "failed") {
  return {
    version: 1 as const,
    requestId: "request-1",
    scope: "cloud" as const,
    deleteAuthUserRequested: false,
    authUserDeleted: false,
    status,
    retryable: status !== "complete",
    startedAt: "2026-08-09T00:00:00.000Z",
    completedAt: "2026-08-09T00:00:01.000Z",
    steps: [],
    warnings: [],
  };
}

describe("DELETE /api/account/data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
    mocks.getSupabaseAdmin.mockReturnValue({});
    mocks.deleteAccountData.mockResolvedValue(report("complete"));
  });

  it("passes the cloud confirmation contract and returns the report at the top level", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({
          scope: "cloud",
          deleteAuthUser: false,
          confirmation: "DELETE_CLOUD_DATA",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.steps).toEqual([]);
    expect(mocks.deleteAccountData).toHaveBeenCalledWith(
      {},
      USER_ID,
      {
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: "DELETE_CLOUD_DATA",
      },
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("accepts child deletion and returns 207 for a partial report", async () => {
    mocks.deleteAccountData.mockResolvedValue({
      ...report("partial"),
      scope: "child",
      childId: "11111111-1111-4111-8111-111111111111",
    });

    const response = await DELETE(
      new Request("http://localhost/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({
          scope: "child",
          childId: "11111111-1111-4111-8111-111111111111",
          confirmation: "DELETE_CHILD_DATA",
        }),
      }),
    );

    expect(response.status).toBe(207);
    expect((await response.json()).ok).toBe(false);
    expect(mocks.deleteAccountData).toHaveBeenCalledOnce();
  });

  it("rejects the wrong confirmation before starting deletion", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({
          scope: "cloud",
          deleteAuthUser: true,
          confirmation: "DELETE_CLOUD_DATA",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });

  it("maps an expired bearer token to 401", async () => {
    mocks.requireAuthenticatedUser.mockRejectedValue(new AuthenticationError("登录状态已失效"));

    const response = await DELETE(
      new Request("http://localhost/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({
          scope: "cloud",
          deleteAuthUser: false,
          confirmation: "DELETE_CLOUD_DATA",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toContain("登录状态已失效");
  });
});
