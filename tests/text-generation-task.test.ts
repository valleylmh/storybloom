import { describe, expect, it } from "vitest";
import {
  createPendingTextGenerationTask,
  createTextGenerationTaskResponse,
  createUnrecoverableTextGenerationTaskResponse,
  isStaleTextGenerationTask,
} from "@/lib/text-generation-task";

describe("text generation task contract", () => {
  it("creates a durable polling contract without persisting story input", () => {
    const task = createPendingTextGenerationTask({
      taskId: "task_123456789012",
      storyId: "story-1",
      reviewBeforeIllustrations: true,
      now: new Date("2026-08-13T02:00:00.000Z"),
    });

    expect(task).toEqual({
      taskId: "task_123456789012",
      storyId: "story-1",
      status: "generating_text",
      reviewBeforeIllustrations: true,
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:00:00.000Z",
    });
    expect(createTextGenerationTaskResponse(task)).toEqual({
      taskId: "task_123456789012",
      storyId: "story-1",
      status: "generating_text",
      pollAfterMs: 1200,
    });
  });

  it("reports an interrupted or missing task as explicitly unrecoverable", () => {
    const task = createPendingTextGenerationTask({
      taskId: "task_123456789012",
      storyId: "story-1",
      reviewBeforeIllustrations: false,
      now: new Date("2026-08-13T02:00:00.000Z"),
    });

    expect(
      isStaleTextGenerationTask(
        task,
        new Date("2026-08-13T02:11:00.000Z").getTime(),
      ),
    ).toBe(true);
    expect(createUnrecoverableTextGenerationTaskResponse(task.taskId)).toMatchObject({
      taskId: task.taskId,
      status: "unrecoverable",
      retryable: true,
    });
  });

  it("does not expire a queued durable job by the legacy ten minute clock", () => {
    const task = {
      ...createPendingTextGenerationTask({
        taskId: "task_123456789012",
        storyId: "story-1",
        reviewBeforeIllustrations: false,
        now: new Date("2026-08-13T02:00:00.000Z"),
      }),
      durableJob: true,
      durableJobId: "job_123456789012",
    };
    expect(
      isStaleTextGenerationTask(
        task,
        new Date("2026-08-13T03:00:00.000Z").getTime(),
      ),
    ).toBe(false);
  });

  it("also keeps the enqueue-to-job-link window recoverable", () => {
    const task = createPendingTextGenerationTask({
      taskId: "task_123456789012",
      storyId: "story-1",
      reviewBeforeIllustrations: false,
      durableJob: true,
      now: new Date("2026-08-13T02:00:00.000Z"),
    });
    expect(
      isStaleTextGenerationTask(
        task,
        new Date("2026-08-13T03:00:00.000Z").getTime(),
      ),
    ).toBe(false);
  });
});
