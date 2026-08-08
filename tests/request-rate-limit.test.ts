import { describe, expect, it } from "vitest";
import {
  createRequestRateLimitIdentifier,
  getClientIp,
} from "@/lib/request-rate-limit";

describe("request rate limit identifiers", () => {
  it("uses the real client header in deployment priority order", () => {
    const request = new Request("https://storybloom.example", {
      headers: {
        "cf-connecting-ip": "203.0.113.8",
        "x-real-ip": "203.0.113.9",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.8");
  });

  it("separates illustration quotas for different stories on the same IP", () => {
    const firstStory = createRequestRateLimitIdentifier("203.0.113.8", "story-a");
    const secondStory = createRequestRateLimitIdentifier("203.0.113.8", "story-b");

    expect(firstStory).not.toBe(secondStory);
    expect(firstStory).toBe(
      createRequestRateLimitIdentifier("203.0.113.8", "story-a"),
    );
  });
});
