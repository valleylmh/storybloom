import "server-only";

import crypto from "node:crypto";
import {
  acknowledgeGenerationJobCleanup,
  claimGenerationJobs,
  completeGenerationJob,
  failGenerationJob,
  listGenerationJobsPendingCleanup,
  reclaimExpiredGenerationJobs,
  renewGenerationJobLease,
  type ClaimedGenerationJob,
  type GenerationJob,
  type GenerationJobFailureResult,
  type GenerationJobKind,
} from "@/lib/generation-jobs";
import {
  deleteGenerationJobPayload,
  getGenerationJobPayload,
  isIllustrationGenerationJobPayload,
  isTextGenerationJobPayload,
} from "@/lib/generation-job-payloads";
import { getGenerationWorkerConfiguration } from "@/lib/generation-job-config";
import {
  commitGenerationQuotaReservation,
  refundGenerationQuotaReservation,
} from "@/lib/generation-quota-reservations";
import {
  classifyGenerationError,
  getGenerationErrorDisposition,
  logGenerationEvent,
} from "@/lib/generation-observability";
import {
  getCachedStory,
  getCachedTextGenerationTask,
  mutateCachedTextGenerationTask,
} from "@/lib/storage";
import {
  executeIllustrationGeneration,
  markIllustrationAttemptFailed,
} from "@/lib/illustration-generation-executor";
import {
  getFreeRegenerationFallbackProviders,
} from "@/lib/illustration-regeneration-policy";
import {
  sweepExpiredTemporaryStoryAssets,
  type TemporaryStoryAssetSweepResult,
} from "@/lib/temporary-story-asset-store";
import {
  SAFE_TEXT_GENERATION_ERROR,
  executeTextGeneration,
} from "@/lib/text-generation-executor";

export type GenerationWorkerSummary = {
  reclaimed: { requeued: number; dead: number; removed: number };
  assetSweep: TemporaryStoryAssetSweepResult | null;
  claimed: number;
  succeeded: number;
  requeued: number;
  dead: number;
  ignored: number;
  cleanupAcknowledged: number;
  cleanupFailed: number;
};

const MIN_LEASE_HEARTBEAT_INTERVAL_MS = 250;
const MAX_LEASE_HEARTBEAT_INTERVAL_MS = 60_000;

type LeaseHeartbeatExecution<T> =
  | { current: true; value: T }
  | { current: false };

function getLeaseHeartbeatIntervalMs(leaseMs: number) {
  return Math.max(
    MIN_LEASE_HEARTBEAT_INTERVAL_MS,
    Math.min(
      MAX_LEASE_HEARTBEAT_INTERVAL_MS,
      Math.floor(leaseMs / 3),
    ),
  );
}

/**
 * Keeps one actively executing job leased without reserving later work. The
 * executor still owns the final publish fence; a background renewal only
 * extends the same opaque lease token and can never authorize publication by
 * itself.
 */
