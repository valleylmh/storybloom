import { describe, expect, it } from "vitest";
import {
  evaluateProductionReadiness,
  PRODUCTION_READINESS_PROFILE,
  type ProductionEnvironment,
} from "@/lib/production-readiness";

const healthyEnvironment: ProductionEnvironment = {
  NEXT_PUBLIC_APP_URL: "https://story.example.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "server-service-role-key",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "public-site-key",
  TURNSTILE_SECRET_KEY: "server-turnstile-secret",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "server-redis-token",
  STORYBLOOM_ASSET_PRINCIPAL_SECRET: "p".repeat(32),
  STORYBLOOM_TEMP_ASSET_BACKEND: "supabase",
  STORYBLOOM_TEMP_ASSET_BUCKET: "story-generation-assets",
};

function issueCodes(environment: ProductionEnvironment) {
  return evaluateProductionReadiness(environment).issues.map(
    (issue) => issue.code,
  );
}

describe("production readiness profile", () => {
  it("declares required, optional, one-of, and paired variables without values", () => {
    expect(PRODUCTION_READINESS_PROFILE.name).toBe("production");
    expect(PRODUCTION_READINESS_PROFILE.required).toContain(
      "NEXT_PUBLIC_APP_URL",
    );
    expect(PRODUCTION_READINESS_PROFILE.required).toContain(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(PRODUCTION_READINESS_PROFILE.optional).toContain("CPA_API_KEY");
    expect(PRODUCTION_READINESS_PROFILE.optional).toEqual(
      expect.arrayContaining([
        "AGNES_IMAGE_TIMEOUT_MS",
        "CLOUDFLARE_IMAGE_TIMEOUT_MS",
        "DASHSCOPE_IMAGE_TIMEOUT_MS",
        "HUGGINGFACE_IMAGE_TIMEOUT_MS",
        "POLLINATIONS_IMAGE_TIMEOUT_MS",
        "IMAGE_DOWNLOAD_TIMEOUT_MS",
      ]),
    );
    expect(PRODUCTION_READINESS_PROFILE.oneOf[0].variables).toEqual([
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ]);
    expect(PRODUCTION_READINESS_PROFILE.paired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "turnstile",
          variables: [
            "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
            "TURNSTILE_SECRET_KEY",
          ],
        }),
        expect.objectContaining({
          name: "upstash-shared-persistence",
          variables: [
            "UPSTASH_REDIS_REST_URL",
            "UPSTASH_REDIS_REST_TOKEN",
          ],
        }),
        expect.objectContaining({
          name: "vercel-kv-shared-persistence",
          variables: ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
        }),
      ]),
    );
    expect(PRODUCTION_READINESS_PROFILE.features).toContainEqual(
      expect.objectContaining({
        name: "production-jobs",
        flag: "STORYBLOOM_PRODUCTION_JOBS_ENABLED",
        defaultEnabled: false,
      }),
    );
  });

  it("accepts a complete Upstash production baseline", () => {
    expect(evaluateProductionReadiness(healthyEnvironment)).toMatchObject({
      profile: "production",
      assessment: "configuration",
      configurationReady: true,
      productionVerified: false,
      manualVerificationRequired: true,
      ok: true,
      issues: [],
    });
    expect(
      evaluateProductionReadiness(healthyEnvironment).manualVerificationChecks.map(
        (check) => check.id,
      ),
    ).toEqual([
      "temporary_asset_migration_applied",
      "temporary_asset_bucket_contract",
      "temporary_asset_role_access",
      "temporary_asset_service_role_crud",
    ]);
  });

  it("accepts the Supabase publishable key and a complete KV pair", () => {
    const {
      NEXT_PUBLIC_SUPABASE_ANON_KEY: _anonKey,
      UPSTASH_REDIS_REST_URL: _upstashUrl,
      UPSTASH_REDIS_REST_TOKEN: _upstashToken,
      ...environment
    } = healthyEnvironment;

    expect(
      evaluateProductionReadiness({
        ...environment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-publishable-key",
        KV_REST_API_URL: "https://kv.example.com",
        KV_REST_API_TOKEN: "server-kv-token",
      }),
    ).toMatchObject({ ok: true, issues: [] });
  });

  it("reports missing required variables and the Supabase public key baseline", () => {
    const report = evaluateProductionReadiness({});

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_required_env",
          severity: "error",
          message: expect.stringContaining("NEXT_PUBLIC_APP_URL"),
        }),
        expect.objectContaining({
          code: "supabase_public_key_required",
          severity: "error",
        }),
        expect.objectContaining({
          code: "turnstile_required",
          severity: "error",
        }),
        expect.objectContaining({
          code: "shared_persistence_required",
          severity: "error",
        }),
      ]),
    );
  });

  it("rejects invalid, insecure, and localhost application URLs", () => {
    expect(
      issueCodes({ ...healthyEnvironment, NEXT_PUBLIC_APP_URL: "not a url" }),
    ).toContain("invalid_app_url");
    expect(
      issueCodes({
        ...healthyEnvironment,
        NEXT_PUBLIC_APP_URL: "http://story.example.com",
      }),
    ).toContain("app_url_https_required");

    for (const localUrl of [
      "http://localhost:3000",
      "https://preview.localhost",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
    ]) {
      expect(
        issueCodes({ ...healthyEnvironment, NEXT_PUBLIC_APP_URL: localUrl }),
      ).toContain("app_url_localhost_forbidden");
    }
  });

  it("requires a valid HTTPS Supabase URL", () => {
    expect(
      issueCodes({
        ...healthyEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "supabase.local",
      }),
    ).toContain("invalid_supabase_url");
    expect(
      issueCodes({
        ...healthyEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "http://supabase.example.com",
      }),
    ).toContain("supabase_url_https_required");
  });

  it("requires both Turnstile variables together", () => {
    const {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: _siteKey,
      TURNSTILE_SECRET_KEY: _secretKey,
      ...withoutTurnstile
    } = healthyEnvironment;

    expect(issueCodes(withoutTurnstile)).toContain("turnstile_required");
    expect(
      issueCodes({
        ...withoutTurnstile,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "public-site-key",
      }),
    ).toContain("turnstile_pair_incomplete");
    expect(
      issueCodes({
        ...withoutTurnstile,
        TURNSTILE_SECRET_KEY: "server-secret",
      }),
    ).toContain("turnstile_pair_incomplete");
  });

  it("rejects incomplete and cross-family shared persistence pairs", () => {
    const {
      UPSTASH_REDIS_REST_URL: _url,
      UPSTASH_REDIS_REST_TOKEN: _token,
      ...withoutPersistence
    } = healthyEnvironment;

    expect(
      issueCodes({
        ...withoutPersistence,
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      }),
    ).toContain("shared_persistence_pair_incomplete");

    const mixedReport = evaluateProductionReadiness({
      ...withoutPersistence,
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      KV_REST_API_TOKEN: "server-kv-token",
    });
    expect(mixedReport.ok).toBe(false);
    expect(mixedReport.issues).toContainEqual(
      expect.objectContaining({
        code: "shared_persistence_mixed_pairs",
        severity: "error",
      }),
    );
  });

  it("rejects when both complete persistence backends are configured", () => {
    const report = evaluateProductionReadiness({
      ...healthyEnvironment,
      KV_REST_API_URL: "https://kv.example.com",
      KV_REST_API_TOKEN: "server-kv-token",
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: "shared_persistence_multiple_backends",
        severity: "error",
      }),
    ]);
  });

  it("never includes configured secret values in issues", () => {
    const distinctiveSecret = "do-not-leak-this-secret-value";
    const report = evaluateProductionReadiness({
      ...healthyEnvironment,
      NEXT_PUBLIC_APP_URL: distinctiveSecret,
      TURNSTILE_SECRET_KEY: distinctiveSecret,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      KV_REST_API_TOKEN: distinctiveSecret,
    });

    expect(JSON.stringify(report)).not.toContain(distinctiveSecret);
  });

  it("keeps the production jobs profile optional while its flag is disabled", () => {
    expect(
      evaluateProductionReadiness({
        ...healthyEnvironment,
        STORYBLOOM_PRODUCTION_JOBS_ENABLED: "0",
      }),
    ).toMatchObject({ ok: true, issues: [] });
  });

  it("requires private shared illustration assets even while production jobs are disabled", () => {
    const report = evaluateProductionReadiness({
      ...healthyEnvironment,
      STORYBLOOM_PRODUCTION_JOBS_ENABLED: "0",
      STORYBLOOM_ASSET_PRINCIPAL_SECRET: undefined,
      STORYBLOOM_TEMP_ASSET_BACKEND: undefined,
      STORYBLOOM_TEMP_ASSET_BUCKET: undefined,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "asset_principal_secret_required" }),
        expect.objectContaining({ code: "temporary_asset_backend_required" }),
        expect.objectContaining({ code: "temporary_asset_bucket_required" }),
      ]),
    );
  });

  it("reports configuration readiness without claiming production verification", () => {
    const report = evaluateProductionReadiness({
      ...healthyEnvironment,
      STORYBLOOM_PRODUCTION_JOBS_ENABLED: "1",
      GENERATION_WORKER_SECRET: "w".repeat(32),
      STORYBLOOM_ASSET_PRINCIPAL_SECRET: "p".repeat(32),
      STORYBLOOM_TEMP_ASSET_BACKEND: "supabase",
      STORYBLOOM_TEMP_ASSET_BUCKET: "story-generation-temp",
      GENERATION_WORKER_LEASE_MS: "300000",
      GENERATION_WORKER_CLAIM_LIMIT: "4",
      GENERATION_RECLAIM_LIMIT: "20",
      STORYBLOOM_TEMP_ASSET_TTL_SECONDS: "86400",
      STORYBLOOM_TEMP_ASSET_MAX_BYTES: String(8 * 1024 * 1024),
      STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS: "3600",
      STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT: "100",
    });

    expect(report).toMatchObject({
      assessment: "configuration",
      configurationReady: true,
      productionVerified: false,
      manualVerificationRequired: true,
      ok: true,
      issues: [],
    });
    expect(report.manualVerificationChecks.map((check) => check.id)).toEqual([
      "temporary_asset_migration_applied",
      "temporary_asset_bucket_contract",
      "temporary_asset_role_access",
      "temporary_asset_service_role_crud",
      "generation_worker_platform_smoke",
    ]);
    expect(report.manualVerificationChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ automated: false }),
      ]),
    );
  });

  it("rejects incomplete or unsupported production job settings when enabled", () => {
    const missing = evaluateProductionReadiness({
      ...healthyEnvironment,
      STORYBLOOM_PRODUCTION_JOBS_ENABLED: "true",
      STORYBLOOM_ASSET_PRINCIPAL_SECRET: undefined,
      STORYBLOOM_TEMP_ASSET_BACKEND: undefined,
      STORYBLOOM_TEMP_ASSET_BUCKET: undefined,
    });
    expect(missing.ok).toBe(false);
    expect(missing.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "generation_worker_secret_required",
        }),
        expect.objectContaining({
          code: "asset_principal_secret_required",
        }),
        expect.objectContaining({
          code: "temporary_asset_backend_required",
        }),
        expect.objectContaining({
          code: "temporary_asset_bucket_required",
        }),
      ]),
    );

    const invalid = evaluateProductionReadiness({
      ...healthyEnvironment,
      STORYBLOOM_PRODUCTION_JOBS_ENABLED: "on",
      GENERATION_WORKER_SECRET: "too-short",
      STORYBLOOM_ASSET_PRINCIPAL_SECRET: "also-too-short",
      STORYBLOOM_TEMP_ASSET_BACKEND: "local-file",
      STORYBLOOM_TEMP_ASSET_BUCKET: "bad/bucket",
      GENERATION_WORKER_LEASE_MS: "999",
      GENERATION_WORKER_CLAIM_LIMIT: "21",
    });
    expect(issueCodes({
      ...healthyEnvironment,
      STORYBLOOM_PRODUCTION_JOBS_ENABLED: "sometimes",
    })).toContain("production_jobs_flag_invalid");
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "generation_worker_secret_too_short" }),
        expect.objectContaining({ code: "asset_principal_secret_too_short" }),
        expect.objectContaining({ code: "temporary_asset_backend_unsupported" }),
        expect.objectContaining({ code: "temporary_asset_bucket_invalid" }),
        expect.objectContaining({ code: "production_jobs_setting_invalid" }),
      ]),
    );
  });

  it("does not include the production worker secret in readiness issues", () => {
    const distinctiveSecret = "worker-secret-that-must-never-be-printed";
    const report = evaluateProductionReadiness({
      ...healthyEnvironment,
      STORYBLOOM_PRODUCTION_JOBS_ENABLED: "1",
      GENERATION_WORKER_SECRET: distinctiveSecret,
      STORYBLOOM_ASSET_PRINCIPAL_SECRET: distinctiveSecret,
      STORYBLOOM_TEMP_ASSET_BACKEND: "unsupported",
      STORYBLOOM_TEMP_ASSET_BUCKET: "story-generation-temp",
    });

    expect(JSON.stringify(report)).not.toContain(distinctiveSecret);
  });

  it("treats whitespace-only environment variables as missing", () => {
    const report = evaluateProductionReadiness({
      ...healthyEnvironment,
      SUPABASE_SERVICE_ROLE_KEY: "   ",
    });

    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_required_env",
        message: expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY"),
      }),
    );
  });
});
