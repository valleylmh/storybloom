import { describe, expect, it } from "vitest";
import {
  ACTIVE_GENERATION_TASK_STORAGE_KEY,
  clearActiveGenerationTask,
  clearGenerationTaskIdFromSearch,
  createActiveGenerationTask,
  getGenerationTaskIdFromSearch,
  readActiveGenerationTask,
  resolveGenerationTaskRecovery,
  setGenerationTaskIdInSearch,
  TASK_QUERY_KEY,
  writeActiveGenerationTask,
  type ClientGenerationTaskStorage,
} from "@/lib/client-generation-task";
import type { GrowthRecordDraft } from "@/lib/growth-records";

class MemoryStorage implements ClientGenerationTaskStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function createGrowthDraft(): GrowthRecordDraft {
  return {
    version: 1,
    childKey: "name:安安",
    childName: "安安",
    childAvatarDataUrl: "data:image/webp;base64,private-avatar",
    occurredOn: "2026-08-12",
    note: "第一次自己骑车。",
    idea: "安安第一次自己骑车",
    photos: [
      {
        id: "photo-1",
        name: "bike.webp",
        dataUrl: "data:image/webp;base64,private-growth-photo",
      },
    ],
    readingStage: "4-5",
    storyTreatment: "warm-imagination",
    parentFacts: "  安安独立骑了三米。  ",
    allowedImaginations: "  树叶像在鼓掌。  ",
  };
}

