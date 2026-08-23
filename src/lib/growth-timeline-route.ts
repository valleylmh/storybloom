import type { GrowthMomentBundle } from "@/lib/growth-moments";

const MAX_GROWTH_TIMELINE_ID_LENGTH = 180;

export type GrowthTimelineTarget = {
  childKey: string;
  momentId?: string;
};

export function normalizeGrowthTimelineId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 &&
    normalized.length <= MAX_GROWTH_TIMELINE_ID_LENGTH &&
    !/[\u0000-\u001f]/.test(normalized)
    ? normalized
    : undefined;
}

/**
 * A child key groups a timeline, while a Moment id identifies the exact record
 * that was just saved. Keep both: old links remain child-scoped, and a fresh
 * result link can still open its record if the display key changes shape.
 */
export function getGrowthTimelineHref({
  childKey,
  momentId,
}: GrowthTimelineTarget) {
  const normalizedChildKey = normalizeGrowthTimelineId(childKey);
  const normalizedMomentId = normalizeGrowthTimelineId(momentId);
  const pathname = `/growth/${encodeURIComponent(normalizedChildKey || childKey)}`;

  return normalizedMomentId
    ? `${pathname}?moment=${encodeURIComponent(normalizedMomentId)}`
    : pathname;
}

export function selectGrowthTimelineBundles(
  bundles: readonly GrowthMomentBundle[],
  target: GrowthTimelineTarget,
) {
  const normalizedChildKey = normalizeGrowthTimelineId(target.childKey);
  const normalizedMomentId = normalizeGrowthTimelineId(target.momentId);
  const childBundles = normalizedChildKey
    ? bundles.filter((bundle) => bundle.moment.childKey === normalizedChildKey)
    : [];

  if (!normalizedMomentId) return childBundles;

  const directBundle = bundles.find(
    (bundle) =>
      bundle.moment.momentId === normalizedMomentId ||
      bundle.moment.clientMomentId === normalizedMomentId,
  );

  // A fresh result link pins one Moment, then opens its full child timeline.
  // This avoids both an empty page from a changed display key and a timeline
  // that appears to contain only the most recently created Moment.
  if (directBundle) {
    return bundles.filter(
      (bundle) => bundle.moment.childKey === directBundle.moment.childKey,
    );
  }

  // Preserve normal child-scoped behavior for copied or stale result links.
  return childBundles;
}
