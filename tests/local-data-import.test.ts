import { describe, expect, it, vi } from "vitest";
import type { GrowthRecord } from "@/lib/growth-records";
import type {
  ChildProfile,
  ChildProfileInput,
  ChildRepository,
} from "@/lib/repositories/child-repository";
import type {
  GrowthRecordInput,
  GrowthRepository,
} from "@/lib/repositories/growth-repository";
import type {
  SavedStory,
  StoryRepository,
  StorySaveInput,
} from "@/lib/repositories/story-repository";
import {
  createLocalDataImportEngine,
  scanLocalImportCandidates,
} from "@/lib/sync/local-data-import";
import {
  createMemorySyncMetaStore,
  getSyncMetaDatabaseName,
  getSyncMetaKey,
  type SyncMeta,
  type SyncMetaStore,
} from "@/lib/sync/sync-meta";
import type { GenerateResponse } from "@/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-09T12:00:00.000Z";

function createResult(
  storyId: string,
  options: { pages?: number; complete?: boolean } = {},
): GenerateResponse {
  const pageCount = options.pages ?? 1;
  const complete = options.complete ?? true;
  return {
    storyId,
    input: {
      childName: "安安",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "第一次自己收好积木",
      style: "fairytale",
      language: "zh-en",
    },
    coverTitle: "《安安和回家的积木》",
    pages: Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      zhText: `第 ${index + 1} 页`,
      enText: `Page ${index + 1}`,
      illustrationPrompt: "A child tidies wooden blocks.",
      imageUrl: complete ? "data:image/webp;base64,scene" : undefined,
      imageStatus: complete ? ("complete" as const) : ("pending" as const),
    })),
    totalPages: pageCount,
    generationMode: "live",
    freeChanceLabel: "",
  };
}

function createSavedStory(
  storyId: string,
  options: {
    id?: string;
    pages?: number;
    complete?: boolean;
    updatedAt?: string;
  } = {},
): SavedStory {
  const result = createResult(storyId, options);
  const complete = options.complete ?? true;
  return {
    id: options.id || storyId,
    storyId,
    clientStoryId: storyId,
    result,
    status: complete ? "complete" : "generating",
    imageProgress: {
      complete: complete ? result.pages.length : 0,
      total: result.pages.length,
    },
    assetManifest: { version: 1, pages: [] },
    createdAt: "2026-08-09T09:00:00.000Z",
    updatedAt: options.updatedAt || "2026-08-09T10:00:00.000Z",
  };
}

function createGrowthRecord(
  clientRecordId = "growth-1",
  storyId = "story-1",
): GrowthRecord {
  return {
    id: clientRecordId,
    clientRecordId,
    storyId,
    childKey: "name:安安",
    childName: "安安",
    occurredOn: "2026-08-09",
    note: "他收好以后特别骄傲。",
    idea: "安安第一次自己收好积木",
    photos: [
      {
        id: "local-photo-1",
        name: "blocks.webp",
        dataUrl: "data:image/webp;base64,photo",
      },
    ],
    story: createResult(storyId),
    createdAt: "2026-08-09T09:00:00.000Z",
    updatedAt: "2026-08-09T10:30:00.000Z",
  };
}

