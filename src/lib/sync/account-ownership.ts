// Bind each device record to its first account. Never infer ownership from title.
const KEY = "storybloom.record-owners.v1";
let activeOwner: string | null = null;
export function setActiveRecordOwner(userId: string | null) { activeOwner = userId; }
export function claimRecord(kind: "story" | "growth", id: string, userId = activeOwner) {
  if (!userId || typeof window === "undefined") return false;
  const owners = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Record<string, string>;
  const key = `${kind}:${id}`;
  if (owners[key]) return owners[key] === userId;
  owners[key] = userId;
  window.localStorage.setItem(KEY, JSON.stringify(owners));
  return true;
}
export function signalAccountChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("storybloom:account-data-dirty"));
}

export function canSaveRecord(kind: "story" | "growth", id: string) {
  return !activeOwner || claimRecord(kind, id, activeOwner);
}
