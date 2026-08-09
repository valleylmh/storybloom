import { describe, expect, it } from "vitest";
import {
  buildStorageInventory,
  isOptionalStorageBucketMissing,
  validateOwnedStoragePath,
} from "@/lib/account/account-data";
import {
  buildAccountExportEntries,
  getAccountExportFilename,
  redactSensitiveExportValue,
} from "@/lib/account/account-export";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";
const STORY_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "44444444-4444-4444-8444-444444444444";
const VOICE_ID = "voice-clone-family-123";

describe("account export path safety", () => {
  it("accepts owned private image paths and returns their entity/file parts", () => {
    expect(
      validateOwnedStoragePath(
        "family-photos",
        `${USER_ID}/${CHARACTER_ID}/canonical.png`,
        USER_ID,
      ),
    ).toEqual({
      ownerId: USER_ID,
      entityId: CHARACTER_ID,
      fileName: "canonical.png",
    });
  });

  it("rejects cross-account, traversal, and wrong-format paths", () => {
    expect(() =>
      validateOwnedStoragePath(
        "family-photos",
        `99999999-9999-4999-8999-999999999999/${CHARACTER_ID}/source.webp`,
        USER_ID,
      ),
    ).toThrow();
    expect(() =>
      validateOwnedStoragePath(
        "story-archive",
        `${USER_ID}/${STORY_ID}/../page-01.webp`,
        USER_ID,
      ),
    ).toThrow();
    expect(() =>
      validateOwnedStoragePath(
        "growth-record-photos",
        `${USER_ID}/${RECORD_ID}/photo.png`,
        USER_ID,
      ),
    ).toThrow();
    expect(() =>
      validateOwnedStoragePath(
        "family-voice-samples",
        `${USER_ID}/${CHARACTER_ID}/sample.webp`,
        USER_ID,
      ),
    ).toThrow();
  });

  it("accepts private voice samples and tolerates an optional bucket not deployed yet", () => {
    expect(
      validateOwnedStoragePath(
        "family-voice-samples",
        `${USER_ID}/${CHARACTER_ID}/sample.webm`,
        USER_ID,
      ),
    ).toEqual({
      ownerId: USER_ID,
      entityId: CHARACTER_ID,
      fileName: "sample.webm",
    });
    expect(
      validateOwnedStoragePath(
        "family-voice-samples",
        `${USER_ID}/${CHARACTER_ID}/sample.m4a`,
        USER_ID,
      ),
    ).toEqual({
      ownerId: USER_ID,
      entityId: CHARACTER_ID,
      fileName: "sample.m4a",
    });
    expect(
      isOptionalStorageBucketMissing({
        statusCode: "404",
        message: "Bucket not found",
      }),
    ).toBe(true);
  });
});

describe("account storage inventory", () => {
  it("keeps valid orphan objects and reports missing references", () => {
    const inventory = buildStorageInventory(
      USER_ID,
      [
        {
          bucket: "family-photos",
          storagePath: `${USER_ID}/${CHARACTER_ID}/source.webp`,
          byteSize: 12,
        },
        {
          bucket: "story-archive",
          storagePath: `${USER_ID}/${STORY_ID}/page-01.webp`,
        },
        {
          bucket: "family-voice-samples",
          storagePath: `${USER_ID}/${CHARACTER_ID}/sample.webm`,
        },
      ],
      [
        {
          bucket: "family-photos",
          storagePath: `${USER_ID}/${CHARACTER_ID}/source.webp`,
          kind: "character",
          ownerId: CHARACTER_ID,
          field: "sourcePhoto",
        },
        {
          bucket: "growth-record-photos",
          storagePath: `${USER_ID}/${RECORD_ID}/missing.webp`,
          kind: "growth-record",
          ownerId: RECORD_ID,
          field: "photo",
        },
        {
          bucket: "family-voice-samples",
          storagePath: `${USER_ID}/${CHARACTER_ID}/sample.webm`,
          kind: "voice",
          ownerId: CHARACTER_ID,
          field: "sampleAudio",
        },
      ],
    );

    expect(inventory.objects).toHaveLength(3);
    expect(inventory.objects.find((object) => object.referenced === false)?.archivePath).toContain(
      "photos/orphans/story-archive",
    );
    expect(
      inventory.objects.find(
        (object) => object.bucket === "family-voice-samples",
      )?.archivePath,
    ).toBe(`voices/samples/${CHARACTER_ID}/sample.webm`);
    expect(inventory.issues.some((issue) => issue.code === "missing-object")).toBe(true);
  });
});