function createStoryRepository(
  initial: SavedStory[] = [],
  options: { failSaves?: number } = {},
) {
  const records = [...initial];
  const saveInputs: StorySaveInput[] = [];
  let remainingFailures = options.failSaves || 0;
  const repository: StoryRepository = {
    async list() {
      return [...records];
    },
    async get(id) {
      return records.find((record) => record.id === id);
    },
    async save(input) {
      saveInputs.push(input);
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error("temporary-story-upload-failure");
      }
      const existing = records.find(
        (record) => record.clientStoryId === input.result.storyId,
      );
      const saved = createSavedStory(input.result.storyId, {
        id: existing?.id || input.preferredCloudId,
        pages: input.result.pages.length,
        complete: input.status === "complete",
        updatedAt: NOW,
      });
      const index = records.findIndex(
        (record) => record.clientStoryId === input.result.storyId,
      );
      if (index >= 0) records[index] = saved;
      else records.push(saved);
      return saved;
    },
    async update(id, patch) {
      const existing = records.find((record) => record.id === id);
      if (!existing) throw new Error("story-not-found");
      return this.save({
        result: patch.result || existing.result,
        status: patch.status || existing.status,
      });
    },
    async remove(id) {
      const index = records.findIndex((record) => record.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
  return { repository, records, saveInputs };
}

function createGrowthRepository(initial: GrowthRecord[] = []) {
  const records = [...initial];
  const saveInputs: GrowthRecordInput[] = [];
  const repository: GrowthRepository = {
    async list() {
      return [...records];
    },
    async getByChild(childId) {
      return records.filter((record) => record.childKey === childId);
    },
    async save(input) {
      saveInputs.push(input);
      const existing = records.find(
        (record) => record.clientRecordId === input.clientRecordId,
      );
      const saved: GrowthRecord = {
        id: existing?.id || input.preferredCloudId || "cloud-growth",
        clientRecordId: input.clientRecordId,
        storyId: input.story.storyId,
        childKey: input.childProfileId || input.draft.childKey,
        childName: input.draft.childName,
        occurredOn: input.draft.occurredOn,
        note: input.draft.note,
        idea: input.draft.idea,
        photos: input.draft.photos,
        story: input.story,
        createdAt: existing?.createdAt || NOW,
        updatedAt: NOW,
      };
      const index = records.findIndex(
        (record) => record.clientRecordId === input.clientRecordId,
      );
      if (index >= 0) records[index] = saved;
      else records.push(saved);
      return saved;
    },
    async update(id, patch) {
      const existing = records.find((record) => record.id === id);
      if (!existing) throw new Error("growth-not-found");
      Object.assign(existing, patch, { updatedAt: NOW });
      return existing;
    },
    async remove(id) {
      const index = records.findIndex((record) => record.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
  return { repository, records, saveInputs };
}

function createChildRepository() {
  const records: ChildProfile[] = [];
  const saveInputs: ChildProfileInput[] = [];
  const repository: ChildRepository = {
    async list() {
      return [...records];
    },
    async get(id) {
      return records.find((record) => record.id === id);
    },
    async save(input) {
      saveInputs.push(input);
      const existing = records.find(
        (record) => record.clientChildId === input.clientChildId,
      );
      if (existing) return existing;
      const record: ChildProfile = {
        id: input.preferredCloudId || "cloud-child",
        familyProfileId: input.familyProfileId,
        userId: USER_ID,
        clientChildId: input.clientChildId,
        displayName: input.displayName,
        primaryCharacterId: input.primaryCharacterId,
        createdAt: NOW,
        updatedAt: NOW,
      };
      records.push(record);
      return record;
    },
    async update(id, patch) {
      const existing = records.find((record) => record.id === id);
      if (!existing) throw new Error("child-not-found");
      Object.assign(existing, patch, { updatedAt: NOW });
      return existing;
    },
    async remove(id) {
      const index = records.findIndex((record) => record.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
  return { repository, records, saveInputs };
}

function trackSyncMeta(base = createMemorySyncMetaStore()) {
  const writes: SyncMeta[] = [];
  const store: SyncMetaStore = {
    list: () => base.list(),
    get: (entityType, localId) => base.get(entityType, localId),
    async put(meta) {
      writes.push({ ...meta });
      return base.put(meta);
    },
    async putMany(meta) {
      writes.push(...meta.map((record) => ({ ...record })));
      return base.putMany(meta);
    },
    remove: (entityType, localId) => base.remove(entityType, localId),
  };
  return { store, writes };
}

function createEngine(options: {
  localStories?: SavedStory[];
  localGrowth?: GrowthRecord[];
  cloudStories?: SavedStory[];
  cloudGrowth?: GrowthRecord[];
  cloudStoryFailures?: number;
  syncMeta?: SyncMetaStore;
  online?: boolean;
  recordConsent?: () => Promise<void>;
} = {}) {
  const localStories = createStoryRepository(options.localStories);
  const localGrowth = createGrowthRepository(options.localGrowth);
  const cloudStories = createStoryRepository(options.cloudStories, {
    failSaves: options.cloudStoryFailures,
  });
  const cloudGrowth = createGrowthRepository(options.cloudGrowth);
  const children = createChildRepository();
  const syncMeta = options.syncMeta || createMemorySyncMetaStore();
  const engine = createLocalDataImportEngine({
    userId: USER_ID,
    localStories: localStories.repository,
    localGrowthRecords: localGrowth.repository,
    cloudStories: cloudStories.repository,
    cloudGrowthRecords: cloudGrowth.repository,
    cloudChildren: children.repository,
    syncMeta,
    ensureFamilyProfileId: async () => "family-1",
    recordGuardianConsent: options.recordConsent,
    now: () => new Date(NOW),
    isOnline: () => options.online !== false,
    maxAttempts: 2,
  });
  return {
    engine,
    localStories,
    localGrowth,
    cloudStories,
    cloudGrowth,
    children,
    syncMeta,
  };
}

describe("local data import", () => {
  it("scans local counts without creating pending sync metadata", async () => {
    const sync = trackSyncMeta();
    const story = createSavedStory("story-1");
    const growth = createGrowthRecord();
    const localStories = createStoryRepository([story]);
    const localGrowth = createGrowthRepository([growth]);

    const snapshot = await scanLocalImportCandidates({
      localStories: localStories.repository,
      localGrowthRecords: localGrowth.repository,
      syncMeta: sync.store,
    });

    expect(snapshot).toMatchObject({
      storyCount: 1,
      growthRecordCount: 1,
      photoCount: 1,
      pendingCount: 0,
      failedCount: 0,
    });
    expect(snapshot.stories[0].syncStatus).toBeUndefined();
    expect(await sync.store.list()).toEqual([]);
    expect(sync.writes).toEqual([]);
  });

  it("imports a selected growth record with its story and stable mappings", async () => {
    const growth = createGrowthRecord();
    const sync = trackSyncMeta();
    const setup = createEngine({ localGrowth: [growth], syncMeta: sync.store });

    const result = await setup.engine.startImport({
      storyIds: [],
      growthRecordIds: [growth.clientRecordId!],
    });

    expect(result).toMatchObject({
      importedStories: 1,
      importedGrowthRecords: 1,
      importedPhotos: 1,
      failedCount: 0,
    });
    expect(setup.cloudStories.records).toHaveLength(1);
    expect(setup.cloudGrowth.records).toHaveLength(1);
    expect(setup.children.records).toHaveLength(1);
    expect(setup.cloudStories.saveInputs[0].preferredCloudId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(setup.cloudGrowth.saveInputs[0]).toMatchObject({
      clientRecordId: "growth-1",
      savedStoryId: setup.cloudStories.records[0].id,
    });
    expect(setup.cloudGrowth.saveInputs[0].draft.photos[0].id).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(sync.writes.some((record) => record.status === "pending")).toBe(true);
    expect(sync.writes.some((record) => record.status === "syncing")).toBe(true);
    expect(await sync.store.get("story", "story-1")).toMatchObject({
      status: "synced",
      cloudId: setup.cloudStories.records[0].id,
    });
    expect(await sync.store.get("growth-record", "growth-1")).toMatchObject({
      status: "synced",
      cloudId: setup.cloudGrowth.records[0].id,
    });

    const repeated = await setup.engine.startImport({
      storyIds: [],
      growthRecordIds: [growth.clientRecordId!],
    });
    expect(repeated.imported).toBe(0);
    expect(repeated.keptCloud).toBe(2);
    expect(setup.cloudStories.records).toHaveLength(1);
    expect(setup.cloudGrowth.records).toHaveLength(1);
    expect(setup.children.records).toHaveLength(1);
  });

  it("bounds retries and resumes failed work without duplicates", async () => {
    const story = createSavedStory("story-1");
    const setup = createEngine({
      localStories: [story],
      cloudStoryFailures: 2,
    });

    const failed = await setup.engine.startImport({
      storyIds: [story.clientStoryId],
      growthRecordIds: [],
    });

    expect(failed.failedCount).toBe(1);
    expect(setup.cloudStories.saveInputs).toHaveLength(2);
    expect(await setup.syncMeta.get("story", "story-1")).toMatchObject({
      status: "failed",
      error: "temporary-story-upload-failure",
    });

    const resumed = await setup.engine.resumePendingImport();
    expect(resumed.importedStories).toBe(1);
    expect(setup.cloudStories.records).toHaveLength(1);
    expect(await setup.syncMeta.get("story", "story-1")).toMatchObject({
      status: "synced",
    });
  });

  it("resumes a browser-interrupted syncing item with its preallocated id", async () => {
    const story = createSavedStory("story-1");
    const cloudId = "33333333-3333-4333-8333-333333333333";
    const sync = createMemorySyncMetaStore([
      {
        localId: "story-1",
        entityType: "story",
        cloudId,
        status: "syncing",
      },
    ]);
    const setup = createEngine({ localStories: [story], syncMeta: sync });

    const result = await setup.engine.resumePendingImport();

    expect(result.importedStories).toBe(1);
    expect(setup.cloudStories.saveInputs[0].preferredCloudId).toBe(cloudId);
    expect(setup.cloudStories.records[0].id).toBe(cloudId);
  });

  it("leaves authorized work pending while offline without cloud calls", async () => {
    const story = createSavedStory("story-1");
    const setup = createEngine({ localStories: [story], online: false });

    const result = await setup.engine.startImport({
      storyIds: [story.clientStoryId],
      growthRecordIds: [],
    });

    expect(result.pendingCount).toBe(1);
    expect(setup.cloudStories.saveInputs).toHaveLength(0);
    expect(await setup.syncMeta.get("story", "story-1")).toMatchObject({
      status: "pending",
    });
  });

  it("requires explicit guardian consent before uploading growth photos", async () => {
    const growth = createGrowthRecord();
    const recordConsent = vi.fn(async () => undefined);
    const setup = createEngine({
      localGrowth: [growth],
      recordConsent,
    });

    const blocked = await setup.engine.startImport({
      storyIds: [],
      growthRecordIds: [growth.clientRecordId!],
    });
    expect(blocked.failedCount).toBe(2);
    expect(recordConsent).not.toHaveBeenCalled();
    expect(setup.cloudStories.saveInputs).toHaveLength(0);

    const imported = await setup.engine.resumePendingImport({
      guardianConsentConfirmed: true,
    });
    expect(recordConsent).toHaveBeenCalledTimes(1);
    expect(imported.importedGrowthRecords).toBe(1);
    expect(imported.importedPhotos).toBe(1);
  });

  it("returns conflicts when both sides changed and applies an explicit choice", async () => {
    const lastSyncedAt = "2026-08-09T09:30:00.000Z";
    const local = createSavedStory("story-1", {
      updatedAt: "2026-08-09T10:00:00.000Z",
    });
    const cloud = createSavedStory("story-1", {
      id: "22222222-2222-4222-8222-222222222222",
      updatedAt: "2026-08-09T11:00:00.000Z",
    });
    const sync = createMemorySyncMetaStore([
      {
        localId: "story-1",
        entityType: "story",
        cloudId: cloud.id,
        status: "synced",
        lastSyncedAt,
      },
    ]);
    const setup = createEngine({
      localStories: [local],
      cloudStories: [cloud],
      syncMeta: sync,
    });

    const conflicted = await setup.engine.startImport({
      storyIds: [local.clientStoryId],
      growthRecordIds: [],
    });
    expect(conflicted.conflicts).toHaveLength(1);
    expect(conflicted.conflicts[0].conflictKey).toBe(
      getSyncMetaKey("story", "story-1"),
    );
    expect(setup.cloudStories.saveInputs).toHaveLength(0);

    const resolved = await setup.engine.resolveConflict(
      getSyncMetaKey("story", "story-1"),
      "keep-local",
    );
    expect(resolved.importedStories).toBe(1);
    expect(setup.cloudStories.saveInputs).toHaveLength(1);
  });

  it("never lets a generating local story overwrite a completed cloud story", async () => {
    const local = createSavedStory("story-1", {
      complete: false,
      updatedAt: "2026-08-09T11:30:00.000Z",
    });
    const cloud = createSavedStory("story-1", {
      id: "22222222-2222-4222-8222-222222222222",
      complete: true,
      updatedAt: "2026-08-09T10:00:00.000Z",
    });
    const setup = createEngine({ localStories: [local], cloudStories: [cloud] });

    const result = await setup.engine.startImport({
      storyIds: [local.clientStoryId],
      growthRecordIds: [],
      conflictResolutions: {
        [getSyncMetaKey("story", "story-1")]: "keep-local",
      },
    });

    expect(result.keptCloud).toBe(1);
    expect(setup.cloudStories.saveInputs).toHaveLength(0);
  });

  it("keeps the more complete story body for an existing client story id", async () => {
    const local = createSavedStory("story-1", {
      pages: 3,
      updatedAt: "2026-08-09T10:00:00.000Z",
    });
    const cloud = createSavedStory("story-1", {
      id: "22222222-2222-4222-8222-222222222222",
      pages: 1,
      updatedAt: "2026-08-09T11:00:00.000Z",
    });
    const setup = createEngine({ localStories: [local], cloudStories: [cloud] });

    const result = await setup.engine.startImport({
      storyIds: [local.clientStoryId],
      growthRecordIds: [],
    });

    expect(result.importedStories).toBe(1);
    expect(setup.cloudStories.saveInputs[0].result.pages).toHaveLength(3);
    expect(setup.cloudStories.records).toHaveLength(1);
  });

  it("returns a growth conflict when dates or notes changed on both sides", async () => {
    const localGrowth = createGrowthRecord("growth-1", "story-1");
    localGrowth.updatedAt = "2026-08-09T10:30:00.000Z";
    const cloudGrowth = {
      ...createGrowthRecord("growth-1", "story-1"),
      id: "44444444-4444-4444-8444-444444444444",
      note: "云端备注",
      updatedAt: "2026-08-09T11:00:00.000Z",
    };
    const cloudStory = createSavedStory("story-1", {
      id: "22222222-2222-4222-8222-222222222222",
      updatedAt: "2026-08-09T10:30:00.000Z",
    });
    const sync = createMemorySyncMetaStore([
      {
        localId: "growth-1",
        entityType: "growth-record",
        cloudId: cloudGrowth.id,
        status: "synced",
        lastSyncedAt: "2026-08-09T09:30:00.000Z",
      },
    ]);
    const setup = createEngine({
      localGrowth: [localGrowth],
      cloudStories: [cloudStory],
      cloudGrowth: [cloudGrowth],
      syncMeta: sync,
    });

    const result = await setup.engine.startImport({
      storyIds: [],
      growthRecordIds: ["growth-1"],
    });

    expect(result.conflicts).toEqual([
      expect.objectContaining({
        conflictKey: getSyncMetaKey("growth-record", "growth-1"),
        entityType: "growth-record",
      }),
    ]);
    expect(setup.cloudGrowth.saveInputs).toHaveLength(0);
  });

  it("keeps story and growth metadata separate when local ids match", async () => {
    const store = createMemorySyncMetaStore();
    await store.putMany([
      { localId: "shared", entityType: "story", status: "pending" },
      { localId: "shared", entityType: "growth-record", status: "failed" },
    ]);

    expect(await store.get("story", "shared")).toMatchObject({ status: "pending" });
    expect(await store.get("growth-record", "shared")).toMatchObject({
      status: "failed",
    });
  });

  it("uses a separate IndexedDB namespace for each signed-in user", () => {
    expect(getSyncMetaDatabaseName("user-a")).not.toBe(
      getSyncMetaDatabaseName("user-b"),
    );
    expect(getSyncMetaDatabaseName("user-a")).toContain("user-a");
  });
});
