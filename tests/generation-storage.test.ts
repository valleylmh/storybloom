import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TextGenerationTask } from "@/lib/text-generation-task";
import type { GeneratedStory } from "@/types";

const redisState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  failSet: false,
  casEvents: [] as Array<{
    expectedRevision: number;
    actualRevision: number;
    nextRevision: number;
    result: -1 | 0 | 1;
  }>,
  taskCasEvents: [] as Array<{
    expectedRevision: number;
    actualRevision: number;
    nextRevision: number;
    result: -1 | 0 | 1;
  }>,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    async set(
      key: string,
      value: unknown,
      options?: { nx?: boolean },
    ) {
      if (redisState.failSet) throw new Error("redis-write-failed");
      if (options?.nx && redisState.values.has(key)) return null;
      redisState.values.set(key, structuredClone(value));
      return "OK";
    }

    async get<T>(key: string) {
      const value = redisState.values.get(key);
      return value === undefined ? null : (structuredClone(value) as T);
    }

    async del(key: string) {
      return redisState.values.delete(key) ? 1 : 0;
    }

    async incr(key: string) {
      const value = Number(redisState.values.get(key) || 0) + 1;
      redisState.values.set(key, value);
      return value;
    }

    async decr(key: string) {
      const value = Number(redisState.values.get(key) || 0) - 1;
      redisState.values.set(key, value);
      return value;
    }

    async expire() {
      return 1;
    }

    async eval<TKeys extends string[], TResult>(
      script: string,
      keys: TKeys,
      args: string[],
    ): Promise<TResult> {
      if (redisState.failSet) throw new Error("redis-write-failed");

      if (script.includes("storage:text-generation-story-publish")) {
        const taskStored = redisState.values.get(keys[0]);
        if (taskStored === undefined) return null as TResult;
        const currentTask = (typeof taskStored === "string"
          ? JSON.parse(taskStored)
          : taskStored) as TextGenerationTask;
        if (
          currentTask.taskId !== args[0] ||
          currentTask.storyId !== args[1] ||
          currentTask.status !== "generating_text" ||
          currentTask.durableJobId !== args[2] ||
          currentTask.durableJobAttempt !== Number(args[3])
        ) {
          return null as TResult;
        }
        const nextStory = JSON.parse(args[4]) as GeneratedStory;
        const storedStory = redisState.values.get(keys[1]);
        const currentStory = storedStory
          ? ((typeof storedStory === "string"
              ? JSON.parse(storedStory)
              : storedStory) as GeneratedStory)
          : null;
        const revisedStory = {
          ...nextStory,
          textGenerationJobId: args[2],
          textGenerationJobAttempt: Number(args[3]),
          revision: (currentStory?.revision || 0) + 1,
          updatedAt: args[6],
        };
        redisState.values.set(keys[1], structuredClone(revisedStory));
        return JSON.stringify(revisedStory) as TResult;
      }

      if (
        script.includes("storage:text-generation-task-story-fenced-mutate")
      ) {
        const taskStored = redisState.values.get(keys[0]);
        const storyStored = redisState.values.get(keys[1]);
        if (taskStored === undefined || storyStored === undefined) {
          return 0 as TResult;
        }
        const currentTask = (typeof taskStored === "string"
          ? JSON.parse(taskStored)
          : taskStored) as TextGenerationTask;
        const currentStory = (typeof storyStored === "string"
          ? JSON.parse(storyStored)
          : storyStored) as GeneratedStory;
        const expectedRevision = Number(args[0]);
        const actualRevision = Number.isInteger(currentTask.revision)
          ? currentTask.revision!
          : 0;
        if (actualRevision !== expectedRevision) return -1 as TResult;
        if (
          currentTask.taskId !== args[3] ||
          currentTask.storyId !== args[4] ||
          currentTask.status !== "generating_text" ||
          currentTask.durableJobId !== args[5] ||
          currentTask.durableJobAttempt !== Number(args[6]) ||
          currentStory.id !== args[4] ||
          currentStory.textGenerationJobId !== args[5] ||
          currentStory.textGenerationJobAttempt !== Number(args[6])
        ) {
          return 0 as TResult;
        }
        redisState.values.set(keys[0], JSON.parse(args[1]));
        return 1 as TResult;
      }

      const key = keys[0];
      const stored = redisState.values.get(key);
      const expectedRevision = Number(args[0]);
      if (script.includes("storage:text-generation-task-mutate")) {
        const nextTask = JSON.parse(args[1]) as TextGenerationTask;
        if (stored === undefined) {
          redisState.taskCasEvents.push({
            expectedRevision,
            actualRevision: 0,
            nextRevision: nextTask.revision ?? 0,
            result: 0,
          });
          return 0 as TResult;
        }
        const currentTask = (typeof stored === "string"
          ? JSON.parse(stored)
          : stored) as TextGenerationTask;
        const actualRevision = Number.isInteger(currentTask.revision)
          ? currentTask.revision!
          : 0;
        if (actualRevision !== expectedRevision) {
          redisState.taskCasEvents.push({
            expectedRevision,
            actualRevision,
            nextRevision: nextTask.revision ?? 0,
            result: -1,
          });
          return -1 as TResult;
        }
        redisState.values.set(key, structuredClone(nextTask));
        redisState.taskCasEvents.push({
          expectedRevision,
          actualRevision,
          nextRevision: nextTask.revision ?? 0,
          result: 1,
        });
        return 1 as TResult;
      }
      const nextStory = JSON.parse(args[1]) as GeneratedStory;
      if (stored === undefined) {
        redisState.casEvents.push({
          expectedRevision,
          actualRevision: 0,
          nextRevision: nextStory.revision ?? 0,
          result: 0,
        });
        return 0 as TResult;
      }

      const current = (typeof stored === "string"
        ? JSON.parse(stored)
        : stored) as GeneratedStory;
      const actualRevision = Number.isInteger(current.revision)
        ? current.revision!
        : 0;
      if (actualRevision !== expectedRevision) {
        redisState.casEvents.push({
          expectedRevision,
          actualRevision,
          nextRevision: nextStory.revision ?? 0,
          result: -1,
        });
        return -1 as TResult;
      }

      redisState.values.set(key, structuredClone(nextStory));
      redisState.casEvents.push({
        expectedRevision,
        actualRevision,
        nextRevision: nextStory.revision ?? 0,
        result: 1,
      });
      return 1 as TResult;
    }
  },
}));

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  cacheDir: process.env.STORYBLOOM_CACHE_DIR,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  kvUrl: process.env.KV_REST_API_URL,
  kvToken: process.env.KV_REST_API_TOKEN,
};

