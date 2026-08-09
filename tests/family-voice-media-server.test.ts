import { describe, expect, it } from "vitest";
import {
  FamilyVoiceMediaError,
  inspectFamilyVoiceSample,
} from "@/lib/family-voice-media-server";

function createSilentWav(
  durationSeconds: number,
  sampleRate = 48_000,
  bitsPerSample = 16,
) {
  const sampleCount = Math.round(durationSeconds * sampleRate);
  const bytesPerSample = bitsPerSample / 8;
  const dataBytes = sampleCount * bytesPerSample;
  const bytes = Buffer.alloc(44 + dataBytes);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + dataBytes, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * bytesPerSample, 28);
  bytes.writeUInt16LE(bytesPerSample, 32);
  bytes.writeUInt16LE(bitsPerSample, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(dataBytes, 40);
  return new Blob([bytes], { type: "audio/wav" });
}

describe("family voice media inspection", () => {
  it("reads the real duration and container from a valid audio file", async () => {
    await expect(
      inspectFamilyVoiceSample(createSilentWav(12), "audio/wav"),
    ).resolves.toMatchObject({
      durationSeconds: 12,
      container: "WAVE",
      sampleRate: 48_000,
      bitsPerSample: 16,
    });
  });

  it("rejects audio whose real duration is outside 10-60 seconds", async () => {
    await expect(
      inspectFamilyVoiceSample(createSilentWav(5), "audio/wav"),
    ).rejects.toMatchObject({ status: 422 } satisfies Partial<FamilyVoiceMediaError>);
  });

  it("rejects a real container that does not match the uploaded MIME", async () => {
    await expect(
      inspectFamilyVoiceSample(createSilentWav(12), "audio/mpeg"),
    ).rejects.toMatchObject({ status: 415 } satisfies Partial<FamilyVoiceMediaError>);
  });

  it("rejects audio below the provider's 16kHz sample-rate floor", async () => {
    await expect(
      inspectFamilyVoiceSample(createSilentWav(12, 8_000), "audio/wav"),
    ).rejects.toMatchObject({ status: 422 } satisfies Partial<FamilyVoiceMediaError>);
  });

  it("rejects WAV audio that is not 16-bit", async () => {
    await expect(
      inspectFamilyVoiceSample(createSilentWav(12, 48_000, 24), "audio/wav"),
    ).rejects.toMatchObject({ status: 422 } satisfies Partial<FamilyVoiceMediaError>);
  });

  it("rejects malformed bytes even when the Storage MIME looks supported", async () => {
    await expect(
      inspectFamilyVoiceSample(
        new Blob([new Uint8Array(1_024)], { type: "audio/wav" }),
        "audio/wav",
      ),
    ).rejects.toMatchObject({ status: 415 } satisfies Partial<FamilyVoiceMediaError>);
  });
});
