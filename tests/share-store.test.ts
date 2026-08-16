import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTemporaryStoryAsset: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  insert: vi.fn(),
  list: vi.fn(),
  maybeSingle: vi.fn(),
  updateRows: vi.fn(),
  deleteRows: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn((size: number) =>
    size === 14 ? "share_12345678" : "delete_token_123456789012",
  ),
}));

vi.mock("@/lib/temporary-story-asset-store", () => ({
  readTemporaryStoryAsset: mocks.readTemporaryStoryAsset,
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: () => {
    const query = {
      eq: vi.fn(() => query),
      maybeSingle: mocks.maybeSingle,
    };
    return {
      storage: {
        from: () => ({
          upload: mocks.upload,
          remove: mocks.remove,
          getPublicUrl: mocks.getPublicUrl,
          list: mocks.list,
        }),
      },
      from: () => ({
        insert: mocks.insert,
        select: vi.fn(() => query),
        update: vi.fn(() => ({ eq: mocks.updateRows })),
        delete: vi.fn(() => ({ eq: mocks.deleteRows })),
      }),
    };
  },
}));

import {
  createSharedStory,
  getSharedStory,
  getShareExpiration,
  revokeSharedStory,
} from "@/lib/share-store";

const owner = { type: "anonymous" as const, id: `v1_${"a".repeat(64)}` };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicUrl.mockImplementation((path: string) => ({
    data: { publicUrl: `https://public.example/${path}` },
  }));
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.updateRows.mockResolvedValue({ error: null });
  mocks.deleteRows.mockResolvedValue({ error: null });
});

describe("shared story temporary assets", () => {
  it("copies an authorized temporary image into the stable public share bucket", async () => {
    mocks.readTemporaryStoryAsset.mockResolvedValue({
      contentType: "image/png",
      bytes: Buffer.from([1, 2, 3]),
    });

    await expect(
      createSharedStory({
        coverTitle: "故事",
        childName: "童童",
        language: "zh",
        assetPrincipals: [owner],
        pages: [
          {
            page: 1,
            zhText: "第一页",
            enText: "Page one",
            imageUrl: `/api/story-assets/${"A".repeat(32)}`,
          },
        ],
      }),
    ).resolves.toEqual({
      shareId: "share_12345678",
      deleteToken: "delete_token_123456789012",
      expiresAt: expect.any(String),
    });

    expect(mocks.readTemporaryStoryAsset).toHaveBeenCalledWith({
      assetId: "A".repeat(32),
      principal: owner,
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      "share_12345678/1.png",
      Buffer.from([1, 2, 3]),
      { contentType: "image/png", upsert: true },
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_story_id: null,
        expires_at: expect.any(String),
        revoked_at: null,
        story: expect.objectContaining({
          pages: [
            expect.objectContaining({
              imageUrl:
                "https://public.example/share_12345678/1.png",
            }),
          ],
        }),
      }),
    );
  });

  it("defaults to a 30 day expiry and keeps permanent sharing explicit", () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    expect(getShareExpiration("7d", now)).toBe("2026-08-23T00:00:00.000Z");
    expect(getShareExpiration("30d", now)).toBe("2026-09-15T00:00:00.000Z");
    expect(getShareExpiration("never", now)).toBeNull();
  });

  it("keeps legacy share creation working before the lifecycle migration is deployed", async () => {
    mocks.insert
      .mockResolvedValueOnce({
        error: {
          code: "42703",
          message: "column expires_at does not exist",
        },
      })
      .mockResolvedValueOnce({ error: null });

    await expect(
      createSharedStory({
        clientStoryId: "story-1",
        coverTitle: "故事",
        childName: "童童",
        language: "zh",
        pages: [
          { page: 1, zhText: "第一页", enText: "Page one" },
        ],
      }),
    ).resolves.toMatchObject({ expiresAt: null });
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).not.toHaveProperty("expires_at");
  });

  it("reads legacy public links while the migration is still pending", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: "column revoked_at does not exist",
        },
      })
      .mockResolvedValueOnce({
        data: {
          share_id: "share_12345678",
          story: {
            coverTitle: "故事",
            childName: "童童",
            language: "zh",
            pages: [],
          },
          created_at: "2026-08-16T00:00:00.000Z",
        },
        error: null,
      });

    await expect(getSharedStory("share_12345678")).resolves.toMatchObject({
      shareId: "share_12345678",
      story: { coverTitle: "故事" },
    });
  });

  it("revokes public access before removing assets and the database row", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { share_id: "share_12345678", revoked_at: null },
      error: null,
    });
    mocks.list.mockResolvedValue({
      data: [{ name: "1.png" }],
      error: null,
    });

    await expect(
      revokeSharedStory({
        shareId: "share_12345678",
        deleteToken: "delete_token_123456789012",
      }),
    ).resolves.toEqual({ status: "deleted" });

    expect(mocks.updateRows).toHaveBeenCalledWith("share_id", "share_12345678");
    expect(mocks.remove).toHaveBeenCalledWith(["share_12345678/1.png"]);
    expect(mocks.deleteRows).toHaveBeenCalledWith("share_id", "share_12345678");
    expect(mocks.updateRows.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remove.mock.invocationCallOrder[0],
    );
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteRows.mock.invocationCallOrder[0],
    );
  });

  it("keeps the revoked row when public asset cleanup needs a retry", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { share_id: "share_12345678", revoked_at: null },
      error: null,
    });
    mocks.list.mockResolvedValue({
      data: [{ name: "1.png" }],
      error: null,
    });
    mocks.remove.mockResolvedValue({ error: new Error("storage unavailable") });

    await expect(
      revokeSharedStory({
        shareId: "share_12345678",
        deleteToken: "delete_token_123456789012",
      }),
    ).resolves.toEqual({ status: "cleanup-pending" });
    expect(mocks.deleteRows).not.toHaveBeenCalled();
  });

  it("waits for concurrent uploads to settle before rolling back every successful object", async () => {
    mocks.readTemporaryStoryAsset.mockImplementation(async ({ assetId }) => ({
      contentType: "image/png",
      bytes: Buffer.from(assetId.startsWith("A") ? [1] : [2]),
    }));
    let finishSecondUpload!: () => void;
    const secondUpload = new Promise<{ error: null }>((resolve) => {
      finishSecondUpload = () => resolve({ error: null });
    });
    mocks.upload.mockImplementation(async (path: string) => {
      if (path.endsWith("/1.png")) return { error: new Error("upload failed") };
      return secondUpload;
    });

    const creating = createSharedStory({
      coverTitle: "故事",
      childName: "童童",
      language: "zh",
      assetPrincipals: [owner],
      pages: [
        {
          page: 1,
          zhText: "第一页",
          enText: "Page one",
          imageUrl: `/api/story-assets/${"A".repeat(32)}`,
        },
        {
          page: 2,
          zhText: "第二页",
          enText: "Page two",
          imageUrl: `/api/story-assets/${"B".repeat(32)}`,
        },
      ],
    });

    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    expect(mocks.remove).not.toHaveBeenCalled();
    finishSecondUpload();

    await expect(creating).rejects.toThrow("upload failed");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith([
      "share_12345678/2.png",
    ]);
  });
});
