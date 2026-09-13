import type { SavedStory } from "@/lib/repositories/story-repository";
import type { GrowthRecord } from "@/lib/growth-records";
export type AccountSnapshot = { stories: SavedStory[]; growth: GrowthRecord[] };
export async function accountCache(userId: string, value?: AccountSnapshot): Promise<AccountSnapshot | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("storybloom-account-cache", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("accounts");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("accounts", value ? "readwrite" : "readonly");
      const task = value ? tx.objectStore("accounts").put(value, userId) : tx.objectStore("accounts").get(userId);
      let result: AccountSnapshot | undefined;
      task.onsuccess = () => { result = value || task.result; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
