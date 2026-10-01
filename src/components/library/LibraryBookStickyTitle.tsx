"use client";

import { useEffect, useState } from "react";
import LibraryDetailBackLink from "@/components/library/LibraryDetailBackLink";

export default function LibraryBookStickyTitle({
  title,
  titleId,
  fallbackHref,
  fallbackLabel,
}: {
  title: string;
  titleId: string;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const heading = document.getElementById(titleId);
    if (!heading) return;

    // Only show after the heading has scrolled above the viewport.
    // A heading below the viewport should not activate the bar.
    setVisible(heading.getBoundingClientRect().bottom <= 0);
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(heading);
    return () => observer.disconnect();
  }, [titleId, title]);

  if (!visible) return null;

  return (
    <div className="library-book-sticky-title">
      <nav className="library-book-sticky-title-inner" aria-label="当前绘本">
        <LibraryDetailBackLink
          fallbackHref={fallbackHref}
          fallbackLabel={fallbackLabel}
        />
        <p title={title}>{title}</p>
      </nav>
    </div>
  );
}
