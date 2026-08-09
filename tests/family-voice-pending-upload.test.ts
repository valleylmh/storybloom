import { describe, expect, it, vi } from "vitest";
import {
  FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS,
  forgetPendingFamilyVoiceUpload,
  readPendingFamilyVoiceUploads,
  reconcilePendingFamilyVoiceUploads,
  rememberPendingFamilyVoiceUpload,
} from "@/lib/family-voice-pending-upload";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";
const SAMPLE_PATH = `${USER_ID}/${CHARACTER_ID}/sample.wav`;

function createStorage() {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage;
}

function createSupabase(
  remove: ReturnType<typeof vi.fn> = vi.fn(async () => ({ error: null })),
) {
  return {
    client: {
      storage: { from: vi.fn(() => ({ remove })) },
    },
    remove,
  };
}

describe("pending family voice upload reconciliation", () => {
  it("records and forgets a pending private sample", () => {
    const storage = createStorage();
    rememberPendingFamilyVoiceUpload(storage, USER_ID, SAMPLE_PATH, 100);
    expect(readPendingFamilyVoiceUploads(storage, USER_ID)).toEqual([
      { path: SAMPLE_PATH, createdAt: 100 },
    ]);
    forgetPendingFamilyVoiceUpload(storage, USER_ID, SAMPLE_PATH);
    expect(readPendingFamilyVoiceUploads(storage, USER_ID)).toEqual([]);
  });

  it("does not truncate a normal multi-character reconciliation backlog at twenty entries", () => {
    const storage = createStorage();
    for (let index = 0; index < 25; index += 1) {
      rememberPendingFamilyVoiceUpload(
        storage,
        USER_ID,
        `${USER_ID}/${CHARACTER_ID}/sample-${index}.wav`,
        100 + index,
      );
    }

    expect(readPendingFamilyVoiceUploads(storage, USER_ID)).toHaveLength(25);
  });

  it("deletes an old unreferenced upload after a lost network request", async () => {
    const storage = createStorage();
    const setup = createSupabase();
    rememberPendingFamilyVoiceUpload(storage, USER_ID, SAMPLE_PATH, 100);

    await reconcilePendingFamilyVoiceUploads(
      setup.client as never,
      storage,
      USER_ID,
      [],
      100 + FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS,
    );

    expect(setup.remove).toHaveBeenCalledWith([SAMPLE_PATH]);
    expect(readPendingFamilyVoiceUploads(storage, USER_ID)).toEqual([]);
  });

  it("never deletes a sample that became referenced by a voice row", async () => {
    const storage = createStorage();
    const setup = createSupabase();
    rememberPendingFamilyVoiceUpload(storage, USER_ID, SAMPLE_PATH, 100);

    await reconcilePendingFamilyVoiceUploads(
      setup.client as never,
      storage,
      USER_ID,
      [{ sample_audio_path: SAMPLE_PATH } as never],
      100 + FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS,
    );

    expect(setup.remove).not.toHaveBeenCalled();
    expect(readPendingFamilyVoiceUploads(storage, USER_ID)).toEqual([]);
  });

  it("retains recent uploads and cleanup failures for a later retry", async () => {
    const storage = createStorage();
    const remove = vi.fn(async () => ({ error: { message: "retry" } }));
    const setup = createSupabase(remove);
    rememberPendingFamilyVoiceUpload(storage, USER_ID, SAMPLE_PATH, 100);

    await reconcilePendingFamilyVoiceUploads(
      setup.client as never,
      storage,
      USER_ID,
      [],
      100 + FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS - 1,
    );
    expect(setup.remove).not.toHaveBeenCalled();

    await reconcilePendingFamilyVoiceUploads(
      setup.client as never,
      storage,
      USER_ID,
      [],
      100 + FAMILY_VOICE_PENDING_UPLOAD_RECONCILE_MS,
    );
    expect(readPendingFamilyVoiceUploads(storage, USER_ID)).toEqual([
      { path: SAMPLE_PATH, createdAt: 100 },
    ]);
  });
});
