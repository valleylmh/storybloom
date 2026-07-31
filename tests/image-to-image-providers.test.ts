import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminMock } = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getCachedCharacterReferenceDataUri: vi.fn(async () =>
    "data:image/webp;base64,cmVmZXJlbmNl"
  ),
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import {
  generateIllustration,
  getImageToImageProviderForPage,
  getProviderForPage,
} from "@/lib/image-generator";

const envKeys = [
  "IMAGE_TO_IMAGE_PROVIDER_ORDER",
  "IMAGE_PROVIDER_ORDER",
  "AGNES_API_KEY",
  "AGNES_IMAGE_REQUEST_DELAY_MS",
  "AGNES_IMAGE_MAX_ATTEMPTS",
  "CPA_API_KEY",
  "CPA_BASE_URL",
  "CPA_IMAGE_MODEL",
  "CPA_IMAGE_REQUEST_DELAY_MS",
  "CPA_IMAGE_MAX_ATTEMPTS",
  "CPA_IMAGE_TIMEOUT_MS",
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  getSupabaseAdminMock.mockReset();
  process.env.AGNES_IMAGE_REQUEST_DELAY_MS = "0";
  process.env.AGNES_IMAGE_MAX_ATTEMPTS = "1";
  process.env.CPA_IMAGE_REQUEST_DELAY_MS = "0";
  process.env.CPA_IMAGE_MAX_ATTEMPTS = "1";
  process.env.CPA_IMAGE_TIMEOUT_MS = "5000";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  for (const key of envKeys) {
    const original = originalEnv[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("image-to-image provider routing", () => {
  it("keeps configured ordinary providers distributed across book pages", () => {
    process.env.AGNES_API_KEY = "agnes-test";
    process.env.IMAGE_PROVIDER_ORDER = "agnes:1,pollinations:1";

    expect(getProviderForPage(1)).toBe("agnes");
    expect(getProviderForPage(2)).toBe("pollinations");
    expect(getProviderForPage(3)).toBe("agnes");
    expect(getProviderForPage(8)).toBe("pollinations");
  });

  it("supports IMAGE_TO_IMAGE_PROVIDER_ORDER weights", () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.AGNES_API_KEY = "agnes-test";
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "cpa:2,agnes:1";

    expect(getImageToImageProviderForPage(1)).toBe("cpa");
    expect(getImageToImageProviderForPage(2)).toBe("cpa");
    expect(getImageToImageProviderForPage(3)).toBe("agnes");
    expect(getImageToImageProviderForPage(4)).toBe("cpa");
  });

  it("sends the uploaded reference to CPA Nano Banana 2", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "cpa:1";
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gemini-3.1-flash-image";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "data:image/png;base64,Y3BhLWltYWdl" } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A child explores a garden", 1, {
      pageNumber: 1,
      style: "watercolor",
      characterReferenceId: "custom-upload",
      customCharacterReferenceToken: "a".repeat(43),
      preferredProvider: "cpa",
    });

    expect(result.provider).toBe("cpa");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://relay.example/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gemini-3.1-flash-image");
    expect(body.modalities).toEqual(["text", "image"]);
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/webp;base64,cmVmZXJlbmNl" },
    });
  });

  it("sends the uploaded reference through Agnes extra_body.image", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "agnes:1";
    process.env.AGNES_API_KEY = "agnes-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ b64_json: "YWduZXMtaW1hZ2U=" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A child reads under a tree", 2, {
      pageNumber: 2,
      style: "fairytale",
      characterReferenceId: "custom-upload",
      customCharacterReferenceToken: "b".repeat(43),
      preferredProvider: "agnes",
    });

    expect(result.provider).toBe("agnes");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.extra_body).toEqual({
      image: ["data:image/webp;base64,cmVmZXJlbmNl"],
      response_format: "b64_json",
    });
  });

  it("sends only the page cast family references to CPA in character order", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gemini-3.1-flash-image";
    const download = vi
      .fn()
      .mockResolvedValueOnce({ data: new Blob(["one"], { type: "image/webp" }), error: null })
      .mockResolvedValueOnce({ data: new Blob(["two"], { type: "image/png" }), error: null });
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: () => ({ download }) },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,Y3Bh" } }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A family pool scene", 3, {
      pageNumber: 1,
      style: "fairytale",
      preferredProvider: "cpa",
      castIds: ["child", "mother"],
      familyCharacters: [
        {
          id: "child",
          name: "童童",
          relation: "孩子",
          appearance: "短发孩子",
          referenceAssetPath: "user/child/canonical.png",
          isProtagonist: true,
        },
        {
          id: "mother",
          name: "妈妈",
          relation: "妈妈",
          appearance: "长发妈妈",
          referenceAssetPath: "user/mother/canonical.png",
        },
        {
          id: "father",
          name: "爸爸",
          relation: "爸爸",
          appearance: "爸爸",
          referenceAssetPath: "user/father/canonical.png",
        },
      ],
    });

    expect(result.provider).toBe("cpa");
    expect(download).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.messages[0].content.slice(1)).toEqual([
      { type: "image_url", image_url: { url: "data:image/webp;base64,b25l" } },
      { type: "image_url", image_url: { url: "data:image/png;base64,dHdv" } },
    ]);
  });

  it("does not use CPA for a saved name without a canonical photo", async () => {
    process.env.IMAGE_PROVIDER_ORDER = "pollinations:1";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A child at the pool", 4, {
      pageNumber: 1,
      style: "fairytale",
      castIds: ["child"],
      familyCharacters: [
        {
          id: "child",
          name: "童童",
          relation: "孩子",
          appearance: "童童",
          isProtagonist: true,
        },
      ],
    });

    expect(result.provider).toBe("pollinations");
    expect(String(fetchMock.mock.calls[0][0])).toContain("image.pollinations.ai");
  });

  it("keeps photo-backed family generation on CPA when CPA fails", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.AGNES_API_KEY = "agnes-test";
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: () => ({
          download: vi.fn().mockResolvedValue({
            data: new Blob(["child"], { type: "image/webp" }),
            error: null,
          }),
        }),
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "CPA unavailable" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateIllustration("A child at the pool", 5, {
        pageNumber: 1,
        style: "fairytale",
        castIds: ["child"],
        familyCharacters: [
          {
            id: "child",
            name: "童童",
            relation: "孩子",
            appearance: "童童",
            referenceAssetPath: "user/child/canonical.png",
          },
        ],
      }),
    ).rejects.toThrow(/CPA unavailable/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay.example/v1/chat/completions",
    );
  });
});
