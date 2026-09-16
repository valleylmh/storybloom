import { beforeEach, describe, it, expect, vi } from "vitest";
const auth = vi.hoisted(() => ({ require: vi.fn() }));
vi.mock("@/lib/supabase/server-auth", () => ({
  requireAuthenticatedUser: auth.require,
  AuthenticationError: class extends Error {},
}));
const storage = vi.hoisted(() => ({
  rpc: vi.fn(),
  get: vi.fn(),
  quota: vi.fn(),
  reserve: vi.fn(),
  publicJob: vi.fn(),
  advance: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ rpc: storage.rpc }),
}));
vi.mock("@/lib/custom-book/service", () => ({
  customQuota: storage.quota,
  reserveCustomJob: storage.reserve,
  publicCustomJob: storage.publicJob,
  getCustomJob: storage.get,
  advanceCustomJob: storage.advance,
  confirmCustomOutline: storage.confirm,
  cancelCustomJob: storage.cancel,
}));
import { AuthenticationError } from "@/lib/supabase/server-auth";
import { GET, POST } from "@/app/api/custom/jobs/route";
import { POST as act, GET as getJob } from "@/app/api/custom/jobs/[id]/route";
import { POST as redeem } from "@/app/api/custom/redeem/route";
import {
  assertOwnedAssets,
  customDraftSchema,
  imageUnits,
} from "@/lib/custom-book/schema";
import { createWorkbenchDraft, makeAsset } from "@/lib/custom-workbench";
const owner = "11111111-1111-4111-8111-111111111111";
const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ id: jobId }) };
beforeEach(() => {
  vi.clearAllMocks();
  auth.require.mockResolvedValue({ id: owner });
  storage.publicJob.mockImplementation((j) => j);
});
describe("custom book API boundaries", () => {
  it("requires authentication for quota, creation, advancement and redemption", async () => {
    auth.require.mockRejectedValue(new AuthenticationError("请登录"));
    for (const response of [
      await GET(new Request("http://test")),
      await POST(new Request("http://test", { method: "POST", body: "{}" })),
      await act(
        new Request("http://test", { method: "POST", body: "{}" }),
        context,
      ),
      await redeem(new Request("http://test", { method: "POST", body: "{}" })),
    ])
      expect(response.status).toBe(401);
    expect(storage.reserve).not.toHaveBeenCalled();
    expect(storage.rpc).not.toHaveBeenCalled();
  });
  it("passes the authenticated owner, never a caller-provided owner, to task reads", async () => {
    storage.get.mockResolvedValue({ id: jobId });
    await getJob(new Request("http://test"), context);
    expect(storage.get).toHaveBeenCalledWith(owner, jobId);
  });
  it("does not accept caller changes to model, assets or quota through a confirm action", async () => {
    const pages = Array.from({ length: 4 }, () => ({
      text: "hello",
      scene: "garden",
      characters: [],
      asset: { storagePath: "other/photo.jpg" },
    }));
    storage.confirm.mockResolvedValue({ id: jobId });
    const response = await act(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          action: "confirm",
          pages,
          userId: "other",
          model: "free-model",
        }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(storage.confirm.mock.calls[0][0]).toBe(owner);
    expect(storage.confirm.mock.calls[0][2][0]).not.toHaveProperty("asset");
  });
  it("hashes normalized redemption codes and never sends plaintext to database", async () => {
    storage.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await redeem(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ code: "abcde-12345" }),
      }),
    );
    expect(storage.rpc.mock.calls[0][1].p_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(storage.rpc.mock.calls[0][1]).not.toHaveProperty("code");
  });
  it("rejects foreign storage paths and excludes adjacent independent pages from a spread", () => {
    const draft = createWorkbenchDraft(false);
    draft.title = "Test";
    draft.characters[0].name = "Hero";
    draft.cover = {
      ...makeAsset("", "photo", "cover"),
      storagePath: "foreign/inputs/photo.jpg",
    };
    const parsed = customDraftSchema.parse(draft);
    expect(() => assertOwnedAssets(parsed, owner)).toThrow("不属于");
    parsed.cover = undefined;
    parsed.spreads = [2, 6];
    parsed.pageCount = 4;
    expect(imageUnits(parsed).filter((u) => u.kind === "page")).toEqual([
      { kind: "page", index: 0, spread: false },
      { kind: "page", index: 1, spread: true },
      { kind: "page", index: 3, spread: false },
    ]);
  });
});
