import {
  normalizeGrowthRecordDraft,
  type GrowthRecordDraft,
} from "@/lib/growth-records";

export const ACTIVE_GENERATION_TASK_STORAGE_KEY =
  "storybloom.generation.active.v1";
export const TASK_QUERY_KEY = "task";

const ACTIVE_GENERATION_TASK_VERSION = 1;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{12,80}$/;

export type ClientGenerationTaskStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export interface ActiveGenerationTask {
  version: typeof ACTIVE_GENERATION_TASK_VERSION;
  taskId: string;
  reviewBeforeIllustrations: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Private, browser-local context used only after the story is complete.
   * It intentionally includes local photo data URLs and must never be added to
   * a generation request or URL.
   */
  growthRecordDraft?: GrowthRecordDraft;
}

export interface ActiveGenerationTaskInput {
  taskId: string;
  reviewBeforeIllustrations: boolean;
  growthRecordDraft?: unknown;
}

export interface ClientGenerationTaskStorageOptions {
  storage?: ClientGenerationTaskStorage | null;
}

export interface WriteActiveGenerationTaskOptions
  extends ClientGenerationTaskStorageOptions {
  now?: string;
}

export interface ClearActiveGenerationTaskOptions
  extends ClientGenerationTaskStorageOptions {
  /** Avoid clearing a newer task when an older request finishes late. */
  taskId?: string;
}

export interface GenerationTaskRecoveryCandidate {
  taskId: string;
  source: "url" | "active-record";
  reviewBeforeIllustrations: boolean;
  growthRecordDraft?: GrowthRecordDraft;
  /** A local pointer is not proof that the server-side task still exists. */
  requiresServerVerification: true;
}

function normalizeTaskId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return TASK_ID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeLocalGrowthRecordDraft(
  value: unknown,
): GrowthRecordDraft | undefined {
  const normalized = normalizeGrowthRecordDraft(value);
  if (!normalized) return undefined;

  if (
    normalized.childCharacterId !== undefined &&
    (typeof normalized.childCharacterId !== "string" ||
      normalized.childCharacterId.trim().length === 0)
  ) {
    return undefined;
  }
  if (
    normalized.childAvatarDataUrl !== undefined &&
    (typeof normalized.childAvatarDataUrl !== "string" ||
      !normalized.childAvatarDataUrl.startsWith("data:image/"))
  ) {
    return undefined;
  }

  // Rebuild from an allowlist so unrelated form fields, access tokens, or
  // accidental private values cannot hitch a ride in the persisted record.
  return {
    version: 1,
    childKey: normalized.childKey,
    childName: normalized.childName,
    ...(normalized.childCharacterId
      ? { childCharacterId: normalized.childCharacterId }
      : {}),
    ...(normalized.childAvatarDataUrl
      ? { childAvatarDataUrl: normalized.childAvatarDataUrl }
      : {}),
    occurredOn: normalized.occurredOn,
    note: normalized.note,
    idea: normalized.idea,
    photos: normalized.photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      dataUrl: photo.dataUrl,
    })),
    ...(normalized.readingStage
      ? { readingStage: normalized.readingStage }
      : {}),
    ...(normalized.storyTreatment
      ? { storyTreatment: normalized.storyTreatment }
      : {}),
    ...(normalized.parentFacts
      ? { parentFacts: normalized.parentFacts }
      : {}),
    ...(normalized.allowedImaginations
      ? { allowedImaginations: normalized.allowedImaginations }
      : {}),
  };
}

function getBrowserStorage(): ClientGenerationTaskStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage?: ClientGenerationTaskStorage | null) {
  return storage === undefined ? getBrowserStorage() : storage;
}

function normalizeActiveGenerationTask(
  value: unknown,
): ActiveGenerationTask | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ActiveGenerationTask>;
  const taskId = normalizeTaskId(candidate.taskId);
  const createdAt = normalizeTimestamp(candidate.createdAt);
  const updatedAt = normalizeTimestamp(candidate.updatedAt);
  if (
    candidate.version !== ACTIVE_GENERATION_TASK_VERSION ||
    !taskId ||
    typeof candidate.reviewBeforeIllustrations !== "boolean" ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  const hasGrowthDraft = candidate.growthRecordDraft !== undefined;
  const growthRecordDraft = hasGrowthDraft
    ? normalizeLocalGrowthRecordDraft(candidate.growthRecordDraft)
    : undefined;
  if (hasGrowthDraft && !growthRecordDraft) return null;

  return {
    version: ACTIVE_GENERATION_TASK_VERSION,
    taskId,
    reviewBeforeIllustrations: candidate.reviewBeforeIllustrations,
    createdAt,
    updatedAt,
    ...(growthRecordDraft ? { growthRecordDraft } : {}),
  };
}

