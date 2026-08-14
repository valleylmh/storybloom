import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assessGrowthStorageCapacity,
  assertGrowthStorageCapacity,
  estimateGrowthPhotoWriteBytes,
  estimateGrowthStorageCapacity,
  formatGrowthStorageBytes,
  getGrowthStorageErrorCode,
} from "@/lib/growth-storage-capacity";

describe("growth storage capacity", () => {
  it("reads only the current origin storage estimate", async () => {
    const estimate = vi.fn(async () => ({
      usage: 80 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
    }));

    await expect(estimateGrowthStorageCapacity({ estimate })).resolves.toEqual({
      supported: true,
      usageBytes: 80 * 1024 * 1024,
      quotaBytes: 100 * 1024 * 1024,
      remainingBytes: 20 * 1024 * 1024,
    });
    expect(estimate).toHaveBeenCalledTimes(1);
  });

  it("warns near the threshold but blocks only a clear over-capacity write", () => {
    const snapshot = {
      supported: true,
      usageBytes: 80,
      quotaBytes: 100,
      remainingBytes: 20,
    };

    expect(assessGrowthStorageCapacity(snapshot, 5)).toMatchObject({
      warning: true,
      blocked: false,
      projectedUsageBytes: 85,
    });
    expect(assessGrowthStorageCapacity(snapshot, 21)).toMatchObject({
      warning: true,
      blocked: true,
    });
    expect(() => assertGrowthStorageCapacity(snapshot, 21)).toThrow(
      "growth-storage-quota-exceeded",
    );
  });

  it("accounts for the local Moment plus compatibility projection", () => {
    expect(estimateGrowthPhotoWriteBytes(1024)).toBe(2048);
    expect(formatGrowthStorageBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("classifies quota, unavailable, and ordinary write failures", () => {
    expect(getGrowthStorageErrorCode({ name: "QuotaExceededError" })).toBe(
      "growth-storage-quota-exceeded",
    );
    expect(getGrowthStorageErrorCode({ name: "SecurityError" })).toBe(
      "growth-storage-unavailable",
    );
    expect(getGrowthStorageErrorCode(new Error("unexpected"))).toBe(
      "growth-storage-write-failed",
    );
  });

  it("never requests persistent-storage permission", () => {
    const source = readFileSync(
      new URL("../src/lib/growth-storage-capacity.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("storage.estimate()");
    expect(source).not.toMatch(/\.persist\s*\(/);
  });
});
