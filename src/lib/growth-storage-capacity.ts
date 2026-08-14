export const GROWTH_STORAGE_WARNING_RATIO = 0.85;
export const GROWTH_STORAGE_COMPATIBILITY_COPIES = 2;

export type GrowthStorageErrorCode =
  | "growth-storage-quota-exceeded"
  | "growth-storage-unavailable"
  | "growth-storage-write-failed";

export class GrowthStorageError extends Error {
  readonly code: GrowthStorageErrorCode;

  constructor(code: GrowthStorageErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "GrowthStorageError";
    this.code = code;
  }
}

export interface GrowthStorageCapacitySnapshot {
  supported: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  remainingBytes?: number;
}

export interface GrowthStorageCapacityAssessment {
  additionalBytes: number;
  projectedUsageBytes?: number;
  projectedRemainingBytes?: number;
  projectedUsageRatio?: number;
  warning: boolean;
  blocked: boolean;
}

interface StorageEstimator {
  estimate(): Promise<StorageEstimate>;
}

function normalizeStorageNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}

export async function estimateGrowthStorageCapacity(
  estimator?: StorageEstimator,
): Promise<GrowthStorageCapacitySnapshot> {
  const browserStorage =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { storage?: StorageEstimator }).storage
      : undefined;
  const storage =
    estimator || browserStorage;
  if (!storage) return { supported: false };

  try {
    const estimate = await storage.estimate();
    const usageBytes = normalizeStorageNumber(estimate.usage);
    const quotaBytes = normalizeStorageNumber(estimate.quota);
    return {
      supported: true,
      ...(usageBytes !== undefined ? { usageBytes } : {}),
      ...(quotaBytes !== undefined ? { quotaBytes } : {}),
      ...(usageBytes !== undefined && quotaBytes !== undefined
        ? { remainingBytes: Math.max(0, quotaBytes - usageBytes) }
        : {}),
    };
  } catch {
    return { supported: true };
  }
}

export function assessGrowthStorageCapacity(
  snapshot: GrowthStorageCapacitySnapshot,
  additionalBytes: number,
): GrowthStorageCapacityAssessment {
  const normalizedAdditional = Math.max(0, Math.floor(additionalBytes));
  const projectedUsageBytes =
    snapshot.usageBytes === undefined
      ? undefined
      : snapshot.usageBytes + normalizedAdditional;
  const projectedRemainingBytes =
    snapshot.remainingBytes === undefined
      ? undefined
      : Math.max(0, snapshot.remainingBytes - normalizedAdditional);
  const projectedUsageRatio =
    projectedUsageBytes === undefined || !snapshot.quotaBytes
      ? undefined
      : projectedUsageBytes / snapshot.quotaBytes;
  const lowRemainingThreshold = snapshot.quotaBytes
    ? Math.min(10 * 1024 * 1024, snapshot.quotaBytes * 0.1)
    : undefined;
  const blocked =
    snapshot.remainingBytes !== undefined &&
    normalizedAdditional > snapshot.remainingBytes;
  const warning =
    blocked ||
    (projectedUsageRatio !== undefined &&
      projectedUsageRatio >= GROWTH_STORAGE_WARNING_RATIO) ||
    (projectedRemainingBytes !== undefined &&
      lowRemainingThreshold !== undefined &&
      projectedRemainingBytes <= lowRemainingThreshold);

  return {
    additionalBytes: normalizedAdditional,
    ...(projectedUsageBytes !== undefined ? { projectedUsageBytes } : {}),
    ...(projectedRemainingBytes !== undefined
      ? { projectedRemainingBytes }
      : {}),
    ...(projectedUsageRatio !== undefined ? { projectedUsageRatio } : {}),
    warning,
    blocked,
  };
}

export function estimateGrowthPhotoWriteBytes(photoBytes: number) {
  return Math.max(0, Math.floor(photoBytes)) * GROWTH_STORAGE_COMPATIBILITY_COPIES;
}

export function formatGrowthStorageBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.ceil(bytes)} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib >= 10 ? 0 : 1)} MB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 0 : 1)} GB`;
}

function getErrorName(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

export function getGrowthStorageErrorCode(
  error: unknown,
): GrowthStorageErrorCode {
  if (error instanceof GrowthStorageError) return error.code;
  if (error instanceof Error) {
    if (
      error.message === "growth-storage-quota-exceeded" ||
      error.message === "growth-storage-unavailable" ||
      error.message === "growth-storage-write-failed"
    ) {
      return error.message;
    }
  }
  const name = getErrorName(error);
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "growth-storage-quota-exceeded";
  }
  if (
    name === "InvalidStateError" ||
    name === "NotFoundError" ||
    name === "SecurityError"
  ) {
    return "growth-storage-unavailable";
  }
  return "growth-storage-write-failed";
}

export function toGrowthStorageError(
  error: unknown,
  fallback: GrowthStorageErrorCode = "growth-storage-write-failed",
) {
  if (error instanceof GrowthStorageError) return error;
  const detected = getGrowthStorageErrorCode(error);
  return new GrowthStorageError(
    detected === "growth-storage-write-failed" ? fallback : detected,
    { cause: error },
  );
}

export function assertGrowthStorageCapacity(
  snapshot: GrowthStorageCapacitySnapshot,
  additionalBytes: number,
) {
  if (assessGrowthStorageCapacity(snapshot, additionalBytes).blocked) {
    throw new GrowthStorageError("growth-storage-quota-exceeded");
  }
}
