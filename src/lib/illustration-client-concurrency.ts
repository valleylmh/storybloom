import type { StoryPage } from "@/types";

// Keep ordinary providers below the burst that previously caused several
// pages to time out together. CPA remains strictly serialized below.
export const DEFAULT_LIVE_ILLUSTRATION_CONCURRENCY = 2;

export function getLiveIllustrationConcurrency(
  pages: Array<Pick<StoryPage, "imagePlannedProvider" | "imageProvider">>,
) {
  if (
    pages.length > 0 &&
    pages.every(
      (page) =>
        page.imagePlannedProvider === "cpa" || page.imageProvider === "cpa",
    )
  ) {
    return 1;
  }

  return DEFAULT_LIVE_ILLUSTRATION_CONCURRENCY;
}
