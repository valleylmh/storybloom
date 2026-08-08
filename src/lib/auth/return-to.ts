const DEFAULT_RETURN_TO = "/";
const LOCAL_ORIGIN = "https://storybloom.local";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isSafeRelativePath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) return false;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return false;
    if (CONTROL_CHARACTERS.test(decoded)) return false;

    const url = new URL(value, LOCAL_ORIGIN);
    return url.origin === LOCAL_ORIGIN && url.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function sanitizeReturnTo(
  value: string | null | undefined,
  fallback = DEFAULT_RETURN_TO,
) {
  const safeFallback = isSafeRelativePath(fallback) ? fallback : DEFAULT_RETURN_TO;
  const candidate = value?.trim();
  if (!candidate || !isSafeRelativePath(candidate)) return safeFallback;

  const url = new URL(candidate, LOCAL_ORIGIN);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildLoginPath(returnTo: string) {
  const params = new URLSearchParams({ next: sanitizeReturnTo(returnTo) });
  return `/login?${params.toString()}`;
}

export function buildAuthCallbackUrl(origin: string, returnTo: string) {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", sanitizeReturnTo(returnTo));
  return callbackUrl.toString();
}
