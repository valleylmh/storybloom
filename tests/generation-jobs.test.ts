import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EnqueueGenerationJobResult,
  GenerationJob,
  GenerationJobFailureResult,
  ReclaimExpiredGenerationJobsResult,
} from "@/lib/generation-jobs";
import type { GenerationErrorClass } from "@/lib/generation-error";

const redisState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  sortedSets: new Map<string, Map<string, number>>(),
  expirations: new Map<string, number>(),
  clockMs: 0,
}));

const JOB_KEY_PREFIX = "storybloom:generation-job:v1:";
const IDEMPOTENCY_KEY_PREFIX =
  "storybloom:generation-job-idempotency:v1:";
const LEGACY_READY_KEY = "storybloom:generation-job-ready:v1";
const READY_KEYS = {
  text: "storybloom:generation-job-ready:v2:text",
  illustration: "storybloom:generation-job-ready:v2:illustration",
} as const;
const CLAIM_RETRY_SENTINEL = "__generation_job_retry__";

function removeExpiredValue(key: string) {
  const expiresAt = redisState.expirations.get(key);
  if (expiresAt === undefined || expiresAt > redisState.clockMs) return;
  redisState.values.delete(key);
  redisState.expirations.delete(key);
}

function readValue(key: string) {
  removeExpiredValue(key);
  return redisState.values.get(key);
}

function writeValue(key: string, value: unknown, ttlSeconds?: number) {
  redisState.values.set(key, structuredClone(value));
  if (ttlSeconds === undefined) redisState.expirations.delete(key);
  else redisState.expirations.set(key, redisState.clockMs + ttlSeconds * 1_000);
}

function deleteValue(key: string) {
  redisState.values.delete(key);
  redisState.expirations.delete(key);
}

function setClock(now: string | number | undefined) {
  if (now !== undefined) redisState.clockMs = Number(now);
}

function refreshIdempotencyKey(
  idempotencyPrefix: string,
  job: GenerationJob,
  ttlSeconds: number,
) {
  const key = `${idempotencyPrefix}${job.idempotencyKeyHash}`;
  const mappedJobId = readValue(key);
  if (mappedJobId === undefined || mappedJobId === job.jobId) {
    writeValue(key, job.jobId, ttlSeconds);
  }
}

function readJob(key: string) {
  const value = readValue(key);
  if (value === undefined) return null;
  return structuredClone(
    (typeof value === "string" ? JSON.parse(value) : value) as GenerationJob,
  );
}

function writeJob(key: string, job: GenerationJob, ttlSeconds?: number) {
  writeValue(key, job, ttlSeconds);
}

function getSortedSet(key: string) {
  let set = redisState.sortedSets.get(key);
  if (!set) {
    set = new Map();
    redisState.sortedSets.set(key, set);
  }
  return set;
}

function zadd(key: string, score: number, member: string) {
  getSortedSet(key).set(member, score);
}

function zrem(key: string, member: string) {
  getSortedSet(key).delete(member);
}

function byScore(key: string, maximum: number, limit: number) {
  return [...getSortedSet(key)]
    .filter(([, score]) => score <= maximum)
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([member]) => member);
}

function readyKeyForKind(kind: GenerationJob["kind"]) {
  return READY_KEYS[kind];
}

function removeFromReadyIndexes(jobId: string) {
  zrem(READY_KEYS.text, jobId);
  zrem(READY_KEYS.illustration, jobId);
  zrem(LEGACY_READY_KEY, jobId);
}

