"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAccountSync } from "@/components/sync/AccountSyncProvider";
import AccountSyncStatus from "@/components/sync/AccountSyncStatus";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import { openAccountStory } from "@/lib/sync/open-account-story";
import { revokeSharesBeforeStoryDeletion } from "@/lib/client-share-management";
import type { SavedStory } from "@/lib/repositories/story-repository";

export default function UnifiedStoryLibrary() {
  const { supabase, session } = useAuth();
  const sync = useAccountSync();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function act(story: SavedStory, action: "open" | "rename" | "delete") {
    if (!supabase || !session) return;
    const title = action === "rename" ? window.prompt("绘本名称", story.result.coverTitle) : undefined;
    if (action === "rename" && !title?.trim()) return;
    if (action === "delete" && !window.confirm(`从账号删除《${story.result.coverTitle}》？其他设备同步后也会移除，相关分享将撤销。`)) return;
    setBusy(story.clientStoryId); setError("");
    try {
      const repository = createCloudStoryRepository(supabase, session.user.id);
      if (action === "open") {
        const local = await localStoryRepository.get(story.clientStoryId);
        const remote = navigator.onLine ? (await repository.list()).find(row => row.clientStoryId === story.clientStoryId) : undefined;
        await openAccountStory((remote || local || story).result, session.user.id, remote?.id);
        return;
      }
      await sync.mutate(async () => {
        const remote = (await repository.list()).find(row => row.clientStoryId === story.clientStoryId);
        if (action === "rename") {
          if (remote) await repository.update(remote.id, { title: title!.trim() });
          else await localStoryRepository.update(story.clientStoryId, { title: title!.trim() });
          return;
        }
        // Share revocation follows the existing deletion boundary.
        await revokeSharesBeforeStoryDeletion({ storyId: story.clientStoryId, accessToken: session.access_token });
        if (remote) await repository.remove(remote.id);
        await localStoryRepository.remove(story.clientStoryId);
      });
    } catch { setError("操作尚未完成，请检查网络后重试。"); }
    finally { setBusy(""); }
  }
  return <main className="unified-account-library">
    <AccountSyncStatus />
    {error ? <p role="alert">{error}</p> : null}
    {!sync.stories.length && !sync.loading ? <p>还没有绘本，记录一个成长时刻开始创作吧。</p> : null}
    <section className="unified-story-grid" aria-label="账号绘本">
      {sync.stories.map(story => <article key={story.clientStoryId}>
        {story.result.pages[0]?.imageUrl ? <img src={story.result.pages[0].imageUrl} alt="" loading="lazy" /> : null}
        <h3>{story.result.coverTitle}</h3><p>{story.result.pages.length} 页</p>
        <div><button disabled={!!busy} onClick={() => void act(story, "open")}>阅读</button><button disabled={!!busy} onClick={() => void act(story, "rename")}>改标题</button><button disabled={!!busy} onClick={() => void act(story, "delete")}>删除</button></div>
      </article>)}
    </section>
  </main>;
}
