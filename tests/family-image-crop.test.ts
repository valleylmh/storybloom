import { describe, expect, it } from "vitest";
import {
  DEFAULT_FAMILY_IMAGE_CROP,
  normalizeFamilyImageCrop,
} from "@/lib/family-image-crop";

describe("family image crop", () => {
  it("uses a centered non-zoomed crop by default", () => {
    expect(normalizeFamilyImageCrop(null)).toEqual(DEFAULT_FAMILY_IMAGE_CROP);
  });

  it("clamps persisted crop values to the supported range", () => {
    expect(normalizeFamilyImageCrop({ x: -30, y: 140, zoom: 5 })).toEqual({
      x: 0,
      y: 100,
      zoom: 2,
    });
  });

  it("repairs incomplete or invalid crop metadata", () => {
    expect(normalizeFamilyImageCrop({ x: "70", y: "bad" })).toEqual({
      x: 70,
      y: 50,
      zoom: 1,
    });
  });
});
