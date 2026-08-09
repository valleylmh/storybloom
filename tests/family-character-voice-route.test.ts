import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  createBailianClonedVoice: vi.fn(),
  deleteBailianClonedVoice: vi.fn(),
  discoverBailianClonedVoiceIdsSince: vi.fn(),
  listBailianClonedVoiceIds: vi.fn(),
  queryBailianClonedVoice: vi.fn(),
  allowIpRequest: vi.fn(),
  inspectFamilyVoiceSample: vi.fn(),
}));

vi.mock("@/lib/supabase/server-auth", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/supabase/server-auth")
  >();
  return {
    ...actual,
    requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  };
});

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

vi.mock("@/lib/request-rate-limit", () => ({
  allowIpRequest: mocks.allowIpRequest,
}));

vi.mock("@/lib/family-voice-media-server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/family-voice-media-server")
  >();
  return {
    ...actual,
    inspectFamilyVoiceSample: mocks.inspectFamilyVoiceSample,
  };
});

vi.mock("@/lib/bailian-voice-cloning-server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/bailian-voice-cloning-server")
  >();
  return {
    ...actual,
    createBailianClonedVoice: mocks.createBailianClonedVoice,
    deleteBailianClonedVoice: mocks.deleteBailianClonedVoice,
    discoverBailianClonedVoiceIdsSince:
      mocks.discoverBailianClonedVoiceIdsSince,
    listBailianClonedVoiceIds: mocks.listBailianClonedVoiceIds,
    queryBailianClonedVoice: mocks.queryBailianClonedVoice,
  };
});

import { BailianVoiceCloningError } from "@/lib/bailian-voice-cloning-server";
import { DELETE, GET, POST } from "@/app/api/family/characters/[id]/voice/route";

const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const SAMPLE_PATH = `${USER_ID}/${CHARACTER_ID}/sample-new.wav`;

type SingleResponse = { data: unknown; error: unknown };

