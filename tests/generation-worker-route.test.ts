import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runGenerationWorker: vi.fn() }));

vi.mock("@/lib/generation-worker", () => ({
  runGenerationWorker: mocks.runGenerationWorker,
}));

import { POST } from "@/app/api/cron/generation-jobs/route";

const SECRET = "worker-secret-with-at-least-thirty-two-chars";

beforeEach(() => {
  vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "1");
  vi.stubEnv("GENERATION_WORKER_SECRET", SECRET);
  mocks.runGenerationWorker.mockResolvedValue({
    reclaimed: { requeued: 0, dead: 0, removed: 0 },
    assetSweep: {
      deletedExpiredAssets: 1,
      deletedOrphans: 0,
      deletedTemporaryFiles: 0,
    },
    claimed: 1,
    succeeded: 1,
    requeued: 0,
    dead: 0,
    ignored: 0,
    cleanupAcknowledged: 1,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("generation jobs cron route", () => {
  it("is hidden while durable jobs are disabled", async () => {
    vi.stubEnv("STORYBLOOM_PRODUCTION_JOBS_ENABLED", "0");
    const response = await POST(new Request("http://localhost/api/cron/generation-jobs"));
    expect(response.status).toBe(404);
    expect(mocks.runGenerationWorker).not.toHaveBeenCalled();
  });

  it("requires a configured dedicated bearer secret", async () => {
    expect(
      (await POST(new Request("http://localhost/api/cron/generation-jobs"))).status,
    ).toBe(401);
    vi.stubEnv("GENERATION_WORKER_SECRET", "short");
    expect(
      (await POST(new Request("http://localhost/api/cron/generation-jobs"))).status,
    ).toBe(503);
  });

  it("runs the bounded worker only through authenticated POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/generation-jobs", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        ok: true,
        claimed: 1,
        assetSweep: { deletedExpiredAssets: 1 },
      });
    expect(mocks.runGenerationWorker).toHaveBeenCalledOnce();
  });
});
