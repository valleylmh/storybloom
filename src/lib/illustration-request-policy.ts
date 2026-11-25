import type { StoryPage } from "@/types";

// Allow the full 300s illustration function duration plus time for status reads.
export const ILLUSTRATION_STALE_THRESHOLD_MS = 330_000;
export const DURABLE_ILLUSTRATION_RECOVERY_THRESHOLD_MS = 30 * 60 * 1000;
export const STALE_ILLUSTRATION_ERROR =
  "插图任务长时间没有更新，请手动重试本页。";
export const INTERRUPTED_ILLUSTRATION_ERROR = "插图任务已停止，请重试本页。";
export const SAFE_ILLUSTRATION_ERROR = "插图生成失败，请稍后重试。";
export const ILLUSTRATION_REQUEST_TIMEOUT_ERROR = "插图请求超时，请重试。";

const LEGACY_ILLUSTRATION_TIMEOUT_ERRORS = new Set([
  ILLUSTRATION_REQUEST_TIMEOUT_ERROR,
  STALE_ILLUSTRATION_ERROR,
  "免费生图模型超过 3 分钟仍未完成，请重新生成本页。",
]);

function isLegacyIllustrationTimeout(page: StoryPage) {
  return (
    page.imageStatus === "failed" &&
    LEGACY_ILLUSTRATION_TIMEOUT_ERRORS.has(page.imageError || "")
  );
}

export function normalizeIllustrationPageForClient(page: StoryPage): StoryPage {
  const imageAttempts = page.imageAttempts?.map((attempt) => ({
    provider: attempt.provider,
    model: attempt.model,
    status: attempt.status,
    ...(attempt.requestAttempt !== undefined
      ? { requestAttempt: attempt.requestAttempt }
      : {}),
    ...(attempt.retry !== undefined ? { retry: attempt.retry } : {}),
    ...(attempt.qualityStatus !== undefined
      ? { qualityStatus: attempt.qualityStatus }
      : {}),
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
            page.imageError === STALE_ILLUSTRATION_ERROR ||
            page.imageError === INTERRUPTED_ILLUSTRATION_ERROR
              ? INTERRUPTED_ILLUSTRATION_ERROR
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

export function isExpiredPendingIllustration(page: StoryPage, nowMs = Date.now()) {
  if (page.imageStatus !== "pending" || isDurablePendingIllustration(page)) {
    return false;
  }

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
): InitialIllustrationAction {
  if (page.imageStatus === "failed") {
    return isLegacyIllustrationTimeout(page) ? "resume" : "wait";
  }

  if (page.imageStatus === "demo") return "start";
  if (page.imageStatus !== "pending") return "wait";
  return getImageStartedAtMs(page) !== null ||
    isDurablePendingIllustration(page) ||
    page.imageAttemptId ||
    page.imageRequestCount
    ? "resume"
    : "start";
}

export function summarizeIllustrationProgress(
  pages: StoryPage[],
): IllustrationProgressSummary {
  const complete = pages.filter(
    (page) => page.imageStatus === "complete" && Boolean(page.imageUrl),
  ).length;
  const failed = pages.filter(
    (page) => page.imageStatus === "failed" && !isLegacyIllustrationTimeout(page),
  ).length;
  const pending = pages.filter(
    (page) => isWaitingImagePage(page) || isLegacyIllustrationTimeout(page),
  ).length;

  const status: IllustrationProgressStatus =
    pages.length > 0 && complete === pages.length
      ? "ready"
      : failed > 0
        ? "partially_failed"
        : "generating_images";

  return {
    status,
    total: pages.length,
    complete,
    pending,
    failed,
  };
}
