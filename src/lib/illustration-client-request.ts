import {
  getImageStartedAtMs,
  getInitialIllustrationAction,
  ILLUSTRATION_STALE_THRESHOLD_MS,
  SAFE_ILLUSTRATION_ERROR,
} from "@/lib/illustration-request-policy";
import type { StoryPage } from "@/types";

export const ILLUSTRATION_HTTP_TIMEOUT_MS = 20_000;
const ILLUSTRATION_POLL_INTERVAL_MS = 2_500;
const MAX_ILLUSTRATION_POLL_INTERVAL_MS = 15_000;

type IllustrationResponse = {
  page?: StoryPage;
  error?: string;
};

type IllustrationRequest = {
  storyId: string;
  page: StoryPage;
  onPending: (page: StoryPage) => void;
  isActive: () => boolean;
};

type IllustrationPoll = IllustrationRequest & {
  submittedAtMs?: number;
  previousRequestCount?: number;
  recovered?: boolean;
};

type IllustrationResult = {
  page: StoryPage;
  recovered: boolean;
};

export async function fetchIllustrationApi(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ILLUSTRATION_HTTP_TIMEOUT_MS,
  );

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | IllustrationResponse
      | null;
    return { ok: response.ok, status: response.status, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTemporaryHttpError(status: number) {
  return status === 408 || status >= 500;
}

export async function pollIllustrationPage(
  input: IllustrationPoll,
): Promise<IllustrationResult> {
  const url = `/api/illustration?storyId=${encodeURIComponent(input.storyId)}&page=${input.page.page}`;
  const confirmByMs =
    (input.submittedAtMs ?? getImageStartedAtMs(input.page) ?? Date.now()) +
    ILLUSTRATION_STALE_THRESHOLD_MS;
  let previousRequestCount = input.previousRequestCount;
  let recovered = input.recovered ?? false;
  let delayMs = ILLUSTRATION_POLL_INTERVAL_MS;

  while (input.isActive()) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    if (!input.isActive()) break;

    const response = await fetchIllustrationApi(url, { cache: "no-store" });
    if (!input.isActive()) break;

    if (
      response &&
      !response.ok &&
      !isTemporaryHttpError(response.status) &&
      response.status !== 429
    ) {
      throw new Error(response.data?.error || "插图状态查询失败。");
    }

    const page = response?.ok ? response.data?.page : undefined;
    if (
      !page ||
      page.page !== input.page.page ||
      (page.imageStatus === "complete" && !page.imageUrl)
    ) {
      recovered = true;
      delayMs = Math.min(delayMs * 2, MAX_ILLUSTRATION_POLL_INTERVAL_MS);
      continue;
    }

    delayMs = ILLUSTRATION_POLL_INTERVAL_MS;
    if (
      page.imageStatus === "pending" &&
      getInitialIllustrationAction(page) === "resume"
    ) {
      previousRequestCount = undefined;
      input.onPending(page);
      continue;
    }

    const terminal =
      page.imageStatus === "complete" || page.imageStatus === "failed";
    const isPreviousAttempt =
      previousRequestCount !== undefined &&
      (page.imageRequestCount ?? 0) <= previousRequestCount;
    if (terminal && (!isPreviousAttempt || Date.now() >= confirmByMs)) {
      return { page, recovered };
    }

    // A timed-out POST may still be starting. Allow time for the new attempt
    // to appear before treating an unchanged page as an unconfirmed submission.
    if (Date.now() >= confirmByMs) {
      throw new Error("后台未收到本页的插图生成请求，请重试。");
    }
  }

  throw new DOMException("Illustration preview closed.", "AbortError");
}

export async function requestIllustrationPage(
  input: IllustrationRequest & { useFreeFallback?: boolean },
): Promise<IllustrationResult> {
  const submittedAtMs = Date.now();
  const response = await fetchIllustrationApi("/api/illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storyId: input.storyId,
      page: input.page.page,
      regenerationMode: input.useFreeFallback ? "free-fallback" : undefined,
    }),
  });
  if (!input.isActive()) {
    throw new DOMException("Illustration preview closed.", "AbortError");
  }

  if (response && !isTemporaryHttpError(response.status)) {
    if (!response.ok) {
      throw new Error(response.data?.error || SAFE_ILLUSTRATION_ERROR);
    }
    const page = response.data?.page;
    if (page?.page === input.page.page && page.imageStatus === "pending") {
      input.onPending(page);
      return pollIllustrationPage({ ...input, page, submittedAtMs });
    }
    if (
      page?.page === input.page.page &&
      (page.imageStatus === "failed" ||
        (page.imageStatus === "complete" && page.imageUrl))
    ) {
      return { page, recovered: false };
    }
  }

  return pollIllustrationPage({
    ...input,
    submittedAtMs,
    recovered: true,
    previousRequestCount: input.useFreeFallback
      ? (input.page.imageRequestCount ?? 0)
      : undefined,
  });
}
