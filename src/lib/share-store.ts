import "server-only";

import { nanoid } from "nanoid";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  readTemporaryStoryAsset,
  type TemporaryStoryAssetPrincipal,
} from "@/lib/temporary-story-asset-store";
import type { StoryInput, StoryPage } from "@/types";

const SHARE_BUCKET = "story-shares";
const MAX_PAGES = 16;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function isLifecycleSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" ||
    /(?:client_story_id|expires_at|revoked_at).*(?:does not exist|schema cache)/i.test(
      candidate.message || "",
    )
  );
}

/**
 * The persisted snapshot deliberately drops most StoryInput fields:
 * share pages must not leak personalization details (toys, friends,
 * appearance notes) — only what is needed to render the book.
 */
export interface SharedStorySnapshot {
  coverTitle: string;
  childName: string;
  language: StoryInput["language"];
  pages: Array<{
    page: number;
    zhText: string;
    enText: string;
    imageUrl?: string;
  }>;
}

export interface SharedStoryRecord {
  shareId: string;
  story: SharedStorySnapshot;
  createdAt: string;
  expiresAt?: string;
}

export type ShareExpiry = "7d" | "30d" | "never";

export interface OwnedSharedStoryRecord extends SharedStoryRecord {
  clientStoryId?: string;
  revokedAt?: string;
}

export type ShareRevocationResult =
  | { status: "not-found" }
  | { status: "deleted" }
  | { status: "cleanup-pending" };

export function getShareExpiration(
  expiry: ShareExpiry,
  now = new Date(),
): string | null {
  if (expiry === "never") return null;
  const days = expiry === "7d" ? 7 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return { contentType: match[1].toLowerCase(), bytes };
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};
const SAFE_SITE_IMAGE_PREFIXES = ["/sample-books/", "/library/", "/characters/"];

export function isAllowedShareImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const parsed = parseDataUrl(imageUrl);
    return Boolean(parsed && EXTENSION_BY_TYPE[parsed.contentType]);
  }

  return (
    /^\/(?!\/)/.test(imageUrl) &&
    !imageUrl.includes("..") &&
    SAFE_SITE_IMAGE_PREFIXES.some((prefix) => imageUrl.startsWith(prefix))
  );
}

export function isTemporaryShareAssetUrl(imageUrl: string) {
  return /^\/api\/story-assets\/[A-Za-z0-9_-]{32}$/.test(imageUrl);
}

