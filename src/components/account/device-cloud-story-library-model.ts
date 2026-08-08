import type { SavedStory } from "@/lib/repositories/story-repository";

export type StoryVisibility = "local-only" | "cloud-only" | "both";

export interface StoryVisibilityRow {
  clientStoryId: string;
  local?: SavedStory;
  cloud?: SavedStory;
}

function timestamp(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function preferLatest(a: SavedStory, b: SavedStory) {
  return timestamp(b.updatedAt) > timestamp(a.updatedAt) ? b : a;
}

/**
 * Aligns the two copies by the stable client id. A duplicate returned by one
 * source is collapsed to its newest row so the UI never offers two actions for
 * one logical book.
 */
export function mergeStoryCopies(
  localStories: SavedStory[],
  cloudStories: SavedStory[],
): StoryVisibilityRow[] {
  const rows = new Map<string, StoryVisibilityRow>();

  for (const story of localStories) {
    const clientStoryId = story.clientStoryId || story.storyId;
    const current = rows.get(clientStoryId);
    rows.set(clientStoryId, {
      clientStoryId,
      local: current?.local ? preferLatest(current.local, story) : story,
      cloud: current?.cloud,
    });
  }

  for (const story of cloudStories) {
    const clientStoryId = story.clientStoryId || story.storyId;
    const current = rows.get(clientStoryId);
    rows.set(clientStoryId, {
      clientStoryId,
      local: current?.local,
      cloud: current?.cloud ? preferLatest(current.cloud, story) : story,
    });
  }

  return Array.from(rows.values()).sort((a, b) => {
    const aTime = Math.max(
      timestamp(a.local?.updatedAt),
      timestamp(a.cloud?.updatedAt),
    );
    const bTime = Math.max(
      timestamp(b.local?.updatedAt),
      timestamp(b.cloud?.updatedAt),
    );
    return bTime - aTime || a.clientStoryId.localeCompare(b.clientStoryId);
  });
}

export function getStoryVisibility(row: StoryVisibilityRow): StoryVisibility {
  if (row.local && row.cloud) return "both";
  return row.local ? "local-only" : "cloud-only";
}
