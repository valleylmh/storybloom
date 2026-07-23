"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { isWeChatBrowser } from "@/lib/browser-detection";

const TAWK_PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
const TAWK_WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID;
const OPEN_TAWK_EVENT = "storybloom:open-tawk";
const TITLE_GUARD_INTERVAL_MS = 250;

declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void;
      minimize?: () => void;
      hideWidget?: () => void;
      showWidget?: () => void;
      onLoad?: () => void;
    };
    __storybloomTawkOpenPending?: boolean;
    __storybloomTawkPanelOpen?: boolean;
  }
}

function isVisibleLauncher(box: DOMRect) {
  return box.width > 0 && box.height > 0 && box.width <= 420 && box.height <= 140;
}

function isEdgePinned(box: DOMRect) {
  return box.bottom >= window.innerHeight - 80 || box.top <= 80;
}

function isRightLauncher(box: DOMRect) {
  return (
    isVisibleLauncher(box) &&
    box.right >= window.innerWidth - 120 &&
    box.bottom >= window.innerHeight - 140
  );
}

function collectFixedLauncherWrappers(
  node: HTMLElement | null,
  targets: Set<HTMLElement>,
) {
  let current = node;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const box = current.getBoundingClientRect();
    if (
      style.position === "fixed" &&
      (isRightLauncher(box) || (isVisibleLauncher(box) && isEdgePinned(box)))
    ) {
      targets.add(current);
    }
    current = current.parentElement;
  }
}

function findTawkLaunchers() {
  const launchers = new Set<HTMLElement>();
  const addLauncher = (node: HTMLElement | null) => {
    if (node) launchers.add(node);
  };

  const iframes = document.querySelectorAll<HTMLIFrameElement>(
    [
      'iframe[src*="embed.tawk.to"]',
      'iframe[src*="tawk.to"]',
      'iframe[src*="tawk.link"]',
      'iframe[title*="tawk" i]',
      'iframe[title*="chat" i]',
      'iframe[name*="tawk" i]',
    ].join(", "),
  );
  iframes.forEach((iframe) => {
    const box = iframe.getBoundingClientRect();
    if (isVisibleLauncher(box) || isRightLauncher(box)) {
      addLauncher(iframe);
      addLauncher(iframe.parentElement);
      collectFixedLauncherWrappers(iframe.parentElement, launchers);
    }
  });

  const links = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="tawk.to"], a[href*="tawk.link"], a[title*="tawk" i], a[aria-label*="tawk" i]',
  );
  links.forEach((link) => {
    const text = [
      link.textContent,
      link.getAttribute("aria-label"),
      link.getAttribute("title"),
      link.href,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!text.includes("tawk")) {
      return;
    }

    addLauncher(link);

    const box = link.getBoundingClientRect();
    if (isVisibleLauncher(box) || window.getComputedStyle(link).position === "fixed") {
      addLauncher(link.parentElement);
      collectFixedLauncherWrappers(link, launchers);
    }
  });

  return [...launchers];
}

function getFrameDocument(iframe: HTMLIFrameElement) {
  try {
    return iframe.contentDocument || iframe.contentWindow?.document || null;
  } catch {
    return null;
  }
}

function isTawkBrandingLink(link: HTMLAnchorElement) {
  const text = [
    link.textContent,
    link.getAttribute("aria-label"),
    link.getAttribute("title"),
    link.href,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("powered by tawk") ||
    text.includes("powered by tawk.to") ||
    text.includes("tawk.to")
  );
}

function hideBrandingLink(link: HTMLAnchorElement) {
  link.style.setProperty("display", "none", "important");
  link.style.setProperty("visibility", "hidden", "important");
  link.style.setProperty("pointer-events", "none", "important");

  let current = link.parentElement;
  while (current && current !== current.ownerDocument.body) {
    const box = current.getBoundingClientRect();
    if (box.width > 0 && box.width <= 280 && box.height > 0 && box.height <= 72) {
      current.style.setProperty("display", "none", "important");
      break;
    }
    current = current.parentElement;
  }
}