let cacheDir = "";

function clearRedisEnvironment() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

function restoreEnvironmentVariable(
  key: keyof NodeJS.ProcessEnv,
  value: string | undefined,
) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function createStory(
  id: string,
  coverTitle = "本地故事",
): GeneratedStory {
  return {
    id,
    input: {
      childName: "童童",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "整理玩具",
      style: "watercolor",
      language: "zh-en",
    },
    pages: [
      {
        page: 1,
        zhText: "第一页",
        enText: "Page one",
        illustrationPrompt: "page one",
        imageStatus: "demo",
      },
    ],
    coverTitle,
    createdAt: new Date().toISOString(),
    status: "generating_images",
    generationMode: "live",
  };
}

function createTask(
  taskId = "task_123456789012",
  status: TextGenerationTask["status"] = "generating_text",
): TextGenerationTask {
  const now = new Date().toISOString();
  return {
    taskId,
    storyId: "story-01",
    status,
    reviewBeforeIllustrations: true,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(os.tmpdir(), "storybloom-generation-storage-"));
  process.env.STORYBLOOM_CACHE_DIR = cacheDir;
  clearRedisEnvironment();
  redisState.values.clear();
  redisState.failSet = false;
  redisState.casEvents.length = 0;
  redisState.taskCasEvents.length = 0;
  vi.resetModules();
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  restoreEnvironmentVariable("NODE_ENV", originalEnvironment.nodeEnv);
  restoreEnvironmentVariable("STORYBLOOM_CACHE_DIR", originalEnvironment.cacheDir);
  restoreEnvironmentVariable(
    "UPSTASH_REDIS_REST_URL",
    originalEnvironment.upstashUrl,
  );
  restoreEnvironmentVariable(
    "UPSTASH_REDIS_REST_TOKEN",
    originalEnvironment.upstashToken,
  );
  restoreEnvironmentVariable("KV_REST_API_URL", originalEnvironment.kvUrl);
  restoreEnvironmentVariable("KV_REST_API_TOKEN", originalEnvironment.kvToken);
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("generation storage safety and durability", () => {
  it("logs only safe metadata when disk persistence falls back to memory", async () => {
    await rm(cacheDir, { recursive: true, force: true });
    await writeFile(cacheDir, "not-a-directory", { mode: 0o600 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { cacheStory, cacheTextGenerationTask } = await import("@/lib/storage");
    const story = createStory("story-01");
    const task = createTask();

    await expect(cacheStory(story.id, story)).resolves.toBeUndefined();
    await expect(cacheTextGenerationTask(task)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith({
      operation: "storage.story_write",
      story: story.id,
      status: "memory_fallback",
      errorClass: "storage_unavailable",
    });
    expect(warn).toHaveBeenCalledWith({
      operation: "storage.text_task_write",
      task: task.taskId,
      story: task.storyId,
      status: "memory_fallback",
      errorClass: "storage_unavailable",
    });
    const serializedLogs = JSON.stringify(warn.mock.calls);
    expect(serializedLogs).not.toContain(cacheDir);
    expect(serializedLogs).not.toContain("ENOTDIR");
    expect(serializedLogs).not.toContain("not-a-directory");
  });
  it("rejects traversal, absolute paths, and encoded separators as story ids", async () => {
    const { cacheStory, getCachedStory, validateStoryId } = await import(
      "@/lib/storage"
    );

    for (const storyId of ["../outside", "/tmp/outside", "..%2Foutside", "story/child", "story\\child"]) {
      expect(() => validateStoryId(storyId)).toThrow("Invalid story id");
      await expect(cacheStory(storyId, createStory(storyId))).rejects.toThrow(
        "Invalid story id",
      );
      await expect(getCachedStory(storyId)).rejects.toThrow("Invalid story id");
    }

    await expect(access(path.join(path.dirname(cacheDir), "outside.json"))).rejects.toThrow();
  });

  it("requires shared storage when durable task creation is requested in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const {
      createTextGenerationTaskIfAbsent,
      getStorageCapabilities,
      isDurableStorageReady,
      requireDurableStorage,
    } = await import("@/lib/storage");

    expect(getStorageCapabilities()).toMatchObject({
      durability: "local-file",
      redisConfigured: false,
      shared: false,
    });
    expect(isDurableStorageReady()).toBe(false);
    expect(() => requireDurableStorage()).toThrow(
      expect.objectContaining({ code: "STORAGE_NOT_DURABLE" }),
    );
    await expect(
      createTextGenerationTaskIfAbsent(createTask(), { requireDurable: true }),
    ).rejects.toMatchObject({ code: "STORAGE_NOT_DURABLE" });
    await expect(readdir(cacheDir)).resolves.toEqual([]);
  });

  it("never combines a URL from one Redis credential family with another family token", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.KV_REST_API_TOKEN = "kv-token-placeholder";
    const { getStorageCapabilities, requireDurableStorage } = await import(
      "@/lib/storage"
    );

    expect(getStorageCapabilities()).toMatchObject({
      redisConfigured: false,
      shared: false,
      reason: "redis_configuration_incomplete",
    });
    expect(() => requireDurableStorage()).toThrow(
      /complete Upstash or KV credential pair/i,
    );
  });

  it("rejects ambiguous configuration when both Redis credential families are complete", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "upstash-token-placeholder";
    process.env.KV_REST_API_URL = "https://kv.invalid";
    process.env.KV_REST_API_TOKEN = "kv-token-placeholder";
    const { getStorageCapabilities, requireDurableStorage } = await import(
      "@/lib/storage"
    );

    expect(getStorageCapabilities()).toMatchObject({
      redisConfigured: false,
      shared: false,
      reason: "redis_configuration_incomplete",
    });
    expect(() => requireDurableStorage()).toThrow(
      /complete Upstash or KV credential pair/i,
    );
  });

  it("uses Redis as the source of truth instead of returning stale process memory", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const {
      cacheStory,
      cacheTextGenerationTask,
      getCachedStory,
      getCachedTextGenerationTask,
      getStorageCapabilities,
    } = await import("@/lib/storage");

    const firstStory = createStory("story-01", "旧标题");
    const latestStory = createStory("story-01", "另一实例的新标题");
    await cacheStory(firstStory.id, firstStory);
    redisState.values.set("story:story-01", structuredClone(latestStory));
    await expect(getCachedStory(firstStory.id)).resolves.toMatchObject({
      coverTitle: "另一实例的新标题",
    });

    const firstTask = createTask();
    const latestTask = { ...firstTask, status: "reviewing_outline" as const };
    await cacheTextGenerationTask(firstTask);
    redisState.values.set(
      `storybloom:text-generation-task:v1:${firstTask.taskId}`,
      structuredClone(latestTask),
    );
    await expect(getCachedTextGenerationTask(firstTask.taskId)).resolves.toMatchObject({
      status: "reviewing_outline",
    });
    expect(getStorageCapabilities()).toMatchObject({
      durability: "shared",
      redisConfigured: true,
      shared: true,
    });
  });

  it("does not publish failed Redis writes into process-local story or task state", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const {
      cacheStory,
      cacheTextGenerationTask,
      getCachedStory,
      getCachedTextGenerationTask,
    } = await import("@/lib/storage");

    const storedStory = createStory("story-01", "已提交");
    const rejectedStory = createStory("story-01", "未提交");
    const storedTask = createTask();
    const rejectedTask = { ...storedTask, status: "reviewing_outline" as const };
    await cacheStory(storedStory.id, storedStory);
    await cacheTextGenerationTask(storedTask);

    redisState.failSet = true;
    await expect(cacheStory(rejectedStory.id, rejectedStory)).rejects.toThrow(
      "redis-write-failed",
    );
    await expect(cacheTextGenerationTask(rejectedTask)).rejects.toThrow(
      "redis-write-failed",
    );
    redisState.failSet = false;

    await expect(getCachedStory(storedStory.id)).resolves.toMatchObject({
      coverTitle: "已提交",
    });
    await expect(getCachedTextGenerationTask(storedTask.taskId)).resolves.toMatchObject({
      status: "generating_text",
    });
  });

  it("warns on large Story payloads and rejects an oversized Redis CAS before sending it", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const {
      cacheStory,
      getCachedStory,
      mutateCachedStory,
    } = await import("@/lib/storage");
    const story = createStory("story-large-payload");
    const largeImageUrl = `data:image/png;base64,${Buffer.alloc(
      3 * 1024 * 1024,
    ).toString("base64")}`;
    const largeStory = {
      ...story,
      pages: [{ ...story.pages[0], imageUrl: largeImageUrl }],
    };

    await expect(cacheStory(story.id, largeStory)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "storage.story_payload",
        story: story.id,
        status: "large_payload",
        payloadBytes: expect.any(Number),
        payloadLimitBytes: 8 * 1024 * 1024,
      }),
    );

    const oversizedImageUrl = `data:image/png;base64,${Buffer.alloc(
      6 * 1024 * 1024,
    ).toString("base64")}`;
    await expect(
      mutateCachedStory(story.id, (current) => ({
        nextStory: {
          ...current,
          pages: [{ ...current.pages[0], imageUrl: oversizedImageUrl }],
        },
        value: true,
      })),
    ).rejects.toMatchObject({
      code: "REDIS_PAYLOAD_TOO_LARGE",
      errorClass: "storage_unavailable",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "storage.story_payload",
        story: story.id,
        status: "rejected_too_large",
        payloadBytes: expect.any(Number),
        payloadLimitBytes: 8 * 1024 * 1024,
        errorClass: "storage_unavailable",
      }),
    );
    await expect(getCachedStory(story.id)).resolves.toMatchObject({
      pages: [expect.objectContaining({ imageUrl: largeImageUrl })],
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("data:image");
  });

  it("rejects oversized character references before writing their Base64 to Redis", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { cacheCharacterReference } = await import("@/lib/storage");

    await expect(
      cacheCharacterReference({
        bytes: Buffer.alloc(6 * 1024 * 1024),
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({
      code: "REDIS_PAYLOAD_TOO_LARGE",
      errorClass: "storage_unavailable",
    });
    expect(
      [...redisState.values.keys()].some((key) =>
        key.startsWith("storybloom:character-reference:v1:"),
      ),
    ).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "storage.character_reference_payload",
        status: "rejected_too_large",
        payloadLimitBytes: 8 * 1024 * 1024,
      }),
    );
  });

  it("restores serialized character references from shared Redis", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const {
      cacheCharacterReference,
      getCachedCharacterReferenceDataUri,
    } = await import("@/lib/storage");

    const token = await cacheCharacterReference({
      bytes: Buffer.from("shared-reference"),
      contentType: "image/webp",
    });

    expect(
      redisState.values.get(`storybloom:character-reference:v1:${token}`),
    ).toEqual(expect.any(String));
    await expect(getCachedCharacterReferenceDataUri(token)).resolves.toBe(
      `data:image/webp;base64,${Buffer.from("shared-reference").toString("base64")}`,
    );
  });

  it("retries Redis CAS conflicts so concurrent page mutations are both preserved with monotonic revisions", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const { cacheStory, getCachedStory, mutateCachedStory } = await import(
      "@/lib/storage"
    );
    const pageOne = createStory("story-cas").pages[0];
    const initialStory: GeneratedStory = {
      ...createStory("story-cas"),
      pages: [
        pageOne,
        {
          ...pageOne,
          page: 2,
          zhText: "第二页",
          enText: "Page two",
          illustrationPrompt: "page two",
        },
      ],
    };
    await cacheStory(initialStory.id, initialStory);

    let firstReads = 0;
    let releaseFirstReads!: () => void;
    const bothReadRevisionZero = new Promise<void>((resolve) => {
      releaseFirstReads = resolve;
    });
    const mutationCalls = new Map<number, number>();

    const completePage = (pageNumber: number) =>
      mutateCachedStory(initialStory.id, async (story) => {
        const call = (mutationCalls.get(pageNumber) ?? 0) + 1;
        mutationCalls.set(pageNumber, call);
        if (call === 1) {
          firstReads += 1;
          if (firstReads === 2) releaseFirstReads();
          await bothReadRevisionZero;
        }

        return {
          nextStory: {
            ...story,
            pages: story.pages.map((page) =>
              page.page === pageNumber
                ? {
                    ...page,
                    imageStatus: "complete" as const,
                    imageUrl: `/generated/page-${pageNumber}.webp`,
                  }
                : page,
            ),
          },
          value: pageNumber,
        };
      });

    const outcomes = await Promise.all([completePage(1), completePage(2)]);
    const finalStory = await getCachedStory(initialStory.id);

    expect(outcomes).toEqual([
      expect.objectContaining({ value: 1, updated: true }),
      expect.objectContaining({ value: 2, updated: true }),
    ]);
    expect(finalStory?.pages).toEqual([
      expect.objectContaining({
        page: 1,
        imageStatus: "complete",
        imageUrl: "/generated/page-1.webp",
      }),
      expect.objectContaining({
        page: 2,
        imageStatus: "complete",
        imageUrl: "/generated/page-2.webp",
      }),
    ]);
    expect(finalStory?.revision).toBe(2);
    expect(redisState.casEvents.filter((event) => event.result === -1)).toEqual([
      expect.objectContaining({ expectedRevision: 0, actualRevision: 1 }),
    ]);
    expect(
      redisState.casEvents
        .filter((event) => event.result === 1)
        .map((event) => ({
          expectedRevision: event.expectedRevision,
          nextRevision: event.nextRevision,
        })),
    ).toEqual([
      { expectedRevision: 0, nextRevision: 1 },
      { expectedRevision: 1, nextRevision: 2 },
    ]);
    expect([...mutationCalls.values()].sort()).toEqual([1, 2]);
  });

  it("atomically advances a durable text task attempt and rejects an older task CAS", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const {
      cacheTextGenerationTask,
      getCachedTextGenerationTask,
      mutateCachedTextGenerationTask,
    } = await import("@/lib/storage");
    const initialTask = {
      ...createTask(),
      durableJob: true,
      durableJobId: "job_123456789012",
    };
    await cacheTextGenerationTask(initialTask);

    const firstAttempt = await mutateCachedTextGenerationTask(
      initialTask.taskId,
      (current) => ({
        nextTask: { ...current, durableJobAttempt: 1 },
        value: 1,
      }),
    );
    const secondAttempt = await mutateCachedTextGenerationTask(
      initialTask.taskId,
      (current) => ({
        nextTask: { ...current, durableJobAttempt: 2 },
        value: 2,
      }),
    );
    const staleAttempt = await mutateCachedTextGenerationTask(
      initialTask.taskId,
      (current) =>
        current.durableJobAttempt === 1
          ? {
              nextTask: { ...current, status: "failed" as const },
              value: true,
            }
          : null,
    );

    expect(firstAttempt).toMatchObject({ value: 1, updated: true });
    expect(secondAttempt).toMatchObject({ value: 2, updated: true });
    expect(staleAttempt).toBeNull();
    await expect(
      getCachedTextGenerationTask(initialTask.taskId),
    ).resolves.toMatchObject({
      status: "generating_text",
      durableJobAttempt: 2,
      revision: 2,
    });
    expect(redisState.taskCasEvents.map((event) => event.result)).toEqual([
      1,
      1,
    ]);
  });

  it("publishes a Story only for the task's current durable attempt", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const {
      cacheTextGenerationTask,
      getCachedStory,
      mutateCachedTextGenerationTask,
      publishTextGenerationStory,
    } = await import("@/lib/storage");
    const durableJobId = "job_123456789012";
    const initialTask = {
      ...createTask(),
      durableJob: true,
      durableJobId,
      durableJobAttempt: 1,
    };
    await cacheTextGenerationTask(initialTask);
    const firstStory = createStory(initialTask.storyId, "第一次生成");

    await expect(
      publishTextGenerationStory({
        taskId: initialTask.taskId,
        storyId: initialTask.storyId,
        durableJobId,
        durableJobAttempt: 1,
        story: firstStory,
      }),
    ).resolves.toMatchObject({
      coverTitle: "第一次生成",
      textGenerationJobAttempt: 1,
      revision: 1,
    });

    await mutateCachedTextGenerationTask(initialTask.taskId, (current) => ({
      nextTask: { ...current, durableJobAttempt: 2 },
      value: true,
    }));
    await expect(
      publishTextGenerationStory({
        taskId: initialTask.taskId,
        storyId: initialTask.storyId,
        durableJobId,
        durableJobAttempt: 1,
        story: createStory(initialTask.storyId, "旧 worker 覆盖"),
      }),
    ).resolves.toBeNull();
    await expect(getCachedStory(initialTask.storyId)).resolves.toMatchObject({
      coverTitle: "第一次生成",
      textGenerationJobAttempt: 1,
    });
  });

  it("publishes a task result only when Story and task share the same durable attempt", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-placeholder";
    const {
      cacheStory,
      cacheTextGenerationTask,
      getCachedTextGenerationTask,
      mutateCachedTextGenerationTask,
    } = await import("@/lib/storage");
    const durableJobId = "job_123456789012";
    const currentTask = {
      ...createTask(),
      durableJob: true,
      durableJobId,
      durableJobAttempt: 2,
    };
    await cacheTextGenerationTask(currentTask);
    await cacheStory(currentTask.storyId, {
      ...createStory(currentTask.storyId),
      textGenerationJobId: durableJobId,
      textGenerationJobAttempt: 1,
    });

    const rejected = await mutateCachedTextGenerationTask(
      currentTask.taskId,
      (task) => ({
        nextTask: { ...task, status: "reviewing_outline" },
        value: true,
      }),
      {
        publishStoryFence: {
          storyId: currentTask.storyId,
          durableJobId,
          durableJobAttempt: 2,
        },
      },
    );

    expect(rejected).toBeNull();
    await expect(
      getCachedTextGenerationTask(currentTask.taskId),
    ).resolves.toMatchObject({
      status: "generating_text",
      durableJobAttempt: 2,
    });
  });

  it("persists private atomic files and restores them after a module reload", async () => {
    const firstModule = await import("@/lib/storage");
    const story = createStory("story-01");
    const task = createTask();
    await firstModule.cacheStory(story.id, story);
    await firstModule.cacheTextGenerationTask(task);

    const storyPath = path.join(cacheDir, "story-01.json");
    const taskDirectory = path.join(cacheDir, "text-generation-tasks");
    const taskPath = path.join(taskDirectory, `${task.taskId}.json`);
    expect((await stat(cacheDir)).mode & 0o777).toBe(0o700);
    expect((await stat(taskDirectory)).mode & 0o777).toBe(0o700);
    expect((await stat(storyPath)).mode & 0o777).toBe(0o600);
    expect((await stat(taskPath)).mode & 0o777).toBe(0o600);
    expect((await readdir(cacheDir)).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect((await readdir(taskDirectory)).some((name) => name.endsWith(".tmp"))).toBe(false);

    vi.resetModules();
    const reloadedModule = await import("@/lib/storage");
    await expect(reloadedModule.getCachedStory(story.id)).resolves.toMatchObject({
      id: story.id,
    });
    await expect(
      reloadedModule.getCachedTextGenerationTask(task.taskId),
    ).resolves.toMatchObject({ taskId: task.taskId });
  });

  it("removes expired story and task files without deleting unexpired cache entries", async () => {
    const storyDirectory = cacheDir;
    const taskDirectory = path.join(cacheDir, "text-generation-tasks");
    await mkdir(taskDirectory, { recursive: true });
    await chmod(cacheDir, 0o700);
    await chmod(taskDirectory, 0o700);

    const expiredStory = createStory("expired-story");
    const liveStory = createStory("live-story");
    const expiredTask = createTask("expired_task_123456");
    const liveTask = createTask("live_task_123456789");
    await writeFile(
      path.join(storyDirectory, "expired-story.json"),
      JSON.stringify(expiredStory),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(storyDirectory, "live-story.json"),
      JSON.stringify(liveStory),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(taskDirectory, `${expiredTask.taskId}.json`),
      JSON.stringify(expiredTask),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(taskDirectory, `${liveTask.taskId}.json`),
      JSON.stringify(liveTask),
      { mode: 0o600 },
    );
    const expiredAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await utimes(path.join(storyDirectory, "expired-story.json"), expiredAt, expiredAt);
    await utimes(
      path.join(taskDirectory, `${expiredTask.taskId}.json`),
      expiredAt,
      expiredAt,
    );

    const storage = await import("@/lib/storage");
    await expect(storage.getCachedStory(expiredStory.id)).resolves.toBeNull();
    await expect(
      storage.getCachedTextGenerationTask(expiredTask.taskId),
    ).resolves.toBeNull();
    await expect(storage.getCachedStory(liveStory.id)).resolves.toMatchObject({
      id: liveStory.id,
    });
    await expect(
      storage.getCachedTextGenerationTask(liveTask.taskId),
    ).resolves.toMatchObject({ taskId: liveTask.taskId });
    await expect(access(path.join(storyDirectory, "expired-story.json"))).rejects.toThrow();
    await expect(
      access(path.join(taskDirectory, `${expiredTask.taskId}.json`)),
    ).rejects.toThrow();
    await expect(readFile(path.join(storyDirectory, "live-story.json"), "utf8")).resolves.toContain(
      "live-story",
    );
  });
});
