import {
  addLocalStorybookVersion,
  clearLocalMomentAssets,
  deleteGrowthRecord,
  deleteLocalGrowthMoment,
  getGrowthMomentBundle,
  listGrowthMomentBundles,
  listGrowthRecords,
  patchGrowthRecord,
  removeLocalStorybookVersion,
  selectLocalStorybookVersion,
  upsertGrowthRecord,
} from "@/lib/growth-records";
import type { GrowthRepository } from "@/lib/repositories/growth-repository";

export const localGrowthRepository: GrowthRepository = {
  list: listGrowthRecords,

  async getByChild(childId) {
    return (await listGrowthRecords()).filter(
      (record) => record.childKey === childId,
    );
  },

  async save(input) {
    if (input.clientRecordId !== input.story.storyId) {
      throw new Error("local-growth-client-id-mismatch");
    }
    return upsertGrowthRecord(input.story, input.draft);
  },

  async update(id, patch) {
    return patchGrowthRecord(id, {
      occurredOn: patch.occurredOn,
      note: patch.note,
      idea: patch.idea,
      story: patch.story,
      photos: patch.photos,
    });
  },

  async remove(id) {
    const deleted = await deleteGrowthRecord(id);
    if (!deleted) throw new Error("local-growth-delete-failed");
  },

  moments: {
    list: listGrowthMomentBundles,
    get: getGrowthMomentBundle,
    addVersion: addLocalStorybookVersion,
    selectVersion: selectLocalStorybookVersion,
    removeVersion: removeLocalStorybookVersion,
    clearOriginalAssets: clearLocalMomentAssets,
    async removeMoment(momentId) {
      const deleted = await deleteLocalGrowthMoment(momentId);
      if (!deleted) throw new Error("local-growth-delete-failed");
    },
  },
};
