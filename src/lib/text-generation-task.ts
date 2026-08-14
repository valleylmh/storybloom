import type { GenerateResponse } from "@/types";

export const TEXT_GENERATION_TASK_TTL_SECONDS = 24 * 60 * 60;
export const TEXT_GENERATION_TASK_STALE_MS = 10 * 60 * 1000;

export type TextGenerationTaskStatus =
  | "generating_text"
  | "reviewing_outline"
  | "generating_images"
  | "ready"
  | "partially_failed"
  | "failed";

export interface TextGenerationTask {
  taskId: string;
  storyId: string;
  /** Opaque HMAC-derived principal ids allowed to poll or mutate this task. */
  generationPrincipalIds?: string[];
  status: TextGenerationTaskStatus;
  reviewBeforeIllustrations: boolean;
  createdAt: string;
  updatedAt: string;
  result?: GenerateResponse;
  error?: string;
  retryable?: boolean;
  durableJob?: boolean;
  durableJobId?: string;
  /**
   * Monotonic claim number copied from the durable job. Together with
   * durableJobId this is the lease-neutral publish identity: a reclaimed
   * worker advances the attempt and permanently fences older publishers.
   */
  durableJobAttempt?: number;
  /** Optional for tasks created before atomic task mutations were introduced. */
  revision?: number;
}

export type TextGenerationTaskResponse = {
  taskId: string;
  storyId: string;
  status: TextGenerationTaskStatus | "unrecoverable";
  pollAfterMs?: number;
  result?: GenerateResponse;
  error?: string;
  retryable?: boolean;
};

export type ClientGenerationTaskStatus = TextGenerationTaskStatus | "unrecoverable";

export interface ClientTextGenerationTaskResponse
  extends Omit<TextGenerationTaskResponse, "status"> {
  status: ClientGenerationTaskStatus;
}

export function createPendingTextGenerationTask(input: {
  taskId: string;
  storyId: string;
  reviewBeforeIllustrations: boolean;
  durableJob?: boolean;
  generationPrincipalIds?: string[];
  now?: Date;
}): TextGenerationTask {
  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    taskId: input.taskId,
    storyId: input.storyId,
    ...(input.generationPrincipalIds?.length
      ? { generationPrincipalIds: input.generationPrincipalIds }
      : {}),
    status: "generating_text",
    reviewBeforeIllustrations: input.reviewBeforeIllustrations,
    ...(input.durableJob ? { durableJob: true } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function isStaleTextGenerationTask(
  task: TextGenerationTask,
  now = Date.now(),
) {
  return (
    task.status === "generating_text" &&
    !task.durableJob &&
    !task.durableJobId &&
    now - new Date(task.updatedAt).getTime() > TEXT_GENERATION_TASK_STALE_MS
  );
}

export function createTextGenerationTaskResponse(
  task: TextGenerationTask,
): TextGenerationTaskResponse {
  return {
    taskId: task.taskId,
    storyId: task.storyId,
    status: task.status,
    ...(task.status === "generating_text" ? { pollAfterMs: 1200 } : {}),
    ...(task.result ? { result: task.result } : {}),
    ...(task.error ? { error: task.error } : {}),
    ...(task.retryable !== undefined ? { retryable: task.retryable } : {}),
  };
}

export function createUnrecoverableTextGenerationTaskResponse(
  taskId: string,
  storyId = "",
  error = "文本生成任务已过期或无法恢复，请重新生成。",
): TextGenerationTaskResponse {
  return {
    taskId,
    storyId,
    status: "unrecoverable",
    error,
    retryable: true,
  };
}
