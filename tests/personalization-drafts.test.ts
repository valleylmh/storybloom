import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { localStorage: new MemoryStorage() });
});

describe("local personalization drafts", () => {
  it("keeps anonymous source, character and Anchor state recoverable", async () => {
    const drafts = await import("@/lib/personalization-drafts");
    const draft = drafts.createPersonalizationDraft({
      sourceLibraryBookId: "xiyouji/shi-hou-chu-shi",
      sourceTitle: "石猴出世",
      prompt: "让孩子成为石猴出世的主角",
      ageGroup: "4-5",
    });
    expect(draft.anonymousId).toMatch(/^[0-9a-f-]{36}$/i);

    const anchor = {
      version: 1 as const,
      displayName: "童童",
      relationship: "孩子",
      appearance: "齐耳短发、圆框眼镜、黄色外套",
      referenceType: "text" as const,
      storyReferenceToken:
        "abcdefghijklmnopqrstuvwxyzABCDEF1234567890_-storyanchor",
      confirmedAt: "2026-08-16T05:00:00.000Z",
    };
    drafts.updatePersonalizationDraft(draft.id, {
      selectedCharacterIds: [],
      anchorStatus: "confirmed",
      anchor,
      generationJobId: "task-123",
    });

    const recovered = drafts.getLatestPersonalizationDraft(
      "xiyouji/shi-hou-chu-shi",
    );
    expect(recovered).toMatchObject({
      id: draft.id,
      anchorStatus: "confirmed",
      anchor: expect.objectContaining({ displayName: "童童" }),
      generationJobId: "task-123",
    });
    expect(recovered?.anchor).not.toHaveProperty("storyReferenceToken");
  });
});
