import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reclaim: vi.fn(),
  listCleanup: vi.fn(),
  acknowledge: vi.fn(),
  claim: vi.fn(),
  renew: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  getPayload: vi.fn(),
  deletePayload: vi.fn(),
  getTask: vi.fn(),
  cacheTask: vi.fn(),
  mutateTask: vi.fn(),
  executeText: vi.fn(),
  commitQuota: vi.fn(),
  refundQuota: vi.fn(),
  getStory: vi.fn(),
  executeIllustration: vi.fn(),
  markIllustrationFailed: vi.fn(),
  sweepAssets: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/lib/generation-jobs", () => ({
  reclaimExpiredGenerationJobs: mocks.reclaim,
  listGenerationJobsPendingCleanup: mocks.listCleanup,
  acknowledgeGenerationJobCleanup: mocks.acknowledge,
  claimGenerationJobs: mocks.claim,
  renewGenerationJobLease: mocks.renew,
  completeGenerationJob: mocks.complete,
  failGenerationJob: mocks.fail,
}));
vi.mock("@/lib/generation-job-payloads", () => ({
  getGenerationJobPayload: mocks.getPayload,
  deleteGenerationJobPayload: mocks.deletePayload,
  isTextGenerationJobPayload: (payload: unknown) =>
    Boolean(
      payload &&
        typeof payload === "object" &&
        "version" in payload &&
        payload.version === 1 &&
        "kind" in payload &&
        payload.kind === "text",
    ),
  isIllustrationGenerationJobPayload: (payload: unknown) =>
    Boolean(
      payload &&
        typeof payload === "object" &&
        "version" in payload &&
        payload.version === 1 &&
        "kind" in payload &&
        payload.kind === "illustration",
    ),
}));
vi.mock("@/lib/generation-quota-reservations", () => ({
  commitGenerationQuotaReservation: mocks.commitQuota,
  refundGenerationQuotaReservation: mocks.refundQuota,
}));
vi.mock("@/lib/storage", () => ({
  getCachedTextGenerationTask: mocks.getTask,
  cacheTextGenerationTask: mocks.cacheTask,
  mutateCachedTextGenerationTask: mocks.mutateTask,
  getCachedStory: mocks.getStory,
}));
vi.mock("@/lib/illustration-generation-executor", () => ({
  executeIllustrationGeneration: mocks.executeIllustration,
  markIllustrationAttemptFailed: mocks.markIllustrationFailed,
}));
vi.mock("@/lib/temporary-story-asset-store", () => ({
  sweepExpiredTemporaryStoryAssets: mocks.sweepAssets,
}));
vi.mock("@/lib/text-generation-executor", () => ({
  SAFE_TEXT_GENERATION_ERROR: "故事生成失败，请稍后再试。",
  executeTextGeneration: mocks.executeText,
}));
vi.mock("@/lib/generation-observability", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/generation-observability")
  >();
  return { ...original, logGenerationEvent: mocks.logEvent };
});

import { runGenerationWorker } from "@/lib/generation-worker";

const task = {
  taskId: "task_123456789012",
  storyId: "story-123456",
  status: "generating_text" as const,
  reviewBeforeIllustrations: true,
  createdAt: "2026-08-13T02:00:00.000Z",
  updatedAt: "2026-08-13T02:00:00.000Z",
};
const job = {
  version: 1 as const,
  jobId: "job_123456789012",
  kind: "text" as const,
  storyId: task.storyId,
  taskId: task.taskId,
  payloadRef: `payload_${"p".repeat(32)}`,
  quotaReservationId: "quota_123456789012",
  idempotencyKeyHash: "a".repeat(64),
  status: "running" as const,
  attempt: 1,
  maxAttempts: 2,
  availableAt: 1,
  createdAt: 1,
  updatedAt: 1,
  lease: { owner: "worker-1", token: "lease_12345678", expiresAt: Date.now() + 60_000 },
};
const illustrationJob = {
  ...job,
  jobId: "job_illustration_1234",
  kind: "illustration" as const,
  taskId: undefined,
  page: 1,
  generationAttemptId: "attempt_12345678",
  quotaReservationId: undefined,
};
const illustrationStory = {
  id: job.storyId,
  input: {
    childName: "童童",
    ageGroup: "4-5" as const,
    theme: "custom" as const,
    style: "watercolor" as const,
    language: "zh" as const,
  },
  coverTitle: "故事",
  pages: [
    {
      page: 1,
      zhText: "第一页",
      enText: "Page one",
      illustrationPrompt: "scene",
      imageStatus: "pending" as const,
      imageAttemptId: illustrationJob.generationAttemptId,
    },
  ],
  createdAt: "2026-08-13T02:00:00.000Z",
  status: "generating_images" as const,
  generationMode: "live" as const,
};
const illustrationPayload = {
  version: 1 as const,
  kind: "illustration" as const,
  assetPrincipals: {
    ownerPrincipal: {
      type: "anonymous" as const,
      id: `v1_${"a".repeat(64)}`,
    },
  },
};

