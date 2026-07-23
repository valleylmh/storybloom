import "server-only";

import { nanoid } from "nanoid";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import type { StoryInput, StoryPage } from "@/types";

const SHARE_BUCKET = "story-shares";
const MAX_PAGES = 16;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

async function persistPageImage(
  shareId: string,
  pageNumber: number,
  imageUrl: string,
): Promise<string | undefined> {
  const supabase = getSupabaseAdmin();

  let contentType: string;
  let bytes: Buffer;

  if (imageUrl.startsWith("data:")) {
    const parsed = parseDataUrl(imageUrl);
    // Demo/SVG placeholders are not worth persisting.
    if (!parsed || !EXTENSION_BY_TYPE[parsed.contentType]) return undefined;
    ({ contentType, bytes } = parsed);
  } else if (isAllowedShareImageUrl(imageUrl)) {
    // Site-relative assets are already stable and do not require a server fetch.
    return imageUrl;
  } else {
    // Never fetch a browser-supplied remote URL: this endpoint must not become
    // an SSRF primitive or an open image importer.
    return undefined;
  }

  if (bytes.length > MAX_IMAGE_BYTES) return undefined;

  const path = `${shareId}/${pageNumber}.${EXTENSION_BY_TYPE[contentType]}`;
  const { error } = await supabase.storage
    .from(SHARE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(SHARE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createSharedStory(input: {
  coverTitle: string;
  childName: string;
  language: StoryInput["language"];
  pages: Array<Pick<StoryPage, "page" | "zhText" | "enText" | "imageUrl">>;
  ownerUserId?: string;
}): Promise<{ shareId: string; deleteToken: string }> {
  const shareId = nanoid(14);
  const deleteToken = nanoid(24);

  const pages = await Promise.all(
    input.pages.slice(0, MAX_PAGES).map(async (page) => ({
      page: page.page,
      zhText: page.zhText,
      enText: page.enText,
      imageUrl: page.imageUrl
        ? await persistPageImage(shareId, page.page, page.imageUrl)
        : undefined,
    })),
  );

  const story: SharedStorySnapshot = {
    coverTitle: input.coverTitle,
    childName: input.childName,
    language: input.language,
    pages,
  };

  const { error } = await getSupabaseAdmin()
    .from("shared_stories")
    .insert({
      share_id: shareId,
      story,
      delete_token: deleteToken,
      owner_user_id: input.ownerUserId ?? null,
    });
  if (error) throw error;

  return { shareId, deleteToken };
}

export async function getSharedStory(
  shareId: string,
): Promise<SharedStoryRecord | null> {
  if (!/^[A-Za-z0-9_-]{10,30}$/.test(shareId)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("shared_stories")
    .select("share_id, story, created_at")
    .eq("share_id", shareId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    shareId: data.share_id,
    story: data.story as SharedStorySnapshot,
    createdAt: data.created_at,
  };
}

export async function deleteSharedStory(
  shareId: string,
  deleteToken: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("shared_stories")
    .delete()
    .eq("share_id", shareId)
    .eq("delete_token", deleteToken)
    .select("share_id");
  if (error) return false;
  const deleted = Boolean(data?.length);

  if (deleted) {
    const { data: objects } = await supabase.storage
      .from(SHARE_BUCKET)
      .list(shareId);
    if (objects?.length) {
      await supabase.storage
        .from(SHARE_BUCKET)
        .remove(objects.map((object) => `${shareId}/${object.name}`));
    }
  }

  return deleted;
}
