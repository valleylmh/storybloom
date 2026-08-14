import { describe, expect, it } from "vitest";
import { evaluateTemporaryStoryAssetBackendConfigurationReadiness } from "@/lib/temporary-story-asset-config";

describe("temporary story asset backend configuration readiness", () => {
  it("describes local files as development configuration, not production verification", () => {
    expect(
      evaluateTemporaryStoryAssetBackendConfigurationReadiness({}),
    ).toEqual({
      status: "ready",
      assessment: "configuration",
      configurationReady: true,
      productionVerified: false,
      backend: "local-file",
      bucket: null,
      shared: false,
    });
  });

  it("describes valid Supabase env as configuration-ready only", () => {
    expect(
      evaluateTemporaryStoryAssetBackendConfigurationReadiness({
        STORYBLOOM_TEMP_ASSET_BACKEND: "supabase",
        STORYBLOOM_TEMP_ASSET_BUCKET: "story-generation-assets",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      }),
    ).toEqual({
      status: "ready",
      assessment: "configuration",
      configurationReady: true,
      productionVerified: false,
      backend: "supabase",
      bucket: "story-generation-assets",
      shared: true,
    });
  });

  it("rejects Supabase configuration with an invalid bucket or missing admin env", () => {
    expect(
      evaluateTemporaryStoryAssetBackendConfigurationReadiness({
        STORYBLOOM_TEMP_ASSET_BACKEND: "supabase",
        STORYBLOOM_TEMP_ASSET_BUCKET: "bad/bucket",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      }),
    ).toMatchObject({
      status: "invalid",
      assessment: "configuration",
      configurationReady: false,
      productionVerified: false,
      reason: "invalid_bucket",
    });

    expect(
      evaluateTemporaryStoryAssetBackendConfigurationReadiness({
        STORYBLOOM_TEMP_ASSET_BACKEND: "supabase",
        STORYBLOOM_TEMP_ASSET_BUCKET: "story-generation-assets",
      }),
    ).toMatchObject({
      status: "invalid",
      reason: "supabase_admin_configuration_incomplete",
    });
  });
});
