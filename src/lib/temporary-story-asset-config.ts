import "server-only";

const DEFAULT_BUCKET = "story-generation-assets";
const BUCKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export type TemporaryStoryAssetBackend = "local-file" | "supabase";

export type TemporaryStoryAssetBackendEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type TemporaryStoryAssetBackendConfiguration =
  | {
      status: "ready";
      assessment: "configuration";
      configurationReady: true;
      productionVerified: false;
      backend: "local-file";
      bucket: null;
      shared: false;
    }
  | {
      status: "ready";
      assessment: "configuration";
      configurationReady: true;
      productionVerified: false;
      backend: "supabase";
      bucket: string;
      shared: true;
    }
  | {
      status: "invalid";
      assessment: "configuration";
      configurationReady: false;
      productionVerified: false;
      backend: string;
      bucket: string | null;
      reason:
        | "unsupported_backend"
        | "supabase_admin_configuration_incomplete"
        | "invalid_bucket";
    };

function configuredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

/**
 * Evaluates environment shape only. A ready Supabase result means the server
 * has enough configuration to attempt Storage access; it does not prove that
 * the bucket exists, is private, has the expected limits, or passes role probes.
 */
export function evaluateTemporaryStoryAssetBackendConfigurationReadiness(
  environment: TemporaryStoryAssetBackendEnvironment = process.env,
): TemporaryStoryAssetBackendConfiguration {
  const configuredBackend = configuredValue(
    environment.STORYBLOOM_TEMP_ASSET_BACKEND,
  );
  const backend = (configuredBackend || "local-file").toLowerCase();
  const configuredBucket = configuredValue(
    environment.STORYBLOOM_TEMP_ASSET_BUCKET,
  );

  if (backend === "local-file") {
    return {
      status: "ready",
      assessment: "configuration",
      configurationReady: true,
      productionVerified: false,
      backend: "local-file",
      bucket: null,
      shared: false,
    };
  }

  if (backend !== "supabase") {
    return {
      status: "invalid",
      assessment: "configuration",
      configurationReady: false,
      productionVerified: false,
      backend,
      bucket: configuredBucket,
      reason: "unsupported_backend",
    };
  }

  const bucket = configuredBucket || DEFAULT_BUCKET;
  if (!BUCKET_PATTERN.test(bucket)) {
    return {
      status: "invalid",
      assessment: "configuration",
      configurationReady: false,
      productionVerified: false,
      backend,
      bucket,
      reason: "invalid_bucket",
    };
  }

  if (
    !configuredValue(environment.NEXT_PUBLIC_SUPABASE_URL) ||
    !configuredValue(environment.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    return {
      status: "invalid",
      assessment: "configuration",
      configurationReady: false,
      productionVerified: false,
      backend,
      bucket,
      reason: "supabase_admin_configuration_incomplete",
    };
  }

  return {
    status: "ready",
    assessment: "configuration",
    configurationReady: true,
    productionVerified: false,
    backend: "supabase",
    bucket,
    shared: true,
  };
}

/**
 * Backward-compatible resolver used by the asset store. `status: "ready"`
 * remains configuration readiness, never a production verification claim.
 */
export function resolveTemporaryStoryAssetBackendConfiguration(): TemporaryStoryAssetBackendConfiguration {
  return evaluateTemporaryStoryAssetBackendConfigurationReadiness();
}

export function isTemporaryStoryAssetSharedBackendEnabled() {
  const configuration = resolveTemporaryStoryAssetBackendConfiguration();
  return configuration.status === "ready" && configuration.shared;
}
