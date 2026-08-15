import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_CONSENT_VERSION,
  clearKnownAnalyticsCookies,
  isPublicAnalyticsPath,
  isPublicAnalyticsUrl,
  parseAnalyticsConsent,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "@/lib/analytics-consent";

describe("analytics consent boundary", () => {
  it("defaults to off and re-asks when the consent version is stale", () => {
    expect(readAnalyticsConsent({ getItem: () => null })).toBe("undecided");
    expect(
      parseAnalyticsConsent(
        JSON.stringify({
          version: "2026-07",
          status: "granted",
          updatedAt: "2026-08-15T00:00:00.000Z",
        }),
      ),
    ).toBeUndefined();
  });

  it("stores an explicit device choice without coupling it to authentication", () => {
    const setItem = vi.fn();
    const dispatch = vi.fn((_event: Event) => true);
    const record = writeAnalyticsConsent("granted", {
      storage: { setItem },
      dispatch,
      now: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(record).toEqual({
      version: ANALYTICS_CONSENT_VERSION,
      status: "granted",
      updatedAt: "2026-08-15T00:00:00.000Z",
    });
    expect(setItem).toHaveBeenCalledWith(
      ANALYTICS_CONSENT_STORAGE_KEY,
      JSON.stringify(record),
    );
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: ANALYTICS_CONSENT_EVENT,
    });
    expect(
      readAnalyticsConsent({
        getItem: () => JSON.stringify(record),
      }),
    ).toBe("granted");
  });

  it("allows only public content routes and rejects every family-sensitive path", () => {
    for (const path of [
      "/library",
      "/library/xiyouji/shi-hou-chu-shi",
      "/inspiration",
      "/privacy",
      "/child-family-data",
    ]) {
      expect(isPublicAnalyticsPath(path)).toBe(true);
    }
    for (const path of [
      "/",
      "/growth",
      "/me",
      "/me/growth",
      "/family",
      "/login",
      "/auth/callback",
      "/custom",
      "/s/private-share-id",
    ]) {
      expect(isPublicAnalyticsPath(path)).toBe(false);
    }
    expect(
      isPublicAnalyticsUrl(
        "https://storybloom.valleylmh.vip/library/xiyouji/shi-hou-chu-shi",
      ),
    ).toBe(true);
    expect(
      isPublicAnalyticsUrl(
        "https://storybloom.valleylmh.vip/me/growth?source=cloud",
      ),
    ).toBe(false);
    expect(
      isPublicAnalyticsUrl(
        "https://example.com/library/xiyouji/shi-hou-chu-shi",
        "https://storybloom.valleylmh.vip",
      ),
    ).toBe(false);
  });

  it("clears known first-party session-replay cookies when consent is withdrawn", () => {
    const writeCookie = vi.fn();
    clearKnownAnalyticsCookies(writeCookie);
    expect(writeCookie).toHaveBeenCalledWith(
      "_clck=; Max-Age=0; Path=/; SameSite=Lax",
    );
    expect(writeCookie).toHaveBeenCalledWith(
      "_clsk=; Max-Age=0; Path=/; SameSite=Lax",
    );
  });
});
