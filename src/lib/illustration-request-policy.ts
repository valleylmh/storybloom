import type { StoryPage } from "@/types";

export const ILLUSTRATION_STALE_THRESHOLD_MS = 3 * 60 * 1000;

export type InitialIllustrationAction = "start" | "resume" | "wait";

export function isWaitingImagePage(page: StoryPage) {
  return page.imageStatus === "pending" || page.imageStatus === "demo";
}

export function getImageStartedAtMs(page: StoryPage) {
  if (!page.imageStartedAt) return null;

  const startedAtMs = new Date(page.imageStartedAt).getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs : null;
}

export function isStaleWaitingPage(page: StoryPage, nowMs: number) {
  if (!isWaitingImagePage(page)) return false;

  const startedAtMs = getImageStartedAtMs(page);
  if (startedAtMs === null) return false;

  return nowMs - startedAtMs > ILLUSTRATION_STALE_THRESHOLD_MS;
}

export function isRecentPendingIllustration(page: StoryPage, nowMs = Date.now()) {
  if (page.imageStatus !== "pending") return false;

  const startedAtMs = getImageStartedAtMs(page);
  return (
    startedAtMs !== null &&
    nowMs - startedAtMs <= ILLUSTRATION_STALE_THRESHOLD_MS
  );
}

export function getInitialIllustrationAction(
  page: StoryPage,
  nowMs = Date.now(),
): InitialIllustrationAction {
  if (page.imageStatus === "complete" || page.imageStatus === "failed") {
    return "wait";
  }

  if (page.imageStatus === "demo") return "start";
  if (page.imageStatus !== "pending") return "wait";

  const startedAtMs = getImageStartedAtMs(page);
  if (startedAtMs === null) return "start";

  return nowMs - startedAtMs <= ILLUSTRATION_STALE_THRESHOLD_MS
    ? "resume"
    : "wait";
}
