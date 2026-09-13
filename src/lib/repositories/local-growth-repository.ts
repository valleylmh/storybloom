import { canSaveRecord, signalAccountChange } from "@/lib/sync/account-ownership";
import {
  addLocalStorybookVersion,
  clearLocalGrowthArchive,
  clearLocalMomentAssets,
  deleteGrowthRecord,
  deleteLocalGrowthMoment,
  deleteLocalGrowthMoments,
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
    if (!canSaveRecord("growth", input.clientRecordId)) throw new Error("record-owned-by-another-account");
    const saved = await upsertGrowthRecord(input.story, input.draft);
    signalAccountChange();
    return saved;
  },

  async update(id, patch) {
    const updated = await patchGrowthRecord(id, {
      occurredOn: patch.occurredOn,
      note: patch.note,
      idea: patch.idea,
      story: patch.story,
      photos: patch.photos,
    });
    signalAccountChange();
    return updated;
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
    removeMoments: deleteLocalGrowthMoments,
    clearAll: clearLocalGrowthArchive,
  },
};
