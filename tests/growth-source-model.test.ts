import { describe, expect, it } from "vitest";
import type { GrowthRecord } from "@/lib/growth-records";
import {
  buildGrowthChildHref,
  chooseInitialGrowthSource,
  getPairedGrowthRecordIds,
  mergeGrowthCopies,
} from "@/components/growth/growth-source-model";

function createRecord({
  id,
  clientRecordId,
  childKey,
  updatedAt,
}: {
  id: string;
  clientRecordId?: string;
  childKey: string;
  updatedAt: string;
}): GrowthRecord {
  return {
    id,
    clientRecordId,
    storyId: clientRecordId || id,
    childKey,
    childName: "小雨",
    occurredOn: "2026-08-09",
    note: "第一次独立骑车",
    idea: "骑车的一天",
    photos: [],
    story: {
      storyId: clientRecordId || id,
      input: {
        childName: "小雨",
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "骑车的一天",
        style: "fairytale",
        language: "zh-en",
      },
      coverTitle: "小雨学骑车",
      pages: [],
      totalPages: 0,
      generationMode: "live",
      freeChanceLabel: "",
    },
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("growth record source model", () => {
  it("pairs local and cloud copies by client_record_id", () => {
    const local = createRecord({
      id: "local-record",
      clientRecordId: "shared-record",
      childKey: "local-child",
      updatedAt: "2026-08-08T10:00:00.000Z",
    });
    const cloud = createRecord({
      id: "cloud-row-id",
      clientRecordId: "shared-record",
      childKey: "cloud-child-profile",
      updatedAt: "2026-08-09T10:00:00.000Z",
    });

    const rows = mergeGrowthCopies([local], [cloud]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientRecordId: "shared-record",
      local,
      cloud,
    });
    expect(getPairedGrowthRecordIds(rows)).toEqual(new Set(["shared-record"]));
  });

  it("automatically prefers cloud on another device with no local records", () => {
    expect(
      chooseInitialGrowthSource({
        localCount: 0,
        cloudCount: 3,
        signedIn: true,
      }),
    ).toBe("cloud");
    expect(
      chooseInitialGrowthSource({
        requested: "local",
        localCount: 0,
        cloudCount: 3,
        signedIn: true,
      }),
    ).toBe("local");
    expect(
      chooseInitialGrowthSource({
        requested: "cloud",
        localCount: 2,
        cloudCount: 3,
        signedIn: false,
      }),
    ).toBe("cloud");
  });

  it("keeps cloud child routes explicitly scoped to the cloud source", () => {
    expect(
      buildGrowthChildHref("/me/growth", "profile/id", "cloud"),
    ).toBe("/me/growth/profile%2Fid?source=cloud");
    expect(buildGrowthChildHref("/me/growth", "local-child", "local")).toBe(
      "/me/growth/local-child",
    );
  });
});
