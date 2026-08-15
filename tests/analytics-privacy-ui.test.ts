import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  new URL("../src/app/layout.tsx", import.meta.url),
  "utf8",
);
const managerSource = readFileSync(
  new URL(
    "../src/components/analytics/AnalyticsConsentManager.tsx",
    import.meta.url,
  ),
  "utf8",
);
const privacySource = readFileSync(
  new URL("../src/app/privacy/page.tsx", import.meta.url),
  "utf8",
);
const footerSource = readFileSync(
  new URL("../src/components/layout/Footer.tsx", import.meta.url),
  "utf8",
);
const clarityPath = new URL(
  "../src/components/analytics/ClarityAnalytics.tsx",
  import.meta.url,
);

describe("analytics privacy UI", () => {
  it("does not load analytics directly from the root layout", () => {
    expect(layoutSource).toContain("<AnalyticsConsentManager />");
    expect(layoutSource).toContain('data-clarity-mask="true"');
    expect(layoutSource).not.toContain('@vercel/analytics/next');
    expect(layoutSource).not.toContain("ClarityAnalytics");
    expect(existsSync(clarityPath)).toBe(false);
  });

  it("requires consent and applies a second URL filter before sending events", () => {
    expect(managerSource).toContain('status === "granted"');
    expect(managerSource).toContain("isPublicAnalyticsPath(pathname)");
    expect(managerSource).toContain("beforeSend");
    expect(managerSource).toContain('readAnalyticsConsent() === "granted"');
    expect(managerSource).toContain(
      "isPublicAnalyticsUrl(event.url, window.location.origin)",
    );
    expect(managerSource).toContain("clearKnownAnalyticsCookies");
    expect(managerSource).toContain("仅必要功能");
  });

  it("provides a permanent withdrawal entry and explains the paused replay tool", () => {
    expect(privacySource).toContain("<AnalyticsPrivacyControls />");
    expect(privacySource).toContain("Microsoft Clarity 会话回放目前暂停接入");
    expect(privacySource).toContain("脚本文件可能暂时保留到刷新页面");
    expect(footerSource).toContain('/privacy#analytics-controls');
    expect(footerSource).toContain("分析设置");
  });
});
