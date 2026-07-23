const DEFAULT_APP_URL = "http://localhost:3000";

export const APP_METADATA_BASE = new URL(
  (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, ""),
);

export function toAbsoluteAppUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, APP_METADATA_BASE).toString();
}
