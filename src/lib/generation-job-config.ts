import "server-only";

const ENABLED_VALUES = new Set(["1", "true", "on"]);

function boundedEnvironmentInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function areProductionGenerationJobsEnabled() {
  return ENABLED_VALUES.has(
    process.env.STORYBLOOM_PRODUCTION_JOBS_ENABLED?.trim().toLowerCase() || "",
  );
}

export function getGenerationWorkerConfiguration() {
  return {
    leaseMs: boundedEnvironmentInteger(
      "GENERATION_WORKER_LEASE_MS",
      5 * 60 * 1_000,
      1_000,
      15 * 60 * 1_000,
    ),
    claimLimit: boundedEnvironmentInteger(
      "GENERATION_WORKER_CLAIM_LIMIT",
      4,
      1,
      20,
    ),
    reclaimLimit: boundedEnvironmentInteger(
      "GENERATION_RECLAIM_LIMIT",
      20,
      1,
      100,
    ),
  };
}