async function persistPageImage(
  shareId: string,
  pageNumber: number,
  imageUrl: string,
  assetPrincipals: TemporaryStoryAssetPrincipal[],
): Promise<{ imageUrl?: string; uploadedPath?: string }> {
  const supabase = getSupabaseAdmin();

  let contentType: string;
  let bytes: Buffer;

  if (imageUrl.startsWith("data:")) {
    const parsed = parseDataUrl(imageUrl);
    // Demo/SVG placeholders are not worth persisting.
    if (!parsed || !EXTENSION_BY_TYPE[parsed.contentType]) return {};
    ({ contentType, bytes } = parsed);
  } else if (isTemporaryShareAssetUrl(imageUrl)) {
    const assetId = imageUrl.slice(imageUrl.lastIndexOf("/") + 1);
    let asset = null;
    for (const principal of assetPrincipals) {
      asset = await readTemporaryStoryAsset({ assetId, principal });
      if (asset) break;
    }
    if (!asset) return {};
    contentType = asset.contentType;
    bytes = asset.bytes;
  } else if (isAllowedShareImageUrl(imageUrl)) {
    // Site-relative assets are already stable and do not require a server fetch.
    return { imageUrl };
  } else {
    // Never fetch a browser-supplied remote URL: this endpoint must not become
    // an SSRF primitive or an open image importer.
    return {};
  }

  if (bytes.length > MAX_IMAGE_BYTES) return {};

  const path = `${shareId}/${pageNumber}.${EXTENSION_BY_TYPE[contentType]}`;
  const { error } = await supabase.storage
    .from(SHARE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(SHARE_BUCKET).getPublicUrl(path);
  return { imageUrl: data.publicUrl, uploadedPath: path };
}

export async function createSharedStory(input: {
  clientStoryId?: string;
  coverTitle: string;
  childName: string;
  language: StoryInput["language"];
  pages: Array<Pick<StoryPage, "page" | "zhText" | "enText" | "imageUrl">>;
  ownerUserId?: string;
  assetPrincipals?: TemporaryStoryAssetPrincipal[];
  expiry?: ShareExpiry;
}): Promise<{ shareId: string; deleteToken: string; expiresAt: string | null }> {
  const shareId = nanoid(14);
  const deleteToken = nanoid(24);
  const expiresAt = getShareExpiration(input.expiry || "30d");

  const uploadedPaths: string[] = [];
  try {
    const pageResults = await Promise.allSettled(
      input.pages.slice(0, MAX_PAGES).map(async (page) => {
        const persisted = page.imageUrl
          ? await persistPageImage(
              shareId,
              page.page,
              page.imageUrl,
              input.assetPrincipals || [],
            )
          : {};
        if (persisted.uploadedPath) uploadedPaths.push(persisted.uploadedPath);
        return {
          page: page.page,
          zhText: page.zhText,
          enText: page.enText,
          imageUrl: persisted.imageUrl,
        };
      }),
    );
    const failedPage = pageResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedPage) throw failedPage.reason;
    const pages = pageResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );

    const story: SharedStorySnapshot = {
      coverTitle: input.coverTitle,
      childName: input.childName,
      language: input.language,
      pages,
    };

    const supabase = getSupabaseAdmin();
    let { error } = await supabase
      .from("shared_stories")
      .insert({
        share_id: shareId,
        story,
        delete_token: deleteToken,
        owner_user_id: input.ownerUserId ?? null,
        client_story_id: input.clientStoryId ?? null,
        expires_at: expiresAt,
        revoked_at: null,
      });
    let effectiveExpiresAt = expiresAt;
    if (error && isLifecycleSchemaMissing(error)) {
      const legacyInsert = await supabase.from("shared_stories").insert({
        share_id: shareId,
        story,
        delete_token: deleteToken,
        owner_user_id: input.ownerUserId ?? null,
      });
      error = legacyInsert.error;
      effectiveExpiresAt = null;
    }
    if (error) throw error;

    return { shareId, deleteToken, expiresAt: effectiveExpiresAt };
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await getSupabaseAdmin()
        .storage.from(SHARE_BUCKET)
        .remove(uploadedPaths)
        .catch(() => undefined);
    }
    throw error;
  }
}

export async function getSharedStory(
  shareId: string,
): Promise<SharedStoryRecord | null> {
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(shareId)) return null;

  const supabase = getSupabaseAdmin();
  let { data, error } = await supabase
    .from("shared_stories")
    .select("share_id, story, created_at, expires_at, revoked_at")
    .eq("share_id", shareId)
    .maybeSingle();
  if (error && isLifecycleSchemaMissing(error)) {
    const legacyResult = await supabase
      .from("shared_stories")
      .select("share_id, story, created_at")
      .eq("share_id", shareId)
      .maybeSingle();
    data = legacyResult.data
      ? { ...legacyResult.data, expires_at: null, revoked_at: null }
      : null;
    error = legacyResult.error;
  }
  if (error || !data) return null;

  const expired = data.expires_at
    ? new Date(data.expires_at).getTime() <= Date.now()
    : false;
  if (data.revoked_at || expired) {
    if (expired && !data.revoked_at) {
      await revokeSharedStory({ shareId, system: true }).catch(() => undefined);
    }
    return null;
  }

  return {
    shareId: data.share_id,
    story: data.story as SharedStorySnapshot,
    createdAt: data.created_at,
    expiresAt: data.expires_at || undefined,
  };
}

