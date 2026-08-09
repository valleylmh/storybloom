import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteBailianClonedVoice: vi.fn(),
  discoverBailianClonedVoiceIdsSince: vi.fn(),
}));

vi.mock("@/lib/bailian-voice-cloning-server", () => ({
  deleteBailianClonedVoice: mocks.deleteBailianClonedVoice,
  discoverBailianClonedVoiceIdsSince:
    mocks.discoverBailianClonedVoiceIdsSince,
}));

import {
  ACCOUNT_DELETION_CONFIRMATION,
  CHILD_DELETION_CONFIRMATION,
  CLOUD_DELETION_CONFIRMATION,
  deleteAccountData,
  extractOwnedStoryAssetPaths,
  getAccountDeletionReportStatus,
  isMissingOptionalTableError,
  listStoragePathsRecursively,
  parseAccountDeletionRequest,
  type AccountDeletionAdminClient,
  type AccountDeletionStepReport,
} from "@/lib/account/account-deletion";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const STORY_ID = "11111111-1111-4111-8111-111111111111";
const CHARACTER_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  mocks.deleteBailianClonedVoice.mockReset();
  mocks.deleteBailianClonedVoice.mockResolvedValue({});
  mocks.discoverBailianClonedVoiceIdsSince.mockReset();
  mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);
});

describe("account deletion helpers", () => {
  it("accepts the three explicit confirmation contracts", () => {
    expect(
      parseAccountDeletionRequest({
        scope: "child",
        childId: STORY_ID,
        confirmation: CHILD_DELETION_CONFIRMATION,
      }),
    ).toEqual({
      scope: "child",
      childId: STORY_ID,
      deleteAuthUser: false,
      confirmation: CHILD_DELETION_CONFIRMATION,
    });

    expect(
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    ).toEqual({
      scope: "cloud",
      deleteAuthUser: false,
      confirmation: CLOUD_DELETION_CONFIRMATION,
    });

    expect(
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: true,
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      }),
    ).toEqual({
      scope: "cloud",
      deleteAuthUser: true,
      confirmation: ACCOUNT_DELETION_CONFIRMATION,
    });
  });

  it("rejects a destructive request whose confirmation does not match its scope", () => {
    expect(() =>
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: true,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    ).toThrow(/确认文本不匹配/);
  });

  it("keeps only manifest paths owned by the requested story", () => {
    expect(
      extractOwnedStoryAssetPaths(
        {
          pages: [
            { storagePath: `${USER_ID}/${STORY_ID}/cover.webp` },
            { storagePath: `${USER_ID}/${STORY_ID}/page-01.webp` },
            { storagePath: `${USER_ID}/another-story/page-01.webp` },
            { storagePath: "https://example.com/public.webp" },
          ],
        },
        USER_ID,
        STORY_ID,
      ),
    ).toEqual([
      `${USER_ID}/${STORY_ID}/cover.webp`,
      `${USER_ID}/${STORY_ID}/page-01.webp`,
    ]);
  });

  it("recursively lists files while excluding folder placeholders", async () => {
    const bucket = {
      list: vi.fn(async (path?: string) => {
        if (path === USER_ID) {
          return {
            data: [
              { id: null, name: STORY_ID },
              { id: "root-file", name: "root.webp", metadata: {} },
            ],
            error: null,
          };
        }
        if (path === `${USER_ID}/${STORY_ID}`) {
          return {
            data: [{ id: "page-file", name: "page-01.webp", metadata: {} }],
            error: null,
          };
        }
        return { data: [], error: null };
      }),
      remove: vi.fn(),
    };

    await expect(listStoragePathsRecursively(bucket, USER_ID)).resolves.toEqual([
      `${USER_ID}/${STORY_ID}/page-01.webp`,
      `${USER_ID}/root.webp`,
    ]);
  });

  it("marks a report partial only after at least one resource was deleted", () => {
    const failed = {
      key: "storage.story-archive",
      kind: "storage",
      status: "failed",
      discovered: 1,
      deleted: 0,
    } satisfies AccountDeletionStepReport;
    const completed = {
      key: "storage.family-photos",
      kind: "storage",
      status: "completed",
      discovered: 1,
      deleted: 1,
    } satisfies AccountDeletionStepReport;

    expect(getAccountDeletionReportStatus([failed])).toBe("failed");
    expect(getAccountDeletionReportStatus([completed, failed])).toBe("partial");
    expect(getAccountDeletionReportStatus([completed])).toBe("complete");
  });

  it("recognizes an optional voice table that is not deployed yet", () => {
    expect(
      isMissingOptionalTableError({
        code: "PGRST205",
        message:
          "Could not find the table public.family_character_voices in the schema cache",
      }),
    ).toBe(true);
  });
});

