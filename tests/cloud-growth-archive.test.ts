import { describe, expect, it, vi } from "vitest";
import {
  buildCloudGrowthArchiveExport,
  deleteCloudGrowthArchive,
  getCloudGrowthRetentionCutoff,
  parseCloudGrowthArchiveDeleteRequest,
  selectCloudGrowthArchiveDeletionTargets,
  summarizeCloudGrowthArchive,
  type CloudGrowthArchiveSnapshot,
} from "@/lib/account/cloud-growth-archive";
import {
  DELETE_ALL_CLOUD_GROWTH_CONFIRMATION,
  DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
} from "@/lib/account/cloud-growth-archive-contract";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const LEGACY_ID = "11111111-1111-4111-8111-111111111111";
const LINKED_LEGACY_ID = "33333333-3333-4333-8333-333333333333";
const MOMENT_ID = "44444444-4444-4444-8444-444444444444";
const STORY_ID = "55555555-5555-4555-8555-555555555555";

function fixture(): CloudGrowthArchiveSnapshot {
  return {
    userId: USER_ID,
    retentionDays: 365,
    children: [
      { id: "child-1", display_name: "安安" },
      { id: "child-2", display_name: "小满" },
    ],
    savedStories: [
      {
        id: STORY_ID,
        client_story_id: "story-1",
        story_snapshot: {
          version: 1,
          storyId: "story-1",
          coverTitle: "积木回家",
          input: {
            childName: "安安",
            ageGroup: "4-5",
            theme: "custom",
            customTheme: "整理积木",
            style: "watercolor",
            language: "zh-en",
            familyCharacters: [
              { id: "private-character", storyReferenceToken: "secret-token" },
            ],
          },
          pages: [
            {
              page: 1,
              zhText: "积木回家了。",
              enText: "The blocks went home.",
              illustrationPrompt:
                "https://example.com/private.webp?token=signed-secret",
              imageStatus: "complete",
              image: {
                storagePath: `${USER_ID}/${STORY_ID}/page-01.webp`,
              },
              imageJobId: "provider-job-id",
            },
          ],
          totalPages: 1,
          generationMode: "live",
          narrationAudio: { url: "https://example.com/audio?token=secret" },
        },
        asset_manifest: {
          pages: [
            {
              storagePath: `${USER_ID}/${STORY_ID}/page-01.webp`,
            },
          ],
        },
      },
    ],
    savedStoryAssets: [
      {
        id: "story-asset-1",
        saved_story_id: STORY_ID,
        storage_path: `${USER_ID}/${STORY_ID}/page-01.webp`,
      },
    ],
    legacyRecords: [
      {
        id: LEGACY_ID,
        child_profile_id: "child-1",
        saved_story_id: STORY_ID,
        client_record_id: "legacy-1",
        occurred_on: "2025-08-15",
        note: "第一次整理积木",
        idea: "积木回家",
        created_at: "2025-08-15T00:00:00.000Z",
        updated_at: "2025-08-15T00:00:00.000Z",
      },
      {
        id: LINKED_LEGACY_ID,
        child_profile_id: "child-2",
        saved_story_id: null,
        client_record_id: "legacy-linked",
        occurred_on: "2026-01-01",
      },
    ],
    legacyPhotos: [
      {
        id: "legacy-photo-1",
        growth_record_id: LEGACY_ID,
        client_photo_id: "photo-1",
        storage_path: `${USER_ID}/${LEGACY_ID}/photo-1.webp`,
        original_name: "现场照片.webp",
        sort_order: 0,
        mime_type: "image/webp",
      },
      {
        id: "legacy-photo-linked",
        growth_record_id: LINKED_LEGACY_ID,
        storage_path: `${USER_ID}/${LINKED_LEGACY_ID}/photo.webp`,
        sort_order: 0,
      },
    ],
    growthMoments: [
      {
        id: MOMENT_ID,
        child_profile_id: "child-2",
        legacy_growth_record_id: LINKED_LEGACY_ID,
        client_moment_id: "moment-1",
        occurred_on: "2026-01-01",
        parent_note: "第一次自己穿鞋",
        source_idea: "自己穿鞋",
        parent_facts: "出门前自己完成。",
        confirmed_tags: ["第一次"],
      },
    ],
    growthMomentAssets: [
      {
        id: "moment-photo-1",
        growth_moment_id: MOMENT_ID,
        client_asset_id: "moment-photo",
        storage_path: `${USER_ID}/${MOMENT_ID}/photo.webp`,
        original_name: "鞋子.webp",
        sort_order: 0,
        mime_type: "image/webp",
      },
    ],
    storybookVersions: [
      {
        id: "version-row-1",
        growth_moment_id: MOMENT_ID,
        client_version_id: "version-1",
        client_story_id: "story-2",
        story_snapshot: {
          storyId: "story-2",
          coverTitle: "会等人的鞋子",
          input: { childName: "小满", ageGroup: "4-5" },
          pages: [],
          totalPages: 0,
          generationMode: "live",
        },
        reading_stage: "4-5",
        illustration_style: "watercolor",
        text_model: "model-a",
        generation_metadata: { providerTaskId: "private-provider-task" },
      },
    ],
    foundationAvailable: true,
  };
}