async function findAuthorizedShare(input: {
  shareId: string;
  deleteToken?: string;
  ownerUserId?: string;
  system?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("shared_stories")
    .select(
      "share_id, story, client_story_id, created_at, expires_at, revoked_at",
    )
    .eq("share_id", input.shareId);
  if (!input.system) {
    // A share created anonymously must remain revocable with its recovery
    // token even if the browser later has a signed-in session.
    if (input.deleteToken) {
      query = query.eq("delete_token", input.deleteToken);
    } else if (input.ownerUserId) {
      query = query.eq("owner_user_id", input.ownerUserId);
    } else {
      return null;
    }
  }
  let { data, error } = await query.maybeSingle();
  if (error && isLifecycleSchemaMissing(error)) {
    let legacyQuery = supabase
      .from("shared_stories")
      .select("share_id, story, created_at")
      .eq("share_id", input.shareId);
    if (!input.system) {
      if (input.deleteToken) {
        legacyQuery = legacyQuery.eq("delete_token", input.deleteToken);
      } else if (input.ownerUserId) {
        legacyQuery = legacyQuery.eq("owner_user_id", input.ownerUserId);
      }
    }
    const legacyResult = await legacyQuery.maybeSingle();
    data = legacyResult.data
      ? {
          ...legacyResult.data,
          client_story_id: null,
          expires_at: null,
          revoked_at: null,
        }
      : null;
    error = legacyResult.error;
    if (error) throw error;
    return data ? { row: data, lifecycleAvailable: false } : null;
  }
  if (error) throw error;
  return data ? { row: data, lifecycleAvailable: true } : null;
}

async function removeShareAssets(shareId: string) {
  const supabase = getSupabaseAdmin();
  const { data: objects, error: listError } = await supabase.storage
    .from(SHARE_BUCKET)
    .list(shareId);
  if (listError) throw listError;
  if (!objects?.length) return;
  const removal = await supabase.storage
    .from(SHARE_BUCKET)
    .remove(objects.map((object) => `${shareId}/${object.name}`));
  if (removal.error) throw removal.error;
}

export async function revokeSharedStory(input: {
  shareId: string;
  deleteToken?: string;
  ownerUserId?: string;
  system?: boolean;
}): Promise<ShareRevocationResult> {
  const authorized = await findAuthorizedShare(input);
  if (!authorized) return { status: "not-found" };
  const { row, lifecycleAvailable } = authorized;

  const supabase = getSupabaseAdmin();
  if (lifecycleAvailable && !row.revoked_at) {
    const revocation = await supabase
      .from("shared_stories")
      .update({ revoked_at: new Date().toISOString() })
      .eq("share_id", input.shareId);
    if (revocation.error) throw revocation.error;
  }

  try {
    await removeShareAssets(input.shareId);
  } catch {
    return { status: "cleanup-pending" };
  }

  const deletion = await supabase
    .from("shared_stories")
    .delete()
    .eq("share_id", input.shareId);
  if (deletion.error) return { status: "cleanup-pending" };
  return { status: "deleted" };
}

export async function listOwnedSharedStories(
  ownerUserId: string,
): Promise<OwnedSharedStoryRecord[]> {
  const supabase = getSupabaseAdmin();
  let { data, error } = await supabase
    .from("shared_stories")
    .select(
      "share_id, story, client_story_id, created_at, expires_at, revoked_at",
    )
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (error && isLifecycleSchemaMissing(error)) {
    const legacyResult = await supabase
      .from("shared_stories")
      .select("share_id, story, created_at")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false });
    data = (legacyResult.data || []).map((row) => ({
      ...row,
      client_story_id: null,
      expires_at: null,
      revoked_at: null,
    }));
    error = legacyResult.error;
  }
  if (error) throw error;
  return (data || []).map((row) => ({
    shareId: row.share_id,
    story: row.story as SharedStorySnapshot,
    clientStoryId: row.client_story_id || undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    revokedAt: row.revoked_at || undefined,
  }));
}

export async function revokeOwnedStoryShares(
  ownerUserId: string,
  clientStoryId: string,
) {
  const shares = (await listOwnedSharedStories(ownerUserId)).filter(
    (share) => share.clientStoryId === clientStoryId,
  );
  const results = await Promise.all(
    shares.map((share) =>
      revokeSharedStory({ shareId: share.shareId, ownerUserId }),
    ),
  );
  return {
    total: results.length,
    cleanupPending: results.filter(
      (result) => result.status === "cleanup-pending",
    ).length,
  };
}

/** Backward-compatible token revocation helper. */
export async function deleteSharedStory(
  shareId: string,
  deleteToken: string,
): Promise<boolean> {
  const result = await revokeSharedStory({ shareId, deleteToken });
  return result.status === "deleted";
}