function isValidQueuedJob(job: GenerationJob | null, jobId: string) {
  return Boolean(
    job &&
      job.status === "queued" &&
      job.jobId === jobId &&
      job.version === 1 &&
      Number.isFinite(job.attempt) &&
      job.attempt >= 0 &&
      Number.isFinite(job.availableAt) &&
      job.availableAt >= 0 &&
      job.idempotencyKeyHash &&
      readyKeyForKind(job.kind),
  );
}

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    async get<T>(key: string) {
      const value = readValue(key);
      return value === undefined ? null : (structuredClone(value) as T);
    }

    async eval<TKeys extends string[], TResult>(
      script: string,
      keys: TKeys,
      args: string[],
    ): Promise<TResult> {
      if (script.includes("generation-jobs:enqueue")) {
        const job = JSON.parse(args[0]) as GenerationJob;
        setClock(job.updatedAt);
        const existingId = readValue(keys[1]);
        if (typeof existingId === "string") {
          const existing = readJob(`${args[4]}${existingId}`);
          if (existing) {
            if (existing.status === "queued") {
              removeFromReadyIndexes(existing.jobId);
              zadd(readyKeyForKind(existing.kind), existing.availableAt, existing.jobId);
            } else removeFromReadyIndexes(existing.jobId);
            return JSON.stringify({ created: false, job: existing }) as TResult;
          }
          deleteValue(keys[1]);
        }
        writeJob(keys[0], job, Number(args[3]));
        writeValue(keys[1], args[1], Number(args[3]));
        removeFromReadyIndexes(job.jobId);
        zadd(readyKeyForKind(job.kind), Number(args[2]), args[1]);
        return JSON.stringify({ created: true, job }) as TResult;
      }

      if (script.includes("generation-jobs:get-by-idempotency")) {
        const jobId = readValue(keys[0]);
        if (typeof jobId !== "string") return null as TResult;
        const job = readJob(`${args[0]}${jobId}`);
        if (
          !job ||
          job.jobId !== jobId ||
          job.idempotencyKeyHash !== args[1] ||
          job.version !== 1
        ) {
          deleteValue(keys[0]);
          return null as TResult;
        }
        return JSON.stringify(job) as TResult;
      }

      if (script.includes("generation-jobs:claim")) {
        setClock(args[1]);
        const claimFromIndex = (readyKey: string) => {
          let repaired = false;
          for (const jobId of byScore(readyKey, Number(args[1]), Number(args[7]))) {
            const jobKey = `${args[0]}${jobId}`;
            const job = readJob(jobKey);
            if (!isValidQueuedJob(job, jobId)) {
              removeFromReadyIndexes(jobId);
              repaired = true;
              continue;
            }
            const correctReadyKey = readyKeyForKind(job!.kind);
            if (correctReadyKey !== readyKey || (args[9] && job!.kind !== args[9])) {
              removeFromReadyIndexes(jobId);
              zadd(correctReadyKey, job!.availableAt, jobId);
              repaired = true;
              continue;
            }
            const claimed: GenerationJob = {
              ...job!,
              status: "running",
              attempt: job!.attempt + 1,
              updatedAt: Number(args[1]),
              lease: {
                owner: args[2],
                token: args[3],
                expiresAt: Number(args[4]),
              },
            };
            writeJob(jobKey, claimed, Number(args[5]));
            refreshIdempotencyKey(args[6], claimed, Number(args[5]));
            removeFromReadyIndexes(jobId);
            zadd(keys[3], Number(args[4]), jobId);
            return JSON.stringify(claimed);
          }
          return repaired ? CLAIM_RETRY_SENTINEL : null;
        };

        let selectedReadyKey: string | null = null;
        if (args[9]) {
          selectedReadyKey = readyKeyForKind(args[9] as GenerationJob["kind"]);
        } else {
          const textId = byScore(keys[0], Number(args[1]), 1)[0];
          const illustrationId = byScore(keys[1], Number(args[1]), 1)[0];
          if (textId && illustrationId) {
            const textScore = getSortedSet(keys[0]).get(textId)!;
            const illustrationScore = getSortedSet(keys[1]).get(illustrationId)!;
            selectedReadyKey = textScore <= illustrationScore ? keys[0] : keys[1];
          } else if (textId) selectedReadyKey = keys[0];
          else if (illustrationId) selectedReadyKey = keys[1];
        }
        if (selectedReadyKey) {
          const result = claimFromIndex(selectedReadyKey);
          if (result) return result as TResult;
        }

        let migrated = false;
        for (const jobId of byScore(keys[2], Number(args[1]), Number(args[7]))) {
          const job = readJob(`${args[0]}${jobId}`);
          removeFromReadyIndexes(jobId);
          if (isValidQueuedJob(job, jobId)) {
            zadd(readyKeyForKind(job!.kind), job!.availableAt, jobId);
          }
          migrated = true;
        }
        if (migrated) return CLAIM_RETRY_SENTINEL as TResult;
        return null as TResult;
      }

      if (script.includes("generation-jobs:renew")) {
        setClock(args[4]);
        const job = readJob(keys[0]);
        if (
          !job ||
          job.status !== "running" ||
          job.lease?.owner !== args[1] ||
          job.lease.token !== args[2] ||
          job.lease.expiresAt <= Number(args[4])
        ) {
          return 0 as TResult;
        }
        const renewed: GenerationJob = {
          ...job,
          updatedAt: Number(args[4]),
          lease: { ...job.lease, expiresAt: Number(args[3]) },
        };
        writeJob(keys[0], renewed, Number(args[5]));
        refreshIdempotencyKey(args[6], renewed, Number(args[5]));
        zadd(keys[1], renewed.lease!.expiresAt, args[0]);
        return 1 as TResult;
      }

      if (script.includes("generation-jobs:complete")) {
        setClock(args[3]);
        const job = readJob(keys[0]);
        if (
          !job ||
          job.status !== "running" ||
          job.lease?.owner !== args[1] ||
          job.lease.token !== args[2] ||
          job.lease.expiresAt <= Number(args[3])
        ) {
          return 0 as TResult;
        }
        const { lease: _lease, ...withoutLease } = job;
        const completed: GenerationJob = {
          ...withoutLease,
          status: "succeeded",
          updatedAt: Number(args[3]),
          completedAt: Number(args[3]),
          ...(args[4] ? { resultRef: args[4] } : {}),
        };
        writeJob(keys[0], completed, Number(args[5]));
        refreshIdempotencyKey(args[6], completed, Number(args[5]));
        removeFromReadyIndexes(args[0]);
        zrem(keys[4], args[0]);
        zadd(keys[5], Number(args[3]), args[0]);
        return 1 as TResult;
      }

      if (script.includes("generation-jobs:fail")) {
        setClock(args[3]);
        const job = readJob(keys[0]);
        if (
          !job ||
          job.status !== "running" ||
          job.lease?.owner !== args[1] ||
          job.lease.token !== args[2] ||
          job.lease.expiresAt <= Number(args[3])
        ) {
          return "ignored" as TResult;
        }
        const { lease: _lease, ...withoutLease } = job;
        const lastError = {
          message: "Generation job failed.",
          errorClass: args[6] as GenerationErrorClass,
          at: Number(args[3]),
        };
        removeFromReadyIndexes(args[0]);
        zrem(keys[4], args[0]);
        if (args[7] === "1" && job.attempt < job.maxAttempts) {
          const queued: GenerationJob = {
            ...withoutLease,
            status: "queued",
            availableAt: Number(args[4]),
            updatedAt: Number(args[3]),
            lastError,
          };
          writeJob(keys[0], queued, Number(args[5]));
          refreshIdempotencyKey(args[8], queued, Number(args[5]));
          zadd(readyKeyForKind(queued.kind), queued.availableAt, args[0]);
          return "requeued" as TResult;
        }
        const dead: GenerationJob = {
          ...withoutLease,
          status: "dead",
          updatedAt: Number(args[3]),
          completedAt: Number(args[3]),
          lastError,
        };
        writeJob(keys[0], dead, Number(args[5]));
        refreshIdempotencyKey(args[8], dead, Number(args[5]));
        zadd(keys[5], Number(args[3]), args[0]);
        return "dead" as TResult;
      }

      if (script.includes("generation-jobs:reclaim")) {
        setClock(args[0]);
        const result: ReclaimExpiredGenerationJobsResult = {
          requeued: 0,
          dead: 0,
          removed: 0,
          transitions: {},
        };
        for (const jobId of byScore(keys[0], Number(args[0]), Number(args[1]))) {
          const jobKey = `${args[2]}${jobId}`;
          const job = readJob(jobKey);
          if (!job) {
            zrem(keys[0], jobId);
            result.removed += 1;
            continue;
          }
          if (
            job.status !== "running" ||
            !job.lease ||
            job.lease.expiresAt > Number(args[0])
          ) {
            zrem(keys[0], jobId);
            result.removed += 1;
            continue;
          }
          const { lease: _lease, ...withoutLease } = job;
          const lastError = {
            message: "Generation job lease expired.",
            errorClass: "stale_result" as const,
            at: Number(args[0]),
          };
          zrem(keys[0], jobId);
          if (job.attempt < job.maxAttempts) {
            const queued: GenerationJob = {
              ...withoutLease,
              status: "queued",
              availableAt: Number(args[0]),
              updatedAt: Number(args[0]),
              lastError,
            };
            writeJob(jobKey, queued, Number(args[3]));
            refreshIdempotencyKey(args[4], queued, Number(args[3]));
            removeFromReadyIndexes(jobId);
            zadd(readyKeyForKind(queued.kind), queued.availableAt, jobId);
            result.requeued += 1;
            result.transitions[jobId] = {
              jobId,
              kind: queued.kind,
              storyId: queued.storyId,
              ...(queued.taskId ? { taskId: queued.taskId } : {}),
              ...(queued.payloadRef ? { payloadRef: queued.payloadRef } : {}),
              ...(queued.quotaReservationId
                ? { quotaReservationId: queued.quotaReservationId }
                : {}),
              attempt: queued.attempt,
              maxAttempts: queued.maxAttempts,
              status: "queued",
            };
          } else {
            const dead: GenerationJob = {
              ...withoutLease,
              status: "dead",
              updatedAt: Number(args[0]),
              completedAt: Number(args[0]),
              lastError,
            };
            writeJob(jobKey, dead, Number(args[3]));
            refreshIdempotencyKey(args[4], dead, Number(args[3]));
            result.dead += 1;
            result.transitions[jobId] = {
              jobId,
              kind: dead.kind,
              storyId: dead.storyId,
              ...(dead.taskId ? { taskId: dead.taskId } : {}),
              ...(dead.payloadRef ? { payloadRef: dead.payloadRef } : {}),
              ...(dead.quotaReservationId
                ? { quotaReservationId: dead.quotaReservationId }
                : {}),
              attempt: dead.attempt,
              maxAttempts: dead.maxAttempts,
              status: "dead",
            };
          }
        }
        return JSON.stringify(result) as TResult;
      }

      throw new Error("Unknown generation job script.");
    }
  },
}));

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  kvUrl: process.env.KV_REST_API_URL,
  kvToken: process.env.KV_REST_API_TOKEN,
};

