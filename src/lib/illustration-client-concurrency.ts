import type { StoryPage } from "@/types";

export const DEFAULT_LIVE_ILLUSTRATION_CONCURRENCY = 4;

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
