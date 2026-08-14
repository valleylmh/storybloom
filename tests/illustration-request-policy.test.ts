import { describe, expect, it } from "vitest";
import {
  DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS,
  getInitialIllustrationAction,
  ILLUSTRATION_STALE_THRESHOLD_MS,
  isRecentPendingIllustration,
  isStaleWaitingPage,
  markStaleIllustrationsFailed,
  STALE_ILLUSTRATION_ERROR,
  summarizeIllustrationProgress,
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

  it("never marks durable pending work stale from the browser clock", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(
        now - DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS - 1,
      ).toISOString(),
      imageAttemptId: "attempt_durable_1234",
      imageDurableJob: true,
      imageJobId: "job_durable_1234",
    });

    expect(getInitialIllustrationAction(page, now)).toBe("resume");
    expect(isRecentPendingIllustration(page, now)).toBe(true);
    expect(isStaleWaitingPage(page, now)).toBe(false);
    expect(summarizeIllustrationProgress([page], now)).toMatchObject({
      status: "generating_images",
      pending: 1,
      stalePending: 0,
    });
    expect(markStaleIllustrationsFailed([page], now)).toEqual([page]);
  });

  it("does not automatically resubmit failed or completed pages", () => {
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "failed" }), now),
    ).toBe("wait");
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "complete" }), now),
    ).toBe("wait");
  });

  it("reports real page counts without simulated progress", () => {
    const summary = summarizeIllustrationProgress(
      [
        createPage({ page: 1, imageStatus: "complete", imageUrl: "/one.webp" }),
        createPage({
          page: 2,
          imageStatus: "pending",
          imageStartedAt: new Date(now - 30_000).toISOString(),
        }),
        createPage({ page: 3, imageStatus: "failed" }),
      ],
      now,
    );

    expect(summary).toEqual({
      status: "partially_failed",
      total: 3,
      complete: 1,
      pending: 1,
      failed: 1,
      stalePending: 0,
    });
  });

  it("treats stale pending work as partially failed without starting it again", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(
        now - ILLUSTRATION_STALE_THRESHOLD_MS - 1,
      ).toISOString(),
    });

    expect(summarizeIllustrationProgress([page], now)).toMatchObject({
      status: "partially_failed",
      pending: 0,
      failed: 0,
      stalePending: 1,
    });

    const nextPages = markStaleIllustrationsFailed([page], now);
    expect(nextPages[0]).toMatchObject({
      imageStatus: "failed",
      imageError: STALE_ILLUSTRATION_ERROR,
      imageCompletedAt: new Date(now).toISOString(),
      imageDurationMs: ILLUSTRATION_STALE_THRESHOLD_MS + 1,
    });
    expect(getInitialIllustrationAction(nextPages[0], now)).toBe("wait");
  });

  it("reports ready only when every completed page has a usable image", () => {
    expect(
      summarizeIllustrationProgress(
        [
          createPage({
            page: 1,
            imageStatus: "complete",
            imageUrl: "/one.webp",
          }),
          createPage({
            page: 2,
            imageStatus: "complete",
            imageUrl: "/two.webp",
          }),
        ],
        now,
      ).status,
    ).toBe("ready");

    expect(
      summarizeIllustrationProgress(
        [createPage({ imageStatus: "complete", imageUrl: undefined })],
        now,
      ).status,
    ).toBe("generating_images");
  });
});