async function executeWithLeaseHeartbeat<T>(
  job: ClaimedGenerationJob,
  leaseMs: number,
  execute: (renewLease: () => Promise<boolean>) => Promise<T>,
): Promise<LeaseHeartbeatExecution<T>> {
  const intervalMs = getLeaseHeartbeatIntervalMs(leaseMs);
  let stopped = false;
  let leaseLost = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let renewalTail: Promise<void> = Promise.resolve();

  // Serialize timer and publish-fence renewals so an older request cannot
  // arrive last and shorten the expiry written by a newer renewal.
  const renewLease = () => {
    const operation = renewalTail.then(async () => {
      if (leaseLost) return false;
      const renewed = await renewGenerationJobLease({
        jobId: job.jobId,
        workerId: job.lease.owner,
        leaseToken: job.lease.token,
        leaseMs,
      });
      if (!renewed) leaseLost = true;
      return renewed;
    });
    renewalTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  const scheduleHeartbeat = () => {
    if (stopped || leaseLost) return;
    timer = setTimeout(async () => {
      timer = null;
      try {
        const renewed = await renewLease();
        if (!renewed) {
          logGenerationEvent(
            {
              operation: "generation.worker_lease_heartbeat",
              task: job.taskId,
              story: job.storyId,
              page: job.page,
              status: "lost",
              errorClass: "stale_result",
            },
            "warn",
          );
        }
      } catch (error) {
        // A transient backend error does not prove that the lease was lost.
        // Retry on the next tick; the executor's publish fence remains the
        // authoritative fail-closed check.
        logGenerationEvent(
          {
            operation: "generation.worker_lease_heartbeat",
            task: job.taskId,
            story: job.storyId,
            page: job.page,
            status: "failed",
            errorClass: classifyGenerationError(error),
          },
          "warn",
        );
      }
      scheduleHeartbeat();
    }, intervalMs);
    (timer as NodeJS.Timeout).unref?.();
  };

  try {
    // Refresh once immediately so validation/task-claim time cannot consume a
    // meaningful portion of the provider execution lease.
    if (!(await renewLease())) return { current: false };
    scheduleHeartbeat();
    return { current: true, value: await execute(renewLease) };
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
  }
}

async function markTerminalTextTask(job: GenerationJob) {
  if (!job.taskId) return;
  await mutateCachedTextGenerationTask(job.taskId, (task) => {
    if (
      task.storyId !== job.storyId ||
      task.status !== "generating_text" ||
      (task.durableJobId !== undefined &&
        task.durableJobId !== job.jobId) ||
      (task.durableJobAttempt !== undefined &&
        task.durableJobAttempt !== job.attempt)
    ) {
      return null;
    }
    return {
      nextTask: {
        ...task,
        status: "failed",
        error: SAFE_TEXT_GENERATION_ERROR,
        retryable: true,
        updatedAt: new Date().toISOString(),
      },
      value: true,
    };
  });
}

async function cleanupTerminalJob(job: GenerationJob) {
  if (job.kind === "text") {
    if (job.status === "dead") {
      await markTerminalTextTask(job);
      if (job.quotaReservationId) {
        const result = await refundGenerationQuotaReservation({
          reservationId: job.quotaReservationId,
        });
        if (result.outcome !== "refunded") {
          throw new Error("Generation quota refund cleanup was rejected.");
        }
      }
    } else if (job.status === "succeeded" && job.quotaReservationId) {
      const result = await commitGenerationQuotaReservation({
        reservationId: job.quotaReservationId,
      });
      if (result.outcome !== "committed") {
        throw new Error("Generation quota commit cleanup was rejected.");
      }
    }
  } else if (
    job.status === "dead" &&
    job.page !== undefined &&
    job.generationAttemptId
  ) {
    await markIllustrationAttemptFailed({
      storyId: job.storyId,
      pageNumber: job.page,
      attemptId: job.generationAttemptId,
    });
  }
  // Deletion is idempotent: a false result means the opaque payload was already
  // absent, while an unavailable backend rejects and keeps cleanup pending.
  if (job.payloadRef) await deleteGenerationJobPayload(job.payloadRef);
  return acknowledgeGenerationJobCleanup(job.jobId);
}

function recordFailureOutcome(
  summary: GenerationWorkerSummary,
  outcome: GenerationJobFailureResult,
) {
  if (outcome === "requeued") summary.requeued += 1;
  else if (outcome === "dead") summary.dead += 1;
  else summary.ignored += 1;
}

async function failClaimedJob(
  job: ClaimedGenerationJob,
  error: unknown,
) {
  const errorClass = classifyGenerationError(error);
  const disposition = getGenerationErrorDisposition(errorClass);
  if (disposition === "stale") return "ignored" as const;
  return failGenerationJob({
    jobId: job.jobId,
    workerId: job.lease.owner,
    leaseToken: job.lease.token,
    retryable: disposition === "retryable",
    errorClass,
  });
}

async function cleanupTerminalJobs(
  jobs: GenerationJob[],
  summary: GenerationWorkerSummary,
) {
  for (const job of jobs) {
    try {
      if (await cleanupTerminalJob(job)) summary.cleanupAcknowledged += 1;
    } catch (error) {
      summary.cleanupFailed += 1;
      logGenerationEvent(
        {
          operation: "generation.worker_cleanup",
          task: job.taskId,
          story: job.storyId,
          page: job.page,
          status: "failed",
          errorClass: classifyGenerationError(error),
        },
        "warn",
      );
    }
  }
}

async function executeClaimedTextJob(
  job: ClaimedGenerationJob,
  leaseMs: number,
) {
  if (!job.taskId || !job.payloadRef) {
    return failGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      retryable: false,
      errorClass: "invalid_response",
    });
  }
  const [task, payload] = await Promise.all([
    getCachedTextGenerationTask(job.taskId),
    getGenerationJobPayload(job.payloadRef),
  ]);
  if (!isTextGenerationJobPayload(payload)) {
    return failGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      retryable: false,
      errorClass: "invalid_response",
    });
  }
  if (!task) {
    return failGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      retryable: false,
      errorClass: "not_found",
    });
  }
  if (
    task.taskId !== job.taskId ||
    task.storyId !== job.storyId ||
    !job.quotaReservationId ||
    !/^quota_[A-Za-z0-9_-]{12,80}$/.test(job.quotaReservationId) ||
    payload.quotaReservationId !== job.quotaReservationId
  ) {
    return failGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      retryable: false,
      errorClass: "invalid_response",
    });
  }

  const claimedTask = await mutateCachedTextGenerationTask(
    job.taskId,
    (latestTask) => {
      if (
        latestTask.taskId !== job.taskId ||
        latestTask.storyId !== job.storyId ||
        latestTask.status !== "generating_text"
      ) {
        return null;
      }
      if (
        latestTask.durableJobId &&
        latestTask.durableJobId !== job.jobId
      ) {
        return null;
      }
      if (
        latestTask.durableJobAttempt !== undefined &&
        latestTask.durableJobAttempt > job.attempt
      ) {
        return null;
      }
      return {
        nextTask: {
          ...latestTask,
          durableJob: true,
          durableJobId: job.jobId,
          durableJobAttempt: job.attempt,
          updatedAt: new Date().toISOString(),
        },
        value: true,
      };
    },
  );
  if (!claimedTask) {
    return completeGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      resultRef: `${job.storyId}:stale`,
    });
  }

  const publishIdentity = {
    durableJobId: job.jobId,
    durableJobAttempt: job.attempt,
  };
  const execution = await executeWithLeaseHeartbeat(
    job,
    leaseMs,
    async (renewLease) => {
      const publishFence = async () => {
        if (!(await renewLease())) return false;
        const fencedTask = await mutateCachedTextGenerationTask(
          job.taskId!,
          (latestTask) => {
            const current =
              latestTask.storyId === job.storyId &&
              latestTask.status === "generating_text" &&
              latestTask.durableJobId === publishIdentity.durableJobId &&
              latestTask.durableJobAttempt === publishIdentity.durableJobAttempt;
            return current ? { value: true } : null;
          },
        );
        return Boolean(fencedTask);
      };

      return executeTextGeneration({
        task: claimedTask.task,
        storyInput: payload.storyInput,
        protagonistCharacter: payload.protagonistCharacter,
        familyCharacters: payload.familyCharacters,
        dailyLimit: payload.dailyLimit,
        generationPrincipalIds: payload.generationPrincipalIds,
        persistTerminalFailure: false,
        publishIdentity,
        publishFence,
      });
    },
  );
  if (!execution.current) return "ignored" as const;
  const outcome = execution.value;
  if (outcome.outcome === "succeeded") {
    return completeGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      resultRef: task.storyId,
    });
  }
  return failClaimedJob(job, outcome.error);
}

