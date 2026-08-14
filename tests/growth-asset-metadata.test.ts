import { describe, expect, it } from "vitest";
import {
  getGrowthAssetMetadataFromBlob,
  getGrowthAssetMetadataFromDataUrl,
  hasValidOptionalGrowthAssetMetadata,
  normalizeAndDedupeGrowthAssets,
  normalizeGrowthAssetMetadata,
  sumGrowthAssetBytes,
} from "@/lib/growth-asset-metadata";

const WEBP_DATA_URL = `data:image/webp;base64,${Buffer.from(
  "compressed-webp-bytes",
).toString("base64")}`;

describe("growth asset metadata", () => {
  it("derives verifiable metadata from the compressed bytes", async () => {
    const blob = new Blob(["compressed-webp-bytes"], { type: "image/webp" });
    const [fromBlob, fromDataUrl] = await Promise.all([
      getGrowthAssetMetadataFromBlob(blob),
      getGrowthAssetMetadataFromDataUrl(WEBP_DATA_URL),
    ]);

    expect(fromBlob).toEqual(fromDataUrl);
    expect(fromBlob).toMatchObject({
      mimeType: "image/webp",
      byteSize: 21,
    });
    expect(fromBlob.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hydrates legacy photos and deduplicates identical content independent of names", async () => {
    const normalized = await normalizeAndDedupeGrowthAssets(
      [
        { id: "photo-1", name: "first.webp", dataUrl: WEBP_DATA_URL },
        { id: "photo-2", name: "renamed.webp", dataUrl: WEBP_DATA_URL },
      ],
      { strict: true },
    );

    expect(normalized.changed).toBe(true);
    expect(normalized.assets).toHaveLength(1);
    expect(normalized.assets[0]).toMatchObject({
      id: "photo-1",
      name: "first.webp",
      mimeType: "image/webp",
      byteSize: 21,
    });
    expect(sumGrowthAssetBytes(normalized.assets)).toBe(21);
  });

  it("repairs stale but well-shaped metadata when verification is requested", async () => {
    const repaired = await normalizeGrowthAssetMetadata(
      {
        dataUrl: WEBP_DATA_URL,
        mimeType: "image/webp" as const,
        byteSize: 1,
        checksumSha256: "0".repeat(64),
      },
      { verifyExisting: true },
    );

    expect(repaired.byteSize).toBe(21);
    expect(repaired.checksumSha256).not.toBe("0".repeat(64));
  });

  it("keeps metadata fields optional while rejecting malformed values", () => {
    expect(hasValidOptionalGrowthAssetMetadata({})).toBe(true);
    expect(
      hasValidOptionalGrowthAssetMetadata({
        mimeType: "image/webp",
        byteSize: 21,
        checksumSha256: "a".repeat(64),
      }),
    ).toBe(true);
    expect(
      hasValidOptionalGrowthAssetMetadata({
        checksumSha256: "not-a-checksum",
      }),
    ).toBe(false);
  });
});