function hideTawkBrandingInDocument(doc: Document) {
  const styleId = "storybloom-hide-tawk-branding";
  if (!doc.getElementById(styleId)) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = `
      a[href*="tawk.to"],
      a[href*="tawk.link"],
      a[aria-label*="tawk" i],
      a[title*="tawk" i] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    doc.head?.appendChild(style);
  }

  doc
    .querySelectorAll<HTMLAnchorElement>(
      'a[href*="tawk.to"], a[href*="tawk.link"], a[aria-label*="tawk" i], a[title*="tawk" i]',
    )
    .forEach((link) => {
      if (isTawkBrandingLink(link)) {
        hideBrandingLink(link);
      }
    });
}

function hideTawkBranding() {
  hideTawkBrandingInDocument(document);

  document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
    const frameDocument = getFrameDocument(iframe);
    if (frameDocument) {
      hideTawkBrandingInDocument(frameDocument);
    }
  });
}

function hideLaunchers() {
  findTawkLaunchers().forEach((el) => {
    el.style.setProperty("display", "none", "important");
  });
  hideTawkBranding();
}

function isTawkNotificationTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  return (
    /(^|\s|\()\d+\)?\s+new messages?($|\s)/i.test(normalized) ||
    normalized === "new message" ||
    normalized.includes(" new message") ||
    /\d+\s*\u6761\u65b0\u6d88\u606f/.test(normalized)
  );
}

function startTitleGuard() {
  let appTitle = document.title;

  const restoreTitle = () => {
    if (isTawkNotificationTitle(document.title)) {
      document.title = appTitle;
      return;
    }

    if (document.title.trim()) {
      appTitle = document.title;
    }
  };

  const observer = new MutationObserver(restoreTitle);
  const titleElement = document.querySelector("title");
  if (titleElement) {
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true });
  }
  observer.observe(document.head, { childList: true, subtree: true });

  const interval = window.setInterval(restoreTitle, TITLE_GUARD_INTERVAL_MS);
  window.addEventListener("focus", restoreTitle);
  document.addEventListener("visibilitychange", restoreTitle);
  restoreTitle();

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
    window.removeEventListener("focus", restoreTitle);
    document.removeEventListener("visibilitychange", restoreTitle);
  };
}

function suppressLaunchersFor(durationMs = 4000) {
  hideLaunchers();
  const timer = window.setInterval(hideLaunchers, 200);
  window.setTimeout(() => {
    window.clearInterval(timer);
    hideLaunchers();
  }, durationMs);
}

function openLoadedTawkTo() {
  window.Tawk_API?.showWidget?.();
  window.Tawk_API?.maximize?.();
  window.__storybloomTawkOpenPending = false;
  window.__storybloomTawkPanelOpen = true;
  suppressLaunchersFor(1600);
}

export default function TawkToChat() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!TAWK_PROPERTY_ID || !TAWK_WIDGET_ID || isWeChatBrowser()) {
      return;
    }

    const requestOpen = () => {
      window.__storybloomTawkOpenPending = true;
      setShouldLoad(true);
      if (window.Tawk_API?.maximize || window.Tawk_API?.showWidget) {
        openLoadedTawkTo();
      }
    };

    window.addEventListener(OPEN_TAWK_EVENT, requestOpen);
    if (window.__storybloomTawkOpenPending) {
      requestOpen();
    }

    return () => {
      window.removeEventListener(OPEN_TAWK_EVENT, requestOpen);
    };
  }, []);

  useEffect(() => {
    if (!shouldLoad) {
      return;
    }

    let observer: MutationObserver | null = null;
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    let suppressTimer: number | null = null;
    const stopTitleGuard = startTitleGuard();

    // Wait for Tawk.to SDK to initialize, then start watching its injected UI.
    const ready = setInterval(() => {
      if (
        document.querySelector('iframe[src*="embed.tawk.to"]') ||
        window.Tawk_API?.hideWidget
      ) {
        clearInterval(ready);
        if (window.__storybloomTawkOpenPending) {
          openLoadedTawkTo();
        } else {
          window.Tawk_API?.hideWidget?.();
          suppressLaunchersFor();
        }

        suppressTimer = window.setInterval(() => {
          if (!window.__storybloomTawkOpenPending && !window.__storybloomTawkPanelOpen) {
            window.Tawk_API?.hideWidget?.();
            hideLaunchers();
          }
        }, 1000);
        window.setTimeout(() => {
          if (suppressTimer) {
            window.clearInterval(suppressTimer);
            suppressTimer = null;
          }
          hideLaunchers();
        }, 7000);

        observer = new MutationObserver(() => {
          hideLaunchers();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Click outside chat panel -> minimize.
        clickHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('iframe[src*="embed.tawk.to"]')) return;

          // Check if click landed inside any tawk wrapper
          const wrappers = document.querySelectorAll<HTMLElement>(
            'iframe[src*="embed.tawk.to"]',
          );
          for (const iframe of wrappers) {
            const container = iframe.parentElement;
            if (container && container.contains(target)) return;
          }

          window.Tawk_API?.minimize?.();
          window.Tawk_API?.hideWidget?.();
          window.__storybloomTawkPanelOpen = false;
          // Re-hide bubble after minimize restores it.
          suppressLaunchersFor();
        };
        document.addEventListener("click", clickHandler, true);
      }
    }, 200);

    return () => {
      clearInterval(ready);
      stopTitleGuard();
      observer?.disconnect();
      if (suppressTimer) {
        window.clearInterval(suppressTimer);
      }
      if (clickHandler) {
        document.removeEventListener("click", clickHandler, true);
      }
    };
  }, [shouldLoad]);

  if (!TAWK_PROPERTY_ID || !TAWK_WIDGET_ID || !shouldLoad) {
    return null;
  }

  const initScript = `
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_API.onLoad = function () {
      if (window.__storybloomTawkOpenPending) {
        window.Tawk_API.showWidget();
        window.Tawk_API.maximize();
        window.__storybloomTawkOpenPending = false;
        window.__storybloomTawkPanelOpen = true;
      } else {
        window.Tawk_API.hideWidget();
      }
      setTimeout(function () {
        if (!window.__storybloomTawkOpenPending && !window.__storybloomTawkPanelOpen) {
          window.Tawk_API.hideWidget();
        }
      }, 500);
    };
    (function () {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}";
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      document.head.appendChild(s);
    })();
  `;

  return (
    <Script id="tawk-to" strategy="afterInteractive">
      {initScript}
    </Script>
  );
}

export function openTawkTo() {
  if (typeof window === "undefined") return;
  if (isWeChatBrowser()) return;
  if (window.Tawk_API?.maximize || window.Tawk_API?.showWidget) {
    openLoadedTawkTo();
    return;
  }

  window.__storybloomTawkOpenPending = true;
  window.dispatchEvent(new Event(OPEN_TAWK_EVENT));
}