describe("client generation task persistence", () => {
  it("persists a validated active task and keeps private growth photos local", () => {
    const storage = new MemoryStorage();
    const growthRecordDraft = {
      ...createGrowthDraft(),
      supabaseAccessToken: "must-not-be-persisted",
    };

    const written = writeActiveGenerationTask(
      {
        taskId: "task_Abc-123",
        reviewBeforeIllustrations: true,
        growthRecordDraft,
      },
      { storage, now: "2026-08-12T10:00:00.000Z" },
    );
    const raw = storage.getItem(ACTIVE_GENERATION_TASK_STORAGE_KEY);
    const restored = readActiveGenerationTask({ storage });

    expect(written).toMatchObject({
      version: 1,
      taskId: "task_Abc-123",
      reviewBeforeIllustrations: true,
      createdAt: "2026-08-12T10:00:00.000Z",
      updatedAt: "2026-08-12T10:00:00.000Z",
    });
    expect(restored?.growthRecordDraft?.photos[0].dataUrl).toBe(
      "data:image/webp;base64,private-growth-photo",
    );
    expect(restored?.growthRecordDraft?.parentFacts).toBe(
      "安安独立骑了三米。",
    );
    expect(raw).toContain("data:image/webp;base64,private-growth-photo");
    expect(raw).not.toContain("must-not-be-persisted");
  });

  it("preserves creation time when the same task metadata is updated", () => {
    const storage = new MemoryStorage();
    writeActiveGenerationTask(
      { taskId: "same-task-123", reviewBeforeIllustrations: true },
      { storage, now: "2026-08-12T10:00:00.000Z" },
    );
    const updated = writeActiveGenerationTask(
      { taskId: "same-task-123", reviewBeforeIllustrations: false },
      { storage, now: "2026-08-12T10:05:00.000Z" },
    );

    expect(updated).toMatchObject({
      createdAt: "2026-08-12T10:00:00.000Z",
      updatedAt: "2026-08-12T10:05:00.000Z",
      reviewBeforeIllustrations: false,
    });
  });

  it("keeps anonymous tasks recoverable when no growth draft exists", () => {
    const storage = new MemoryStorage();
    const written = writeActiveGenerationTask(
      {
        taskId: "anonymous-task-123",
        reviewBeforeIllustrations: true,
        growthRecordDraft: undefined,
      },
      { storage, now: "2026-08-12T10:00:00.000Z" },
    );

    expect(written).toMatchObject({ taskId: "anonymous-task-123" });
    expect(written).not.toHaveProperty("growthRecordDraft");
    expect(readActiveGenerationTask({ storage })?.taskId).toBe(
      "anonymous-task-123",
    );
  });

  it("rejects invalid task metadata and malformed private drafts", () => {
    const valid = createActiveGenerationTask(
      { taskId: "valid-task-123", reviewBeforeIllustrations: true },
      "2026-08-12T10:00:00.000Z",
    );
    const invalidPhoto = {
      ...createGrowthDraft(),
      photos: [{ id: "photo-1", name: "bike.webp", dataUrl: "https://public/photo" }],
    };

    expect(valid?.taskId).toBe("valid-task-123");
    expect(
      createActiveGenerationTask(
        {
          taskId: "contains spaces",
          reviewBeforeIllustrations: true,
        },
        "2026-08-12T10:00:00.000Z",
      ),
    ).toBeNull();
    expect(
      createActiveGenerationTask(
        {
          taskId: "valid-task-123",
          reviewBeforeIllustrations: true,
          growthRecordDraft: invalidPhoto,
        },
        "2026-08-12T10:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("tolerates unavailable, corrupt, and quota-limited storage", () => {
    const corruptStorage = new MemoryStorage();
    corruptStorage.setItem(ACTIVE_GENERATION_TASK_STORAGE_KEY, "{not-json");
    const throwingStorage: ClientGenerationTaskStorage = {
      getItem() {
        throw new Error("storage-disabled");
      },
      setItem() {
        throw new Error("quota-exceeded");
      },
      removeItem() {
        throw new Error("storage-disabled");
      },
    };

    expect(readActiveGenerationTask({ storage: corruptStorage })).toBeNull();
    expect(readActiveGenerationTask({ storage: throwingStorage })).toBeNull();
    expect(
      writeActiveGenerationTask(
        { taskId: "valid-task-123", reviewBeforeIllustrations: true },
        { storage: throwingStorage },
      ),
    ).toBeNull();
    expect(clearActiveGenerationTask({ storage: throwingStorage })).toBe(false);
  });

  it("clears only the expected active task when requested", () => {
    const storage = new MemoryStorage();
    writeActiveGenerationTask(
      { taskId: "newer-task-123", reviewBeforeIllustrations: true },
      { storage, now: "2026-08-12T10:00:00.000Z" },
    );

    expect(
      clearActiveGenerationTask({ storage, taskId: "older-task-123" }),
    ).toBe(false);
    expect(readActiveGenerationTask({ storage })?.taskId).toBe("newer-task-123");
    expect(
      clearActiveGenerationTask({ storage, taskId: "newer-task-123" }),
    ).toBe(true);
    expect(readActiveGenerationTask({ storage })).toBeNull();
  });
});

describe("client generation task URL recovery", () => {
  it("reads, sets, and clears the task query without losing other parameters", () => {
    expect(TASK_QUERY_KEY).toBe("task");
    expect(
      getGenerationTaskIdFromSearch("/create?mode=minimal&task=task-123456789#book"),
    ).toBe("task-123456789");
    expect(
      setGenerationTaskIdInSearch("?mode=minimal", "task-123456789"),
    ).toBe("?mode=minimal&task=task-123456789");
    expect(
      clearGenerationTaskIdFromSearch("?mode=minimal&task=task-123456789"),
    ).toBe("?mode=minimal");
    expect(getGenerationTaskIdFromSearch("?task=one&task=two")).toBeNull();
  });

  it("uses the URL task first but never attaches another task's private draft", () => {
    const activeTask = createActiveGenerationTask(
      {
        taskId: "active-task-123",
        reviewBeforeIllustrations: false,
        growthRecordDraft: createGrowthDraft(),
      },
      "2026-08-12T10:00:00.000Z",
    );

    expect(
      resolveGenerationTaskRecovery("?task=url-task-12345", activeTask),
    ).toEqual({
      taskId: "url-task-12345",
      source: "url",
      reviewBeforeIllustrations: true,
      requiresServerVerification: true,
    });
    const matching = resolveGenerationTaskRecovery(
      "?task=active-task-123",
      activeTask,
    );
    expect(matching).toMatchObject({
      taskId: "active-task-123",
      source: "url",
      reviewBeforeIllustrations: false,
      requiresServerVerification: true,
    });
    expect(matching?.growthRecordDraft?.photos[0].dataUrl).toContain(
      "private-growth-photo",
    );
    expect(setGenerationTaskIdInSearch("", "active-task-123")).not.toContain(
      "data:image/",
    );
  });

  it("falls back to the active record and labels it as needing server verification", () => {
    const activeTask = createActiveGenerationTask(
      {
        taskId: "active-task-123",
        reviewBeforeIllustrations: true,
      },
      "2026-08-12T10:00:00.000Z",
    );

    expect(resolveGenerationTaskRecovery("?mode=minimal", activeTask)).toEqual({
      taskId: "active-task-123",
      source: "active-record",
      reviewBeforeIllustrations: true,
      requiresServerVerification: true,
    });
    expect(resolveGenerationTaskRecovery("", null)).toBeNull();
  });
});
