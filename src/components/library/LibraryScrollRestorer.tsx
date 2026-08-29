"use client";

import { useEffect } from "react";
import {
  clearLibraryReturnPosition,
  readLibraryHistoryReturnPosition,
  readLibraryReturnPosition,
} from "@/lib/library/navigation";

export default function LibraryScrollRestorer() {
  useEffect(() => {
    let frame = 0;
    let settleTimer = 0;
    let finalTimer = 0;
    let previousScrollRestoration = window.history.scrollRestoration;

    const cancelScheduledRestore = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (finalTimer) window.clearTimeout(finalTimer);
      frame = 0;
      settleTimer = 0;
      finalTimer = 0;
    };

    const scheduleRestore = () => {
      const saved = readLibraryReturnPosition();
      const historySaved = readLibraryHistoryReturnPosition();
      const returnPosition =
        saved?.sourcePathname === window.location.pathname
          ? saved
          : historySaved?.sourcePathname === window.location.pathname
            ? historySaved
            : null;
      if (!returnPosition) return;

      cancelScheduledRestore();
      previousScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      const restore = () => {
        window.scrollTo({
          top: returnPosition.scrollY,
          left: 0,
          behavior: "auto",
        });
      };

      frame = window.requestAnimationFrame(restore);
      settleTimer = window.setTimeout(restore, 120);
      finalTimer = window.setTimeout(() => {
        restore();
        if (saved) clearLibraryReturnPosition(saved.capturedAt);
        window.history.scrollRestoration = previousScrollRestoration;
      }, 420);
    };

    scheduleRestore();
    window.addEventListener("popstate", scheduleRestore);
    window.addEventListener("pageshow", scheduleRestore);

    return () => {
      cancelScheduledRestore();
      window.removeEventListener("popstate", scheduleRestore);
      window.removeEventListener("pageshow", scheduleRestore);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return null;
}
