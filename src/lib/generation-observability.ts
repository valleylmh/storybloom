import "server-only";
import { GENERATION_ERROR_CLASSES } from "@/lib/generation-error";
import type { GenerationErrorClass } from "@/lib/generation-error";

export {
  GENERATION_ERROR_CLASSES,
  GenerationProviderError,
  classifyGenerationError,
  getGenerationErrorDisposition,
  isRetryableGenerationErrorClass,
  type GenerationErrorClass,
  type GenerationErrorDisposition,
} from "@/lib/generation-error";

export type GenerationLogLevel = "info" | "warn" | "error";

export interface GenerationEvent {
  operation: string;
  task?: string;
  story?: string;
  page?: number;
  provider?: string;
  model?: string;
  status: string;
  duration?: number;
  attempt?: number;
  retry?: boolean;
  width?: number;
  height?: number;
  qualityChecked?: boolean;
  qualityWarnings?: number;
  payloadBytes?: number;
  payloadLimitBytes?: number;
  errorClass?: GenerationErrorClass;
}

export interface GenerationLogPayload {
  operation: string;
  task?: string;
  story?: string;
  page?: number;
  provider?: string;
  model?: string;
  status: string;
  duration?: number;
  attempt?: number;
  retry?: boolean;
  width?: number;
  height?: number;
  qualityChecked?: boolean;
  qualityWarnings?: number;
  payloadBytes?: number;
  payloadLimitBytes?: number;
  errorClass?: GenerationErrorClass;
}

const errorClasses = new Set<string>(GENERATION_ERROR_CLASSES);
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9._:@/-]*$/;
const MAX_LABEL_LENGTH = 160;
const MAX_CORRELATION_ID_LENGTH = 100;

function safeLabel(value: unknown, fallback?: string) {
  if (typeof value !== "string") return fallback;

  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_LABEL_LENGTH ||
    normalized.includes("://") ||
    !SAFE_IDENTIFIER_PATTERN.test(normalized)
  ) {
    return fallback;
  }

  return normalized;
}

function safeCorrelationId(value: unknown) {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  return normalized.length > 0 &&
    normalized.length <= MAX_CORRELATION_ID_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(normalized)
    ? normalized
    : undefined;
}

function safePage(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function safeDuration(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function safePositiveInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : undefined;
}

function safeNonNegativeInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function safeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function safeByteCount(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function safeErrorClass(value: unknown): GenerationErrorClass | undefined {
  return typeof value === "string" && errorClasses.has(value)
    ? (value as GenerationErrorClass)
    : undefined;
}

/**
 * Rebuilds a generation event from an explicit allowlist. Runtime callers may
 * pass wider objects, but request bodies, prompts, URLs, credentials and raw
 * Error objects are never copied to the returned payload.
 */
export function createGenerationLogPayload(
  event: GenerationEvent,
): GenerationLogPayload {
  const payload: GenerationLogPayload = {
    operation: safeLabel(event.operation, "unknown")!,
    status: safeLabel(event.status, "unknown")!,
  };

  const task = safeCorrelationId(event.task);
  const story = safeCorrelationId(event.story);
  const page = safePage(event.page);
  const provider = safeLabel(event.provider);
  const model = safeLabel(event.model);
  const duration = safeDuration(event.duration);
  const attempt = safePositiveInteger(event.attempt);
  const retry = safeBoolean(event.retry);
  const width = safePositiveInteger(event.width);
  const height = safePositiveInteger(event.height);
  const qualityChecked = safeBoolean(event.qualityChecked);
  const qualityWarnings = safeNonNegativeInteger(event.qualityWarnings);
  const payloadBytes = safeByteCount(event.payloadBytes);
  const payloadLimitBytes = safeByteCount(event.payloadLimitBytes);
  const errorClass = safeErrorClass(event.errorClass);

  if (task !== undefined) payload.task = task;
  if (story !== undefined) payload.story = story;
  if (page !== undefined) payload.page = page;
  if (provider !== undefined) payload.provider = provider;
  if (model !== undefined) payload.model = model;
  if (duration !== undefined) payload.duration = duration;
  if (attempt !== undefined) payload.attempt = attempt;
  if (retry !== undefined) payload.retry = retry;
  if (width !== undefined) payload.width = width;
  if (height !== undefined) payload.height = height;
  if (qualityChecked !== undefined) payload.qualityChecked = qualityChecked;
  if (qualityWarnings !== undefined) payload.qualityWarnings = qualityWarnings;
  if (payloadBytes !== undefined) payload.payloadBytes = payloadBytes;
  if (payloadLimitBytes !== undefined) {
    payload.payloadLimitBytes = payloadLimitBytes;
  }
  if (errorClass !== undefined) payload.errorClass = errorClass;

  return payload;
}

export function logGenerationEvent(
  event: GenerationEvent,
  level: GenerationLogLevel = "info",
) {
  const payload = createGenerationLogPayload(event);

  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.info(payload);
  }

  return payload;
}
