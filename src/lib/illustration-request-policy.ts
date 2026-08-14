import type { StoryPage } from "@/types";

export const ILLUSTRATION_STALE_THRESHOLD_MS = 3 * 60 * 1000;
export const DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS = 30 * 60 * 1000;
export const STALE_ILLUSTRATION_ERROR =
  "插图任务长时间没有更新，请手动重试本页。";
export const SAFE_ILLUSTRATION_ERROR = "插图生成失败，请稍后重试。";

export function normalizeIllustrationPageForClient(page: StoryPage): StoryPage {
  const imageAttempts = page.imageAttempts?.map((attempt) => ({
    provider: attempt.provider,
    model: attempt.model,
    status: attempt.status,
    durationMs: attempt.durationMs,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    ...(attempt.status === "failed"
      ? {
          error: SAFE_ILLUSTRATION_ERROR,
          errorClass: attempt.errorClass || ("unknown" as const),
        }
      : {}),
  }));

  return {
    ...page,
    ...(page.imageStatus === "failed"
      ? {
          imageError:
            page.imageError === STALE_ILLUSTRATION_ERROR
              ? STALE_ILLUSTRATION_ERROR
              : SAFE_ILLUSTRATION_ERROR,
        }
      : { imageError: undefined }),
    ...(imageAttempts ? { imageAttempts } : {}),
  };
}

export type InitialIllustrationAction = "start" | "resume" | "wait";
export type IllustrationProgressStatus =
  | "generating_images"
  | "ready"
  | "partially_failed";

export interface IllustrationProgressSummary {
  status: IllustrationProgressStatus;
  total: number;
  complete: number;
  pending: number;
  failed: number;
  stalePending: number;
}

export function isWaitingImagePage(page: StoryPage) {
  return page.imageStatus === "pending" || page.imageStatus === "demo";
}

export function isDurablePendingIllustration(page: StoryPage) {
  return (
    page.imageStatus === "pending" &&
    (page.imageDurableJob === true || Boolean(page.imageJobId))
  );
}

export function getImageStartedAtMs(page: StoryPage) {
  if (!page.imageStartedAt) return null;

  const startedAtMs = new Date(page.imageStartedAt).getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs : null;
}

export function isStaleWaitingPage(page: StoryPage, nowMs: number) {
  if (!isWaitingImagePage(page)) return false;
  // Durable work is reconciled against the server-side job state. A browser
  // clock must never turn a queued/running job into a local failure.
  if (isDurablePendingIllustration(page)) return false;

  const startedAtMs = getImageStartedAtMs(page);
  if (startedAtMs === null) return false;

  return nowMs - startedAtMs > ILLUSTRATION_STALE_THRESHOLD_MS;
}

export function isRecentPendingIllustration(page: StoryPage, nowMs = Date.now()) {
  if (page.imageStatus !== "pending") return false;
  if (isDurablePendingIllustration(page)) return true;

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
  if (isDurablePendingIllustration(page)) return "resume";

  const startedAtMs = getImageStartedAtMs(page);
  if (startedAtMs === null) return "start";

  return nowMs - startedAtMs <= ILLUSTRATION_STALE_THRESHOLD_MS
    ? "resume"
    : "wait";
}

/**
 * Summarizes persisted page state without inventing a percentage or elapsed
 * generation phase. Stale pending pages are reported separately and make the
 * story partially failed until a parent explicitly retries them.
 */
export function summarizeIllustrationProgress(
  pages: StoryPage[],
  nowMs = Date.now(),
): IllustrationProgressSummary {
  const complete = pages.filter(
    (page) => page.imageStatus === "complete" && Boolean(page.imageUrl),
  ).length;
  const stalePending = pages.filter((page) =>
    isStaleWaitingPage(page, nowMs),
  ).length;
  const failed = pages.filter((page) => page.imageStatus === "failed").length;
  const pending = pages.filter(
    (page) => isWaitingImagePage(page) && !isStaleWaitingPage(page, nowMs),
  ).length;

  const status: IllustrationProgressStatus =
    pages.length > 0 && complete === pages.length
      ? "ready"
      : failed > 0 || stalePending > 0
        ? "partially_failed"
        : "generating_images";

  return {
    status,
    total: pages.length,
    complete,
    pending,
    failed,
    stalePending,
  };
}

/**
 * Converts timed-out pending work into an explicit local failure. This never
 * starts a replacement request; retry remains a deliberate user action.
 */
export function markStaleIllustrationsFailed(
  pages: StoryPage[],
  nowMs = Date.now(),
) {
  let changed = false;
  const completedAt = new Date(nowMs).toISOString();
  const nextPages = pages.map((page) => {
    if (!isStaleWaitingPage(page, nowMs)) return page;

    changed = true;
    const startedAtMs = getImageStartedAtMs(page);
    return {
      ...page,
      imageStatus: "failed" as const,
      imageError: STALE_ILLUSTRATION_ERROR,
      imageCompletedAt: completedAt,
      imageDurationMs:
        startedAtMs === null ? undefined : Math.max(0, nowMs - startedAtMs),
    };
  });

  return changed ? nextPages : pages;
}
