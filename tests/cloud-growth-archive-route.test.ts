import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  readSnapshot: vi.fn(),
  summarize: vi.fn(),
  updateRetention: vi.fn(),
  parseDelete: vi.fn(),
  deleteArchive: vi.fn(),
  createExport: vi.fn(),
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

vi.mock("@/lib/account/cloud-growth-archive", () => ({
  CloudGrowthArchiveInputError: class CloudGrowthArchiveInputError extends Error {
    readonly status = 400;
  },
  readCloudGrowthArchiveSnapshot: mocks.readSnapshot,
  summarizeCloudGrowthArchive: mocks.summarize,
  updateCloudGrowthRetention: mocks.updateRetention,
  parseCloudGrowthArchiveDeleteRequest: mocks.parseDelete,
  deleteCloudGrowthArchive: mocks.deleteArchive,
  createCloudGrowthArchiveExport: mocks.createExport,
}));

import {
  DELETE,
  GET as GET_SUMMARY,
  PATCH,
} from "@/app/api/account/growth-archive/route";
import { GET as GET_EXPORT } from "@/app/api/account/growth-archive/export/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("private cloud growth archive routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
    mocks.getSupabaseAdmin.mockReturnValue({ admin: true });
    mocks.readSnapshot.mockResolvedValue({ userId: USER_ID });
    mocks.summarize.mockReturnValue({
      version: 1,
      source: "private-cloud",
      counts: { moments: 0 },
    });
    mocks.parseDelete.mockReturnValue({
      scope: "all",
      confirmation: "DELETE_CLOUD_GROWTH_ARCHIVE",
    });
    mocks.deleteArchive.mockResolvedValue({
      version: 1,
      scope: "all",
      status: "complete",
      discovered: {},
      deleted: {},
      warnings: [],
    });
    mocks.createExport.mockResolvedValue({
      blob: new Blob(["zip"], { type: "application/zip" }),
      fileName: "storybloom-cloud-growth-archive-2026-08-15.zip",
      report: { status: "complete" },
    });
  });

  it("requires authentication and returns a no-store summary", async () => {
    const response = await GET_SUMMARY(
      new Request("http://localhost/api/account/growth-archive", {
        headers: {
          Authorization: "Bearer token",
          "X-StoryBloom-Time-Zone": "Asia/Shanghai",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).summary.source).toBe("private-cloud");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.requireAuthenticatedUser).toHaveBeenCalledOnce();
    expect(mocks.summarize).toHaveBeenCalledWith(
      { userId: USER_ID },
      expect.any(Date),
      "Asia/Shanghai",
    );
  });

  it("saves only the explicit retention preference", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/account/growth-archive", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ retentionDays: 1095 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateRetention).toHaveBeenCalledWith(
      { admin: true },
      USER_ID,
      1095,
    );
    expect(mocks.deleteArchive).not.toHaveBeenCalled();
  });

  it("returns a partial deletion report without touching the local browser", async () => {
    mocks.deleteArchive.mockResolvedValue({
      version: 1,
      scope: "all",
      status: "partial",
      discovered: {},
      deleted: {},
      warnings: ["storage retry"],
    });
    const request = new Request("http://localhost/api/account/growth-archive", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scope: "all",
        confirmation: "DELETE_CLOUD_GROWTH_ARCHIVE",
      }),
    });
    const response = await DELETE(request);

    expect(response.status).toBe(207);
    expect((await response.json()).report.warnings).toEqual(["storage retry"]);
    expect(mocks.parseDelete).toHaveBeenCalledOnce();
    expect(mocks.deleteArchive).toHaveBeenCalledOnce();
  });

  it("streams a dedicated growth archive ZIP", async () => {
    const response = await GET_EXPORT(
      new Request("http://localhost/api/account/growth-archive/export", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(
      "storybloom-cloud-growth-archive-2026-08-15.zip",
    );
    expect(mocks.createExport).toHaveBeenCalledOnce();
  });
});
