"use client";

import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  clearKnownAnalyticsCookies,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentStatus,
} from "@/lib/analytics-consent";

const STATUS_COPY: Record<AnalyticsConsentStatus, string> = {
  undecided: "尚未选择；当前不会记录或发送任何访问分析。",
  denied: "已关闭；当前设备不会记录或发送匿名访问分析。",
  granted:
    "已允许；只统计公开内容页面，家庭、成长、创作、账户、登录和分享页面仍然排除。",
};

export default function AnalyticsPrivacyControls() {
  const [status, setStatus] = useState<AnalyticsConsentStatus>("undecided");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setStatus(readAnalyticsConsent());
      setReady(true);
    };
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

  function update(nextStatus: "granted" | "denied") {
    const shouldReload = status === "granted" && nextStatus === "denied";
    writeAnalyticsConsent(nextStatus);
    if (nextStatus === "denied") clearKnownAnalyticsCookies();
    setStatus(nextStatus);
    if (shouldReload) window.location.reload();
  }

  return (
    <div className="analytics-privacy-controls">
      <p role="status">
        <strong>当前设备：</strong>
        {ready ? STATUS_COPY[status] : "正在读取设置…"}
      </p>
      <div>
        <button
          type="button"
          aria-pressed={status === "denied"}
          onClick={() => update("denied")}
        >
          关闭匿名分析
        </button>
        <button
          type="button"
          className="analytics-consent-allow"
          aria-pressed={status === "granted"}
          onClick={() => update("granted")}
        >
          允许公开页面匿名分析
        </button>
      </div>
      <small>
        设置只保存在当前浏览器；清理浏览器数据后会恢复为默认关闭并再次询问。
      </small>
    </div>
  );
}