async function executeClaimedIllustrationJob(
  job: ClaimedGenerationJob,
  leaseMs: number,
) {
  if (job.page === undefined || !job.generationAttemptId || !job.payloadRef) {
    return failGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      retryable: false,
      errorClass: "invalid_response",
    });
  }

  const [story, payload] = await Promise.all([
    getCachedStory(job.storyId),
    getGenerationJobPayload(job.payloadRef),
  ]);
  if (!story || !isIllustrationGenerationJobPayload(payload)) {
    return failGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      retryable: false,
      errorClass: story ? "invalid_response" : "not_found",
    });
  }

  const page = story.pages.find((item) => item.page === job.page);
  if (
    !page ||
    page.imageStatus !== "pending" ||
    page.imageAttemptId !== job.generationAttemptId
  ) {
    return completeGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      resultRef: `${job.storyId}:${job.page}:stale`,
    });
  }

  const execution = await executeWithLeaseHeartbeat(
    job,
    leaseMs,
    (renewLease) =>
      executeIllustrationGeneration({
        story,
        pageNumber: job.page!,
        attemptId: job.generationAttemptId!,
        assetPrincipals: payload.assetPrincipals,
        fallbackProviders:
          payload.fallbackMode === "free-fallback"
            ? getFreeRegenerationFallbackProviders()
            : undefined,
        persistTerminalFailure: false,
        publishFence: renewLease,
      }),
  );
  if (!execution.current) return "ignored" as const;
  const outcome = execution.value;
  if (outcome.outcome === "succeeded" || outcome.outcome === "stale") {
    // A stale executor result means the Story/asset publish fence rejected this
    // attempt; closing the still-current job lease is safe and avoids reclaiming
    // work that must never be published.
    return completeGenerationJob({
      jobId: job.jobId,
      workerId: job.lease.owner,
      leaseToken: job.lease.token,
      resultRef: `${job.storyId}:${job.page}`,
    });
  }
  return failClaimedJob(job, outcome.error);
}