describe("account export metadata", () => {
  it("redacts share/delete credentials recursively", () => {
    expect(
      redactSensitiveExportValue({
        delete_token: "secret",
        nested: {
          refresh_token: "refresh",
          characterReferenceId: "private-reference-token",
          value: "keep",
        },
      }),
    ).toEqual({ nested: { value: "keep" } });
  });

  it("uses the Shanghai calendar date in the download filename", () => {
    expect(getAccountExportFilename(new Date("2026-08-08T16:30:00.000Z"))).toBe(
      "storybloom-export-2026-08-09.zip",
    );
  });

  it("emits the requested top-level files without exposing auth tokens", () => {
    const entries = buildAccountExportEntries({
      user: {
        id: USER_ID,
        email: "parent@example.com",
        email_confirmed_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        last_sign_in_at: "2026-08-08T00:00:00.000Z",
        app_metadata: { access_token: "must-not-export" },
        user_metadata: { name: "Parent" },
      } as never,
      familyProfile: null,
      accountSettings: null,
      children: [],
      characters: [],
      voices: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          family_character_id: CHARACTER_ID,
          profile_id: "66666666-6666-4666-8666-666666666666",
          user_id: USER_ID,
          sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.webm`,
          sample_duration_seconds: 12.5,
          voice_id: VOICE_ID,
          provider_request_id: "provider-request-private",
          target_model: "qwen-audio-3.0-tts-plus",
          status: "ready",
          error_message: null,
          consent_confirmed_at: "2026-08-09T00:00:00.000Z",
          consent_version: "voice-cloning-v1",
          created_at: "2026-08-09T00:00:00.000Z",
          updated_at: "2026-08-09T00:00:00.000Z",
        },
      ],
      stories: [],
      storyAssets: [],
      growthRecords: [],
      growthRecordPhotos: [],
      sharedStories: [
        {
          share_id: "share-123456",
          delete_token: "must-not-export",
          story: { coverTitle: "A story" },
          created_at: "2026-08-08T00:00:00.000Z",
        },
      ],
      storageObjects: [
        {
          bucket: "family-voice-samples",
          storagePath: `${USER_ID}/${CHARACTER_ID}/sample.webm`,
          fileName: "sample.webm",
          entityId: CHARACTER_ID,
          archivePath: `voices/samples/${CHARACTER_ID}/sample.webm`,
          referenced: true,
          references: [],
        },
      ],
      storageIssues: [],
    });
    const names = entries.map((entry) => entry.name);
    expect(names).toContain("profile.json");
    expect(names).toContain("children.json");
    expect(names).toContain("characters.json");
    expect(names).toContain("voices.json");
    expect(names).toContain("stories/index.json");
    expect(names).toContain("growth-records/index.json");
    expect(names).toContain("photos/index.json");
    const shared = entries.find((entry) => entry.name === "stories/shared.json");
    expect(String(shared?.data)).not.toContain("must-not-export");
    const voices = entries.find((entry) => entry.name === "voices.json");
    expect(String(voices?.data)).toContain(VOICE_ID);
    expect(String(voices?.data)).toContain(
      `voices/samples/${CHARACTER_ID}/sample.webm`,
    );
    expect(String(voices?.data)).not.toContain("provider-request-private");
  });
});
