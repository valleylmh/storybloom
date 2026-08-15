import { describe, expect, it, vi } from "vitest";
import {
  buildCloudGrowthMomentMirrorRows,
  isGrowthMomentFoundationMissing,
  mirrorLegacyGrowthRecordToMoment,
  type CloudGrowthMomentMirrorInput,
} from "@/lib/repositories/cloud-growth-moment-mirror";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "22222222-2222-4222-8222-222222222222";
const STORY_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ROW_ID = "44444444-4444-4444-8444-444444444444";
const PHOTO_ROW_ID = "55555555-5555-4555-8555-555555555555";

function fixture(): CloudGrowthMomentMirrorInput {
  return {
    record: {
      id: RECORD_ID,
      child_profile_id: "66666666-6666-4666-8666-666666666666",
      saved_story_id: STORY_ID,
      client_record_id: "growth-local-1",
      occurred_on: "2026-08-15",
      note: "第一次自己整理积木。",
      idea: "积木回家",
      created_at: "2026-08-15T01:00:00.000Z",
      updated_at: "2026-08-15T02:00:00.000Z",
    },
    photos: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        client_photo_id: "local-photo-1",
        storage_path: `${USER_ID}/${RECORD_ID}/photo.webp`,
        original_name: "现场照片.webp",
        sort_order: 0,
        mime_type: "image/webp",
        byte_size: 1024,
        checksum_sha256: "a".repeat(64),
      },
    ],
    savedStory: {
      id: STORY_ID,
      story_snapshot: {
        version: 1,
        storyId: "story-local-1",
        input: {
          childName: "安安",
          ageGroup: "4-5",
          theme: "custom",
          customTheme: "整理积木",
          parentFacts: "确实由安安独立完成。",
          allowedImaginations: "积木可以轻声说晚安。",
          storyTreatment: "warm-imagination",
          style: "watercolor",
          language: "zh-en",
        },
        coverTitle: "积木回家",
        pages: [
          {
            page: 1,
            zhText: "积木回家了。",
            enText: "The blocks went home.",
            illustrationPrompt:
              "A warm room. https://example.com/private-reference.webp",
            imageStatus: "complete",
            image: {
              storagePath: `${USER_ID}/${STORY_ID}/page-01.webp`,
              mimeType: "image/webp",
            },
          },
        ],
        totalPages: 1,
        generationMode: "live",
      },
      asset_manifest: {
        version: 1,
        pages: [
          {
            page: 1,
            storagePath: `${USER_ID}/${STORY_ID}/page-01.webp`,
            mimeType: "image/webp",
          },
        ],
      },
      created_at: "2026-08-15T01:10:00.000Z",
      updated_at: "2026-08-15T01:20:00.000Z",
    },
    draft: {
      version: 1,
      childKey: "child-local-1",
      childName: "安安",
      occurredOn: "2026-08-15",
      note: "第一次自己整理积木。",
      idea: "积木回家",
      photos: [
        {
          id: "local-photo-1",
          name: "现场照片.webp",
          dataUrl: "data:image/webp;base64,private-photo",
        },
      ],
      readingStage: "4-5",
      storyTreatment: "warm-imagination",
      parentFacts: "确实由安安独立完成。",
      allowedImaginations: "积木可以轻声说晚安。",
    },
    clientVersionId: "storybook-version-local-1",
    imageProviders: ["dashscope", "dashscope", "cpa"],
  };
}

describe("cloud GrowthMoment explicit-import mirror", () => {
  it("builds user-scoped Moment, asset, and version rows without browser media", () => {
    const rows = buildCloudGrowthMomentMirrorRows(USER_ID, fixture(), {
      versionRowId: VERSION_ROW_ID,
      assetRowIds: new Map([["local-photo-1", PHOTO_ROW_ID]]),
    });

    expect(rows.moment).toMatchObject({
      id: RECORD_ID,
      user_id: USER_ID,
      legacy_growth_record_id: RECORD_ID,
      client_moment_id: "growth-local-1",
      parent_facts: "确实由安安独立完成。",
      allowed_imaginations: "积木可以轻声说晚安。",
    });
    expect(rows.version).toMatchObject({
      id: VERSION_ROW_ID,
      growth_moment_id: RECORD_ID,
      saved_story_id: STORY_ID,
      client_version_id: "storybook-version-local-1",
      client_story_id: "story-local-1",
      reading_stage: "4-5",
      illustration_style: "watercolor",
      story_treatment: "warm-imagination",
      image_providers: ["dashscope", "cpa"],
      source: "legacy-growth-record",
    });
    expect(rows.assets).toEqual([
      expect.objectContaining({
        id: PHOTO_ROW_ID,
        growth_moment_id: RECORD_ID,
        client_asset_id: "local-photo-1",
        storage_path: `${USER_ID}/${RECORD_ID}/photo.webp`,
        mime_type: "image/webp",
      }),
    ]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain("https://");
    expect(rows.version.story_snapshot.pages[0].illustrationPrompt).toContain(
      "[removed]",
    );
  });

  it("falls back only when the optional foundation relation is absent", () => {
    expect(
      isGrowthMomentFoundationMissing({
        code: "PGRST205",
        message:
          "Could not find the table 'public.growth_moments' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isGrowthMomentFoundationMissing({
        code: "42501",
        message: "permission denied for table growth_moments",
      }),
    ).toBe(false);
  });

  it("keeps legacy import available only for a genuinely missing foundation", async () => {
    const from = vi.fn(() => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: null,
          error: {
            code: "PGRST205",
            message:
              "Could not find the table 'public.growth_moments' in the schema cache",
          },
        }),
      };
      return query;
    });

    await expect(
      mirrorLegacyGrowthRecordToMoment({ from } as any, USER_ID, fixture()),
    ).resolves.toEqual({ foundationAvailable: false });
    expect(from).toHaveBeenCalledTimes(1);

    const deniedFrom = vi.fn(() => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: null,
          error: {
            code: "42501",
            message: "permission denied for table growth_moments",
          },
        }),
      };
      return query;
    });
    await expect(
      mirrorLegacyGrowthRecordToMoment(
        { from: deniedFrom } as any,
        USER_ID,
        fixture(),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