type FakeRow = Record<string, unknown>;
type FakeResult = {
  data: FakeRow[] | null;
  error: { code: string; message: string } | null;
};

class FakeQuery implements PromiseLike<FakeResult> {
  private operation: "select" | "delete" | "update" | "upsert" = "select";
  private filters: Array<(row: FakeRow) => boolean> = [];
  private selectedColumn?: string;
  private mutation?: FakeRow;

  constructor(
    private readonly table: string,
    private readonly tables: Record<string, FakeRow[]>,
    private readonly deletionLog: string[],
  ) {}

  select(column?: string) {
    this.selectedColumn = column;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  update(payload: FakeRow) {
    this.operation = "update";
    this.mutation = payload;
    return this;
  }

  upsert(payload: FakeRow) {
    this.operation = "upsert";
    this.mutation = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  async maybeSingle() {
    const result = await this.run();
    return { data: result.data?.[0] || null, error: result.error };
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private async run() {
    const source = this.tables[this.table] || [];
    let matches = source.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
    if (this.operation === "upsert" && this.mutation) {
      const existing = source.find(
        (row) => row.user_id === this.mutation?.user_id,
      );
      if (existing) Object.assign(existing, this.mutation);
      else source.push({ ...this.mutation });
      this.tables[this.table] = source;
      matches = [existing || source.at(-1)!];
    }
    if (this.operation === "update" && this.mutation) {
      matches.forEach((row) => Object.assign(row, this.mutation));
    }
    if (this.operation === "delete") {
      if (
        this.selectedColumn &&
        matches.some((row) => !((this.selectedColumn as string) in row))
      ) {
        return {
          data: null,
          error: {
            code: "42703",
            message: `column ${this.selectedColumn} does not exist`,
          },
        };
      }
      this.deletionLog.push(this.table);
      this.tables[this.table] = source.filter((row) => !matches.includes(row));
    }
    return { data: matches, error: null };
  }
}

describe("account deletion auth safety", () => {
  it("fails closed when the voice lifecycle lock migration is missing", async () => {
    const storageFrom = vi.fn();
    const client = {
      from: (table: string) => {
        if (table !== "account_voice_deletion_locks") {
          throw new Error("unexpected table access");
        }
        return {
          upsert: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: null,
                error: {
                  code: "PGRST205",
                  message:
                    "Could not find the table public.account_voice_deletion_locks in the schema cache",
                },
              }),
            }),
          }),
        };
      },
      storage: { from: storageFrom },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("failed");
    expect(report.retryable).toBe(true);
    expect(report.steps[0]?.error).toMatchObject({
      code: "account-voice-lifecycle-migration-required",
      retryable: false,
    });
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("does not delete database rows or the Auth user when Storage cleanup fails", async () => {
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_characters: [],
      shared_stories: [],
      account_settings: [{ user_id: USER_ID }],
      child_profiles: [],
      family_profiles: [{ id: STORY_ID, user_id: USER_ID }],
    };
    const deletionLog: string[] = [];
    const deleteUser = vi.fn(async () => ({ data: null, error: null }));
    const buckets = new Map<string, { list: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }>();
    const getBucket = (name: string) => {
      let bucket = buckets.get(name);
      if (!bucket) {
        bucket = {
          list: vi.fn(async (path?: string) => ({
            data:
              name === "story-archive" && path === USER_ID
                ? [{ id: "story-file", name: "cover.webp", metadata: {} }]
                : [],
            error: null,
          })),
          remove: vi.fn(async () => ({
            data: null,
            error:
              name === "story-archive"
                ? { code: "storage_unavailable", message: "storage unavailable" }
                : null,
          })),
        };
        buckets.set(name, bucket);
      }
      return bucket;
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, deletionLog),
      storage: { from: getBucket },
      auth: { admin: { deleteUser } },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: true,
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      }),
      { now: () => new Date("2026-08-09T00:00:00.000Z") },
    );

    expect(report.status).toBe("failed");
    expect(report.authUserDeleted).toBe(false);
    expect(report.steps.find((step) => step.key === "auth.user")).toMatchObject({
      status: "skipped",
      reason: "blocked_by_storage_error",
    });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(deletionLog).toEqual([]);
  });

  it("uses share_id and user_id as deletion return columns for their non-id tables", async () => {
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_characters: [],
      shared_stories: [{ share_id: "share-123456", owner_user_id: USER_ID }],
      account_settings: [{ user_id: USER_ID }],
      child_profiles: [],
      family_profiles: [],
    };
    const deletionLog: string[] = [];
    const client = {
      from: (table: string) => new FakeQuery(table, tables, deletionLog),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("complete");
    expect(report.steps.find((step) => step.key === "database.shared_stories")).toMatchObject({
      status: "completed",
      deleted: 1,
    });
    expect(report.steps.find((step) => step.key === "database.account_settings")).toMatchObject({
      status: "completed",
      deleted: 1,
    });
    expect(tables.shared_stories).toEqual([]);
    expect(tables.account_settings).toEqual([]);
    expect(tables.account_voice_deletion_locks).toEqual([]);
  });

  it("keeps the account voice lock and asks for a retry while enrollment is fresh", async () => {
    mocks.deleteBailianClonedVoice.mockReset();
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: USER_ID,
          family_character_id: CHARACTER_ID,
          sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
          voice_id: null,
          status: "processing",
          updated_at: new Date().toISOString(),
          retired_voice_ids: [],
          previous_ready_voice: null,
          retired_sample_paths: [],
        },
      ],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("failed");
    expect(
      report.steps.find(
        (step) => step.key === "provider.family-character-voices",
      ),
    ).toMatchObject({
      status: "failed",
      error: { code: "family-voice-operation-in-progress", retryable: true },
    });
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(tables.account_voice_deletion_locks).toHaveLength(1);
  });

  it("does not race a fresh explicit provider deletion during account deletion", async () => {
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: USER_ID,
          family_character_id: CHARACTER_ID,
          sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
          voice_id: "active-family-voice",
          status: "deleting",
          updated_at: new Date().toISOString(),
          retired_voice_ids: [],
          previous_ready_voice: null,
          retired_sample_paths: [],
          provider_voice_ids_before_attempt: null,
        },
      ],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("failed");
    expect(
      report.steps.find(
        (step) => step.key === "provider.family-character-voices",
      ),
    ).toMatchObject({
      status: "failed",
      error: { code: "family-voice-operation-in-progress" },
    });
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(tables.account_voice_deletion_locks).toHaveLength(1);
  });

  it("reconciles a stale ambiguous create before completing account deletion", async () => {
    const providerSnapshot = ["existing-before-attempt"];
    const discoveredVoiceId = "created-after-response-loss";
    const voiceRow = {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
      voice_id: null,
      status: "processing",
      updated_at: "2026-08-08T00:00:00.000Z",
      retired_voice_ids: [],
      previous_ready_voice: null,
      retired_sample_paths: [],
      provider_voice_ids_before_attempt: providerSnapshot,
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [voiceRow],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      discoveredVoiceId,
    ]);

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("complete");
    expect(mocks.discoverBailianClonedVoiceIdsSince).toHaveBeenCalledWith(
      "sb33333333",
      providerSnapshot,
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      discoveredVoiceId,
      { allowListAbsenceConfirmation: false },
    );
    expect(
      report.steps.find(
        (step) => step.key === "provider.family-character-voices",
      ),
    ).toMatchObject({ status: "completed", discovered: 1, deleted: 1 });
    expect(voiceRow.provider_voice_ids_before_attempt).toBeNull();
    expect(tables.family_character_voices).toEqual([]);
    expect(tables.account_voice_deletion_locks).toEqual([]);
  });

  it("fails closed and retains the account lock when ambiguous-create discovery fails", async () => {
    const voiceRow = {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
      voice_id: null,
      status: "processing",
      updated_at: "2026-08-08T00:00:00.000Z",
      retired_voice_ids: [],
      previous_ready_voice: null,
      retired_sample_paths: [],
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [voiceRow],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const storageFrom = vi.fn(() => ({
      list: vi.fn(async () => ({ data: [], error: null })),
      remove: vi.fn(async () => ({ data: null, error: null })),
    }));
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: { from: storageFrom },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;
    mocks.discoverBailianClonedVoiceIdsSince.mockRejectedValue(
      new Error("provider list unavailable"),
    );

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("failed");
    expect(
      report.steps.find(
        (step) => step.key === "provider.family-character-voices",
      ),
    ).toMatchObject({
      status: "failed",
      error: {
        code: "family-voice-ambiguous-create-reconciliation-failed",
        retryable: true,
      },
    });
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(tables.family_character_voices).toEqual([voiceRow]);
    expect(tables.account_voice_deletion_locks).toHaveLength(1);
  });

  it("persists discovered ambiguous voices before attempting provider deletion", async () => {
    const discoveredVoiceId = "created-after-response-loss";
    const voiceRow = {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
      voice_id: null,
      status: "processing",
      updated_at: "2026-08-08T00:00:00.000Z",
      retired_voice_ids: [],
      previous_ready_voice: null,
      retired_sample_paths: [],
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [voiceRow],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const storageFrom = vi.fn();
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: { from: storageFrom },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([
      discoveredVoiceId,
    ]);
    mocks.deleteBailianClonedVoice.mockRejectedValue(
      new Error("provider unavailable"),
    );

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("failed");
    expect(voiceRow).toMatchObject({
      status: "deleting",
      retired_voice_ids: [discoveredVoiceId],
      provider_voice_ids_before_attempt: null,
    });
    expect(storageFrom).not.toHaveBeenCalled();
    expect(tables.account_voice_deletion_locks).toHaveLength(1);
  });

  it("turns an empty ambiguous account diff into a retryable tombstone", async () => {
    const voiceRow = {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
      voice_id: null,
      status: "processing",
      updated_at: "2026-08-08T00:00:00.000Z",
      retired_voice_ids: [],
      previous_ready_voice: null,
      retired_sample_paths: [],
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [voiceRow],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const storageFrom = vi.fn();
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: { from: storageFrom },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("failed");
    expect(
      report.steps.find(
        (step) => step.key === "provider.family-character-voices",
      ),
    ).toMatchObject({
      status: "failed",
      error: { code: "family-voice-ambiguous-create-still-pending" },
    });
    expect(voiceRow.status).toBe("deleting");
    expect(voiceRow.provider_voice_ids_before_attempt).toEqual([
      "existing-before-attempt",
    ]);
    expect(storageFrom).not.toHaveBeenCalled();
    expect(tables.account_voice_deletion_locks).toHaveLength(1);
  });

  it("finishes account deletion after an empty ambiguous tombstone survives the grace window", async () => {
    const voiceRow = {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
      voice_id: null,
      status: "deleting",
      updated_at: "2026-08-08T00:00:00.000Z",
      retired_voice_ids: [],
      previous_ready_voice: null,
      retired_sample_paths: [],
      provider_voice_ids_before_attempt: ["existing-before-attempt"],
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [voiceRow],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;
    mocks.discoverBailianClonedVoiceIdsSince.mockResolvedValue([]);

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("complete");
    expect(tables.family_character_voices).toEqual([]);
    expect(tables.account_voice_deletion_locks).toEqual([]);
    expect(mocks.deleteBailianClonedVoice).not.toHaveBeenCalled();
  });

  it("persists each provider deletion before attempting the next voice ID", async () => {
    mocks.deleteBailianClonedVoice.mockReset();
    mocks.deleteBailianClonedVoice
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const voiceRow = {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
      voice_id: "active-family-voice",
      status: "ready",
      updated_at: "2026-08-08T00:00:00.000Z",
      retired_voice_ids: ["retired-family-voice"],
      previous_ready_voice: null,
      retired_sample_paths: [],
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [voiceRow],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("partial");
    expect(voiceRow.voice_id).toBeNull();
    expect(voiceRow.status).toBe("deleting");
    expect(voiceRow.retired_voice_ids).toEqual(["retired-family-voice"]);
    expect(tables.account_voice_deletion_locks).toHaveLength(1);
  });

  it("deletes private family voice samples before their optional metadata rows", async () => {
    mocks.deleteBailianClonedVoice.mockReset();
    mocks.deleteBailianClonedVoice.mockResolvedValue({});
    const samplePath = `${USER_ID}/${CHARACTER_ID}/sample.webm`;
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: USER_ID,
          family_character_id: CHARACTER_ID,
          sample_audio_path: samplePath,
          voice_id: "active-family-voice",
          status: "ready",
          updated_at: "2026-08-08T00:00:00.000Z",
          retired_voice_ids: ["retired-family-voice"],
          previous_ready_voice: { voice_id: "previous-family-voice" },
          retired_sample_paths: [],
        },
      ],
      family_characters: [
        {
          id: CHARACTER_ID,
          user_id: USER_ID,
          source_photo_path: null,
          canonical_photo_path: null,
        },
      ],
      shared_stories: [],
      account_settings: [{ user_id: USER_ID }],
      child_profiles: [],
      family_profiles: [],
    };
    const deletionLog: string[] = [];
    const voiceRemove = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      from: (table: string) => new FakeQuery(table, tables, deletionLog),
      storage: {
        from: (bucketName: string) => ({
          list: vi.fn(async (path?: string) => {
            if (bucketName !== "family-voice-samples") {
              return { data: [], error: null };
            }
            if (path === USER_ID) {
              return {
                data: [{ id: null, name: CHARACTER_ID, metadata: null }],
                error: null,
              };
            }
            if (path === `${USER_ID}/${CHARACTER_ID}`) {
              return {
                data: [{ id: "sample", name: "sample.webm", metadata: {} }],
                error: null,
              };
            }
            return { data: [], error: null };
          }),
          remove:
            bucketName === "family-voice-samples"
              ? voiceRemove
              : vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("complete");
    expect(
      report.steps.find(
        (step) => step.key === "provider.family-character-voices",
      ),
    ).toMatchObject({ status: "completed", discovered: 3, deleted: 3 });
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "active-family-voice",
      { allowListAbsenceConfirmation: false },
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "retired-family-voice",
      { allowListAbsenceConfirmation: false },
    );
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "previous-family-voice",
      { allowListAbsenceConfirmation: false },
    );
    expect(
      report.steps.find(
        (step) => step.key === "storage.family-voice-samples",
      ),
    ).toMatchObject({ status: "completed", discovered: 1, deleted: 1 });
    expect(
      report.steps.find(
        (step) => step.key === "database.family_character_voices",
      ),
    ).toMatchObject({ status: "completed", discovered: 1, deleted: 1 });
    expect(voiceRemove).toHaveBeenCalledWith([samplePath]);
    expect(tables.family_character_voices).toEqual([]);
    expect(
      deletionLog.indexOf("family_character_voices"),
    ).toBeLessThan(deletionLog.indexOf("family_characters"));
  });

  it("allows list absence confirmation only after an account deletion tombstone is stale", async () => {
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: USER_ID,
          family_character_id: CHARACTER_ID,
          sample_audio_path: `${USER_ID}/${CHARACTER_ID}/sample.wav`,
          voice_id: "active-family-voice",
          status: "deleting",
          updated_at: "2026-08-08T00:00:00.000Z",
          retired_voice_ids: [],
          previous_ready_voice: null,
          retired_sample_paths: [],
          provider_voice_ids_before_attempt: null,
        },
      ],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => ({ data: [], error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    const report = await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(report.status).toBe("complete");
    expect(mocks.deleteBailianClonedVoice).toHaveBeenCalledWith(
      "active-family-voice",
      { allowListAbsenceConfirmation: true },
    );
  });

  it("does not delete a voice row inserted after the account deletion snapshot", async () => {
    const lateVoiceRow = {
      id: "55555555-5555-4555-8555-555555555555",
      user_id: USER_ID,
      family_character_id: CHARACTER_ID,
      sample_audio_path: `${USER_ID}/${CHARACTER_ID}/late.wav`,
      voice_id: null,
      status: "processing",
      updated_at: new Date().toISOString(),
      retired_voice_ids: [],
      previous_ready_voice: null,
      retired_sample_paths: [],
      provider_voice_ids_before_attempt: [],
    };
    const tables: Record<string, FakeRow[]> = {
      saved_stories: [],
      growth_records: [],
      growth_record_photos: [],
      saved_story_assets: [],
      family_character_voices: [],
      family_characters: [],
      shared_stories: [],
      account_settings: [],
      child_profiles: [],
      family_profiles: [],
    };
    let inserted = false;
    const client = {
      from: (table: string) => new FakeQuery(table, tables, []),
      storage: {
        from: () => ({
          list: vi.fn(async () => {
            if (!inserted) {
              inserted = true;
              tables.family_character_voices.push(lateVoiceRow);
            }
            return { data: [], error: null };
          }),
          remove: vi.fn(async () => ({ data: null, error: null })),
        }),
      },
      auth: {
        admin: { deleteUser: vi.fn(async () => ({ data: null, error: null })) },
      },
    } as unknown as AccountDeletionAdminClient;

    await deleteAccountData(
      client,
      USER_ID,
      parseAccountDeletionRequest({
        scope: "cloud",
        deleteAuthUser: false,
        confirmation: CLOUD_DELETION_CONFIRMATION,
      }),
    );

    expect(tables.family_character_voices).toEqual([lateVoiceRow]);
  });
});
