import { describe, expect, it } from "vitest";
import { parseFamilyVoiceReadySnapshot } from "@/lib/family-character-voice-private-server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";

function snapshot(path = `${USER_ID}/${CHARACTER_ID}/old.wav`) {
  return {
    sample_audio_path: path,
    sample_duration_seconds: 20,
    voice_id: "private-voice-id",
    target_model: "qwen-audio-3.0-tts-plus",
    provider_request_id: "request-old",
    consent_confirmed_at: "2026-08-08T00:00:00.000Z",
    consent_version: "2026-08",
  };
}

describe("private family voice snapshot", () => {
  it("accepts a complete snapshot owned by the current user and character", () => {
    expect(
      parseFamilyVoiceReadySnapshot(snapshot(), USER_ID, CHARACTER_ID),
    ).toEqual(snapshot());
  });

  it("rejects a snapshot that points to another character's private sample", () => {
    expect(
      parseFamilyVoiceReadySnapshot(
        snapshot(
          `${USER_ID}/33333333-3333-4333-8333-333333333333/old.wav`,
        ),
        USER_ID,
        CHARACTER_ID,
      ),
    ).toBeNull();
  });
});
