"use client";

import type { MouseEvent } from "react";
import {
  readLibraryHistoryReturnPosition,
  readLibraryReturnPosition,
} from "@/lib/library/navigation";

export default function LibraryDetailBackLink({
  fallbackHref,
  fallbackLabel,
}: {
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const saved = readLibraryReturnPosition();
    const historySaved = readLibraryHistoryReturnPosition();
    if (
      (saved?.destinationPathname === window.location.pathname ||
        historySaved?.destinationPathname === window.location.pathname) &&
      window.history.length > 1
    ) {
      event.preventDefault();
      window.history.back();
    }
  };

  return (
    <a href={fallbackHref} className="library-back" onClick={handleClick}>
      ← 返回上一页
      <span className="sr-only">，直接访问时返回{fallbackLabel}</span>
    </a>
  );
}
