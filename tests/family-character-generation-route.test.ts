import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  generateCpaReferenceImage: vi.fn(),
}));

vi.mock("@/lib/supabase/server-auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

vi.mock("@/lib/image-generator", () => ({
  generateCpaReferenceImage: mocks.generateCpaReferenceImage,
}));

import { POST } from "@/app/api/family/characters/[id]/generate/route";

const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function createCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: CHARACTER_ID,
    user_id: USER_ID,
    display_name: "童童",
    relationship: "孩子",
    kind: "person",
    description: "",
    source_photo_path: `${USER_ID}/${CHARACTER_ID}/source.webp`,
    cartoonize: true,
    canonical_generation_count: 0,
    status: "source_uploaded",
    ...overrides,
  };
}

function mockCharacterLookup(character: ReturnType<typeof createCharacter>) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: character, error: null }));
  mocks.getSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => query),
  });
}

async function callRoute() {
  return POST(
    new Request(`http://localhost/api/family/characters/${CHARACTER_ID}/generate`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: CHARACTER_ID }) },
  );
}

describe("family character generation route limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ id: USER_ID });
  });

  it("rejects a sixth cartoon generation before calling the provider", async () => {
    mockCharacterLookup(createCharacter({ canonical_generation_count: 5 }));

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("用完 5 次");
    expect(mocks.generateCpaReferenceImage).not.toHaveBeenCalled();
  });

  it("does not generate when the character keeps the real photo", async () => {
    mockCharacterLookup(createCharacter({ cartoonize: false }));

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("开启卡通化");
    expect(mocks.generateCpaReferenceImage).not.toHaveBeenCalled();
  });

  it("claims one server-side attempt before generating the cartoon image", async () => {
    const lookup: Record<string, ReturnType<typeof vi.fn>> = {};
    lookup.select = vi.fn(() => lookup);
    lookup.eq = vi.fn(() => lookup);
    lookup.maybeSingle = vi.fn(async () => ({
      data: createCharacter({ canonical_generation_count: 0 }),
      error: null,
    }));

    const claim: Record<string, ReturnType<typeof vi.fn>> = {};
    claim.update = vi.fn(() => claim);
    claim.eq = vi.fn(() => claim);
    claim.neq = vi.fn(() => claim);
    claim.lt = vi.fn(() => claim);
    claim.select = vi.fn(() => claim);
    claim.maybeSingle = vi.fn(async () => ({
      data: { canonical_generation_count: 1 },
      error: null,
    }));

    const finish = {
      update: vi.fn(),
      eq: vi.fn(),
      then: (
        resolve: (value: { error: null }) => unknown,
      ) => Promise.resolve({ error: null }).then(resolve),
    };
    finish.update.mockReturnValue(finish);
    finish.eq.mockReturnValue(finish);

    const from = vi
      .fn()
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(claim)
      .mockReturnValueOnce(finish);
    mocks.getSupabaseAdmin.mockReturnValue({
      from,
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async () => ({
            data: new Blob(["source"], { type: "image/webp" }),
            error: null,
          })),
          upload: vi.fn(async () => ({ error: null })),
        })),
      },
    });
    mocks.generateCpaReferenceImage.mockResolvedValue(
      "data:image/png;base64,aW1hZ2U=",
    );

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generationCount).toBe(1);
    expect(body.remainingGenerations).toBe(4);
    expect(claim.update).toHaveBeenCalledWith(
      expect.objectContaining({ canonical_generation_count: 1 }),
    );
    expect(mocks.generateCpaReferenceImage).toHaveBeenCalledOnce();
    expect(finish.update).toHaveBeenCalledWith(
      expect.objectContaining({
        canonical_crop: { x: 50, y: 50, zoom: 1 },
      }),
    );
  });

  it("returns the claimed generation when the image model fails", async () => {
    const lookup: Record<string, ReturnType<typeof vi.fn>> = {};
    lookup.select = vi.fn(() => lookup);
    lookup.eq = vi.fn(() => lookup);
    lookup.maybeSingle = vi.fn(async () => ({
      data: createCharacter({ canonical_generation_count: 0 }),
      error: null,
    }));

    const claim: Record<string, ReturnType<typeof vi.fn>> = {};
    claim.update = vi.fn(() => claim);
    claim.eq = vi.fn(() => claim);
    claim.neq = vi.fn(() => claim);
    claim.lt = vi.fn(() => claim);
    claim.select = vi.fn(() => claim);
    claim.maybeSingle = vi.fn(async () => ({
      data: { canonical_generation_count: 1 },
      error: null,
    }));

    const rollback = {
      update: vi.fn(),
      eq: vi.fn(),
      then: (
        resolve: (value: { error: null }) => unknown,
      ) => Promise.resolve({ error: null }).then(resolve),
    };
    rollback.update.mockReturnValue(rollback);
    rollback.eq.mockReturnValue(rollback);

    const admin = {
      from: vi
        .fn()
        .mockReturnValueOnce(lookup)
        .mockReturnValueOnce(claim)
        .mockReturnValueOnce(rollback),
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async () => ({
            data: new Blob(["source"], { type: "image/webp" }),
            error: null,
          })),
        })),
      },
    };
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    mocks.generateCpaReferenceImage.mockRejectedValue(
      new Error("provider unavailable"),
    );

    const response = await callRoute();

    expect(response.status).toBe(500);
    expect(rollback.update).toHaveBeenCalledWith(
      expect.objectContaining({ canonical_generation_count: 0 }),
    );
  });
});
