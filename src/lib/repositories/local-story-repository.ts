import {
  deleteHistory,
  listHistory,
  upsertHistory,
  type StoryHistoryRecord,
} from "@/lib/client-history";
import type {
  SavedStory,
  StoryRepository,
  StorySaveInput,
} from "@/lib/repositories/story-repository";

function fromHistory(record: StoryHistoryRecord): SavedStory {
  return {
    ...record,
    id: record.storyId,
    clientStoryId: record.storyId,
    assetManifest: { version: 1, pages: [] },
  };
}

async function save(input: StorySaveInput) {
  const records = await upsertHistory(input.result);
  const saved = records.find(
    (record) => record.storyId === input.result.storyId,
  );
  if (!saved) throw new Error("local-story-save-failed");
  return fromHistory(saved);
}

export const localStoryRepository: StoryRepository = {
  async list() {
    return (await listHistory()).map(fromHistory);
  },

  async get(id) {
    const record = (await listHistory()).find((item) => item.storyId === id);
    return record ? fromHistory(record) : undefined;
  },

  save,

  async update(id, patch) {
    const existing = await this.get(id);
    if (!existing) throw new Error("local-story-not-found");
    if (!patch.result) {
      return existing;
    }
    if (patch.result.storyId !== id) {
      throw new Error("local-story-id-mismatch");
    }
    return save({ result: patch.result });
  },

  async remove(id) {
    await deleteHistory(id);
  },
};
