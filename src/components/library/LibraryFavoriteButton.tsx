"use client";

import { Heart } from "@phosphor-icons/react";
import { createFavoriteKey } from "@/lib/favorites";
import { useFavorites } from "@/hooks/useFavorites";

export default function LibraryFavoriteButton({
  contentId,
  compact = false,
  toolbar = false,
}: {
  contentId: string;
  compact?: boolean;
  toolbar?: boolean;
}) {
  const { keys, toggle } = useFavorites();
  const active = keys.has(createFavoriteKey("library", contentId));

  return (
    <button
      type="button"
      className={`${toolbar ? "library-reader-icon-btn" : "library-favorite-button"} ${
        active ? "library-favorite-button-active" : ""
      } ${compact && !toolbar ? "library-favorite-button-compact" : ""}`}
      aria-pressed={active}
      aria-label={active ? "取消收藏这本绘本" : "收藏这本绘本"}
      title={compact ? (active ? "取消收藏" : "收藏") : undefined}
      onClick={() => toggle("library", contentId)}
    >
      <Heart aria-hidden="true" weight={active ? "fill" : "regular"} />
      {compact ? null : active ? "已收藏" : "收藏"}
    </button>
  );
}
