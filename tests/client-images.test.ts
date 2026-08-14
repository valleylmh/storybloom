import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTemporaryStoryAssetUrl,
  materializeTemporaryStoryImages,
} from "@/lib/client-images";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installFileReaderStub() {
  class FileReaderStub {
    result: string | ArrayBuffer | null = null;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;

    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then(
        (buffer) => {
          this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
          this.onload?.();
        },
        () => this.onerror?.(),
      );
    }
  }
  vi.stubGlobal("FileReader", FileReaderStub);
}

describe("temporary story image materialization", () => {
  it("recognizes only opaque story asset paths", () => {
    expect(isTemporaryStoryAssetUrl(`/api/story-assets/${"A".repeat(32)}`)).toBe(
      true,
    );
    expect(isTemporaryStoryAssetUrl("/api/story-assets/short")).toBe(false);
    expect(isTemporaryStoryAssetUrl("/api/audio/story")).toBe(false);
    expect(isTemporaryStoryAssetUrl("data:image/webp;base64,abc")).toBe(false);
  });

  it("converts temporary URLs to self-contained data URIs before local save", async () => {
    installFileReaderStub();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Blob(["image-bytes"], { type: "image/webp" }), {
          status: 200,
        }),
      ),
    );
    const assetUrl = `/api/story-assets/${"B".repeat(32)}`;

    const story = await materializeTemporaryStoryImages({
      storyId: "story-1",
      pages: [
        { page: 1, imageUrl: assetUrl },
        { page: 2, imageUrl: "/library/static.webp" },
      ],
    });

    expect(story.pages[0].imageUrl).toMatch(/^data:image\/webp;base64,/);
    expect(story.pages[1].imageUrl).toBe("/library/static.webp");
    expect(fetch).toHaveBeenCalledWith(assetUrl);
  });

  it("fails the local write boundary instead of persisting an expiring URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(
      materializeTemporaryStoryImages({
        pages: [{ imageUrl: `/api/story-assets/${"C".repeat(32)}` }],
      }),
    ).rejects.toThrow("temporary-story-asset-materialization-failed");
  });
});