describe("private cloud growth archive governance", () => {
  it("deduplicates migrated legacy rows and previews retention by calendar year", () => {
    const snapshot = fixture();
    const summary = summarizeCloudGrowthArchive(
      snapshot,
      new Date("2026-08-15T00:30:00+08:00"),
      "Asia/Shanghai",
    );

    expect(getCloudGrowthRetentionCutoff(365, new Date("2026-08-15T00:30:00+08:00"), "Asia/Shanghai")).toBe(
      "2025-08-15",
    );
    expect(summary.counts).toMatchObject({
      children: 2,
      moments: 2,
      legacyGrowthRecords: 1,
      growthMoments: 1,
      photos: 2,
      storybookVersions: 2,
    });
    expect(summary.expired).toMatchObject({ moments: 1, photos: 1, storybookVersions: 1 });
    expect(summary.productionVerified).toBe(false);
  });

  it("builds a scoped manifest with anonymous paths and no private task fields", () => {
    const built = buildCloudGrowthArchiveExport(
      fixture(),
      "2026-08-15T00:00:00.000Z",
    );
    const serialized = JSON.stringify(built.archive);

    expect(built.downloads.map((item) => item.exportPath)).toEqual(
      expect.arrayContaining([
        "assets/moment-0001/photo-01.webp",
        "assets/moment-0001/storybook-01/image-01.webp",
        "assets/moment-0002/photo-01.webp",
      ]),
    );
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain("signed-secret");
    expect(serialized).not.toContain("provider-job-id");
    expect(serialized).not.toContain("private-provider-task");
    expect(serialized).not.toContain("familyCharacters");
    expect(serialized).not.toContain("narrationAudio");
    expect(serialized).toContain("积木回家了");
  });

  it("requires exact confirmations and selects both legacy and new-table targets", () => {
    expect(
      parseCloudGrowthArchiveDeleteRequest({
        scope: "all",
        confirmation: DELETE_ALL_CLOUD_GROWTH_CONFIRMATION,
      }),
    ).toMatchObject({ scope: "all" });
    expect(() =>
      parseCloudGrowthArchiveDeleteRequest({
        scope: "expired",
        confirmation: DELETE_ALL_CLOUD_GROWTH_CONFIRMATION,
      }),
    ).toThrow(/确认文本/);

    const targets = selectCloudGrowthArchiveDeletionTargets(
      fixture(),
      "expired",
      new Date("2026-08-15T00:30:00+08:00"),
      "Asia/Shanghai",
    );
    expect(targets.legacyIds).toEqual([LEGACY_ID]);
    expect(targets.momentIds).toEqual([]);
    expect(targets.storagePaths).toEqual([
      `${USER_ID}/${LEGACY_ID}/photo-1.webp`,
    ]);
    expect(
      parseCloudGrowthArchiveDeleteRequest({
        scope: "expired",
        confirmation: DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
      }),
    ).toMatchObject({ scope: "expired" });
  });

  it("deletes only growth tables and growth-photo storage", async () => {
    const tables: string[] = [];
    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from(table: string) {
        tables.push(table);
        return {
          delete() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      },
      storage: {
        from(bucket: string) {
          expect(bucket).toBe("growth-record-photos");
          return { remove };
        },
      },
    } as any;

    const report = await deleteCloudGrowthArchive(
      supabase,
      fixture(),
      {
        scope: "expired",
        confirmation: DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
      },
      new Date("2026-08-15T00:30:00+08:00"),
      "Asia/Shanghai",
    );

    expect(tables).toEqual(["growth_records"]);
    expect(tables).not.toContain("saved_stories");
    expect(remove).toHaveBeenCalledWith([
      `${USER_ID}/${LEGACY_ID}/photo-1.webp`,
    ]);
    expect(report.status).toBe("complete");
  });

  it("does not remove photo objects when their database rows fail to delete", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from() {
        return {
          delete() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({
                      error: { message: "database unavailable" },
                    });
                  },
                };
              },
            };
          },
        };
      },
      storage: { from: () => ({ remove }) },
    } as any;

    const report = await deleteCloudGrowthArchive(
      supabase,
      fixture(),
      {
        scope: "expired",
        confirmation: DELETE_EXPIRED_CLOUD_GROWTH_CONFIRMATION,
      },
      new Date("2026-08-15T00:30:00+08:00"),
      "Asia/Shanghai",
    );

    expect(remove).not.toHaveBeenCalled();
    expect(report.status).toBe("failed");
    expect(report.deleted.storageObjects).toBe(0);
  });
});
