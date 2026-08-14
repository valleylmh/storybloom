import { describe, expect, it } from "vitest";
import {
  isAllowedShareImageUrl,
  isTemporaryShareAssetUrl,
} from "@/lib/share-store";
import { allowIpRequest } from "@/lib/request-rate-limit";

describe("open-source safety boundaries", () => {
  it("accepts only data images and safe site-relative share assets", () => {
    expect(
      isAllowedShareImageUrl(
        "data:image/png;base64," + Buffer.from("png").toString("base64"),
      ),
    ).toBe(true);
    expect(isAllowedShareImageUrl("/sample-books/brave-cloud-1.svg")).toBe(true);
    expect(isAllowedShareImageUrl("https://127.0.0.1/admin.png")).toBe(false);
    expect(isAllowedShareImageUrl("//attacker.example/image.png")).toBe(false);
    expect(isAllowedShareImageUrl("/../private.png")).toBe(false);
  });

  it("folds the client IP into per-route request limits", async () => {
    const prefix = `test-limit-${Date.now()}-${Math.random()}`;
    const options = {
      limit: 2,
      window: "1 h" as const,
      windowMs: 60 * 60 * 1000,
      prefix,
    };
    const request = (ip: string) =>
      new Request("http://localhost", { headers: { "x-real-ip": ip } });

    expect(await allowIpRequest(request("198.51.100.10"), options)).toBe(true);
    expect(await allowIpRequest(request("198.51.100.10"), options)).toBe(true);
    expect(await allowIpRequest(request("198.51.100.10"), options)).toBe(false);
    expect(await allowIpRequest(request("198.51.100.11"), options)).toBe(true);
  });

  it("keeps private temporary asset URLs out of the public allowlist", () => {
    const temporaryUrl = `/api/story-assets/${"A".repeat(32)}`;
    expect(isTemporaryShareAssetUrl(temporaryUrl)).toBe(true);
    expect(isAllowedShareImageUrl(temporaryUrl)).toBe(false);
    expect(isTemporaryShareAssetUrl("/api/story-assets/short")).toBe(false);
  });
});
