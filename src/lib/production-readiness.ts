export type ProductionEnvironment = Readonly<
  Record<string, string | null | undefined>
>;

export type ProductionReadinessSeverity = "error" | "warning";

export type ProductionReadinessIssueCode =
  | "missing_required_env"
  | "invalid_app_url"
  | "app_url_https_required"
  | "app_url_localhost_forbidden"
  | "invalid_supabase_url"
  | "supabase_url_https_required"
  | "supabase_public_key_required"
  | "turnstile_required"
  | "turnstile_pair_incomplete"
  | "shared_persistence_required"
  | "shared_persistence_pair_incomplete"
  | "shared_persistence_mixed_pairs"
  | "shared_persistence_multiple_backends"
  | "production_jobs_flag_invalid"
  | "generation_worker_secret_required"
  | "generation_worker_secret_too_short"
  | "asset_principal_secret_required"
  | "asset_principal_secret_too_short"
  | "temporary_asset_backend_required"
  | "temporary_asset_backend_unsupported"
  | "temporary_asset_bucket_required"
  | "temporary_asset_bucket_invalid"
  | "production_jobs_setting_invalid";

export type ProductionReadinessIssue = {
  code: ProductionReadinessIssueCode;
  severity: ProductionReadinessSeverity;
  message: string;
};

export type ProductionReadinessReport = {
  profile: typeof PRODUCTION_READINESS_PROFILE.name;
  assessment: "configuration";
  configurationReady: boolean;
  productionVerified: false;
  manualVerificationRequired: boolean;
  manualVerificationChecks: ProductionManualVerificationCheck[];
  /** @deprecated Use configurationReady. Kept for existing callers. */
  ok: boolean;
  issues: ProductionReadinessIssue[];
};

export type ProductionManualVerificationCheck = {
  id:
    | "temporary_asset_migration_applied"
    | "temporary_asset_bucket_contract"
    | "temporary_asset_role_access"
    | "temporary_asset_service_role_crud"
    | "generation_worker_platform_smoke";
  requiredWhen: "production_jobs_enabled";
  automated: false;
  message: string;
};

export const PRODUCTION_JOBS_MANUAL_VERIFICATION_CHECKS: readonly ProductionManualVerificationCheck[] =
  [
    {
      id: "temporary_asset_migration_applied",
      requiredWhen: "production_jobs_enabled",
      automated: false,
      message:
        "Apply supabase/migrations/202608130001_temporary_story_generation_assets.sql to the target Supabase project.",
    },
    {
      id: "temporary_asset_bucket_contract",
      requiredWhen: "production_jobs_enabled",
      automated: false,
      message:
        "Verify the configured temporary asset bucket exists, is private, permits only JPEG/PNG/WebP, and enforces the expected size limit.",
    },
    {
      id: "temporary_asset_role_access",
      requiredWhen: "production_jobs_enabled",
      automated: false,
      message:
        "Verify anonymous and authenticated browser clients cannot list, upload, download, update, or delete temporary asset objects directly.",
    },
    {
      id: "temporary_asset_service_role_crud",
      requiredWhen: "production_jobs_enabled",
      automated: false,
      message:
        "Using a disposable probe object, verify the service-role client can upload, download, and delete temporary asset bytes.",
    },
    {
      id: "generation_worker_platform_smoke",
      requiredWhen: "production_jobs_enabled",
      automated: false,
      message:
        "Verify the deployed worker trigger, lease reclaim, retry limits, stale-attempt fencing, authorization, and bounded cleanup on the target platform.",
    },
  ];

export const PRODUCTION_READINESS_ENV_NAMES = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "STORYBLOOM_PRODUCTION_JOBS_ENABLED",
  "GENERATION_WORKER_SECRET",
  "STORYBLOOM_ASSET_PRINCIPAL_SECRET",
  "GENERATION_WORKER_LEASE_MS",
  "GENERATION_WORKER_CLAIM_LIMIT",
  "GENERATION_RECLAIM_LIMIT",
  "STORYBLOOM_TEMP_ASSET_BACKEND",
  "STORYBLOOM_TEMP_ASSET_BUCKET",
  "STORYBLOOM_TEMP_ASSET_TTL_SECONDS",
  "STORYBLOOM_TEMP_ASSET_MAX_BYTES",
  "STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS",
  "STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT",
] as const;

