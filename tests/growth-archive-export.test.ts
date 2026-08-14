import { describe, expect, it } from "vitest";
import {
  buildLocalGrowthArchiveExport,
  createLocalGrowthArchiveZip,
} from "@/lib/growth-archive-export";
import type { GrowthMomentBundle } from "@/lib/growth-moments";

const PHOTO_DATA_URL = `data:image/webp;base64,${Buffer.from("photo-bytes").toString(
  "base64",
)}`;
const PAGE_DATA_URL = `data:image/webp;base64,${Buffer.from("page-bytes").toString(
  "base64",
)}`;

function fixture(): GrowthMomentBundle {
  return {
    moment: {
      schemaVersion: 1,
      momentId: "moment-1",
      clientMomentId: "client-moment-1",
      childKey: "name:安安",
      childName: "安安",
      childAvatarDataUrl: PHOTO_DATA_URL,
      occurredOn: "2026-08-01",
      parentNote: "不要导出 Bearer known-auth-secret",
      sourceIdea: "第一次整理积木",
      parentFacts: "妈妈在旁边陪着。",
      allowedImaginations: "积木可以说晚安。",
      originalAssets: [
        {
          assetId: "photo-1",
          kind: "photo",
          name: "现场照片.webp",
          dataUrl: PHOTO_DATA_URL,
          mimeType: "image/webp",
          byteSize: 11,
          checksumSha256: "a".repeat(64),
        },
      ],
      confirmedTags: ["第一次"],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    storybookVersions: [
      {
        schemaVersion: 1,
        versionId: "version-1",
        momentId: "moment-1",
        storyId: "story-1",
        result: {
          storyId: "story-1",
          input: {
            childName: "安安",
            ageGroup: "4-5",
            theme: "custom",
            customTheme: "第一次整理积木",
            style: "watercolor",
            language: "zh-en",
            customCharacterReferenceToken: "temporary-character-token",
            characterReferenceId: "private-character-id",
            familyCharacters: [
              {
                id: "family-character-1",
                name: "安安",
                relation: "孩子",
                appearance: "黄色上衣",
                storyReferenceToken: "temporary-story-token",
              },
            ],
          },
          coverTitle: "安安和回家的积木",
          pages: [
            {
              page: 1,
              zhText: "积木回家了。",
              enText: "The blocks went home.",
              illustrationPrompt:
                "https://example.com/private.webp?token=known-signed-token",
              imageUrl: PAGE_DATA_URL,
              imageStatus: "complete",
              imageJobId: "provider-job-id",
              imageAttempts: [
                {
                  provider: "cpa",
                  status: "success",
                  durationMs: 10,
                  startedAt: "2026-08-01T00:00:00.000Z",
                  completedAt: "2026-08-01T00:00:00.010Z",
                },
              ],
            },
          ],
          totalPages: 1,
          generationMode: "live",
          freeChanceLabel: "free",
          narrationAudio: {
            url: "https://example.com/audio?token=temporary",
            model: "provider-task-secret",
            voice: "voice",
            format: "mp3",
          },
        },
        readingStage: "4-5",
        style: "watercolor",
        storyTreatment: "documentary",
        characterReferenceId: "private-character-id",
        promptVersion: "growth-v1",
        textModel: "model-a",
        imageProviders: ["cpa"],
        source: "generated",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    activeStorybookVersionId: "version-1",
  };
}

const retention = {
  version: 1 as const,
  policy: "keep-forever" as const,
  updatedAt: "2026-08-15T00:00:00.000Z",
};

describe("local growth archive export", () => {
  it("creates a portable manifest with separate image entries", async () => {
    const built = await buildLocalGrowthArchiveExport(
      [fixture()],
      retention,
      "2026-08-15T00:00:00.000Z",
    );
    const archiveEntry = built.entries.find((entry) => entry.name === "archive.json");
    const serialized = String(archiveEntry?.data || "");

    expect(built.archive.summary).toEqual({
      children: 1,
      moments: 1,
      originalPhotos: 1,
      storybookVersions: 1,
      storybookImages: 1,
    });
    expect(built.entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        "README.txt",
        "archive.json",
        "assets/moment-0001/child-avatar.webp",
        "assets/moment-0001/photo-01.webp",
        "assets/moment-0001/storybook-01/page-01.webp",
      ]),
    );
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain("known-auth-secret");
    expect(serialized).not.toContain("known-signed-token");
    expect(serialized).not.toContain("provider-job-id");
    expect(serialized).not.toContain("provider-task-secret");
    expect(serialized).not.toContain("temporary-character-token");
    expect(serialized).not.toContain("temporary-story-token");
    expect(serialized).not.toContain("familyCharacters");
    expect(serialized).not.toContain("characterReferenceId");
    expect(serialized).not.toContain("narrationAudio");
    expect(serialized).toContain("assets/moment-0001/photo-01.webp");
    expect(serialized).toContain("model-a");
  });

  it("packages the archive as a browser-downloadable ZIP", async () => {
    const exported = await createLocalGrowthArchiveZip(
      [fixture()],
      retention,
      "2026-08-15T00:00:00.000Z",
    );
    const signature = new Uint8Array(await exported.blob.slice(0, 4).arrayBuffer());

    expect(Array.from(signature)).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(exported.filename).toBe("storybloom-growth-archive-2026-08-15.zip");
    expect(exported.blob.type).toBe("application/zip");
  });
});
