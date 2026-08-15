export const ANALYTICS_CONSENT_VERSION = "2026-08" as const;
export const ANALYTICS_CONSENT_STORAGE_KEY =
  "storybloom.analytics-consent.v1";
export const ANALYTICS_CONSENT_EVENT = "storybloom:analytics-consent-change";

export type AnalyticsConsentStatus = "granted" | "denied" | "undecided";

export interface AnalyticsConsentRecord {
  version: typeof ANALYTICS_CONSENT_VERSION;
  status: Exclude<AnalyticsConsentStatus, "undecided">;
  updatedAt: string;
}

const PUBLIC_ANALYTICS_ROUTES = [
  "/library",
  "/inspiration",
  "/privacy",
  "/child-family-data",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getBrowserStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function parseAnalyticsConsent(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== ANALYTICS_CONSENT_VERSION ||
      (parsed.status !== "granted" && parsed.status !== "denied") ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.updatedAt))
    ) {
      return undefined;
    }
    return parsed as unknown as AnalyticsConsentRecord;
  } catch {
    return undefined;
  }
}

export function readAnalyticsConsent(
  storage: Pick<Storage, "getItem"> | undefined = getBrowserStorage(),
): AnalyticsConsentStatus {
  if (!storage) return "undecided";
  try {
    return (
      parseAnalyticsConsent(storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY))
        ?.status || "undecided"
    );
  } catch {
    return "undecided";
  }
}

export function writeAnalyticsConsent(
  status: AnalyticsConsentRecord["status"],
  options: {
    storage?: Pick<Storage, "setItem">;
    now?: Date;
    dispatch?: (event: Event) => boolean;
  } = {},
) {
  const record: AnalyticsConsentRecord = {
    version: ANALYTICS_CONSENT_VERSION,
    status,
    updatedAt: (options.now || new Date()).toISOString(),
  };
  const storage = options.storage || getBrowserStorage();
  try {
    storage?.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // The caller can still reflect the current choice in its UI. When local
    // storage is blocked, analytics stays conservatively off and the visitor
    // will be asked again on a later page load.
  }
  const dispatch =
    options.dispatch ||
    (typeof window === "undefined"
      ? undefined
      : (event: Event) => window.dispatchEvent(event));
  dispatch?.(
    new CustomEvent(ANALYTICS_CONSENT_EVENT, {
      detail: { status },
    }),
  );
  return record;
}

export function isPublicAnalyticsPath(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return PUBLIC_ANALYTICS_ROUTES.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

export function isPublicAnalyticsUrl(url: string, expectedOrigin?: string) {
  try {
    const baseUrl = new URL(expectedOrigin || "https://storybloom.local");
    const parsedUrl = new URL(url, baseUrl);
    return (
      (!expectedOrigin || parsedUrl.origin === baseUrl.origin) &&
      isPublicAnalyticsPath(parsedUrl.pathname)
    );
  } catch {
    return false;
  }
}

export function clearKnownAnalyticsCookies(
  writeCookie: ((value: string) => void) | undefined =
    typeof document === "undefined"
      ? undefined
      : (value) => {
          document.cookie = value;
        },
) {
  if (!writeCookie) return;
  ["_clck", "_clsk"].forEach((name) => {
    try {
      writeCookie(`${name}=; Max-Age=0; Path=/; SameSite=Lax`);
    } catch {
      // Cookie access may be blocked. Analysis still stays disabled because
      // the scripts and events are independently gated by consent.
    }
  });
}
