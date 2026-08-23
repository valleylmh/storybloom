import { describe, expect, it } from "vitest";
import {
  getGrowthTimelineHref,
  selectGrowthTimelineBundles,
} from "@/lib/growth-timeline-route";
import type { GrowthMomentBundle } from "@/lib/growth-moments";

function bundle(
  momentId: string,
  childKey: string,
): GrowthMomentBundle {
  return {
    moment: {
      schemaVersion: 1,
      momentId,
      clientMomentId: momentId,
      childKey,
      childName: "安安",
      occurredOn: "2026-08-23",
      parentNote: "第一次自己收好积木。",
      sourceIdea: "安安收好积木",
      originalAssets: [],
      confirmedTags: [],
      createdAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
    },
    storybookVersions: [],
  };
}

describe("growth timeline result links", () => {
  it("keeps the child grouping path and adds an opaque exact Moment target", () => {
    expect(
      getGrowthTimelineHref({
        childKey: "name:安安",
        momentId: "moment_story-1",
      }),
    ).toBe(
      `/growth/${encodeURIComponent("name:安安")}?moment=moment_story-1`,
    );
  });

  it("opens the saved Moment's full child timeline even if a name-based key no longer matches", () => {
    const saved = bundle("moment_story-1", "name:安安");
    const earlier = bundle("moment_story-0", "name:安安");
    const other = bundle("moment_story-2", "name:小满");

    expect(
      selectGrowthTimelineBundles([saved, earlier, other], {
        childKey: "name:安安（旧名称）",
        momentId: "moment_story-1",
      }),
    ).toEqual([saved, earlier]);
  });

  it("falls back to the child timeline when an old exact target is unavailable", () => {
    const saved = bundle("moment_story-1", "name:安安");
    const other = bundle("moment_story-2", "name:小满");

    expect(
      selectGrowthTimelineBundles([saved, other], {
        childKey: "name:安安",
        momentId: "missing-moment",
      }),
    ).toEqual([saved]);
  });
});