function restoreEnvironmentVariable(
  key: keyof NodeJS.ProcessEnv,
  value: string | undefined,
) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function configureRedis() {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token-placeholder";
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

async function enqueueTextJob(
  overrides: Partial<Parameters<typeof import("@/lib/generation-jobs")["enqueueGenerationJob"]>[0]> = {},
) {
  const { enqueueGenerationJob } = await import("@/lib/generation-jobs");
  return enqueueGenerationJob({
    kind: "text",
    storyId: "story-01",
    taskId: "task_123456789012",
    idempotencyKey: "text:task_123456789012",
    payloadRef: "payload:text:task_123456789012",
    now: 1_000,
    ...overrides,
  });
}

beforeEach(() => {
  configureRedis();
  redisState.values.clear();
  redisState.sortedSets.clear();
  redisState.expirations.clear();
  redisState.clockMs = 0;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  restoreEnvironmentVariable("NODE_ENV", originalEnvironment.nodeEnv);
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
  vi.resetModules();
});

describe("durable generation jobs", () => {
  it("enqueues idempotently without duplicating a job", async () => {
    const [first, duplicate] = await Promise.all([
      enqueueTextJob(),
      enqueueTextJob({ now: 2_000 }),
    ]);

    expect(first.created).toBe(true);
    expect(duplicate).toMatchObject({
      created: false,
      job: { jobId: first.job.jobId, status: "queued", attempt: 0 },
    });
    expect(redisState.values.size).toBe(2);
  });

  it("reconciles an enqueue by idempotency key without retaining the raw key", async () => {
    const { getGenerationJobByIdempotencyKey } = await import(
      "@/lib/generation-jobs"
    );
    const idempotencyKey = "text:private-client-request:task_123456789012";
    const enqueued = await enqueueTextJob({ idempotencyKey });

    await expect(
      getGenerationJobByIdempotencyKey(idempotencyKey),
    ).resolves.toMatchObject({
      jobId: enqueued.job.jobId,
      status: "queued",
      idempotencyKeyHash: enqueued.job.idempotencyKeyHash,
    });
    await expect(
      getGenerationJobByIdempotencyKey("text:missing-client-request"),
    ).resolves.toBeNull();
    expect(JSON.stringify([...redisState.values])).not.toContain(idempotencyKey);
  });

  it("removes stale idempotency mappings during reconciliation", async () => {
    const { getGenerationJobByIdempotencyKey } = await import(
      "@/lib/generation-jobs"
    );
    const idempotencyKey = "text:stale-client-request";
    const enqueued = await enqueueTextJob({ idempotencyKey });
    const mappingKey = `${IDEMPOTENCY_KEY_PREFIX}${enqueued.job.idempotencyKeyHash}`;
    deleteValue(`${JOB_KEY_PREFIX}${enqueued.job.jobId}`);

    await expect(
      getGenerationJobByIdempotencyKey(idempotencyKey),
    ).resolves.toBeNull();
    expect(readValue(mappingKey)).toBeUndefined();
  });

  it("allows only one worker to claim the same queued job", async () => {
    const { claimGenerationJobs } = await import("@/lib/generation-jobs");
    const enqueued = await enqueueTextJob();
    const [workerOne, workerTwo] = await Promise.all([
      claimGenerationJobs({ workerId: "worker-one", limit: 1, leaseMs: 5_000, now: 2_000 }),
      claimGenerationJobs({ workerId: "worker-two", limit: 1, leaseMs: 5_000, now: 2_000 }),
    ]);

    expect(workerOne.length + workerTwo.length).toBe(1);
    const claimed = workerOne[0] ?? workerTwo[0];
    expect(claimed).toMatchObject({
      jobId: enqueued.job.jobId,
      status: "running",
      attempt: 1,
    });
    expect(claimed.lease.token).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
  });

  it("leaves another job kind queued for its own worker", async () => {
    const { claimGenerationJobs, enqueueGenerationJob, getGenerationJob } = await import(
      "@/lib/generation-jobs"
    );
    const illustration = await enqueueGenerationJob({
      kind: "illustration",
      storyId: "story-01",
      page: 1,
      generationAttemptId: "attempt_12345678",
      idempotencyKey: "illustration:story-01:1:attempt_12345678",
      now: 1_000,
    });

    await expect(
      claimGenerationJobs({
        workerId: "text-worker",
        kind: "text",
        limit: 1,
        leaseMs: 5_000,
        now: 2_000,
      }),
    ).resolves.toEqual([]);
    await expect(getGenerationJob(illustration.job.jobId)).resolves.toMatchObject({
      status: "queued",
      attempt: 0,
    });
  });

  it("does not starve a text job behind more than 200 legacy illustration jobs", async () => {
    const { claimGenerationJobs, enqueueGenerationJob } = await import(
      "@/lib/generation-jobs"
    );
    const illustrations = await Promise.all(
      Array.from({ length: 225 }, (_, index) =>
        enqueueGenerationJob({
          kind: "illustration",
          storyId: "story-01",
          page: (index % 8) + 1,
          generationAttemptId: `attempt_${String(index).padStart(8, "0")}`,
          idempotencyKey: `illustration:head:${index}`,
          now: 1_000,
        }),
      ),
    );
    const text = await enqueueTextJob({ now: 1_001 });
    for (const { job } of [...illustrations, text]) {
      zrem(readyKeyForKind(job.kind), job.jobId);
      zadd(LEGACY_READY_KEY, job.availableAt, job.jobId);
    }

    await expect(
      claimGenerationJobs({
        workerId: "text-worker",
        kind: "text",
        limit: 1,
        leaseMs: 5_000,
        now: 2_000,
      }),
    ).resolves.toMatchObject([
      { jobId: text.job.jobId, kind: "text", status: "running" },
    ]);
    expect(getSortedSet(READY_KEYS.illustration).size).toBe(225);
    expect(getSortedSet(LEGACY_READY_KEY).size).toBe(0);
  });

  it("migrates and claims queued jobs left in the legacy shared ready index", async () => {
    const { claimGenerationJobs } = await import("@/lib/generation-jobs");
    const enqueued = await enqueueTextJob();
    zrem(READY_KEYS.text, enqueued.job.jobId);
    zadd(LEGACY_READY_KEY, enqueued.job.availableAt, enqueued.job.jobId);

    await expect(
      claimGenerationJobs({
        workerId: "legacy-text-worker",
        kind: "text",
        limit: 1,
        leaseMs: 5_000,
        now: 2_000,
      }),
    ).resolves.toMatchObject([
      { jobId: enqueued.job.jobId, kind: "text", status: "running" },
    ]);
    expect(getSortedSet(LEGACY_READY_KEY).has(enqueued.job.jobId)).toBe(false);
    expect(getSortedSet(READY_KEYS.text).has(enqueued.job.jobId)).toBe(false);
  });

  it("cleans stale ready members without starving a valid queued job", async () => {
    const { claimGenerationJobs } = await import("@/lib/generation-jobs");
    const enqueued = await enqueueTextJob({
      availableAt: 2_000,
      now: 1_000,
    });
    for (let index = 0; index < 40; index += 1) {
      zadd(READY_KEYS.text, 1_000, `stale-${String(index).padStart(2, "0")}`);
    }

    await expect(
      claimGenerationJobs({
        workerId: "worker-cleanup",
        limit: 1,
        leaseMs: 5_000,
        now: 2_000,
      }),
    ).resolves.toMatchObject([
      { jobId: enqueued.job.jobId, status: "running", attempt: 1 },
    ]);
    expect(getSortedSet(READY_KEYS.text).size).toBe(0);
  });

  it("never claims more jobs than the requested limit", async () => {
    const { claimGenerationJobs } = await import("@/lib/generation-jobs");
    const jobs = await Promise.all(
      [1, 2, 3].map((index) =>
        enqueueTextJob({
          taskId: `task_limit_12345${index}`,
          idempotencyKey: `text:task_limit_12345${index}`,
          now: 1_000 + index,
        }),
      ),
    );

    const claimed = await claimGenerationJobs({
      workerId: "worker-limited",
      limit: 2,
      leaseMs: 5_000,
      now: 2_000,
    });

    expect(claimed).toHaveLength(2);
    expect(new Set(claimed.map((job) => job.jobId)).size).toBe(2);
    expect(
      jobs.filter(({ job }) => readJob(`${JOB_KEY_PREFIX}${job.jobId}`)?.status === "queued"),
    ).toHaveLength(1);
  });

  it("reclaims an expired lease and ignores completion from its old owner", async () => {
    const {
      claimGenerationJobs,
      completeGenerationJob,
      getGenerationJob,
      reclaimExpiredGenerationJobs,
    } = await import("@/lib/generation-jobs");
    const enqueued = await enqueueTextJob({ maxAttempts: 3 });
    const [oldClaim] = await claimGenerationJobs({
      workerId: "worker-old",
      leaseMs: 1_000,
      now: 2_000,
    });

    await expect(
      reclaimExpiredGenerationJobs({ now: 3_001 }),
    ).resolves.toMatchObject({ requeued: 1, dead: 0, removed: 0 });
    const [newClaim] = await claimGenerationJobs({
      workerId: "worker-new",
      leaseMs: 2_000,
      now: 3_001,
    });
    await expect(
      completeGenerationJob({
        jobId: enqueued.job.jobId,
        workerId: oldClaim.lease.owner,
        leaseToken: oldClaim.lease.token,
        now: 3_100,
      }),
    ).resolves.toBe("ignored");
    await expect(
      completeGenerationJob({
        jobId: enqueued.job.jobId,
        workerId: newClaim.lease.owner,
        leaseToken: newClaim.lease.token,
        resultRef: "story:story-01",
        now: 3_200,
      }),
    ).resolves.toBe("completed");
    await expect(getGenerationJob(enqueued.job.jobId)).resolves.toMatchObject({
      status: "succeeded",
      attempt: 2,
      resultRef: "story:story-01",
    });
  });

  it("requeues retryable failures until max attempts, then marks the job dead", async () => {
    const {
      claimGenerationJobs,
      failGenerationJob,
      getGenerationJob,
    } = await import("@/lib/generation-jobs");
    const enqueued = await enqueueTextJob({ maxAttempts: 2 });

    const results: GenerationJobFailureResult[] = [];
    for (const now of [2_000, 4_000]) {
      const [claim] = await claimGenerationJobs({
        workerId: `worker-${now}`,
        leaseMs: 5_000,
        now,
      });
      results.push(
        await failGenerationJob({
          jobId: enqueued.job.jobId,
          workerId: claim.lease.owner,
          leaseToken: claim.lease.token,
          retryable: true,
          retryDelayMs: 1_000,
          errorClass: "upstream_5xx",
          now,
        }),
      );
    }

    expect(results).toEqual(["requeued", "dead"]);
    await expect(getGenerationJob(enqueued.job.jobId)).resolves.toMatchObject({
      status: "dead",
      attempt: 2,
      lastError: {
        message: "Generation job failed.",
        errorClass: "upstream_5xx",
      },
    });
  });

  it("stores only a safe failure summary and normalizes invalid runtime classes", async () => {
    const {
      claimGenerationJobs,
      failGenerationJob,
      getGenerationJob,
    } = await import("@/lib/generation-jobs");
    const enqueued = await enqueueTextJob({ maxAttempts: 1 });
    const [claim] = await claimGenerationJobs({
      workerId: "worker-safe-error",
      leaseMs: 5_000,
      now: 2_000,
    });
    const maliciousInput = {
      jobId: enqueued.job.jobId,
      workerId: claim.lease.owner,
      leaseToken: claim.lease.token,
      retryable: false,
      errorClass: "https://provider.invalid?api_key=super-secret raw body",
      message: "Authorization: Bearer super-secret",
      now: 2_100,
    } as unknown as Parameters<typeof failGenerationJob>[0];

    await expect(failGenerationJob(maliciousInput)).resolves.toBe("dead");
    const stored = await getGenerationJob(enqueued.job.jobId);
    expect(stored?.lastError).toEqual({
      message: "Generation job failed.",
      errorClass: "unknown",
      at: 2_100,
    });
    expect(JSON.stringify(stored)).not.toContain("provider.invalid");
    expect(JSON.stringify(stored)).not.toContain("super-secret");
  });

  it("keeps terminal job and idempotency TTLs aligned after completion", async () => {
    const { claimGenerationJobs, completeGenerationJob } = await import(
      "@/lib/generation-jobs"
    );
    const input = {
      taskId: "task_ttl_12345678",
      idempotencyKey: "text:task_ttl_12345678",
      now: 1_000,
    };
    const enqueued = await enqueueTextJob(input);
    const [claim] = await claimGenerationJobs({
      workerId: "worker-ttl",
      leaseMs: 5_000,
      now: 2_000,
    });
    zadd(READY_KEYS.text, 2_500, claim.jobId);
    zadd(READY_KEYS.illustration, 2_500, claim.jobId);
    zadd(LEGACY_READY_KEY, 2_500, claim.jobId);

    await expect(
      completeGenerationJob({
        jobId: claim.jobId,
        workerId: claim.lease.owner,
        leaseToken: claim.lease.token,
        now: 3_000,
      }),
    ).resolves.toBe("completed");

    const jobKey = `${JOB_KEY_PREFIX}${enqueued.job.jobId}`;
    const idempotencyKey = `${IDEMPOTENCY_KEY_PREFIX}${enqueued.job.idempotencyKeyHash}`;
    expect(redisState.expirations.get(jobKey)).toBe(86_403_000);
    expect(redisState.expirations.get(idempotencyKey)).toBe(
      redisState.expirations.get(jobKey),
    );
    expect(getSortedSet(READY_KEYS.text).has(claim.jobId)).toBe(false);
    expect(getSortedSet(READY_KEYS.illustration).has(claim.jobId)).toBe(false);
    expect(getSortedSet(LEGACY_READY_KEY).has(claim.jobId)).toBe(false);

    const duplicate = await enqueueTextJob({ ...input, now: 4_000 });
    expect(duplicate).toMatchObject({
      created: false,
      job: { jobId: enqueued.job.jobId, status: "succeeded" },
    });
  });

  it("keeps terminal job and idempotency TTLs aligned after a dead failure", async () => {
    const { claimGenerationJobs, failGenerationJob } = await import(
      "@/lib/generation-jobs"
    );
    const enqueued = await enqueueTextJob({
      taskId: "task_dead_ttl_1234",
      idempotencyKey: "text:task_dead_ttl_1234",
      maxAttempts: 1,
    });
    const [claim] = await claimGenerationJobs({
      workerId: "worker-dead-ttl",
      leaseMs: 5_000,
      now: 2_000,
    });

    await expect(
      failGenerationJob({
        jobId: claim.jobId,
        workerId: claim.lease.owner,
        leaseToken: claim.lease.token,
        retryable: false,
        errorClass: "upstream_5xx",
        now: 3_000,
      }),
    ).resolves.toBe("dead");

    const jobKey = `${JOB_KEY_PREFIX}${enqueued.job.jobId}`;
    const idempotencyKey = `${IDEMPOTENCY_KEY_PREFIX}${enqueued.job.idempotencyKeyHash}`;
    expect(redisState.expirations.get(idempotencyKey)).toBe(
      redisState.expirations.get(jobKey),
    );
  });

  it("renews only the current lease", async () => {
    const { claimGenerationJobs, renewGenerationJobLease } = await import(
      "@/lib/generation-jobs"
    );
    await enqueueTextJob();
    const [claim] = await claimGenerationJobs({
      workerId: "worker-one",
      leaseMs: 2_000,
      now: 2_000,
    });

    await expect(
      renewGenerationJobLease({
        jobId: claim.jobId,
        workerId: "worker-other",
        leaseToken: claim.lease.token,
        leaseMs: 5_000,
        now: 2_500,
      }),
    ).resolves.toBe(false);
    await expect(
      renewGenerationJobLease({
        jobId: claim.jobId,
        workerId: claim.lease.owner,
        leaseToken: claim.lease.token,
        leaseMs: 5_000,
        now: 2_500,
      }),
    ).resolves.toBe(true);
  });

  it("rejects renew, complete, and fail after a lease has expired even before reclaim", async () => {
    const {
      claimGenerationJobs,
      completeGenerationJob,
      failGenerationJob,
      renewGenerationJobLease,
    } = await import("@/lib/generation-jobs");
    await enqueueTextJob();
    const [claim] = await claimGenerationJobs({
      workerId: "worker-expired",
      leaseMs: 1_000,
      now: 2_000,
    });

    await expect(
      renewGenerationJobLease({
        jobId: claim.jobId,
        workerId: claim.lease.owner,
        leaseToken: claim.lease.token,
        leaseMs: 5_000,
        now: 3_001,
      }),
    ).resolves.toBe(false);
    await expect(
      completeGenerationJob({
        jobId: claim.jobId,
        workerId: claim.lease.owner,
        leaseToken: claim.lease.token,
        now: 3_001,
      }),
    ).resolves.toBe("ignored");
    await expect(
      failGenerationJob({
        jobId: claim.jobId,
        workerId: claim.lease.owner,
        leaseToken: claim.lease.token,
        retryable: true,
        errorClass: "stale_result",
        now: 3_001,
      }),
    ).resolves.toBe("ignored");
  });

  it("uses only a local adapter outside production and rejects production without shared storage", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    let jobs = await import("@/lib/generation-jobs");
    expect(jobs.getGenerationJobCapabilities()).toEqual({
      shared: false,
      adapter: "local",
    });
    const localIdempotencyKey = "text:task_local_123456";
    const localResult: EnqueueGenerationJobResult = await jobs.enqueueGenerationJob({
      kind: "text",
      storyId: "story-local",
      taskId: "task_local_123456",
      idempotencyKey: localIdempotencyKey,
    });
    expect(localResult.created).toBe(true);
    await expect(
      jobs.getGenerationJobByIdempotencyKey(localIdempotencyKey),
    ).resolves.toMatchObject({ jobId: localResult.job.jobId, status: "queued" });
    await expect(
      jobs.getGenerationJobByIdempotencyKey("text:missing-local-request"),
    ).resolves.toBeNull();

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    jobs = await import("@/lib/generation-jobs");
    expect(jobs.getGenerationJobCapabilities()).toEqual({
      shared: false,
      adapter: "unavailable",
    });
    await expect(
      jobs.enqueueGenerationJob({
        kind: "text",
        storyId: "story-prod",
        taskId: "task_prod_123456",
        idempotencyKey: "text:task_prod_123456",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_NOT_DURABLE" });
  });
});
