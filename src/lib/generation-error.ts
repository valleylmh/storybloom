export const GENERATION_ERROR_CLASSES = [
  "timeout",
  "rate_limit",
  "authentication",
  "configuration",
  "network",
  "upstream_4xx",
  "upstream_5xx",
  "invalid_response",
  "storage_unavailable",
  "stale_result",
  "not_found",
  "conflict",
  "unknown",
] as const;

export type GenerationErrorClass =
  (typeof GENERATION_ERROR_CLASSES)[number];

export type GenerationErrorDisposition = "retryable" | "terminal" | "stale";

const RETRYABLE_GENERATION_ERROR_CLASSES = new Set<GenerationErrorClass>([
  "timeout",
  "rate_limit",
  "network",
  "upstream_5xx",
  "storage_unavailable",
]);

/**
 * Central retry policy for durable generation jobs. Only failures known to be
 * transient are retried. Unknown failures are terminal so programming errors
 * cannot repeatedly poison the queue, while stale work is left to the lease
 * state machine instead of being requeued or marked dead by an old worker.
 */
export function getGenerationErrorDisposition(
  errorClass: GenerationErrorClass,
): GenerationErrorDisposition {
  if (errorClass === "stale_result") return "stale";
  return RETRYABLE_GENERATION_ERROR_CLASSES.has(errorClass)
    ? "retryable"
    : "terminal";
}

export function isRetryableGenerationErrorClass(
  errorClass: GenerationErrorClass,
) {
  return getGenerationErrorDisposition(errorClass) === "retryable";
}

export class GenerationProviderError extends Error {
  readonly errorClass: GenerationErrorClass;

  constructor(
    errorClass: GenerationErrorClass,
    message = "Generation provider request failed.",
  ) {
    super(message);
    this.name = "GenerationProviderError";
    this.errorClass = errorClass;
  }
}

const errorClasses = new Set<string>(GENERATION_ERROR_CLASSES);

function safeErrorClass(value: unknown): GenerationErrorClass | undefined {
  return typeof value === "string" && errorClasses.has(value)
    ? (value as GenerationErrorClass)
    : undefined;
}

function readErrorName(error: unknown) {
  if (error instanceof Error) return error.name;
  if (error && typeof error === "object" && "name" in error) {
    return typeof error.name === "string" ? error.name : "";
  }
  return "";
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return typeof error.message === "string" ? error.message : "";
  }
  return "";
}

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;

  const errorPayload = error as Record<string, unknown>;
  for (const key of ["status", "statusCode", "code"] as const) {
    if (!(key in errorPayload)) continue;
    const value = errorPayload[key];
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && /^\d{3}$/.test(value)) {
      return Number.parseInt(value, 10);
    }
  }

  return undefined;
}

export function classifyGenerationError(error: unknown): GenerationErrorClass {
  if (error instanceof GenerationProviderError) return error.errorClass;
  if (error && typeof error === "object" && "errorClass" in error) {
    const errorClass = safeErrorClass(error.errorClass);
    if (errorClass) return errorClass;
  }

  const name = readErrorName(error);
  const message = readErrorMessage(error);
  const normalized = `${name} ${message}`.toLowerCase();
  const status = readErrorStatus(error);

  if (/abort|timeout|timed out|etimedout/.test(normalized)) return "timeout";
  if (status === 429 || /rate.?limit|too many requests|quota/.test(normalized)) {
    return "rate_limit";
  }
  if (
    status === 401 ||
    status === 403 ||
    /unauthori[sz]ed|forbidden|invalid api.?key|authentication/.test(normalized)
  ) {
    return "authentication";
  }
  if (
    /missing .*?(?:api.?key|token|configuration)|not configured|requires .*?(?:api.?key|token)|must configure/.test(
      normalized,
    )
  ) {
    return "configuration";
  }
  if (
    /invalid json|non-json|did not return|invalid response|unexpected content|must return exactly|invalid castids/.test(
      normalized,
    )
  ) {
    return "invalid_response";
  }
  if (/storage|cache|persist|filesystem|disk|redis/.test(normalized)) {
    return "storage_unavailable";
  }
  if (/stale/.test(normalized)) return "stale_result";
  if (status === 404 || /not found|missing resource/.test(normalized)) {
    return "not_found";
  }
  if (status === 409 || /conflict|already exists|duplicate/.test(normalized)) {
    return "conflict";
  }
  if (
    /fetch failed|network|econn|enotfound|socket|dns|tls|certificate/.test(
      normalized,
    )
  ) {
    return "network";
  }
  if (status !== undefined && status >= 500 && status <= 599) {
    return "upstream_5xx";
  }
  if (status !== undefined && status >= 400 && status <= 499) {
    return "upstream_4xx";
  }

  const httpStatus = normalized.match(/\bhttp\s+(\d{3})\b/)?.[1];
  if (httpStatus) {
    const parsedStatus = Number.parseInt(httpStatus, 10);
    if (parsedStatus >= 500) return "upstream_5xx";
    if (parsedStatus >= 400) return "upstream_4xx";
  }

  return "unknown";
}
