import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import {
  FamilyCharacterVoiceError,
  getFamilyCharacterVoiceForNarration,
} from "@/lib/family-character-voice-server";

function createQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  return query;
}

function mockVoiceResult(
  result: { data: unknown; error: unknown },
  characterResult: { data: unknown; error: unknown } = {
    data: { kind: "person" },
    error: null,
  },
) {
  const query = createQuery(result);
  const characterQuery = createQuery(characterResult);
  mocks.getSupabaseAdmin.mockReturnValue({
    from: vi.fn((table: string) =>
      table === "family_characters" ? characterQuery : query,
    ),
  });
  return query;
}

describe("family character voice narration lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED = "1";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED;
  });

  it("does not read or use a cloned voice while the feature is disabled", async () => {
    delete process.env.NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED;

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining("暂未开放"),
    } satisfies Partial<FamilyCharacterVoiceError>);
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns a trusted ready voice owned by the current user", async () => {
    const query = mockVoiceResult({
      data: {
        voice_id: "private-provider-voice-id",
        status: "ready",
        updated_at: "2026-08-09T00:00:00.000Z",
      },
      error: null,
    });

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).resolves.toEqual({
      familyCharacterId: "character-1",
      voiceId: "private-provider-voice-id",
      revision: "2026-08-09T00:00:00.000Z",
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith(
      "family_character_id",
      "character-1",
    );
  });

  it("keeps the existing narration path when no cloned voice exists", async () => {
    mockVoiceResult({ data: null, error: null });

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).resolves.toBeNull();
  });

  it("fails closed when the voice relation is missing from the schema cache", async () => {
    mockVoiceResult({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table family_character_voices in the schema cache",
      },
    });

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("数据库部署"),
    } satisfies Partial<FamilyCharacterVoiceError>);
  });

  it("fails closed for a PostgreSQL missing-relation error", async () => {
    mockVoiceResult({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.family_character_voices" does not exist',
      },
    });

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).rejects.toMatchObject({
      status: 503,
    } satisfies Partial<FamilyCharacterVoiceError>);
  });

  it("does not silently use another voice while enrollment is incomplete", async () => {
    mockVoiceResult({
      data: {
        voice_id: null,
        status: "processing",
        updated_at: "2026-08-09T00:00:00.000Z",
      },
      error: null,
    });

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<FamilyCharacterVoiceError>);
  });

  it("keeps the previous cloned voice usable while a replacement is processing", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const characterId = "22222222-2222-4222-8222-222222222222";
    mockVoiceResult({
      data: {
        voice_id: null,
        status: "processing",
        updated_at: "2026-08-09T00:00:00.000Z",
        previous_ready_voice: {
          sample_audio_path: `${userId}/${characterId}/old.wav`,
          sample_duration_seconds: 20,
          voice_id: "previous-private-voice",
          target_model: "qwen-audio-3.0-tts-plus",
          provider_request_id: "request-old",
          consent_confirmed_at: "2026-08-08T00:00:00.000Z",
          consent_version: "2026-08",
        },
      },
      error: null,
    });

    await expect(
      getFamilyCharacterVoiceForNarration(userId, characterId),
    ).resolves.toMatchObject({
      voiceId: "previous-private-voice",
      familyCharacterId: characterId,
    });
  });

  it("rejects a stale voice binding after a character becomes a pet", async () => {
    mockVoiceResult(
      {
        data: {
          voice_id: "private-provider-voice-id",
          status: "ready",
          updated_at: "2026-08-09T00:00:00.000Z",
        },
        error: null,
      },
      { data: { kind: "pet" }, error: null },
    );

    await expect(
      getFamilyCharacterVoiceForNarration("user-1", "character-1"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<FamilyCharacterVoiceError>);
  });
});
