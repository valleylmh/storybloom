import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  CHILD_DELETION_CONFIRMATION,
  CLOUD_DELETION_CONFIRMATION,
  deleteAccountData,
  extractOwnedStoryAssetPaths,
  getAccountDeletionReportStatus,
  listStoragePathsRecursively,
  parseAccountDeletionRequest,
  type AccountDeletionAdminClient,
  type AccountDeletionStepReport,
} from "@/lib/account/account-deletion";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const STORY_ID = "11111111-1111-4111-8111-111111111111";

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
});

type FakeRow = Record<string, unknown>;
type FakeResult = {
  data: FakeRow[] | null;
  error: { code: string; message: string } | null;
};

class FakeQuery implements PromiseLike<FakeResult> {
  private operation: "select" | "delete" = "select";
  private filters: Array<(row: FakeRow) => boolean> = [];
  private selectedColumn?: string;

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
    const matches = source.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
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
  });
});
