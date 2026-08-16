export const SHARE_STORAGE_KEY = "storybloom.shareLinks.v1";
export const SHARE_LINKS_CHANGED_EVENT = "storybloom:share-links-changed";

export interface StoredShare {
  shareId: string;
  deleteToken: string;
  url: string;
  createdAt?: string;
  expiresAt?: string;
  coverTitle?: string;
}

export interface OwnedShareSummary {
  shareId: string;
  clientStoryId?: string;
  coverTitle: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

function dispatchShareChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SHARE_LINKS_CHANGED_EVENT));
  }
}

export function readStoredShares(): Record<string, StoredShare> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SHARE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, Partial<StoredShare>>).flatMap(
        ([storyId, share]) =>
          share &&
          typeof share.shareId === "string" &&
          typeof share.deleteToken === "string" &&
          typeof share.url === "string"
            ? [[storyId, share as StoredShare]]
            : [],
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredShares(shares: Record<string, StoredShare>) {
  try {
    window.localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(shares));
    dispatchShareChange();
    return true;
  } catch {
    return false;
  }
}

export function getStoredShare(storyId: string) {
  return readStoredShares()[storyId];
}

export function isStoredShareExpired(share: StoredShare | undefined) {
  if (!share?.expiresAt) return false;
  const expiresAt = new Date(share.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function storeShare(storyId: string, share: StoredShare) {
  return writeStoredShares({ ...readStoredShares(), [storyId]: share });
}

export function forgetStoredShare(storyId: string) {
  const shares = readStoredShares();
  delete shares[storyId];
  return writeStoredShares(shares);
}

export function createShareManagementCode(share: StoredShare) {
  return `${share.shareId}.${share.deleteToken}`;
}

export function restoreShareManagementCode(
  storyId: string,
  code: string,
  origin: string,
) {
  const match = /^([A-Za-z0-9_-]{10,30})\.([A-Za-z0-9_-]{10,40})$/.exec(
    code.trim(),
  );
  if (!match) return null;
  const share: StoredShare = {
    shareId: match[1],
    deleteToken: match[2],
    url: `${origin}/s/${match[1]}`,
  };
  storeShare(storyId, share);
  return share;
}

async function revokeStoredShare(storyId: string, share: StoredShare) {
  const response = await fetch("/api/share", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shareId: share.shareId,
      deleteToken: share.deleteToken,
    }),
  });
  if (response.ok || response.status === 404) {
    forgetStoredShare(storyId);
    return;
  }
  throw new Error("share-revocation-failed");
}

export async function revokeSharesBeforeStoryDeletion(input: {
  storyId: string;
  accessToken?: string;
}) {
  const stored = getStoredShare(input.storyId);
  if (stored) await revokeStoredShare(input.storyId, stored);
  if (!input.accessToken) return;

  const response = await fetch("/api/share", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({ clientStoryId: input.storyId }),
  });
  if (!response.ok) throw new Error("owned-share-revocation-failed");
}

export async function listOwnedShareSummaries(accessToken: string) {
  const response = await fetch("/api/share", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("owned-share-list-failed");
  const body = (await response.json()) as { shares?: OwnedShareSummary[] };
  return Array.isArray(body.shares) ? body.shares : [];
}