const UPSTASH_PERSISTENCE_PAIR = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

const KV_PERSISTENCE_PAIR = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

const TURNSTILE_PAIR = [
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
] as const;

const SUPABASE_PUBLIC_KEY_ALTERNATIVES = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const PRODUCTION_JOBS_FLAG = "STORYBLOOM_PRODUCTION_JOBS_ENABLED";
const PRODUCTION_JOBS_ENABLED_VALUES = new Set(["1", "true", "on"]);
const PRODUCTION_JOBS_DISABLED_VALUES = new Set(["0", "false", "off"]);
const TEMPORARY_ASSET_BUCKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * Declarative environment contract for a deployed StoryBloom instance.
 *
 * Values are deliberately absent from this object. Feature-specific provider,
 * mail, analytics, and voice settings stay optional at the core profile level;
 * callers can add stricter feature profiles without weakening this baseline.
 */
export const PRODUCTION_READINESS_PROFILE = {
  name: "production",
  required: [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  oneOf: [
    {
      name: "supabase-public-key",
      variables: SUPABASE_PUBLIC_KEY_ALTERNATIVES,
      required: true,
    },
  ],
  paired: [
    {
      name: "turnstile",
      variables: TURNSTILE_PAIR,
      required: true,
    },
    {
      name: "upstash-shared-persistence",
      variables: UPSTASH_PERSISTENCE_PAIR,
      required: false,
      alternativeGroup: "shared-persistence",
    },
    {
      name: "vercel-kv-shared-persistence",
      variables: KV_PERSISTENCE_PAIR,
      required: false,
      alternativeGroup: "shared-persistence",
    },
  ],
  features: [
    {
      name: "production-jobs-and-assets",
      flag: PRODUCTION_JOBS_FLAG,
      defaultEnabled: false,
      requiredWhenEnabled: [
        "GENERATION_WORKER_SECRET",
        "STORYBLOOM_ASSET_PRINCIPAL_SECRET",
        "STORYBLOOM_TEMP_ASSET_BACKEND",
        "STORYBLOOM_TEMP_ASSET_BUCKET",
      ],
      dependencies: ["shared-persistence", "supabase"],
    },
  ],
  optional: [
    "STORY_TEXT_PROVIDER",
    "TEXT_MODEL_PROVIDER",
    "STORY_TEXT_MODEL",
    "CHARACTER_VISION_MODEL",
    "STORY_TEXT_TIMEOUT_MS",
    "STORY_TEXT_MAX_TOKENS",
    "STORY_TEXT_MAX_ATTEMPTS",
    "CPA_API_KEY",
    "CPA_BASE_URL",
    "CPA_TEXT_MODEL",
    "CPA_TEXT_TIMEOUT_MS",
    "CPA_IMAGE_MODEL",
    "CPA_IMAGE_SIZE",
    "CPA_IMAGE_REQUEST_DELAY_MS",
    "CPA_IMAGE_RETRY_DELAY_MS",
    "CPA_IMAGE_MAX_ATTEMPTS",
    "CPA_IMAGE_TIMEOUT_MS",
    "IMAGE_PROVIDER_ORDER",
    "IMAGE_PROVIDER",
    "IMAGE_TO_IMAGE_PROVIDER_ORDER",
    "IMAGE_GENERATION_CONCURRENCY",
    "AGNES_API_KEY",
    "AGNES_IMAGE_ENDPOINT",
    "AGNES_IMAGE_MODEL",
    "AGNES_IMAGE_SIZE",
    "AGNES_IMAGE_REQUEST_DELAY_MS",
    "AGNES_IMAGE_RETRY_DELAY_MS",
    "AGNES_IMAGE_MAX_ATTEMPTS",
    "AGNES_IMAGE_TIMEOUT_MS",
    "DASHSCOPE_API_KEY",
    "DASHSCOPE_IMAGE_MODEL",
    "DASHSCOPE_IMAGE_SIZE",
    "DASHSCOPE_IMAGE_CONCURRENCY",
    "DASHSCOPE_IMAGE_REQUEST_DELAY_MS",
    "DASHSCOPE_IMAGE_RATE_LIMIT_RETRY_MS",
    "DASHSCOPE_IMAGE_TIMEOUT_MS",
    "DASHSCOPE_NEGATIVE_PROMPT",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "CF_ACCOUNT_ID",
    "CF_API_TOKEN",
    "CLOUDFLARE_IMAGE_MODEL",
    "CLOUDFLARE_IMAGE_REQUEST_DELAY_MS",
    "CLOUDFLARE_IMAGE_RETRY_DELAY_MS",
    "CLOUDFLARE_IMAGE_MAX_ATTEMPTS",
    "CLOUDFLARE_IMAGE_TIMEOUT_MS",
    "HUGGINGFACE_API_TOKEN",
    "HUGGINGFACE_TOKEN",
    "HF_TOKEN",
    "HUGGINGFACE_IMAGE_ENDPOINT",
    "HUGGINGFACE_IMAGE_MODEL",
    "HUGGINGFACE_IMAGE_SIZE",
    "HUGGINGFACE_IMAGE_WIDTH",
    "HUGGINGFACE_IMAGE_HEIGHT",
    "HUGGINGFACE_IMAGE_REQUEST_DELAY_MS",
    "HUGGINGFACE_IMAGE_RETRY_DELAY_MS",
    "HUGGINGFACE_IMAGE_MAX_ATTEMPTS",
    "HUGGINGFACE_IMAGE_TIMEOUT_MS",
    "POLLINATIONS_IMAGE_ENDPOINT",
    "POLLINATIONS_IMAGE_MODEL",
    "POLLINATIONS_IMAGE_SIZE",
    "POLLINATIONS_IMAGE_WIDTH",
    "POLLINATIONS_IMAGE_HEIGHT",
    "POLLINATIONS_IMAGE_REQUEST_DELAY_MS",
    "POLLINATIONS_IMAGE_RETRY_DELAY_MS",
    "POLLINATIONS_IMAGE_MAX_ATTEMPTS",
    "POLLINATIONS_IMAGE_TIMEOUT_MS",
    "IMAGE_DOWNLOAD_TIMEOUT_MS",
    "FAMILY_REFERENCE_DOWNLOAD_MAX_ATTEMPTS",
    "FAMILY_REFERENCE_DOWNLOAD_RETRY_DELAY_MS",
    "SUPABASE_FAMILY_ASSETS_BUCKET",
    "STORYBLOOM_ALLOW_DEMO_IMAGES",
    "STORYBLOOM_CACHE_DIR",
    "STORYBLOOM_PRODUCTION_JOBS_ENABLED",
    "GENERATION_WORKER_SECRET",
    "STORYBLOOM_ASSET_PRINCIPAL_SECRET",
    "GENERATION_WORKER_LEASE_MS",
    "GENERATION_WORKER_CLAIM_LIMIT",
    "GENERATION_RECLAIM_LIMIT",
    "STORYBLOOM_TEMP_ASSET_BACKEND",
    "STORYBLOOM_TEMP_ASSET_BUCKET",
    "STORYBLOOM_TEMP_ASSET_DIR",
    "STORYBLOOM_TEMP_ASSET_TTL_SECONDS",
    "STORYBLOOM_TEMP_ASSET_MAX_BYTES",
    "STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS",
    "STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT",
    "DASHSCOPE_TOKEN_KEY",
    "TOKEN_PLAN_TTS_ENABLED",
    "TOKEN_PLAN_TTS_ENDPOINT",
    "TOKEN_PLAN_TTS_VOICE_ZH",
    "TOKEN_PLAN_TTS_VOICE_EN",
    "TOKEN_PLAN_TTS_TIMEOUT_MS",
    "GEMINI_API_KEY",
    "GEMINI_TTS_ENABLED",
    "GEMINI_TTS_BASE_URL",
    "GEMINI_TTS_MODEL",
    "GEMINI_TTS_VOICE_ZH",
    "GEMINI_TTS_VOICE_EN",
    "GEMINI_TTS_TIMEOUT_MS",
    "GEMINI_TTS_MAX_ATTEMPTS",
    "EDGE_TTS_VOICE_ZH",
    "EDGE_TTS_VOICE_EN",
    "EDGE_TTS_TIMEOUT_MS",
    "EDGE_TTS_MAX_ATTEMPTS",
    "EDGE_TTS_WEBSOCKET_URL",
    "STORY_AUDIO_SIGNED_URL_TTL_SECONDS",
    "NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED",
    "BAILIAN_VOICE_CLONING_API_KEY",
    "BAILIAN_VOICE_CLONING_ENDPOINT",
    "BAILIAN_VOICE_CLONING_TIMEOUT_MS",
    "FAMILY_VOICE_ENROLLMENT_RATE_LIMIT_PER_HOUR",
    "FAMILY_VOICE_SAMPLE_READ_RETRY_MS",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_REPLY_TO_EMAIL",
    "RESEND_TOPIC_ID",
    "RESEND_WEBHOOK_SECRET",
    "NEWSLETTER_CONSENT_VERSION",
    "NEWSLETTER_ACTION_SECRET",
    "NEWSLETTER_SEND_CONCURRENCY",
    "NEWSLETTER_TEXT_TIMEOUT_MS",
    "CRON_SECRET",
    "FREE_GENERATION_DAILY_LIMIT",
    "NEXT_PUBLIC_FREE_GENERATION_DAILY_LIMIT",
    "ILLUSTRATION_RATE_LIMIT_PER_STORY",
    "NEXT_PUBLIC_STORY_VIDEO_ENABLED",
    "NEXT_PUBLIC_REMOTION_LICENSE_KEY",
    "NEXT_PUBLIC_XIAOHONGSHU_ORDER_URL",
    "NEXT_PUBLIC_XIANYU_ORDER_URL",
    "NEXT_PUBLIC_TAWK_PROPERTY_ID",
    "NEXT_PUBLIC_TAWK_WIDGET_ID",
  ],
} as const;

function hasEnvironmentValue(environment: ProductionEnvironment, name: string) {
  const value = environment[name];
  return typeof value === "string" && value.trim().length > 0;
}

function pairState(
  environment: ProductionEnvironment,
  pair: readonly [string, string],
) {
  const first = hasEnvironmentValue(environment, pair[0]);
  const second = hasEnvironmentValue(environment, pair[1]);
  return {
    any: first || second,
    complete: first && second,
  };
}

function parseEnvironmentUrl(
  environment: ProductionEnvironment,
  name: string,
) {
  if (!hasEnvironmentValue(environment, name)) return null;
  try {
    return new URL(environment[name]!.trim());
  } catch {
    return undefined;
  }
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function checkApplicationUrl(
  environment: ProductionEnvironment,
  issues: ProductionReadinessIssue[],
) {
  const url = parseEnvironmentUrl(environment, "NEXT_PUBLIC_APP_URL");
  if (url === null) return;
  if (url === undefined) {
    issues.push({
      code: "invalid_app_url",
      severity: "error",
      message: "NEXT_PUBLIC_APP_URL must be a valid absolute URL.",
    });
    return;
  }
  if (isLocalHostname(url.hostname)) {
    issues.push({
      code: "app_url_localhost_forbidden",
      severity: "error",
      message: "NEXT_PUBLIC_APP_URL cannot use a localhost address in production.",
    });
  }
  if (url.protocol !== "https:") {
    issues.push({
      code: "app_url_https_required",
      severity: "error",
      message: "NEXT_PUBLIC_APP_URL must use HTTPS in production.",
    });
  }
}

function checkSupabaseBaseline(
  environment: ProductionEnvironment,
  issues: ProductionReadinessIssue[],
) {
  if (
    !SUPABASE_PUBLIC_KEY_ALTERNATIVES.some((name) =>
      hasEnvironmentValue(environment, name),
    )
  ) {
    issues.push({
      code: "supabase_public_key_required",
      severity: "error",
      message:
        "Configure NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    });
  }

  const url = parseEnvironmentUrl(environment, "NEXT_PUBLIC_SUPABASE_URL");
  if (url === null) return;
  if (url === undefined) {
    issues.push({
      code: "invalid_supabase_url",
      severity: "error",
      message: "NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.",
    });
    return;
  }
  if (url.protocol !== "https:") {
    issues.push({
      code: "supabase_url_https_required",
      severity: "error",
      message: "NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production.",
    });
  }
}

function checkTurnstilePair(
  environment: ProductionEnvironment,
  issues: ProductionReadinessIssue[],
) {
  const state = pairState(environment, TURNSTILE_PAIR);
  if (!state.any) {
    issues.push({
      code: "turnstile_required",
      severity: "error",
      message:
        "Production requires NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.",
    });
    return;
  }
  if (!state.complete) {
    issues.push({
      code: "turnstile_pair_incomplete",
      severity: "error",
      message:
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together.",
    });
  }
}

function checkSharedPersistence(
  environment: ProductionEnvironment,
  issues: ProductionReadinessIssue[],
) {
  const upstash = pairState(environment, UPSTASH_PERSISTENCE_PAIR);
  const kv = pairState(environment, KV_PERSISTENCE_PAIR);

  if (!upstash.any && !kv.any) {
    issues.push({
      code: "shared_persistence_required",
      severity: "error",
      message:
        "Production requires one complete shared persistence pair: UPSTASH_REDIS_REST_URL with UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL with KV_REST_API_TOKEN.",
    });
    return;
  }

  if (!upstash.complete && !kv.complete && upstash.any && kv.any) {
    issues.push({
      code: "shared_persistence_mixed_pairs",
      severity: "error",
      message:
        "Shared persistence cannot mix UPSTASH_REDIS_REST_* and KV_REST_API_* credentials; configure one matching URL and token pair.",
    });
    return;
  }

  if ((upstash.any && !upstash.complete) || (kv.any && !kv.complete)) {
    issues.push({
      code: "shared_persistence_pair_incomplete",
      severity: "error",
      message:
        "Each configured shared persistence backend must include its matching URL and token.",
    });
    return;
  }

  if (upstash.complete && kv.complete) {
    issues.push({
      code: "shared_persistence_multiple_backends",
      severity: "error",
      message:
        "Configure exactly one shared persistence pair; remove either the UPSTASH_REDIS_REST_* or KV_REST_API_* pair.",
    });
  }
}

function parseProductionJobsFlag(environment: ProductionEnvironment) {
  const raw = environment[PRODUCTION_JOBS_FLAG];
  if (raw === undefined || raw === null || raw.trim().length === 0) {
    return { enabled: false, valid: true };
  }
  const normalized = raw.trim().toLowerCase();
  if (PRODUCTION_JOBS_ENABLED_VALUES.has(normalized)) {
    return { enabled: true, valid: true };
  }
  if (PRODUCTION_JOBS_DISABLED_VALUES.has(normalized)) {
    return { enabled: false, valid: true };
  }
  return { enabled: false, valid: false };
}

function checkOptionalIntegerSetting(
  environment: ProductionEnvironment,
  issues: ProductionReadinessIssue[],
  name: string,
  minimum: number,
  maximum: number,
) {
  if (!hasEnvironmentValue(environment, name)) return;
  const value = environment[name]!.trim();
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    issues.push({
      code: "production_jobs_setting_invalid",
      severity: "error",
      message: `${name} must be an integer between ${minimum} and ${maximum}.`,
    });
  }
}

function checkProductionJobsAndAssets(
  environment: ProductionEnvironment,
  issues: ProductionReadinessIssue[],
) {
  const flag = parseProductionJobsFlag(environment);
  if (!flag.valid) {
    issues.push({
      code: "production_jobs_flag_invalid",
      severity: "error",
      message:
        "STORYBLOOM_PRODUCTION_JOBS_ENABLED must be one of 1, true, on, 0, false, or off.",
    });
    return;
  }
  if (!flag.enabled) return;

  if (!hasEnvironmentValue(environment, "GENERATION_WORKER_SECRET")) {
    issues.push({
      code: "generation_worker_secret_required",
      severity: "error",
      message:
        "Production jobs require a dedicated GENERATION_WORKER_SECRET.",
    });
  } else if (environment.GENERATION_WORKER_SECRET!.trim().length < 32) {
    issues.push({
      code: "generation_worker_secret_too_short",
      severity: "error",
      message: "GENERATION_WORKER_SECRET must contain at least 32 characters.",
    });
  }

  if (!hasEnvironmentValue(environment, "STORYBLOOM_ASSET_PRINCIPAL_SECRET")) {
    issues.push({
      code: "asset_principal_secret_required",
      severity: "error",
      message:
        "Production assets require a dedicated STORYBLOOM_ASSET_PRINCIPAL_SECRET.",
    });
  } else if (
    environment.STORYBLOOM_ASSET_PRINCIPAL_SECRET!.trim().length < 32
  ) {
    issues.push({
      code: "asset_principal_secret_too_short",
      severity: "error",
      message:
        "STORYBLOOM_ASSET_PRINCIPAL_SECRET must contain at least 32 characters.",
    });
  }

  if (!hasEnvironmentValue(environment, "STORYBLOOM_TEMP_ASSET_BACKEND")) {
    issues.push({
      code: "temporary_asset_backend_required",
      severity: "error",
      message:
        "Production jobs require STORYBLOOM_TEMP_ASSET_BACKEND=supabase.",
    });
  } else if (
    environment.STORYBLOOM_TEMP_ASSET_BACKEND!.trim().toLowerCase() !==
    "supabase"
  ) {
    issues.push({
      code: "temporary_asset_backend_unsupported",
      severity: "error",
      message:
        "STORYBLOOM_TEMP_ASSET_BACKEND must be supabase for production jobs.",
    });
  }

  if (!hasEnvironmentValue(environment, "STORYBLOOM_TEMP_ASSET_BUCKET")) {
    issues.push({
      code: "temporary_asset_bucket_required",
      severity: "error",
      message:
        "Production jobs require a private STORYBLOOM_TEMP_ASSET_BUCKET.",
    });
  } else if (
    !TEMPORARY_ASSET_BUCKET_PATTERN.test(
      environment.STORYBLOOM_TEMP_ASSET_BUCKET!.trim(),
    )
  ) {
    issues.push({
      code: "temporary_asset_bucket_invalid",
      severity: "error",
      message:
        "STORYBLOOM_TEMP_ASSET_BUCKET must be a valid Storage bucket name.",
    });
  }

  checkOptionalIntegerSetting(
    environment,
    issues,
    "GENERATION_WORKER_LEASE_MS",
    1_000,
    15 * 60 * 1_000,
  );
  checkOptionalIntegerSetting(
    environment,
    issues,
    "GENERATION_WORKER_CLAIM_LIMIT",
    1,
    20,
  );
  checkOptionalIntegerSetting(
    environment,
    issues,
    "GENERATION_RECLAIM_LIMIT",
    1,
    100,
  );
  checkOptionalIntegerSetting(
    environment,
    issues,
    "STORYBLOOM_TEMP_ASSET_TTL_SECONDS",
    1,
    7 * 24 * 60 * 60,
  );
  checkOptionalIntegerSetting(
    environment,
    issues,
    "STORYBLOOM_TEMP_ASSET_MAX_BYTES",
    1,
    16 * 1024 * 1024,
  );
  checkOptionalIntegerSetting(
    environment,
    issues,
    "STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS",
    1,
    24 * 60 * 60,
  );
  checkOptionalIntegerSetting(
    environment,
    issues,
    "STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT",
    1,
    500,
  );
}

export function evaluateProductionReadiness(
  environment: ProductionEnvironment,
): ProductionReadinessReport {
  const issues: ProductionReadinessIssue[] = [];

  for (const name of PRODUCTION_READINESS_PROFILE.required) {
    if (!hasEnvironmentValue(environment, name)) {
      issues.push({
        code: "missing_required_env",
        severity: "error",
        message: `Missing required environment variable: ${name}.`,
      });
    }
  }

  checkApplicationUrl(environment, issues);
  checkSupabaseBaseline(environment, issues);
  checkTurnstilePair(environment, issues);
  checkSharedPersistence(environment, issues);
  checkProductionJobsAndAssets(environment, issues);

  const productionJobsFlag = parseProductionJobsFlag(environment);
  const manualVerificationChecks =
    productionJobsFlag.valid && productionJobsFlag.enabled
      ? [...PRODUCTION_JOBS_MANUAL_VERIFICATION_CHECKS]
      : [];
  const configurationReady = !issues.some(
    (issue) => issue.severity === "error",
  );

  return {
    profile: PRODUCTION_READINESS_PROFILE.name,
    assessment: "configuration",
    configurationReady,
    productionVerified: false,
    manualVerificationRequired: manualVerificationChecks.length > 0,
    manualVerificationChecks,
    ok: configurationReady,
    issues,
  };
}

/**
 * Reads only the variable names used by the production baseline. The returned
 * values are meant to be passed directly into `evaluateProductionReadiness`;
 * reports never echo them back.
 */
export function readProductionReadinessEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ProductionEnvironment {
  return Object.fromEntries(
    PRODUCTION_READINESS_ENV_NAMES.map((name) => [name, environment[name]]),
  );
}
