import { describe, expect, it } from "vitest";
import {
  DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS,
  getInitialIllustrationAction,
  ILLUSTRATION_REQUEST_TIMEOUT_ERROR,
  ILLUSTRATION_STALE_THRESHOLD_MS,
  isExpiredPendingIllustration,
  isRecentPendingIllustration,
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
    expect(getInitialIllustrationAction(demoPage)).toBe("start");
    expect(isExpiredPendingIllustration(demoPage, now)).toBe(false);
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "pending" })),
    ).toBe("start");
  });

  it("resumes polling for a recent pending page without submitting it again", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(now - 30_000).toISOString(),
    });

    expect(getInitialIllustrationAction(page)).toBe("resume");
    expect(isRecentPendingIllustration(page, now)).toBe(true);
  });

  it("resumes old pending pages so the server can resolve their status", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(
        now - ILLUSTRATION_STALE_THRESHOLD_MS - 1,
      ).toISOString(),
    });

    expect(getInitialIllustrationAction(page)).toBe("resume");
    expect(isExpiredPendingIllustration(page, now)).toBe(true);
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

    expect(getInitialIllustrationAction(page)).toBe("resume");
    expect(isRecentPendingIllustration(page, now)).toBe(true);
    expect(isExpiredPendingIllustration(page, now)).toBe(false);
    expect(summarizeIllustrationProgress([page])).toMatchObject({
      status: "generating_images",
      pending: 1,
    });
  });

  it("does not automatically resubmit failed or completed pages", () => {
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "failed" })),
    ).toBe("wait");
    expect(
      getInitialIllustrationAction(createPage({ imageStatus: "complete" })),
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
    );

    expect(summary).toEqual({
      status: "partially_failed",
      total: 3,
      complete: 1,
      pending: 1,
      failed: 1,
    });
  });

  it("keeps pending pages in progress until the server confirms their outcome", () => {
    const page = createPage({
      imageStatus: "pending",
      imageStartedAt: new Date(
        now - ILLUSTRATION_STALE_THRESHOLD_MS - 1,
      ).toISOString(),
    });

    expect(summarizeIllustrationProgress([page])).toMatchObject({
      status: "generating_images",
      pending: 1,
      failed: 0,
    });
  });

  it.each([
    ILLUSTRATION_REQUEST_TIMEOUT_ERROR,
    STALE_ILLUSTRATION_ERROR,
    "免费生图模型超过 3 分钟仍未完成，请重新生成本页。",
  ])("checks the server when a saved page carries the old error %s", (imageError) => {
    const page = createPage({ imageStatus: "failed", imageError });
    expect(getInitialIllustrationAction(page)).toBe("resume");
    expect(summarizeIllustrationProgress([page])).toMatchObject({
      status: "generating_images",
      pending: 1,
      failed: 0,
    });
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
      ).status,
    ).toBe("ready");

    expect(
      summarizeIllustrationProgress(
        [createPage({ imageStatus: "complete", imageUrl: undefined })],
      ).status,
    ).toBe("generating_images");
  });
});
