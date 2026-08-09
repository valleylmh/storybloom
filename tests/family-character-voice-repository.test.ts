import { describe, expect, it, vi } from "vitest";
import {
  FAMILY_CHARACTER_VOICE_SAFE_COLUMNS,
  FAMILY_VOICE_SAMPLES_BUCKET,
  listFamilyCharacterVoices,
  removeFamilyVoiceSamples,
  uploadFamilyVoiceSample,
} from "@/lib/repositories/family-character-voice-repository";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";
const SAMPLE_PATH = `${USER_ID}/${CHARACTER_ID}/sample.wav`;

function createVoiceQuery(result: unknown) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("family character voice repository", () => {
  it("lists only explicitly safe columns and hides server identifiers", async () => {
    const query = createVoiceQuery({ data: [], error: null });
    const supabase = { from: vi.fn(() => query) };

    await expect(
      listFamilyCharacterVoices(supabase as never, {
        userId: USER_ID,
        familyCharacterId: CHARACTER_ID,
      }),
    ).resolves.toEqual([]);

    expect(FAMILY_CHARACTER_VOICE_SAFE_COLUMNS).not.toContain("voice_id");
    expect(FAMILY_CHARACTER_VOICE_SAFE_COLUMNS).not.toContain(
      "provider_request_id",
    );
    expect(FAMILY_CHARACTER_VOICE_SAFE_COLUMNS).not.toContain(
      "enrollment_attempt_id",
    );
    expect(FAMILY_CHARACTER_VOICE_SAFE_COLUMNS).not.toContain(
      "retired_voice_ids",
    );
    expect(FAMILY_CHARACTER_VOICE_SAFE_COLUMNS).not.toContain(
      "previous_ready_voice",
    );
    expect(query.select).toHaveBeenCalledWith(
      FAMILY_CHARACTER_VOICE_SAFE_COLUMNS.join(","),
    );
    expect(query.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(query.eq).toHaveBeenCalledWith(
      "family_character_id",
      CHARACTER_ID,
    );
  });

  it("returns an empty list while the optional migration is not deployed", async () => {
    const query = createVoiceQuery({
      data: null,
      error: {
        code: "PGRST205",
        message:
          "Could not find the table 'public.family_character_voices' in the schema cache",
      },
    });
    const supabase = { from: vi.fn(() => query) };

    await expect(
      listFamilyCharacterVoices(supabase as never, { userId: USER_ID }),
    ).resolves.toEqual([]);

    await expect(
      listFamilyCharacterVoices(
        supabase as never,
        { userId: USER_ID },
        { missingRelation: "throw" },
      ),
    ).rejects.toMatchObject({ code: "PGRST205" });
  });

  it("uploads a validated audio sample without overwriting an existing object", async () => {
    const upload = vi.fn(async () => ({ data: null, error: null }));
    const storageFrom = vi.fn(() => ({ upload }));
    const supabase = { storage: { from: storageFrom } };
    const blob = new Blob(["voice"], { type: "audio/wav" });

    await expect(
      uploadFamilyVoiceSample(supabase as never, SAMPLE_PATH, blob),
    ).resolves.toBe(SAMPLE_PATH);

    expect(storageFrom).toHaveBeenCalledWith(FAMILY_VOICE_SAMPLES_BUCKET);
    expect(upload).toHaveBeenCalledWith(SAMPLE_PATH, blob, {
      contentType: "audio/wav",
      upsert: false,
    });
  });

  it("stores M4A samples with the canonical audio/mp4 MIME", async () => {
    const upload = vi.fn(async () => ({ data: null, error: null }));
    const supabase = { storage: { from: vi.fn(() => ({ upload })) } };
    const path = `${USER_ID}/${CHARACTER_ID}/sample.m4a`;
    const blob = new Blob(["voice"], { type: "audio/x-m4a" });

    await expect(
      uploadFamilyVoiceSample(supabase as never, path, blob),
    ).resolves.toBe(path);
    expect(upload).toHaveBeenCalledWith(path, blob, {
      contentType: "audio/mp4",
      upsert: false,
    });
  });

  it("rejects provider-incompatible WebM and OGG sample paths", async () => {
    const upload = vi.fn(async () => ({ data: null, error: null }));
    const supabase = { storage: { from: vi.fn(() => ({ upload })) } };

    await expect(
      uploadFamilyVoiceSample(
        supabase as never,
        `${USER_ID}/${CHARACTER_ID}/sample.webm`,
        new Blob(["voice"], { type: "audio/webm" }),
      ),
    ).rejects.toThrow("family-voice-sample-extension-invalid");
    await expect(
      uploadFamilyVoiceSample(
        supabase as never,
        `${USER_ID}/${CHARACTER_ID}/sample.ogg`,
        new Blob(["voice"], { type: "audio/ogg" }),
      ),
    ).rejects.toThrow("family-voice-sample-extension-invalid");
    expect(upload).not.toHaveBeenCalled();
  });

  it("deduplicates removals and rejects non-audio paths", async () => {
    const remove = vi.fn(async () => ({ data: null, error: null }));
    const supabase = { storage: { from: vi.fn(() => ({ remove })) } };

    await removeFamilyVoiceSamples(supabase as never, [SAMPLE_PATH, SAMPLE_PATH]);
    expect(remove).toHaveBeenCalledWith([SAMPLE_PATH]);
    await expect(
      removeFamilyVoiceSamples(supabase as never, [
        `${USER_ID}/${CHARACTER_ID}/sample.webp`,
      ]),
    ).rejects.toThrow("family-voice-sample-extension-invalid");
  });
});
