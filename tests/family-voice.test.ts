import { describe, expect, it } from "vitest";
import {
  FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS,
  FAMILY_VOICE_MAX_SAMPLE_BYTES,
  FAMILY_VOICE_PROCESSING_STALE_MS,
  areFamilyVoiceTypeAndExtensionCompatible,
  createFamilyVoiceEnrollmentPrefix,
  encodeFamilyVoicePcm16Wav,
  getFamilyVoiceCanonicalExtension,
  isFamilyVoiceAmbiguousAbsenceGraceElapsed,
  isFamilyVoiceCloningEnabled,
  isFamilyVoiceProcessingStale,
  isValidFamilyVoiceSampleDuration,
  isValidFamilyVoiceSampleSize,
  normalizeFamilyVoiceContentType,
  normalizeFamilyVoiceExtension,
  parseOwnedFamilyVoiceSamplePath,
} from "@/lib/family-voice";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";

describe("family voice helpers", () => {
  it("keeps voice cloning disabled unless the public flag is explicitly enabled", () => {
    expect(isFamilyVoiceCloningEnabled(undefined)).toBe(false);
    expect(isFamilyVoiceCloningEnabled("")).toBe(false);
    expect(isFamilyVoiceCloningEnabled("0")).toBe(false);
    expect(isFamilyVoiceCloningEnabled("false")).toBe(false);
    expect(isFamilyVoiceCloningEnabled("1")).toBe(true);
    expect(isFamilyVoiceCloningEnabled(" true ")).toBe(true);
    expect(isFamilyVoiceCloningEnabled("ON")).toBe(true);
  });

  it("enforces the 10-60 second and 10MB sample limits", () => {
    expect(isValidFamilyVoiceSampleDuration(10)).toBe(true);
    expect(isValidFamilyVoiceSampleDuration(60)).toBe(true);
    expect(isValidFamilyVoiceSampleDuration(9.99)).toBe(false);
    expect(isValidFamilyVoiceSampleDuration(60.01)).toBe(false);
    expect(isValidFamilyVoiceSampleSize(FAMILY_VOICE_MAX_SAMPLE_BYTES)).toBe(
      true,
    );
    expect(
      isValidFamilyVoiceSampleSize(FAMILY_VOICE_MAX_SAMPLE_BYTES + 1),
    ).toBe(false);
  });

  it("treats processing as stale only after the 15-minute lease expires", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    expect(
      isFamilyVoiceProcessingStale(
        new Date(now - FAMILY_VOICE_PROCESSING_STALE_MS).toISOString(),
        now,
      ),
    ).toBe(true);
    expect(
      isFamilyVoiceProcessingStale(
        new Date(now - FAMILY_VOICE_PROCESSING_STALE_MS + 1).toISOString(),
        now,
      ),
    ).toBe(false);
    expect(isFamilyVoiceProcessingStale("not-a-date", now)).toBe(false);
    expect(isFamilyVoiceProcessingStale(null, now)).toBe(false);
  });

  it("requires a second observation window before concluding an ambiguous create was absent", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    expect(
      isFamilyVoiceAmbiguousAbsenceGraceElapsed(
        new Date(
          now - FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS,
        ).toISOString(),
        now,
      ),
    ).toBe(true);
    expect(
      isFamilyVoiceAmbiguousAbsenceGraceElapsed(
        new Date(
          now - FAMILY_VOICE_AMBIGUOUS_ABSENCE_GRACE_MS + 1,
        ).toISOString(),
        now,
      ),
    ).toBe(false);
  });

  it("allows only WAV, MP3, and M4A MIME and extension aliases", () => {
    expect(normalizeFamilyVoiceContentType("audio/x-m4a")).toBe("audio/mp4");
    expect(normalizeFamilyVoiceContentType("audio/x-wav")).toBe("audio/wav");
    expect(normalizeFamilyVoiceContentType("audio/mp3")).toBe("audio/mpeg");
    expect(normalizeFamilyVoiceContentType("audio/webm;codecs=opus")).toBeNull();
    expect(normalizeFamilyVoiceContentType("audio/ogg")).toBeNull();
    expect(normalizeFamilyVoiceExtension("sample.mp3")).toBe("mp3");
    expect(normalizeFamilyVoiceExtension("sample.m4a")).toBe("m4a");
    expect(normalizeFamilyVoiceExtension("sample.webm")).toBeNull();
    expect(normalizeFamilyVoiceExtension("sample.mp4")).toBeNull();
    expect(areFamilyVoiceTypeAndExtensionCompatible("audio/mpeg", "mp3")).toBe(
      true,
    );
    expect(areFamilyVoiceTypeAndExtensionCompatible("audio/wav", "m4a")).toBe(
      false,
    );
    expect(getFamilyVoiceCanonicalExtension("audio/mp4")).toBe("m4a");
  });

  it("accepts only an exact user/character/filename storage path", () => {
    const validPath = `${USER_ID}/${CHARACTER_ID}/sample-123.wav`;
    expect(
      parseOwnedFamilyVoiceSamplePath(validPath, USER_ID, CHARACTER_ID),
    ).toEqual({ filename: "sample-123.wav", extension: "wav" });
    expect(
      parseOwnedFamilyVoiceSamplePath(
        `${USER_ID}/${CHARACTER_ID}/../other.wav`,
        USER_ID,
        CHARACTER_ID,
      ),
    ).toBeNull();
    expect(
      parseOwnedFamilyVoiceSamplePath(
        `99999999-9999-4999-8999-999999999999/${CHARACTER_ID}/sample.wav`,
        USER_ID,
        CHARACTER_ID,
      ),
    ).toBeNull();
    expect(
      parseOwnedFamilyVoiceSamplePath(
        `${USER_ID}/${CHARACTER_ID}/nested/sample.wav`,
        USER_ID,
        CHARACTER_ID,
      ),
    ).toBeNull();
  });

  it("accepts legacy stored extensions only for cleanup and recovery", () => {
    for (const extension of ["mp4", "webm", "ogg"] as const) {
      const path = `${USER_ID}/${CHARACTER_ID}/legacy.${extension}`;
      expect(
        parseOwnedFamilyVoiceSamplePath(path, USER_ID, CHARACTER_ID),
      ).toBeNull();
      expect(
        parseOwnedFamilyVoiceSamplePath(path, USER_ID, CHARACTER_ID, {
          allowLegacy: true,
        }),
      ).toEqual({ filename: `legacy.${extension}`, extension });
    }
  });

  it("encodes mono 16-bit PCM as a valid WAV container", async () => {
    const blob = encodeFamilyVoicePcm16Wav(
      [new Float32Array([-1, -0.5, 0, 0.5, 1])],
      48_000,
    );
    const view = new DataView(await blob.arrayBuffer());

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 5 * 2);
    expect(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4))).toBe(
      "RIFF",
    );
    expect(String.fromCharCode(...new Uint8Array(view.buffer, 8, 4))).toBe(
      "WAVE",
    );
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(-32_768);
    expect(view.getInt16(52, true)).toBe(32_767);
  });

  it("rejects WAV encoding below the provider sample-rate floor", () => {
    expect(() =>
      encodeFamilyVoicePcm16Wav([new Float32Array([0])], 8_000),
    ).toThrow("family-voice-sample-rate-invalid");
  });

  it("creates a provider-safe enrollment prefix", () => {
    expect(createFamilyVoiceEnrollmentPrefix(CHARACTER_ID)).toBe("sb11111111");
  });
});