function mockSingleClaim(
  kind: "text" | "illustration",
  claimedJob: typeof job | typeof illustrationJob,
) {
  let claimed = false;
  mocks.claim.mockImplementation(async ({ kind: requestedKind }) => {
    if (requestedKind !== kind || claimed) return [];
    claimed = true;
    return [claimedJob];
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.executeText.mockReset();
  mocks.getTask.mockReset();
  mocks.mutateTask.mockReset();
  mocks.getPayload.mockReset();
  mocks.reclaim.mockResolvedValue({ requeued: 0, dead: 0, removed: 0, transitions: {} });
  mocks.listCleanup.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  mockSingleClaim("text", job);
  mocks.getTask.mockResolvedValue(task);
  mocks.mutateTask.mockImplementation(async (_taskId, mutator) => {
    const current = await mocks.getTask(_taskId);
    if (!current) return null;
    const decision = await mutator(current);
    if (!decision) return null;
    if (!decision.nextTask) {
      return { task: current, value: decision.value, updated: false };
    }
    const nextTask = {
      ...decision.nextTask,
      revision: (current.revision || 0) + 1,
    };
    mocks.getTask.mockResolvedValue(nextTask);
    return { task: nextTask, value: decision.value, updated: true };
  });
  mocks.getPayload.mockResolvedValue({
    version: 1,
    kind: "text",
    storyInput: { childName: "童童", ageGroup: "4-5", theme: "custom", style: "watercolor", language: "zh" },
    familyCharacters: [],
    dailyLimit: 3,
    reviewBeforeIllustrations: true,
    quotaReservationId: job.quotaReservationId,
    generationPrincipalIds: [`v1_${"a".repeat(64)}`],
  });
  mocks.renew.mockResolvedValue(true);
  mocks.complete.mockResolvedValue("completed");
  mocks.fail.mockResolvedValue("requeued");
  mocks.executeText.mockResolvedValue({ outcome: "succeeded" });
  mocks.getStory.mockResolvedValue(illustrationStory);
  mocks.executeIllustration.mockResolvedValue({ outcome: "succeeded" });
  mocks.markIllustrationFailed.mockResolvedValue(true);
  mocks.commitQuota.mockResolvedValue({ outcome: "committed", changed: true });
  mocks.refundQuota.mockResolvedValue({ outcome: "refunded", changed: true });
  mocks.sweepAssets.mockResolvedValue({
    deletedExpiredAssets: 1,
    deletedOrphans: 0,
    deletedTemporaryFiles: 0,
  });
  mocks.acknowledge.mockResolvedValue(true);
  mocks.deletePayload.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("generation worker", () => {
  it("completes a claimed text job after executor success", async () => {
    const summary = await runGenerationWorker();
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(mocks.executeText).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          durableJobId: job.jobId,
          durableJobAttempt: job.attempt,
        }),
        persistTerminalFailure: false,
        publishFence: expect.any(Function),
        publishIdentity: {
          durableJobId: job.jobId,
          durableJobAttempt: job.attempt,
        },
      }),
    );
    expect(mocks.complete).toHaveBeenCalled();
  });

  it("requeues a retryable failure without refunding or failing the task", async () => {
    mocks.executeText.mockResolvedValue({ outcome: "failed", error: new Error("network") });
    const summary = await runGenerationWorker();
    expect(summary.requeued).toBe(1);
    expect(mocks.refundQuota).not.toHaveBeenCalled();
    expect(mocks.cacheTask).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("claims one job only when it is ready to execute", async () => {
    const secondJob = {
      ...job,
      jobId: "job_second_12345678",
      lease: { ...job.lease, token: "lease_87654321" },
    };
    let textClaims = 0;
    mocks.claim.mockImplementation(async ({ kind, limit }) => {
      expect(limit).toBe(1);
      if (kind !== "text") return [];
      textClaims += 1;
      return textClaims === 1 ? [job] : textClaims === 2 ? [secondJob] : [];
    });
    let firstExecutionFinished = false;
    mocks.executeText
      .mockImplementationOnce(async () => {
        expect(mocks.claim).toHaveBeenCalledTimes(1);
        firstExecutionFinished = true;
        return { outcome: "succeeded" };
      })
      .mockImplementationOnce(async () => {
        expect(firstExecutionFinished).toBe(true);
        expect(mocks.claim).toHaveBeenCalledTimes(3);
        return { outcome: "succeeded" };
      });

    const summary = await runGenerationWorker();

    expect(summary).toMatchObject({ claimed: 2, succeeded: 2 });
    expect(mocks.claim.mock.calls.every(([input]) => input.limit === 1)).toBe(
      true,
    );
  });

  it("renews the active lease while an executor is running and stops afterward", async () => {
    vi.stubEnv("GENERATION_WORKER_LEASE_MS", "3000");
    let releaseExecution!: (value: { outcome: "succeeded" }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const blockedExecution = new Promise<{ outcome: "succeeded" }>(
      (resolve) => {
        releaseExecution = resolve;
      },
    );
    mocks.executeText.mockImplementation(async () => {
      markStarted();
      return blockedExecution;
    });

    const worker = runGenerationWorker();
    await started;
    expect(mocks.renew).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.renew).toHaveBeenCalledTimes(2);

    releaseExecution({ outcome: "succeeded" });
    await worker;
    const renewalsAfterCompletion = mocks.renew.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.renew).toHaveBeenCalledTimes(renewalsAfterCompletion);
  });

  it("fails closed when a heartbeat discovers that the lease was lost", async () => {
    vi.stubEnv("GENERATION_WORKER_LEASE_MS", "3000");
    mocks.renew.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    let releaseExecution!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const continueExecution = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });
    mocks.executeText.mockImplementation(async (input) => {
      markStarted();
      await continueExecution;
      expect(await input.publishFence()).toBe(false);
      return {
        outcome: "failed" as const,
        error: Object.assign(new Error("stale lease"), {
          errorClass: "stale_result" as const,
        }),
      };
    });

    const worker = runGenerationWorker();
    await started;
    await vi.advanceTimersByTimeAsync(1_000);
    releaseExecution();

    await expect(worker).resolves.toMatchObject({ ignored: 1 });
    expect(mocks.fail).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.renew).toHaveBeenCalledTimes(2);
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "generation.worker_lease_heartbeat",
        status: "lost",
        errorClass: "stale_result",
      }),
      "warn",
    );
  });

  it("retries a transient heartbeat storage error without abandoning a current lease", async () => {
    vi.stubEnv("GENERATION_WORKER_LEASE_MS", "3000");
    mocks.renew
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(
        Object.assign(new Error("redis unavailable"), {
          errorClass: "storage_unavailable" as const,
        }),
      )
      .mockResolvedValue(true);
    let releaseExecution!: (value: { outcome: "succeeded" }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const blockedExecution = new Promise<{ outcome: "succeeded" }>(
      (resolve) => {
        releaseExecution = resolve;
      },
    );
    mocks.executeText.mockImplementation(async () => {
      markStarted();
      return blockedExecution;
    });

    const worker = runGenerationWorker();
    await started;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "generation.worker_lease_heartbeat",
        status: "failed",
        errorClass: "storage_unavailable",
      }),
      "warn",
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.renew).toHaveBeenCalledTimes(3);
    releaseExecution({ outcome: "succeeded" });

    await expect(worker).resolves.toMatchObject({ succeeded: 1 });
  });

  it("marks non-retryable executor failures dead immediately", async () => {
    mocks.executeText.mockResolvedValue({
      outcome: "failed",
      error: Object.assign(new Error("authentication failed"), {
        errorClass: "authentication" as const,
      }),
    });
    mocks.fail.mockResolvedValue("dead");

    const summary = await runGenerationWorker();

    expect(summary.dead).toBe(1);
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        errorClass: "authentication",
      }),
    );
  });

  it("uses the same terminal policy when execution throws", async () => {
    mocks.getPayload.mockRejectedValue({ errorClass: "configuration" });
    mocks.fail.mockResolvedValue("dead");

    const summary = await runGenerationWorker();

    expect(summary.dead).toBe(1);
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        errorClass: "configuration",
      }),
    );
  });

  it("idempotently cleans a terminal dead job", async () => {
    mocks.claim.mockResolvedValue([]);
    mocks.listCleanup.mockReset();
    mocks.listCleanup.mockResolvedValueOnce([{ ...job, status: "dead", lease: undefined }]).mockResolvedValueOnce([]);
    const summary = await runGenerationWorker();
    expect(summary.cleanupAcknowledged).toBe(1);
    expect(mocks.mutateTask).toHaveBeenCalledWith(
      task.taskId,
      expect.any(Function),
    );
    expect(mocks.refundQuota).toHaveBeenCalledWith({ reservationId: job.quotaReservationId });
    expect(mocks.deletePayload).toHaveBeenCalledWith(job.payloadRef);
    expect(mocks.acknowledge).toHaveBeenCalledWith(job.jobId);
  });

  it("rejects a text payload whose quota reservation is not bound to the job", async () => {
    mocks.getPayload.mockResolvedValue({
      version: 1,
      kind: "text",
      storyInput: { childName: "童童", ageGroup: "4-5", theme: "custom", style: "watercolor", language: "zh" },
      familyCharacters: [],
      dailyLimit: 3,
      reviewBeforeIllustrations: true,
      quotaReservationId: "quota_different_12345",
      generationPrincipalIds: [`v1_${"a".repeat(64)}`],
    });
    mocks.fail.mockResolvedValue("dead");

    const summary = await runGenerationWorker();

    expect(summary.dead).toBe(1);
    expect(mocks.executeText).not.toHaveBeenCalled();
    expect(mocks.mutateTask).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        errorClass: "invalid_response",
      }),
    );
  });

  it("rejects a damaged or wrong-kind text payload as invalid response", async () => {
    mocks.getPayload.mockResolvedValue({
      version: 1,
      kind: "illustration",
      assetPrincipals: illustrationPayload.assetPrincipals,
    });
    mocks.fail.mockResolvedValue("dead");

    const summary = await runGenerationWorker();

    expect(summary.dead).toBe(1);
    expect(mocks.executeText).not.toHaveBeenCalled();
    expect(mocks.mutateTask).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        errorClass: "invalid_response",
      }),
    );
  });

  it("rejects a text job whose cached task is bound to another story", async () => {
    mocks.getTask.mockResolvedValue({
      ...task,
      storyId: "story-other-123",
    });
    mocks.fail.mockResolvedValue("dead");

    const summary = await runGenerationWorker();

    expect(summary.dead).toBe(1);
    expect(mocks.executeText).not.toHaveBeenCalled();
    expect(mocks.mutateTask).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        errorClass: "invalid_response",
      }),
    );
  });

  it("does not execute an older durable text attempt after a newer claim owns the task", async () => {
    mocks.getTask.mockResolvedValue({
      ...task,
      durableJob: true,
      durableJobId: job.jobId,
      durableJobAttempt: job.attempt + 1,
    });

    const summary = await runGenerationWorker();

    expect(summary.succeeded).toBe(1);
    expect(mocks.executeText).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ resultRef: `${job.storyId}:stale` }),
    );
  });

  it("continues cleanup and claims work when one cleanup job fails", async () => {
    const poisonedCleanupJob = {
      ...job,
      jobId: "job_cleanup_bad_1234",
      status: "dead" as const,
      lease: undefined,
    };
    const healthyCleanupJob = {
      ...job,
      jobId: "job_cleanup_good_123",
      status: "dead" as const,
      lease: undefined,
      taskId: "task_other_1234567",
      payloadRef: `payload_${"q".repeat(32)}`,
    };
    mocks.listCleanup.mockReset();
    mocks.listCleanup
      .mockResolvedValueOnce([poisonedCleanupJob, healthyCleanupJob])
      .mockResolvedValueOnce([]);
    mocks.refundQuota.mockRejectedValueOnce(new Error("redis unavailable"));

    const summary = await runGenerationWorker();

    expect(summary).toMatchObject({
      cleanupFailed: 1,
      cleanupAcknowledged: 1,
      claimed: 1,
      succeeded: 1,
    });
    expect(mocks.acknowledge).not.toHaveBeenCalledWith(
      poisonedCleanupJob.jobId,
    );
    expect(mocks.acknowledge).toHaveBeenCalledWith(healthyCleanupJob.jobId);
    expect(mocks.claim).toHaveBeenCalled();
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "generation.worker_cleanup",
        status: "failed",
        errorClass: "storage_unavailable",
      }),
      "warn",
    );
  });

  it("completes a current illustration job and reports the asset sweep", async () => {
    mockSingleClaim("illustration", illustrationJob);
    mocks.getPayload.mockResolvedValue(illustrationPayload);

    const summary = await runGenerationWorker();

    expect(summary).toMatchObject({
      claimed: 1,
      succeeded: 1,
      assetSweep: { deletedExpiredAssets: 1 },
    });
    expect(mocks.executeIllustration).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        attemptId: illustrationJob.generationAttemptId,
        persistTerminalFailure: false,
        publishFence: expect.any(Function),
      }),
    );
  });

  it("requeues illustration failure and leaves terminal page state to cleanup", async () => {
    mockSingleClaim("illustration", illustrationJob);
    mocks.getPayload.mockResolvedValue(illustrationPayload);
    mocks.executeIllustration.mockResolvedValue({
      outcome: "failed",
      error: new Error("network failed"),
    });

    const summary = await runGenerationWorker();

    expect(summary.requeued).toBe(1);
    expect(mocks.markIllustrationFailed).not.toHaveBeenCalled();
  });

  it("rejects a damaged or wrong-kind illustration payload as invalid response", async () => {
    mockSingleClaim("illustration", illustrationJob);
    mocks.getPayload.mockResolvedValue({
      version: 1,
      kind: "text",
      quotaReservationId: job.quotaReservationId,
    });
    mocks.fail.mockResolvedValue("dead");

    const summary = await runGenerationWorker();

    expect(summary.dead).toBe(1);
    expect(mocks.executeIllustration).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        retryable: false,
        errorClass: "invalid_response",
      }),
    );
  });

  it("marks only the matching attempt failed when an illustration job is dead", async () => {
    mocks.claim.mockResolvedValue([]);
    mocks.listCleanup.mockReset();
    mocks.listCleanup
      .mockResolvedValueOnce([
        { ...illustrationJob, status: "dead", lease: undefined },
      ])
      .mockResolvedValueOnce([]);

    const summary = await runGenerationWorker();

    expect(summary.cleanupAcknowledged).toBe(1);
    expect(mocks.markIllustrationFailed).toHaveBeenCalledWith({
      storyId: illustrationJob.storyId,
      pageNumber: illustrationJob.page,
      attemptId: illustrationJob.generationAttemptId,
    });
    expect(mocks.deletePayload).toHaveBeenCalledWith(illustrationJob.payloadRef);
  });

  it("completes a stale illustration job without invoking the provider", async () => {
    mockSingleClaim("illustration", illustrationJob);
    mocks.getPayload.mockResolvedValue(illustrationPayload);
    mocks.getStory.mockResolvedValue({
      ...illustrationStory,
      pages: [
        {
          ...illustrationStory.pages[0],
          imageAttemptId: "newer_attempt_1234",
        },
      ],
    });

    const summary = await runGenerationWorker();

    expect(summary.succeeded).toBe(1);
    expect(mocks.executeIllustration).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ resultRef: expect.stringContaining(":stale") }),
    );
  });
});