export function createActiveGenerationTask(
  input: ActiveGenerationTaskInput,
  now = new Date().toISOString(),
  createdAt = now,
): ActiveGenerationTask | null {
  const taskId = normalizeTaskId(input.taskId);
  const normalizedNow = normalizeTimestamp(now);
  const normalizedCreatedAt = normalizeTimestamp(createdAt);
  if (
    !taskId ||
    typeof input.reviewBeforeIllustrations !== "boolean" ||
    !normalizedNow ||
    !normalizedCreatedAt
  ) {
    return null;
  }

  const hasGrowthDraft = input.growthRecordDraft !== undefined;
  const growthRecordDraft = hasGrowthDraft
    ? normalizeLocalGrowthRecordDraft(input.growthRecordDraft)
    : undefined;
  if (hasGrowthDraft && !growthRecordDraft) return null;

  return {
    version: ACTIVE_GENERATION_TASK_VERSION,
    taskId,
    reviewBeforeIllustrations: input.reviewBeforeIllustrations,
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedNow,
    ...(growthRecordDraft ? { growthRecordDraft } : {}),
  };
}

export function readActiveGenerationTask(
  options: ClientGenerationTaskStorageOptions = {},
): ActiveGenerationTask | null {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;

  try {
    const raw = storage.getItem(ACTIVE_GENERATION_TASK_STORAGE_KEY);
    if (!raw) return null;
    return normalizeActiveGenerationTask(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeActiveGenerationTask(
  input: ActiveGenerationTaskInput,
  options: WriteActiveGenerationTaskOptions = {},
): ActiveGenerationTask | null {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;

  const existing = readActiveGenerationTask({ storage });
  const now = options.now ?? new Date().toISOString();
  const record = createActiveGenerationTask(
    input,
    now,
    existing?.taskId === normalizeTaskId(input.taskId)
      ? existing.createdAt
      : now,
  );
  if (!record) return null;

  try {
    storage.setItem(
      ACTIVE_GENERATION_TASK_STORAGE_KEY,
      JSON.stringify(record),
    );
    return record;
  } catch {
    // Private browsing, disabled storage, or photo-heavy quota failures must
    // not block anonymous creation. Returning null makes recovery unconfirmed.
    return null;
  }
}

export function clearActiveGenerationTask(
  options: ClearActiveGenerationTaskOptions = {},
) {
  const storage = resolveStorage(options.storage);
  if (!storage) return false;

  if (options.taskId) {
    const expectedTaskId = normalizeTaskId(options.taskId);
    const activeTask = readActiveGenerationTask({ storage });
    if (!expectedTaskId || activeTask?.taskId !== expectedTaskId) return false;
  }

  try {
    storage.removeItem(ACTIVE_GENERATION_TASK_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

type TaskSearchInput = string | URL | URLSearchParams;

function getTaskSearchParams(input: TaskSearchInput) {
  if (input instanceof URL) return new URLSearchParams(input.search);
  if (input instanceof URLSearchParams) return new URLSearchParams(input);

  const questionMark = input.indexOf("?");
  const rawSearch = questionMark >= 0 ? input.slice(questionMark + 1) : input;
  const hashMark = rawSearch.indexOf("#");
  return new URLSearchParams(
    (hashMark >= 0 ? rawSearch.slice(0, hashMark) : rawSearch).replace(/^\?/, ""),
  );
}

function formatTaskSearch(params: URLSearchParams) {
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function getGenerationTaskIdFromSearch(input: TaskSearchInput) {
  const taskIds = getTaskSearchParams(input).getAll(TASK_QUERY_KEY);
  if (taskIds.length !== 1) return null;
  return normalizeTaskId(taskIds[0]);
}

export function setGenerationTaskIdInSearch(
  input: TaskSearchInput,
  taskId: string,
) {
  const params = getTaskSearchParams(input);
  const normalizedTaskId = normalizeTaskId(taskId);
  if (normalizedTaskId) params.set(TASK_QUERY_KEY, normalizedTaskId);
  else params.delete(TASK_QUERY_KEY);
  return formatTaskSearch(params);
}

export function clearGenerationTaskIdFromSearch(input: TaskSearchInput) {
  const params = getTaskSearchParams(input);
  params.delete(TASK_QUERY_KEY);
  return formatTaskSearch(params);
}

export function resolveGenerationTaskRecovery(
  search: TaskSearchInput,
  activeTask: ActiveGenerationTask | null,
  defaultReviewBeforeIllustrations = true,
): GenerationTaskRecoveryCandidate | null {
  const taskIdFromUrl = getGenerationTaskIdFromSearch(search);
  const normalizedActiveTask = activeTask
    ? normalizeActiveGenerationTask(activeTask)
    : null;

  if (taskIdFromUrl) {
    const matchingActiveTask =
      normalizedActiveTask?.taskId === taskIdFromUrl
        ? normalizedActiveTask
        : null;
    return {
      taskId: taskIdFromUrl,
      source: "url",
      reviewBeforeIllustrations:
        matchingActiveTask?.reviewBeforeIllustrations ??
        defaultReviewBeforeIllustrations,
      requiresServerVerification: true,
      ...(matchingActiveTask?.growthRecordDraft
        ? { growthRecordDraft: matchingActiveTask.growthRecordDraft }
        : {}),
    };
  }

  if (!normalizedActiveTask) return null;
  return {
    taskId: normalizedActiveTask.taskId,
    source: "active-record",
    reviewBeforeIllustrations: normalizedActiveTask.reviewBeforeIllustrations,
    requiresServerVerification: true,
    ...(normalizedActiveTask.growthRecordDraft
      ? { growthRecordDraft: normalizedActiveTask.growthRecordDraft }
      : {}),
  };
}
