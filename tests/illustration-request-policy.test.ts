import { describe, expect, it } from "vitest";
import {
  getInitialIllustrationAction,
  ILLUSTRATION_STALE_THRESHOLD_MS,
  isRecentPendingIllustration,
  isStaleWaitingPage,
} from "@/lib/illustration-request-policy";
import type { StoryPage } from "@/types";

function createPage(overrides: Partial<StoryPage> = {}): StoryPage {
  return {
    page: 1,
    zhText: "第一页",
    enText: "Page one",
    illustrationPrompt: "A storybook page",
    imageStatus: "demo",
    ...overrides,
  };
}

describe("illustration request policy", () => {
  const now = Date.parse("2026-08-08T03:00:00.000Z");

  it("starts demo pages and pending pages that have never been submitted", () => {
    const demoPage = createPage();
    expect(getInitialIllustrationAction(demoPage, now)).toBe("start");
    expect(isStaleWaitingPage(demoPage, now)).toBe(false);
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "pending" }), now),
    ).toBe("start");
  });

  it("resumes polling for a recent pending page without submitting it again", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(now - 30_000).toISOString(),
    });

    expect(getInitialIllustrationAction(page, now)).toBe("resume");
    expect(isRecentPendingIllustration(page, now)).toBe(true);
  });

  it("leaves stale pending pages for the bounded fallback retry path", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(
        now - ILLUSTRATION_STALE_THRESHOLD_MS - 1,
      ).toISOString(),
    });

    expect(getInitialIllustrationAction(page, now)).toBe("wait");
    expect(isStaleWaitingPage(page, now)).toBe(true);
    expect(isRecentPendingIllustration(page, now)).toBe(false);
  });

  it("does not automatically resubmit failed or completed pages", () => {
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "failed" }), now),
    ).toBe("wait");
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "complete" }), now),
    ).toBe("wait");
  });
});