function createAdmin(options: {
  character?: Record<string, unknown> | null;
  sampleBlob?: Blob;
  downloadResponses?: Array<{ data: Blob | null; error: unknown }>;
  voiceSingles?: SingleResponse[];
  signedUrl?: string | null;
  accountLocked?: boolean;
  removeError?: { message: string } | null;
} = {}) {
  const state = {
    inserts: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    deletes: 0,
    eqCalls: [] as Array<[string, unknown]>,
    removes: [] as string[][],
    voiceSingles: [...(options.voiceSingles || [])],
  };
  const character =
    options.character === undefined
      ? {
          id: CHARACTER_ID,
          profile_id: PROFILE_ID,
          user_id: USER_ID,
          kind: "person",
        }
      : options.character;

  function queryFor(table: string) {
    let operation: "select" | "insert" | "update" | "delete" = "select";
    const query: Record<string, unknown> & {
      then?: (
        resolve: (value: SingleResponse) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise<unknown>;
    } = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn((column: string, value: unknown) => {
      state.eqCalls.push([column, value]);
      return query;
    });
    query.neq = vi.fn(() => query);
    query.insert = vi.fn((payload: Record<string, unknown>) => {
      operation = "insert";
      state.inserts.push(payload);
      return query;
    });
    query.update = vi.fn((payload: Record<string, unknown>) => {
      operation = "update";
      state.updates.push(payload);
      return query;
    });
    query.delete = vi.fn(() => {
      operation = "delete";
      state.deletes += 1;
      return query;
    });
    query.maybeSingle = vi.fn(async () => {
      if (table === "family_characters") {
        return { data: character, error: null };
      }
      if (table === "family_character_voices") {
        const next = state.voiceSingles.shift();
        if (next) return next;
        return { data: operation === "select" ? null : {}, error: null };
      }
      if (table === "account_voice_deletion_locks") {
        return {
          data: options.accountLocked ? { user_id: USER_ID } : null,
          error: null,
        };
      }
      return { data: null, error: null };
    });
    query.then = (resolve, reject) =>
      Promise.resolve({ data: operation === "select" ? null : {}, error: null }).then(
        resolve,
        reject,
      );
    return query;
  }

  const storageBucket = {
    download: vi.fn(async () => {
      const next = options.downloadResponses?.shift();
      if (next) return next;
      return {
        data:
          options.sampleBlob ||
          new Blob([new Uint8Array(1024)], { type: "audio/wav" }),
        error: null,
      };
    }),
    createSignedUrl: vi.fn(async () => ({
      data: options.signedUrl === null
        ? null
        : {
            signedUrl:
              options.signedUrl ||
              "https://storage.example.test/signed/sample.wav?token=private",
          },
      error: null,
    })),
    remove: vi.fn(async (paths: string[]) => {
      state.removes.push(paths);
      return { data: options.removeError ? null : paths, error: options.removeError || null };
    }),
  };
  const admin = {
    from: vi.fn((table: string) => queryFor(table)),
    storage: {
      from: vi.fn(() => storageBucket),
    },
  };
  return { admin, state, storageBucket };
}

function createVoiceRecord(overrides: Record<string, unknown> = {}) {
  return {
    family_character_id: CHARACTER_ID,
    profile_id: PROFILE_ID,
    user_id: USER_ID,
    sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample-old.wav`,
    sample_duration_seconds: 20,
    voice_id: "old-voice-id",
    target_model: "qwen-audio-3.0-tts-plus",
    status: "ready",
    error_message: null,
    provider_request_id: "old-request-id",
    enrollment_attempt_id: "44444444-4444-4444-8444-444444444444",
    retired_voice_ids: [],
    previous_ready_voice: null,
    retired_sample_paths: [],
    provider_voice_ids_before_attempt: null,
    consent_confirmed_at: "2026-08-08T00:00:00.000Z",
    consent_version: "2026-08",
    updated_at: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

function createTrackedVoiceRecord(overrides: Record<string, unknown> = {}) {
  return createVoiceRecord({
    sample_audio_path: SAMPLE_PATH,
    sample_duration_seconds: 19.75,
    voice_id: "new-voice-id",
    status: "processing",
    provider_request_id: "request-new",
    enrollment_attempt_id: "55555555-5555-4555-8555-555555555555",
    consent_confirmed_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  });
}

function createPendingVoiceRecord(overrides: Record<string, unknown> = {}) {
  return createTrackedVoiceRecord({
    voice_id: null,
    provider_request_id: null,
    provider_voice_ids_before_attempt: [],
    ...overrides,
  });
}

async function callRoute(
  body: Record<string, unknown> = {
    sampleAudioPath: SAMPLE_PATH,
    sampleDurationSeconds: 20,
    consentConfirmed: true,
  },
) {
  return POST(
    new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: CHARACTER_ID }) },
  );
}

describe("family character voice route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
    mocks.allowIpRequest.mockResolvedValue(true);
    mocks.createBailianClonedVoice.mockResolvedValue({
      voiceId: "new-voice-id",
      requestId: "request-new",
    });
    mocks.deleteBailianClonedVoice.mockResolvedValue({});
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);
    mocks.listBailianClonedVoiceIds.mockResolvedValue([]);
    mocks.queryBailianClonedVoice.mockResolvedValue({ status: "OK" });
    mocks.inspectFamilyVoiceSample.mockResolvedValue({
      durationSeconds: 19.75,
      container: "WAVE",
    });
    process.env.BAILIAN_VOICE_ABSENCE_RECHECK_MS = "1";
    process.env.FAMILY_VOICE_SAMPLE_READ_RETRY_MS = "1";
  });

  afterEach(() => {
    delete process.env.BAILIAN_VOICE_ABSENCE_RECHECK_MS;
    delete process.env.FAMILY_VOICE_SAMPLE_READ_RETRY_MS;
  });

  it("requires explicit consent before touching storage or the provider", async () => {
    const setup = createAdmin();
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute({
      sampleAudioPath: SAMPLE_PATH,
      sampleDurationSeconds: 20,
      consentConfirmed: false,
    });

    expect(response.status).toBe(400);
    expect(setup.admin.from).not.toHaveBeenCalled();
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("rate limits repeated enrollment attempts and authorizes orphan cleanup", async () => {
    const setup = createAdmin();
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.allowIpRequest.mockResolvedValue(false);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("过于频繁");
    expect(body.cleanupSample).toBe(true);
    expect(setup.storageBucket.download).not.toHaveBeenCalled();
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("rejects paths outside the authenticated user's exact character folder", async () => {
    const setup = createAdmin();
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute({
      sampleAudioPath: `${USER_ID}/${CHARACTER_ID}/nested/sample.wav`,
      sampleDurationSeconds: 20,
      consentConfirmed: true,
    });

    expect(response.status).toBe(400);
    expect(setup.admin.from).not.toHaveBeenCalled();
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("allows only person characters", async () => {
    const setup = createAdmin({
      character: {
        id: CHARACTER_ID,
        profile_id: PROFILE_ID,
        user_id: USER_ID,
        kind: "pet",
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("人物角色");
    expect(setup.storageBucket.download).not.toHaveBeenCalled();
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("blocks enrollment while an account voice-deletion lock exists", async () => {
    const setup = createAdmin({ accountLocked: true });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("账户数据正在删除");
    expect(body.cleanupSample).toBe(true);
    expect(setup.storageBucket.download).not.toHaveBeenCalled();
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("rejects a MIME/extension mismatch before claiming processing", async () => {
    const setup = createAdmin({
      sampleBlob: new Blob([new Uint8Array(1024)], { type: "audio/mpeg" }),
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();

    expect(response.status).toBe(415);
    expect(setup.state.inserts).toHaveLength(0);
    expect(setup.state.updates).toHaveLength(0);
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("retries a just-uploaded private sample before starting enrollment", async () => {
    const setup = createAdmin({
      downloadResponses: [
        {
          data: null,
          error: { statusCode: "404", message: "Object not found" },
        },
      ],
      voiceSingles: [
        { data: null, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        { data: createPendingVoiceRecord(), error: null },
        { data: createTrackedVoiceRecord(), error: null },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(setup.storageBucket.download).toHaveBeenCalledTimes(2);
    expect(mocks.createBailianClonedVoice).toHaveBeenCalledOnce();
  });

  it("returns a retryable storage-sync error after repeated missing-object reads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const missing = {
      data: null,
      error: { statusCode: "404", message: "Object not found" },
    };
    const setup = createAdmin({
      downloadResponses: [missing, missing, missing, missing],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("尚未同步完成");
    expect(setup.storageBucket.download).toHaveBeenCalledTimes(4);
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("claims processing, uses a 10-minute signed URL, and hides sensitive IDs", async () => {
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        { data: createPendingVoiceRecord(), error: null },
        { data: createTrackedVoiceRecord(), error: null },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "ready" });
    expect(body.voice_id).toBeUndefined();
    expect(body.sampleAudioPath).toBeUndefined();
    expect(setup.state.inserts[0]).toMatchObject({
      family_character_id: CHARACTER_ID,
      user_id: USER_ID,
      sample_audio_path: SAMPLE_PATH,
      sample_duration_seconds: 19.75,
      status: "processing",
      voice_id: null,
      consent_version: "2026-08",
      enrollment_attempt_id: expect.any(String),
    });
    expect(setup.storageBucket.createSignedUrl).toHaveBeenCalledWith(
      SAMPLE_PATH,
      600,
    );
    expect(mocks.inspectFamilyVoiceSample).toHaveBeenCalledWith(
      expect.any(Blob),
      "audio/wav",
    );
    expect(mocks.createBailianClonedVoice).toHaveBeenCalledWith({
      sampleUrl:
        "https://storage.example.test/signed/sample.wav?token=private",
      prefix: "sb11111111",
    });
    expect(mocks.listBailianClonedVoiceIds).toHaveBeenCalledWith(
      "sb11111111",
    );
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({ provider_voice_ids_before_attempt: [] }),
    );
    expect(
      mocks.listBailianClonedVoiceIds.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.createBailianClonedVoice.mock.invocationCallOrder[0],
    );
    expect(setup.state.updates).toContainEqual(expect.objectContaining({
      voice_id: "new-voice-id",
      status: "processing",
      provider_request_id: "request-new",
    }));
    expect(setup.state.updates).toContainEqual(expect.objectContaining({
      status: "ready",
      previous_ready_voice: null,
    }));
    expect(setup.state.eqCalls).toContainEqual([
      "enrollment_attempt_id",
      setup.state.inserts[0].enrollment_attempt_id,
    ]);
  });

  it("keeps a newly created provider voice processing until query_voice reports OK", async () => {
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        { data: createPendingVoiceRecord(), error: null },
        { data: createTrackedVoiceRecord(), error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.queryBailianClonedVoice.mockResolvedValue({ status: "DEPLOYING" });

    const response = await callRoute();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, status: "processing" });
    expect(setup.state.updates).not.toContainEqual(
      expect.objectContaining({ status: "ready" }),
    );
  });

  it("recovers one provider voice after an ambiguous create response", async () => {
    const providerSnapshot = ["existing-before-attempt"];
    const recoveredVoiceId = "recovered-after-timeout";
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        {
          data: createPendingVoiceRecord({
            provider_voice_ids_before_attempt: providerSnapshot,
          }),
          error: null,
        },
        {
          data: createTrackedVoiceRecord({
            voice_id: recoveredVoiceId,
            provider_request_id: null,
            provider_voice_ids_before_attempt: providerSnapshot,
          }),
          error: null,
        },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.listBailianClonedVoiceIds.mockResolvedValue(providerSnapshot);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("provider response lost", 504, {
        ambiguous: true,
      }),
    );
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      recoveredVoiceId,
    ]);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "ready" });
    expect(mocks.discoverBailianClonedVoiceIdsSince).toHaveBeenCalledWith(
      "sb11111111",
      providerSnapshot,
    );
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({
        voice_id: recoveredVoiceId,
        provider_request_id: null,
      }),
    );
    expect(mocks.queryBailianClonedVoice).toHaveBeenCalledWith(
      recoveredVoiceId,
    );
  });

  it("keeps an ambiguous create retryable when no new provider voice is visible yet", async () => {
    const providerSnapshot = ["existing-before-attempt"];
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        {
          data: createPendingVoiceRecord({
            provider_voice_ids_before_attempt: providerSnapshot,
          }),
          error: null,
        },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.listBailianClonedVoiceIds.mockResolvedValue(providerSnapshot);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("provider response lost", 504, {
        ambiguous: true,
      }),
    );
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);

    const response = await callRoute();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, status: "processing" });
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({
        provider_voice_ids_before_attempt: providerSnapshot,
      }),
    );
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(setup.state.deletes).toBe(0);
    expect(setup.state.removes).toHaveLength(0);
  });

  it("cancels every newly discovered voice when an ambiguous create yields multiple IDs", async () => {
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        { data: createPendingVoiceRecord(), error: null },
        { data: { status: "failed" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("provider response lost", 504, {
        ambiguous: true,
      }),
    );
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      "ambiguous-voice-a",
      "ambiguous-voice-b",
    ]);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain("重新录制");
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "ambiguous-voice-a",
      { allowListAbsenceConfirmation: false },
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "ambiguous-voice-b",
      { allowListAbsenceConfirmation: false },
    );
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        provider_voice_ids_before_attempt: null,
      }),
    );
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
  });

  it("does not revoke ambiguous candidates until their cleanup queue is durable", async () => {
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        { data: createPendingVoiceRecord(), error: null },
        { data: null, error: { message: "database unavailable" } },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("provider response lost", 504, {
        ambiguous: true,
      }),
    );
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      "ambiguous-voice-a",
      "ambiguous-voice-b",
    ]);

    const response = await callRoute();

    expect(response.status).toBe(500);
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({
        retired_voice_ids: ["ambiguous-voice-a", "ambiguous-voice-b"],
      }),
    );
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("lets the authenticated status endpoint finish a provider-approved voice", async () => {
    const processingVoice = createTrackedVoiceRecord();
    const setup = createAdmin({
      voiceSingles: [
        { data: processingVoice, error: null },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await GET(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "ready" });
    expect(mocks.queryBailianClonedVoice).toHaveBeenCalledWith("new-voice-id");
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({ status: "ready" }),
    );
  });

  it("lets GET recover and finalize one voice from an ambiguous create snapshot", async () => {
    const providerSnapshot = ["existing-before-attempt"];
    const recoveredVoiceId = "recovered-by-status-poll";
    const setup = createAdmin({
      voiceSingles: [
        {
          data: createPendingVoiceRecord({
            provider_voice_ids_before_attempt: providerSnapshot,
          }),
          error: null,
        },
        {
          data: createTrackedVoiceRecord({
            voice_id: recoveredVoiceId,
            provider_request_id: null,
            provider_voice_ids_before_attempt: providerSnapshot,
          }),
          error: null,
        },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      recoveredVoiceId,
    ]);

    const response = await GET(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "ready" });
    expect(mocks.discoverBailianClonedVoiceIdsSince).toHaveBeenCalledWith(
      "sb11111111",
      providerSnapshot,
    );
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({ voice_id: recoveredVoiceId }),
    );
    expect(mocks.queryBailianClonedVoice).toHaveBeenCalledWith(
      recoveredVoiceId,
    );
  });

  it("lets GET cancel multiple voices discovered for one ambiguous create", async () => {
    const setup = createAdmin({
      voiceSingles: [
        {
          data: createPendingVoiceRecord({
            provider_voice_ids_before_attempt: ["existing-before-attempt"],
          }),
          error: null,
        },
        { data: { status: "failed" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      "ambiguous-poll-a",
      "ambiguous-poll-b",
    ]);

    const response = await GET(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "failed",
      rejected: true,
    });
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "ambiguous-poll-a",
      { allowListAbsenceConfirmation: false },
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "ambiguous-poll-b",
      { allowListAbsenceConfirmation: false },
    );
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
  });

  it("restores the previous ready voice when provider review rejects a replacement", async () => {
    const oldVoice = createVoiceRecord();
    const previousReadyVoice = {
      sample_audio_path: oldVoice.sample_audio_path,
      sample_duration_seconds: oldVoice.sample_duration_seconds,
      voice_id: oldVoice.voice_id,
      target_model: oldVoice.target_model,
      provider_request_id: oldVoice.provider_request_id,
      consent_confirmed_at: oldVoice.consent_confirmed_at,
      consent_version: oldVoice.consent_version,
    };
    const setup = createAdmin({
      voiceSingles: [
        { data: oldVoice, error: null },
        {
          data: { family_character_id: CHARACTER_ID, status: "processing" },
          error: null,
        },
        {
          data: createPendingVoiceRecord({
            previous_ready_voice: previousReadyVoice,
          }),
          error: null,
        },
        {
          data: createTrackedVoiceRecord({
            previous_ready_voice: previousReadyVoice,
          }),
          error: null,
        },
        { data: { status: "ready", voice_id: "old-voice-id" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.queryBailianClonedVoice.mockResolvedValue({ status: "UNDEPLOYED" });

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toContain("继续使用原来的真人声音");
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "new-voice-id",
      { allowListAbsenceConfirmation: false },
    );
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({
        status: "ready",
        voice_id: "old-voice-id",
        previous_ready_voice: null,
      }),
    );
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
  });

  it("restores the old ready voice and removes the new sample when re-recording fails", async () => {
    const oldVoice = createVoiceRecord();
    const setup = createAdmin({
      voiceSingles: [
        { data: oldVoice, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        {
          data: createPendingVoiceRecord({
            previous_ready_voice: {
              sample_audio_path: oldVoice.sample_audio_path,
              sample_duration_seconds: oldVoice.sample_duration_seconds,
              voice_id: oldVoice.voice_id,
              target_model: oldVoice.target_model,
              provider_request_id: oldVoice.provider_request_id,
              consent_confirmed_at: oldVoice.consent_confirmed_at,
              consent_version: oldVoice.consent_version,
            },
          }),
          error: null,
        },
        { data: { status: "ready", voice_id: "old-voice-id" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("百炼声音复刻服务暂时不可用。", 502),
    );

    const response = await callRoute();

    expect(response.status).toBe(502);
    expect(setup.state.updates).toContainEqual(expect.objectContaining({
      sample_audio_path: oldVoice.sample_audio_path,
      voice_id: "old-voice-id",
      status: "ready",
      provider_request_id: "old-request-id",
    }));
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
  });

  it("revokes the superseded provider voice after a re-recording succeeds", async () => {
    const oldVoice = createVoiceRecord();
    const setup = createAdmin({
      voiceSingles: [
        { data: oldVoice, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        {
          data: createPendingVoiceRecord({
            previous_ready_voice: {
              sample_audio_path: oldVoice.sample_audio_path,
              sample_duration_seconds: oldVoice.sample_duration_seconds,
              voice_id: oldVoice.voice_id,
              target_model: oldVoice.target_model,
              provider_request_id: oldVoice.provider_request_id,
              consent_confirmed_at: oldVoice.consent_confirmed_at,
              consent_version: oldVoice.consent_version,
            },
          }),
          error: null,
        },
        {
          data: createTrackedVoiceRecord({
            previous_ready_voice: {
              sample_audio_path: oldVoice.sample_audio_path,
              sample_duration_seconds: oldVoice.sample_duration_seconds,
              voice_id: oldVoice.voice_id,
              target_model: oldVoice.target_model,
              provider_request_id: oldVoice.provider_request_id,
              consent_confirmed_at: oldVoice.consent_confirmed_at,
              consent_version: oldVoice.consent_version,
            },
          }),
          error: null,
        },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({
        provider_voice_ids_before_attempt: ["old-voice-id"],
      }),
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "old-voice-id",
      { allowListAbsenceConfirmation: false },
    );
    expect(setup.state.updates).toContainEqual(
      expect.objectContaining({ retired_voice_ids: [] }),
    );
    expect(setup.state.removes).toContainEqual([oldVoice.sample_audio_path]);
  });

  it("restores a durable previous voice after a crashed re-recording is reclaimed", async () => {
    const previousSamplePath = `${USER_ID}/${CHARACTER_ID}/sample-previous.wav`;
    const staleSamplePath = `${USER_ID}/${CHARACTER_ID}/sample-stale.wav`;
    const staleVoice = createVoiceRecord({
      status: "processing",
      voice_id: null,
      sample_audio_path: staleSamplePath,
      updated_at: "2026-08-08T00:00:00.000Z",
      previous_ready_voice: {
        sample_audio_path: previousSamplePath,
        sample_duration_seconds: 22,
        voice_id: "durable-previous-voice",
        target_model: "qwen-audio-3.0-tts-plus",
        provider_request_id: "request-previous",
        consent_confirmed_at: "2026-08-07T00:00:00.000Z",
        consent_version: "2026-08",
      },
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: staleVoice, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        {
          data: createPendingVoiceRecord({
            previous_ready_voice: staleVoice.previous_ready_voice,
          }),
          error: null,
        },
        { data: { status: "ready", voice_id: "durable-previous-voice" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("百炼声音复刻服务暂时不可用。", 502),
    );

    const response = await callRoute();

    expect(response.status).toBe(502);
    expect(setup.state.updates).toContainEqual(expect.objectContaining({
      sample_audio_path: previousSamplePath,
      sample_duration_seconds: 22,
      voice_id: "durable-previous-voice",
      status: "ready",
      previous_ready_voice: null,
    }));
    expect(setup.state.removes).toContainEqual([staleSamplePath]);
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
    expect(setup.state.removes).not.toContainEqual([previousSamplePath]);
  });

  it("deletes the first failed enrollment row before cleaning its sample", async () => {
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        { data: createPendingVoiceRecord(), error: null },
        { data: { sample_audio_path: SAMPLE_PATH }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError(
        "百炼声音复刻请求失败（InvalidParameter）。",
        502,
        { requestId: "failed-request" },
      ),
    );

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.cleanupSample).toBe(true);
    expect(setup.state.deletes).toBe(1);
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
    expect(setup.state.eqCalls).toContainEqual([
      "enrollment_attempt_id",
      setup.state.inserts[0].enrollment_attempt_id,
    ]);
  });

  it("cleans the previous failed sample when a retry also fails", async () => {
    const failedVoice = createVoiceRecord({
      status: "failed",
      voice_id: null,
      error_message: "旧的失败",
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample-failed-old.wav`,
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: failedVoice, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        { data: createPendingVoiceRecord(), error: null },
        { data: { sample_audio_path: SAMPLE_PATH }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("百炼声音复刻服务暂时不可用。", 502),
    );

    const response = await callRoute();

    expect(response.status).toBe(502);
    expect(setup.state.removes).toContainEqual([failedVoice.sample_audio_path]);
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
  });

  it("does not remove a sample when the failed-claim delete loses ownership", async () => {
    const setup = createAdmin({
      voiceSingles: [
        { data: null, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        { data: createPendingVoiceRecord(), error: null },
        { data: null, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.createBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("百炼声音复刻服务暂时不可用。", 502),
    );

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.cleanupSample).toBeUndefined();
    expect(setup.state.removes).toHaveLength(0);
  });

  it("keeps a fresh processing lease and does not call the provider", async () => {
    const processingVoice = createVoiceRecord({
      status: "processing",
      voice_id: null,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample-active.wav`,
      updated_at: new Date().toISOString(),
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: processingVoice, error: null },
        { data: null, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.cleanupSample).toBe(true);
    expect(setup.state.updates).toHaveLength(0);
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("reclaims a stale processing lease with snapshot CAS", async () => {
    const staleVoice = createVoiceRecord({
      status: "processing",
      voice_id: null,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample-stale.wav`,
      updated_at: "2026-08-08T00:00:00.000Z",
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: staleVoice, error: null },
        { data: { family_character_id: CHARACTER_ID, status: "processing" }, error: null },
        {
          data: createPendingVoiceRecord({
            previous_ready_voice: staleVoice.previous_ready_voice,
          }),
          error: null,
        },
        {
          data: createTrackedVoiceRecord({
            previous_ready_voice: staleVoice.previous_ready_voice,
          }),
          error: null,
        },
        { data: { status: "ready" }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(setup.state.eqCalls).toContainEqual(["status", "processing"]);
    expect(setup.state.eqCalls).toContainEqual([
      "sample_audio_path",
      staleVoice.sample_audio_path,
    ]);
    expect(setup.state.eqCalls).toContainEqual([
      "updated_at",
      staleVoice.updated_at,
    ]);
    expect(setup.state.removes).toContainEqual([staleVoice.sample_audio_path]);
    expect(mocks.createBailianClonedVoice).toHaveBeenCalledTimes(1);
  });

  it("does not call the provider when a stale snapshot loses the CAS race", async () => {
    const staleVoice = createVoiceRecord({
      status: "processing",
      voice_id: null,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample-stale.wav`,
      updated_at: "2026-08-08T00:00:00.000Z",
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: staleVoice, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.cleanupSample).toBe(true);
    expect(mocks.createBailianClonedVoice).not.toHaveBeenCalled();
    expect(setup.state.removes).toContainEqual([SAMPLE_PATH]);
  });

  it("deletes active and retired provider voices before removing local state", async () => {
    const readyVoice = createVoiceRecord({
      retired_voice_ids: ["retired-voice-id"],
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: readyVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { sample_audio_path: readyVoice.sample_audio_path }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "deleted" });
    expect(mocks.deleteBailianClonedVoice).toHaveBeenNthCalledWith(
      1,
      "old-voice-id",
      { allowListAbsenceConfirmation: false },
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenNthCalledWith(
      2,
      "retired-voice-id",
      { allowListAbsenceConfirmation: false },
    );
    expect(setup.state.deletes).toBe(1);
    expect(setup.state.removes).toContainEqual([readyVoice.sample_audio_path]);
  });

  it("can revoke and remove a legacy WebM sample created before the format migration", async () => {
    const legacyPath = `${USER_ID}/${CHARACTER_ID}/legacy.webm`;
    const readyVoice = createVoiceRecord({ sample_audio_path: legacyPath });
    const setup = createAdmin({
      voiceSingles: [
        { data: readyVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(setup.state.removes).toContainEqual([legacyPath]);
  });

  it("rejects deletion of a fresh processing enrollment", async () => {
    const processingVoice = createVoiceRecord({
      status: "processing",
      voice_id: null,
      updated_at: new Date().toISOString(),
    });
    const setup = createAdmin({
      voiceSingles: [{ data: processingVoice, error: null }],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(setup.state.deletes).toBe(0);
  });

  it("reconciles a stale ambiguous create before deleting its local state", async () => {
    const providerSnapshot = ["existing-before-attempt"];
    const discoveredVoiceId = "created-after-response-loss";
    const ambiguousVoice = createPendingVoiceRecord({
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample-ambiguous.wav`,
      updated_at: "2026-08-08T00:00:00.000Z",
      provider_voice_ids_before_attempt: providerSnapshot,
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: ambiguousVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      discoveredVoiceId,
    ]);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "deleted" });
    expect(mocks.discoverBailianClonedVoiceIdsSince).toHaveBeenCalledWith(
      "sb11111111",
      providerSnapshot,
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      discoveredVoiceId,
      { allowListAbsenceConfirmation: false },
    );
    expect(setup.state.removes).toContainEqual([
      ambiguousVoice.sample_audio_path,
    ]);
    expect(setup.state.deletes).toBe(1);
  });

  it("fails closed when stale ambiguous-create discovery is unavailable during deletion", async () => {
    const ambiguousVoice = createPendingVoiceRecord({
      updated_at: "2026-08-08T00:00:00.000Z",
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    });
    const setup = createAdmin({
      voiceSingles: [{ data: ambiguousVoice, error: null }],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockRejectedValue(
      new BailianVoiceCloningError("list unavailable", 502),
    );

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(502);
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(setup.state.updates).toHaveLength(0);
    expect(setup.state.deletes).toBe(0);
    expect(setup.state.removes).toHaveLength(0);
  });

  it("turns an empty ambiguous diff into a durable deleting tombstone", async () => {
    const providerSnapshot = ["existing-before-attempt"];
    const ambiguousVoice = createPendingVoiceRecord({
      updated_at: "2026-08-08T00:00:00.000Z",
      provider_voice_ids_before_attempt: providerSnapshot,
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: ambiguousVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      status: "deleting",
      pending: true,
    });
    expect(setup.state.updates[0]).toMatchObject({ status: "deleting" });
    expect(setup.state.updates[0]).not.toHaveProperty(
      "provider_voice_ids_before_attempt",
    );
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(setup.state.deletes).toBe(0);
    expect(setup.state.removes).toHaveLength(0);
  });

  it("does not reset the observation window when an ambiguous tombstone is retried early", async () => {
    const ambiguousVoice = createPendingVoiceRecord({
      status: "deleting",
      updated_at: new Date().toISOString(),
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    });
    const setup = createAdmin({
      voiceSingles: [{ data: ambiguousVoice, error: null }],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(202);
    expect(setup.state.updates).toHaveLength(0);
    expect(setup.state.deletes).toBe(0);
    expect(setup.state.removes).toHaveLength(0);
  });

  it("finishes local deletion after an ambiguous tombstone stays absent for the grace window", async () => {
    const ambiguousVoice = createPendingVoiceRecord({
      status: "deleting",
      updated_at: "2026-08-08T00:00:00.000Z",
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: ambiguousVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "deleted" });
    expect(setup.state.updates[0]).not.toHaveProperty(
      "provider_voice_ids_before_attempt",
    );
    expect(setup.state.removes).toContainEqual([
      ambiguousVoice.sample_audio_path,
    ]);
    expect(setup.state.deletes).toBe(1);
  });

  it("does not truncate a provider deletion queue above one thousand IDs", async () => {
    const retiredVoiceIds = Array.from(
      { length: 1_001 },
      (_, index) => `retired-${index}`,
    );
    const readyVoice = createVoiceRecord({ retired_voice_ids: retiredVoiceIds });
    const setup = createAdmin({
      voiceSingles: [
        { data: readyVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "retired-1000",
      { allowListAbsenceConfirmation: false },
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledTimes(1_002);
  });

  it("keeps the deleting row when private Storage cleanup is not confirmed", async () => {
    const readyVoice = createVoiceRecord();
    const setup = createAdmin({
      removeError: { message: "storage unavailable" },
      voiceSingles: [
        { data: readyVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(502);
    expect(setup.state.deletes).toBe(0);
    expect(setup.state.updates[0]).toMatchObject({
      status: "deleting",
      retired_sample_paths: [readyVoice.sample_audio_path],
    });
  });

  it("keeps local deletion state retryable when provider revocation fails", async () => {
    const readyVoice = createVoiceRecord();
    const setup = createAdmin({
      voiceSingles: [
        { data: readyVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);
    mocks.deleteBailianClonedVoice.mockRejectedValue(
      new BailianVoiceCloningError("provider delete failed", 502),
    );

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(502);
    expect(setup.state.deletes).toBe(0);
    expect(setup.state.removes).toHaveLength(0);
    expect(setup.state.updates[0]).toMatchObject({ status: "deleting" });
  });

  it("allows list absence confirmation only on a stale deleting retry", async () => {
    const deletingVoice = createVoiceRecord({
      status: "deleting",
      updated_at: "2026-08-08T00:00:00.000Z",
    });
    const setup = createAdmin({
      voiceSingles: [
        { data: deletingVoice, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
        { data: { family_character_id: CHARACTER_ID }, error: null },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(setup.admin);

    const response = await DELETE(
      new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/voice`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: CHARACTER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "old-voice-id",
      { allowListAbsenceConfirmation: true },
    );
  });
});
