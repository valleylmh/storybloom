import { describe, expect, it } from "vitest";
import {
  getStoryVisibility,
  mergeStoryCopies,
} from "@/components/account/device-cloud-story-library-model";
import type { SavedStory } from "@/lib/repositories/story-repository";

function createStory(
  clientStoryId: string,
  updatedAt: string,
  id = clientStoryId,
): SavedStory {
  return {
    id,
    storyId: clientStoryId,
    clientStoryId,
    result: {
      storyId: clientStoryId,
      input: {
        childName: "小雨",
        ageGroup: "4-5",
        theme: "custom",
        customTheme: "一次散步",
        style: "fairytale",
        language: "zh-en",
      },
      coverTitle: `绘本 ${clientStoryId}`,
      pages: [],
      totalPages: 0,
      generationMode: "live",
      freeChanceLabel: "",
    },
    assetManifest: { version: 1, pages: [] },
    status: "complete",
    imageProgress: { complete: 0, total: 0 },
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("device and cloud story visibility", () => {
  it("aligns copies with the same client story id", () => {
    const local = createStory("story-shared", "2026-08-08T10:00:00.000Z");
    const cloud = createStory(
      "story-shared",
      "2026-08-09T10:00:00.000Z",
      "cloud-row-id",
    );

    const rows = mergeStoryCopies([local], [cloud]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientStoryId: "story-shared",
      local,
      cloud,
    });
    expect(getStoryVisibility(rows[0])).toBe("both");
  });

  it("keeps source-only books visible and sorts by the newest copy", () => {
    const local = createStory("story-local", "2026-08-08T10:00:00.000Z");
    const cloud = createStory(
      "story-cloud",
      "2026-08-09T10:00:00.000Z",
      "cloud-row-id",
    );

    const rows = mergeStoryCopies([local], [cloud]);

    expect(rows.map((row) => row.clientStoryId)).toEqual([
      "story-cloud",
      "story-local",
    ]);
    expect(getStoryVisibility(rows[0])).toBe("cloud-only");
    expect(getStoryVisibility(rows[1])).toBe("local-only");
  });

  it("collapses duplicate source rows to the latest version", () => {
    const older = createStory(
      "story-duplicate",
      "2026-08-08T10:00:00.000Z",
      "older",
    );
    const newer = createStory(
      "story-duplicate",
      "2026-08-09T10:00:00.000Z",
      "newer",
    );

    const [row] = mergeStoryCopies([older, newer], []);

    expect(row.local?.id).toBe("newer");
    expect(getStoryVisibility(row)).toBe("local-only");
  });
});
