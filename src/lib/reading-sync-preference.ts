export const READING_SYNC_CHANGED_EVENT = "storybloom:reading-sync-changed";

const READING_SYNC_KEY = "storybloom.readingSyncEnabled.v1";

export function isReadingSyncEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(READING_SYNC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setReadingSyncEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(READING_SYNC_KEY, "1");
    } else {
      window.localStorage.removeItem(READING_SYNC_KEY);
    }
    window.dispatchEvent(new Event(READING_SYNC_CHANGED_EVENT));
  } catch {
    // The feature stays local-only when the browser blocks preferences.
  }
}
