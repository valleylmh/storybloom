import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateCpaStoryCharacterAnchor: vi.fn(),
  cacheCharacterReference: vi.fn(),
}));

vi.mock("@/lib/image-generator", () => ({
  generateCpaStoryCharacterAnchor: mocks.generateCpaStoryCharacterAnchor,
}));

vi.mock("@/lib/storage", () => ({
  cacheCharacterReference: mocks.cacheCharacterReference,
}));

import { createStoryCharacterAnchorToken } from "@/lib/story-character-anchor";

const character = {
  id: "child",
  name: "童童",
  relation: "孩子",
  appearance: "五岁短发孩子",
  sourceReferenceAssetPath: "user/child/source.webp",
  canonicalReferenceAssetPath: "user/child/canonical.png",
  isProtagonist: true,
};

const visualBible = {
  version: 1 as const,
  seriesStyleLock: "fixed storybook style",
  paletteLock: "fixed palette",
  continuityPolicy: "fixed continuity",
  characters: [
    {
      id: "child",
      name: "童童",
      identityLock: "same child",
      outfitLock: "powder-blue pajamas",
      referenceGuidance: "real photo controls face",
    },
  ],
};

describe("story character anchor cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the generated protagonist anchor in the private temporary cache", async () => {
    mocks.generateCpaStoryCharacterAnchor.mockResolvedValue(
      "data:image/png;base64,YW5jaG9y",
    );
    mocks.cacheCharacterReference.mockResolvedValue("anchor-token");

    const token = await createStoryCharacterAnchorToken({
      character,
      visualBible,
    });

    expect(token).toBe("anchor-token");
    expect(mocks.generateCpaStoryCharacterAnchor).toHaveBeenCalledWith({
      character,
      visualBible,
    });
    expect(mocks.cacheCharacterReference).toHaveBeenCalledWith({
      contentType: "image/png",
      bytes: Buffer.from("anchor"),
    });
  });

  it("rejects non-image provider output instead of caching it", async () => {
    mocks.generateCpaStoryCharacterAnchor.mockResolvedValue("not-an-image");

    await expect(
      createStoryCharacterAnchorToken({ character, visualBible }),
    ).rejects.toThrow(/cacheable story anchor image/);
    expect(mocks.cacheCharacterReference).not.toHaveBeenCalled();
  });
});
