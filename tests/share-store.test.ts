import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTemporaryStoryAsset: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  insert: vi.fn(),
  list: vi.fn(),
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
  getSupabaseAdmin: () => ({
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
      delete: () => ({
        eq: () => ({
          eq: () => ({ select: mocks.deleteRows }),
        }),
      }),
    }),
  }),
}));

import { createSharedStory } from "@/lib/share-store";

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
  mocks.deleteRows.mockResolvedValue({ data: [], error: null });
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
