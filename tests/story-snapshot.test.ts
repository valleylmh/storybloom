import { describe, expect, it } from "vitest";
import {
  fromPersistedStorySnapshot,
  isPersistedStoragePath,
  toPersistedStorySnapshot,
} from "@/lib/persistence/story-snapshot";
import type { GenerateResponse } from "@/types";

function createResult(): GenerateResponse {
  return {
    storyId: "client-story-1",
    input: {
      childName: "安安",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "第一次自己收好积木",
      parentFacts: "安安第一次独立收好积木，妈妈在旁边陪着。",
      allowedImaginations: "积木可以轻轻说晚安。",
      storyTreatment: "warm-imagination",
      otherDetails:
        "不要保存 Bearer known-auth-secret 或 data:image/png;base64,known-photo",
      style: "fairytale",
      language: "zh-en",
      customCharacterReferenceToken: "temporary-character-token",
      sourceLibraryBookId: "xiyouji/shi-hou-chu-shi",
      personalizationDraftId: "123e4567-e89b-42d3-a456-426614174000",
      personalizationAnchor: {
        version: 1,
        displayName: "安安",
        relationship: "孩子",
        appearance: "短发，黄色上衣",
        referenceType: "text",
        confirmedAt: "2026-08-16T05:00:00.000Z",
      },
      familyCharacters: [
        {
          id: "character-1",
          name: "安安",
          relation: "孩子",
          appearance: "短发，黄色上衣",
          sourceReferenceAssetPath: "user/family/source.webp",
          canonicalReferenceAssetPath: "user/family/canonical.webp",
          storyReferenceToken: "temporary-story-token",
          isProtagonist: true,
        },
      ],
    },
    coverTitle: "《安安和回家的积木》",
    pages: [
      {
        page: 1,
        zhText: "积木散落在地上。",
        enText: "Blocks were scattered on the floor.",
        illustrationPrompt:
          "A child tidies wooden blocks. https://example.com/file?token=known-signed-token",
        imageUrl: "data:image/webp;base64,private-photo-content",
        imageStatus: "complete",
        imageProvider: "cpa",
        imageDurationMs: 1200,
        imageAttempts: [
          {
            provider: "cpa",
            status: "success",
            durationMs: 1200,
            startedAt: "2026-08-09T00:00:00.000Z",
            completedAt: "2026-08-09T00:00:01.200Z",
          },
        ],
      },
      {
        page: 2,
        zhText: "积木回到了盒子里。",
        enText: "The blocks went back into the box.",
        illustrationPrompt: "The same child smiles beside a toy box.",
        imageUrl: "user-1/story-1/page-02.webp",
        imageStatus: "complete",
      },
      {
        page: 3,
        zhText: "晚安。",
        enText: "Good night.",
        illustrationPrompt: "A calm room.",
        imageUrl:
          "https://example.supabase.co/storage/v1/object/sign/story?token=temporary",
        imageStatus: "complete",
      },
    ],
    totalPages: 3,
    generationMode: "live",
    freeChanceLabel: "免费生成",
    narrationAudio: {
      url: "https://example.supabase.co/audio?token=temporary-audio",
      model: "temporary-provider-job-id",
      voice: "voice",
      format: "mp3",
    },
    ...({
      providerTaskId: "provider-task-secret",
      accessToken: "Bearer secret-token",
      debug: { rawPhoto: "data:image/png;base64,raw" },
    } as Record<string, unknown>),
  };
}

describe("persisted story snapshots", () => {
  it("uses a whitelist and keeps only private storage paths for images", () => {
    const snapshot = toPersistedStorySnapshot(createResult());
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.version).toBe(1);
    expect(snapshot.pages[0].image).toBeUndefined();
    expect(snapshot.pages[0].imageStatus).toBe("pending");
    expect(snapshot.pages[1].image?.storagePath).toBe(
      "user-1/story-1/page-02.webp",
    );
    expect(snapshot.pages[2].image).toBeUndefined();
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain("token=temporary");
    expect(serialized).not.toContain("provider-task-secret");
    expect(serialized).not.toContain("Bearer secret-token");
    expect(serialized).not.toContain("temporary-character-token");
    expect(serialized).not.toContain("temporary-story-token");
    expect(serialized).not.toContain("known-auth-secret");
    expect(serialized).not.toContain("known-photo");
    expect(serialized).not.toContain("known-signed-token");
    expect(serialized).not.toContain("sourceReferenceAssetPath");
    expect(serialized).not.toContain("imageAttempts");
    expect(snapshot.input.parentFacts).toContain("第一次独立收好积木");
    expect(snapshot.input.allowedImaginations).toContain("轻轻说晚安");
    expect(snapshot.input.storyTreatment).toBe("warm-imagination");
    expect(snapshot.input.sourceLibraryBookId).toBe(
      "xiyouji/shi-hou-chu-shi",
    );
    expect(snapshot.input.personalizationAnchor?.appearance).toBe(
      "短发，黄色上衣",
    );
  });

  it("reconstructs a GenerateResponse without reviving temporary URLs", () => {
    const snapshot = toPersistedStorySnapshot(createResult());
    Object.assign(snapshot.input, {
      accessToken: "Bearer legacy-secret",
      customCharacterReferenceToken: "legacy-temporary-token",
    });
    Object.assign(snapshot.pages[1], {
      providerTaskId: "legacy-provider-task",
    });
    const restored = fromPersistedStorySnapshot(snapshot);

    expect(restored.pages[0].imageUrl).toBeUndefined();
    expect(restored.pages[1].imageUrl).toBe(
      "user-1/story-1/page-02.webp",
    );
    expect(restored.pages[2].imageUrl).toBeUndefined();
    expect(restored.narrationAudio).toBeUndefined();
    expect(restored.input.customCharacterReferenceToken).toBeUndefined();
    expect(restored.input.parentFacts).toContain("第一次独立收好积木");
    expect(restored.input.allowedImaginations).toContain("轻轻说晚安");
    expect(restored.input.storyTreatment).toBe("warm-imagination");
    expect(restored.input.sourceLibraryBookId).toBe(
      "xiyouji/shi-hou-chu-shi",
    );
    expect(restored.input.personalizationDraftId).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
    expect("accessToken" in restored.input).toBe(false);
    expect("providerTaskId" in restored.pages[1]).toBe(false);
    expect(restored.input.familyCharacters?.[0]).toEqual({
      id: "character-1",
      name: "安安",
      relation: "孩子",
      appearance: "短发，黄色上衣",
      isProtagonist: true,
    });
  });

  it("rejects URLs, Data URLs, traversal, and incomplete paths", () => {
    expect(isPersistedStoragePath("user/story/page.webp")).toBe(true);
    expect(isPersistedStoragePath("data:image/webp;base64,x")).toBe(false);
    expect(isPersistedStoragePath("https://example.com/image.webp")).toBe(false);
    expect(isPersistedStoragePath("user/../image.webp")).toBe(false);
    expect(isPersistedStoragePath("user/image.webp")).toBe(false);
  });
});
