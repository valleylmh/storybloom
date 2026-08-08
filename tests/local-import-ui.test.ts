import { describe, expect, it } from "vitest";
import {
  countLocalImportSelection,
  countSelectedImportPhotos,
  createEmptyLocalImportSelection,
  getLocalImportCounts,
  getLocalImportDismissKey,
  getLocalOnlyCandidates,
  hasLocalImportWork,
  toggleLocalImportSelection,
  type LocalImportSnapshot,
} from "@/components/account/local-import-controller";

const snapshot: LocalImportSnapshot = {
  stories: [
    {
      localId: "story-local",
      entityType: "story",
      title: "本地绘本",
    },
    {
      localId: "story-synced",
      entityType: "story",
      title: "已同步绘本",
      syncStatus: "synced",
    },
  ],
  growthRecords: [
    {
      localId: "growth-local",
      entityType: "growth-record",
      title: "第一次骑车",
      photoCount: 3,
    },
    {
      localId: "growth-pending",
      entityType: "growth-record",
      title: "等待恢复",
      photoCount: 2,
      syncStatus: "pending",
    },
  ],
  photoCount: 5,
};

describe("local import UI contract", () => {
  it("previews only local-only candidates while preserving resumable work", () => {
    expect(getLocalImportCounts(snapshot)).toEqual({
      stories: 1,
      growthRecords: 1,
      photos: 3,
      pending: 1,
      failed: 0,
    });
    expect(getLocalOnlyCandidates(snapshot)).toEqual({
      stories: [snapshot.stories[0]],
      growthRecords: [snapshot.growthRecords[0]],
    });
    expect(hasLocalImportWork(snapshot)).toBe(true);
  });

  it("starts with every item unselected and toggles one item at a time", () => {
    const empty = createEmptyLocalImportSelection();
    expect(empty).toEqual({ storyIds: [], growthRecordIds: [] });
    expect(countLocalImportSelection(empty)).toBe(0);

    const storySelected = toggleLocalImportSelection(
      empty,
      "story",
      "story-local",
    );
    expect(storySelected).toEqual({
      storyIds: ["story-local"],
      growthRecordIds: [],
    });

    const bothSelected = toggleLocalImportSelection(
      storySelected,
      "growth-record",
      "growth-local",
    );
    expect(countLocalImportSelection(bothSelected)).toBe(2);
    expect(countSelectedImportPhotos(snapshot, bothSelected)).toBe(3);
    expect(
      toggleLocalImportSelection(bothSelected, "story", "story-local"),
    ).toEqual({ storyIds: [], growthRecordIds: ["growth-local"] });
  });

  it("keeps the first-login dismissal separate for each account", () => {
    expect(getLocalImportDismissKey("user-a")).not.toBe(
      getLocalImportDismissKey("user-b"),
    );
  });
});
