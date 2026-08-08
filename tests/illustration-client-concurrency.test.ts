import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVE_ILLUSTRATION_CONCURRENCY,
  getLiveIllustrationConcurrency,
} from "@/lib/illustration-client-concurrency";

describe("live illustration request concurrency", () => {
  it("submits an all-CPA family book one page at a time", () => {
    expect(
      getLiveIllustrationConcurrency([
        { imagePlannedProvider: "cpa" },
        { imagePlannedProvider: "cpa" },
        { imagePlannedProvider: "cpa" },
      ]),
    ).toBe(1);
  });

  it("keeps ordinary and mixed-provider books concurrent", () => {
    expect(
      getLiveIllustrationConcurrency([
        { imagePlannedProvider: "cpa" },
        { imagePlannedProvider: "agnes" },
      ]),
    ).toBe(DEFAULT_LIVE_ILLUSTRATION_CONCURRENCY);
  });
});
