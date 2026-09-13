import { imageUrlToDataUrl } from "@/lib/client-images";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import { createIndexedDbSyncMetaStore } from "./sync-meta";
import type { GenerateResponse } from "@/types";
export async function openAccountStory(story: GenerateResponse, userId: string, cloudId?: string) {
  const pages = await Promise.all(story.pages.map(async page => {
    if (!page.imageUrl || page.imageUrl.startsWith("data:")) return page;
    const dataUrl = await imageUrlToDataUrl(page.imageUrl);
    if (!dataUrl) throw new Error("图片加载失败，请联网后重试");
    return { ...page, imageUrl: dataUrl };
  }));
  await localStoryRepository.save({ result: { ...story, pages } });
  if (cloudId) await createIndexedDbSyncMetaStore(userId).put({ entityType: "story", localId: story.storyId, cloudId, status: "synced", lastSyncedAt: new Date().toISOString() });
  window.location.href = `/?mode=minimal&book=${encodeURIComponent(story.storyId)}`;
}