export async function runGenerationWorker(): Promise<GenerationWorkerSummary> {
  const configuration = getGenerationWorkerConfiguration();
  const workerId = `generation-worker-${crypto.randomUUID()}`;
  const [reclaimed, assetSweep] = await Promise.all([
    reclaimExpiredGenerationJobs({
      limit: configuration.reclaimLimit,
    }),
    sweepExpiredTemporaryStoryAssets().catch((error) => {
      logGenerationEvent(
        {
          operation: "generation.worker_asset_sweep",
          status: "failed",
          errorClass: classifyGenerationError(error),
        },
        "warn",
      );
      return null;
    }),
  ]);
  const summary: GenerationWorkerSummary = {
    reclaimed: {
      requeued: reclaimed.requeued,
      dead: reclaimed.dead,
      removed: reclaimed.removed,
    },
    assetSweep,
    claimed: 0,
    succeeded: 0,
    requeued: 0,
    dead: 0,
    ignored: 0,
    cleanupAcknowledged: 0,
    cleanupFailed: 0,
  };

  const pendingCleanup = await listGenerationJobsPendingCleanup(
    configuration.reclaimLimit,
  );
  await cleanupTerminalJobs(pendingCleanup, summary);

  // Claim only work that can start immediately. Alternating the preferred kind
  // gives both queues a chance without reserving multiple aging leases.
  let preferredKind: GenerationJobKind = "text";
  let emptyClaims = 0;
  while (summary.claimed < configuration.claimLimit && emptyClaims < 2) {
    const jobs = await claimGenerationJobs({
      workerId,
      kind: preferredKind,
      limit: 1,
      leaseMs: configuration.leaseMs,
    });
    preferredKind = preferredKind === "text" ? "illustration" : "text";
    const job = jobs[0];
    if (!job) {
      emptyClaims += 1;
      continue;
    }
    emptyClaims = 0;
    summary.claimed += 1;
    try {
      const outcome = job.kind === "text"
        ? await executeClaimedTextJob(job, configuration.leaseMs)
        : await executeClaimedIllustrationJob(job, configuration.leaseMs);
      if (outcome === "completed") summary.succeeded += 1;
      else recordFailureOutcome(summary, outcome);
    } catch (error) {
      const errorClass = classifyGenerationError(error);
      logGenerationEvent(
        {
          operation: "generation.worker",
          task: job.taskId,
          story: job.storyId,
          status: "failed",
          errorClass,
        },
        "error",
      );
      try {
        recordFailureOutcome(summary, await failClaimedJob(job, error));
      } catch {
        summary.ignored += 1;
      }
    }
  }

  const completedCleanup = await listGenerationJobsPendingCleanup(
    configuration.reclaimLimit,
  );
  await cleanupTerminalJobs(completedCleanup, summary);
  return summary;
}
