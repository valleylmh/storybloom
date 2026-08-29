export type LibraryReturnPosition = {
  sourcePathname: string;
  sourceHref: string;
  destinationPathname: string;
  scrollY: number;
  capturedAt: number;
};

const LIBRARY_RETURN_POSITION_KEY = "storybloom.library-return-position.v1";
const LIBRARY_RETURN_POSITION_MAX_AGE = 30 * 60 * 1000;
export const LIBRARY_RETURN_HISTORY_STATE_KEY =
  "__storybloomLibraryReturnPosition";

export type LibraryHistoryReturnPosition = Pick<
  LibraryReturnPosition,
  "sourcePathname" | "destinationPathname" | "scrollY" | "capturedAt"
>;

function isValidReturnPosition(value: unknown): value is LibraryReturnPosition {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LibraryReturnPosition>;
  return (
    typeof record.sourcePathname === "string" &&
    typeof record.sourceHref === "string" &&
    typeof record.destinationPathname === "string" &&
    typeof record.scrollY === "number" &&
    Number.isFinite(record.scrollY) &&
    typeof record.capturedAt === "number" &&
    Date.now() - record.capturedAt <= LIBRARY_RETURN_POSITION_MAX_AGE
  );
}

export function rememberLibraryReturnPosition(destinationHref: string) {
  if (typeof window === "undefined") return;
  const destination = new URL(destinationHref, window.location.origin);
  const record: LibraryReturnPosition = {
    sourcePathname: window.location.pathname,
    sourceHref: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    destinationPathname: destination.pathname,
    scrollY: Math.max(0, window.scrollY),
    capturedAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(
      LIBRARY_RETURN_POSITION_KEY,
      JSON.stringify(record),
    );
  } catch {
    // The history entry below remains available when session storage is blocked.
  }
  try {
    window.history.replaceState(
      {
        ...window.history.state,
        [LIBRARY_RETURN_HISTORY_STATE_KEY]: {
          sourcePathname: record.sourcePathname,
          destinationPathname: record.destinationPathname,
          scrollY: record.scrollY,
          capturedAt: record.capturedAt,
        } satisfies LibraryHistoryReturnPosition,
      },
      "",
      record.sourceHref,
    );
  } catch {
    // Native history navigation still works when history state is unavailable.
  }
}

export function readLibraryHistoryReturnPosition() {
  if (typeof window === "undefined") return null;
  const value = window.history.state?.[
    LIBRARY_RETURN_HISTORY_STATE_KEY
  ] as Partial<LibraryHistoryReturnPosition> | undefined;
  if (
    !value ||
    typeof value.sourcePathname !== "string" ||
    typeof value.destinationPathname !== "string" ||
    typeof value.scrollY !== "number" ||
    !Number.isFinite(value.scrollY) ||
    typeof value.capturedAt !== "number"
  ) {
    return null;
  }
  return value as LibraryHistoryReturnPosition;
}

export function readLibraryReturnPosition() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_RETURN_POSITION_KEY);
    const value = raw ? (JSON.parse(raw) as unknown) : null;
    if (!isValidReturnPosition(value)) {
      window.sessionStorage.removeItem(LIBRARY_RETURN_POSITION_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearLibraryReturnPosition(capturedAt: number) {
  if (typeof window === "undefined") return;
  const current = readLibraryReturnPosition();
  if (!current || current.capturedAt !== capturedAt) return;
  try {
    window.sessionStorage.removeItem(LIBRARY_RETURN_POSITION_KEY);
  } catch {
    // No cleanup is needed when browser storage is unavailable.
  }
}
