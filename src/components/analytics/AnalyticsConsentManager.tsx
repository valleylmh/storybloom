"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  clearKnownAnalyticsCookies,
  isPublicAnalyticsPath,
  isPublicAnalyticsUrl,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentStatus,
} from "@/lib/analytics-consent";

export default function AnalyticsConsentManager() {
  const pathname = usePathname();
  const [status, setStatus] = useState<AnalyticsConsentStatus | "loading">(
    "loading",
  );

  useEffect(() => {
    const refresh = () => setStatus(readAnalyticsConsent());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) refresh();
    };
    refresh();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function choose(nextStatus: "granted" | "denied") {
    writeAnalyticsConsent(nextStatus);
    if (nextStatus === "denied") clearKnownAnalyticsCookies();
    setStatus(nextStatus);
  }

  const analyticsAllowed =
    status === "granted" && isPublicAnalyticsPath(pathname);
  const showPrompt =
    status === "undecided" && !pathname.startsWith("/auth/callback");

  return (
    <>
      {analyticsAllowed ? (
        <Analytics
          beforeSend={(event) =>
            readAnalyticsConsent() === "granted" &&
            isPublicAnalyticsUrl(event.url, window.location.origin)
              ? event
              : null
          }
        />
      ) : null}

      {showPrompt ? (
        <aside
          className="analytics-consent-banner"
          aria-label="匿名访问分析设置"
          role="region"
        >
          <div>
            <strong>是否允许匿名访问分析？</strong>
            <p>
              默认不加载分析。允许后也只统计绘本馆、每日灵感和隐私说明等公开页面；创作、成长、家庭、账户、登录和分享页面始终不记录或发送访问事件。
            </p>
            <Link href="/privacy#analytics-controls">查看或随时更改设置</Link>
          </div>
          <div className="analytics-consent-actions">
            <button type="button" onClick={() => choose("denied")}>
              仅必要功能
            </button>
            <button
              type="button"
              className="analytics-consent-allow"
              onClick={() => choose("granted")}
            >
              允许匿名分析
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
