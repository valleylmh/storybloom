import { describe, expect, it } from "vitest";
import {
  createGrowthRecord,
  getGrowthRecordCover,
  groupGrowthRecordsByChild,
  isGrowthRecordDraft,
  isValidGrowthDate,
  type GrowthRecordDraft,
} from "@/lib/growth-records";
import type { GenerateResponse } from "@/types";

function createStory(storyId: string, childName: string): GenerateResponse {
  return {
    storyId,
    input: {
      childName,
      ageGroup: "4-5",
      theme: "custom",
      customTheme: `${childName}第一次自己收好积木`,
      style: "fairytale",
      language: "zh-en",
    },
    coverTitle: `《${childName}和回家的积木》`,
    pages: [
      {
        page: 1,
        zhText: "积木散落在地上。",
        enText: "Blocks were scattered on the floor.",
        illustrationPrompt: "A child tidies wooden blocks.",
        imageUrl: "data:image/webp;base64,scene",
        imageStatus: "complete",
      },
    ],
    totalPages: 1,
    generationMode: "live",
    freeChanceLabel: "免费生成",
  };
}

function createDraft(childKey: string, childName: string): GrowthRecordDraft {
  return {
    version: 1,
    childKey,
    childName,
    occurredOn: "2026-08-05",
    note: "他收好以后特别骄傲。",
    idea: `${childName}第一次自己收好积木`,
    photos: [
      {
        id: "photo-1",
        name: "blocks.webp",
        dataUrl: "data:image/webp;base64,photo",
      },
    ],
  };
}

describe("growth records", () => {
  it("creates a child-scoped record without changing the story", () => {
    const story = createStory("story-1", "安安");
    const draft = createDraft("child-1", "安安");
    const record = createGrowthRecord(
      story,
      draft,
      undefined,
      "2026-08-05T10:00:00.000Z",
    );

    expect(record.id).toBe("story-1");
    expect(record.childKey).toBe("child-1");
    expect(record.story).toBe(story);
    expect(record.photos).toHaveLength(1);
    expect(getGrowthRecordCover(record)).toBe("data:image/webp;base64,photo");
  });

  it("preserves the original creation time when a story is updated", () => {
    const draft = createDraft("child-1", "安安");
    const original = createGrowthRecord(
      createStory("story-1", "安安"),
      draft,
      undefined,
      "2026-08-05T10:00:00.000Z",
    );
    const updatedStory = createStory("story-1", "安安");
    updatedStory.pages[0].zhText = "积木已经回到盒子里。";
    const updated = createGrowthRecord(
      updatedStory,
      draft,
      original,
      "2026-08-05T10:05:00.000Z",
    );

    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBe("2026-08-05T10:05:00.000Z");
    expect(updated.story.pages[0].zhText).toContain("回到盒子里");
  });

  it("groups records by child and keeps the newest date", () => {
    const first = createGrowthRecord(
      createStory("story-1", "安安"),
      createDraft("child-1", "安安"),
      undefined,
      "2026-08-05T10:00:00.000Z",
    );
    const olderDraft = { ...createDraft("child-1", "安安"), occurredOn: "2026-07-01" };
    const older = createGrowthRecord(
      createStory("story-2", "安安"),
      olderDraft,
      undefined,
      "2026-07-01T10:00:00.000Z",
    );
    const other = createGrowthRecord(
      createStory("story-3", "小满"),
      createDraft("child-2", "小满"),
      undefined,
      "2026-08-04T10:00:00.000Z",
    );

    const children = groupGrowthRecordsByChild([older, other, first]);
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({
      childKey: "child-1",
      recordCount: 2,
      latestOccurredOn: "2026-08-05",
    });
  });

  it("rejects objects that are not explicit growth record drafts", () => {
    expect(isGrowthRecordDraft(createDraft("child-1", "安安"))).toBe(true);
    expect(isGrowthRecordDraft({ childKey: "child-1" })).toBe(false);
    expect(
      isGrowthRecordDraft({
        ...createDraft("child-1", "安安"),
        occurredOn: "",
      }),
    ).toBe(false);
    expect(
      isGrowthRecordDraft({
        ...createDraft("child-1", "安安"),
        photos: Array.from({ length: 5 }, (_, index) => ({
          id: `photo-${index}`,
          name: `${index}.webp`,
          dataUrl: "data:image/webp;base64,photo",
        })),
      }),
    ).toBe(false);
  });

  it("accepts only real ISO calendar dates", () => {
    expect(isValidGrowthDate("2026-08-05")).toBe(true);
    expect(isValidGrowthDate("2026-02-29")).toBe(false);
    expect(isValidGrowthDate("2026-8-5")).toBe(false);
  });
});
