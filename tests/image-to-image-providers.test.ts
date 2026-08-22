import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminMock, inspectIllustrationQualityMock } = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  inspectIllustrationQualityMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getCachedCharacterReferenceDataUri: vi.fn(async () =>
    "data:image/webp;base64,cmVmZXJlbmNl"
  ),
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/illustration-quality", () => ({
  inspectIllustrationQuality: inspectIllustrationQualityMock,
  createDemoIllustrationQualityReport: vi.fn(() => ({
    version: 1 as const,
    status: "demo" as const,
    width: 1024,
    height: 1024,
    format: "svg",
    bytes: 0,
  })),
}));

import {
  generateCpaReferenceImage,
  generateCpaStoryCharacterAnchor,
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
  "FAMILY_REFERENCE_DOWNLOAD_MAX_ATTEMPTS",
  "FAMILY_REFERENCE_DOWNLOAD_RETRY_DELAY_MS",
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  getSupabaseAdminMock.mockReset();
  inspectIllustrationQualityMock.mockReset().mockResolvedValue({
    version: 1 as const,
    status: "passed" as const,
    width: 1024,
    height: 1024,
    format: "png",
    bytes: 2048,
  });
  process.env.AGNES_IMAGE_REQUEST_DELAY_MS = "0";
  process.env.AGNES_IMAGE_MAX_ATTEMPTS = "1";
  process.env.CPA_IMAGE_REQUEST_DELAY_MS = "0";
  process.env.CPA_IMAGE_MAX_ATTEMPTS = "1";
  process.env.CPA_IMAGE_TIMEOUT_MS = "5000";
  process.env.FAMILY_REFERENCE_DOWNLOAD_MAX_ATTEMPTS = "3";
  process.env.FAMILY_REFERENCE_DOWNLOAD_RETRY_DELAY_MS = "1";
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

  it("allows gpt-image models to participate in ordinary CPA page routing", () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gpt-image-1.5";
    process.env.IMAGE_PROVIDER_ORDER = "cpa:1,agnes:1";
    process.env.AGNES_API_KEY = "agnes-test";

    expect(getProviderForPage(1)).toBe("cpa");
    expect(getProviderForPage(2)).toBe("agnes");
  });

  it("keeps chat-based CPA image models out of ordinary page routing", () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gemini-3.1-flash-image";
    process.env.IMAGE_PROVIDER_ORDER = "cpa:1,agnes:1";
    process.env.AGNES_API_KEY = "agnes-test";

    expect(getProviderForPage(1)).toBe("agnes");
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
    expect(body.messages[0].content[1]).toMatchObject({
      type: "text",
      text: expect.stringContaining("UPLOADED IDENTITY REFERENCE"),
    });
    expect(body.messages[0].content[2]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/webp;base64,cmVmZXJlbmNl" },
    });
    expect(body.messages[0].content[0].text).toContain(
      "Do not recolor, restyle, add, remove, or substitute garments",
    );
  });

  it("uses the Images edits API for gpt-image models with ordered references", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gpt-image-1.5";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ b64_json: "Z3B0LWltYWdl" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await generateCpaReferenceImage({
      prompt: "Keep both reference identities in a warm family scene.",
      referenceImages: [
        "data:image/png;base64,Zmlyc3Q=",
        "data:image/webp;base64,c2Vjb25k",
      ],
    });

    expect(image).toBe("data:image/png;base64,Z3B0LWltYWdl");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://relay.example/v1/images/edits");
    expect(init.headers).not.toMatchObject({ "Content-Type": expect.anything() });
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-image-1.5");
    expect(form.get("size")).toBe("1024x1024");
    expect(form.get("response_format")).toBe("b64_json");
    expect(form.getAll("image[]")).toHaveLength(2);
    expect((form.getAll("image[]")[0] as Blob).type).toBe("image/png");
    expect((form.getAll("image[]")[1] as Blob).type).toBe("image/webp");
    expect(String(form.get("prompt"))).toContain("Image 1: REFERENCE IMAGE 1");
    expect(String(form.get("prompt"))).toContain("Image 2: REFERENCE IMAGE 2");
  });

  it("uses the Images generations API for gpt-image models without references", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gpt-image-1.5";
    process.env.IMAGE_PROVIDER_ORDER = "cpa:1";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ b64_json: "Z2VuZXJhdGVk" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A small red paper boat", 7, {
      pageNumber: 1,
      style: "watercolor",
      preferredProvider: "cpa",
    });

    expect(result.provider).toBe("cpa");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://relay.example/v1/images/generations");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-image-1.5",
      prompt: expect.stringContaining("A small red paper boat"),
      size: "1024x1024",
      response_format: "b64_json",
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

  it("sends labeled source and canonical references for only the page cast", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gemini-3.1-flash-image";
    const download = vi
      .fn()
      .mockResolvedValueOnce({ data: new Blob(["child-source"], { type: "image/webp" }), error: null })
      .mockResolvedValueOnce({ data: new Blob(["mother-source"], { type: "image/png" }), error: null })
      .mockResolvedValueOnce({ data: new Blob(["child-canonical"], { type: "image/webp" }), error: null })
      .mockResolvedValueOnce({ data: new Blob(["mother-canonical"], { type: "image/png" }), error: null });
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
          sourceReferenceAssetPath: "user/child/source.webp",
          canonicalReferenceAssetPath: "user/child/canonical.png",
          storyReferenceToken: "story-anchor-token",
          isProtagonist: true,
        },
        {
          id: "mother",
          name: "妈妈",
          relation: "妈妈",
          appearance: "长发妈妈",
          referenceAssetPath: "user/mother/canonical.png",
          sourceReferenceAssetPath: "user/mother/source.webp",
          canonicalReferenceAssetPath: "user/mother/canonical.png",
        },
        {
          id: "father",
          name: "爸爸",
          relation: "爸爸",
          appearance: "爸爸",
          referenceAssetPath: "user/father/canonical.png",
          sourceReferenceAssetPath: "user/father/source.webp",
          canonicalReferenceAssetPath: "user/father/canonical.png",
        },
      ],
      visualBible: {
        version: 1,
        seriesStyleLock: "fixed clay render",
        paletteLock: "fixed warm palette",
        continuityPolicy: "never use the previous page as the identity source",
        characters: [
          {
            id: "child",
            name: "童童",
            identityLock: "same exact child face",
            outfitLock: "powder-blue pajamas on every page",
            referenceGuidance: "real photo controls face; cartoon controls body",
          },
          {
            id: "mother",
            name: "妈妈",
            identityLock: "same exact mother face",
            outfitLock: "rose pajamas on every page",
            referenceGuidance: "real photo controls face; cartoon controls body",
          },
        ],
      },
    });

    expect(result.provider).toBe("cpa");
    expect(download).toHaveBeenCalledTimes(4);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const referenceContent = body.messages[0].content.slice(1) as Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
    }>;
    expect(referenceContent.filter((item) => item.type === "text").map((item) => item.text)).toEqual([
      expect.stringContaining("CHARACTER child (童童) — FIXED STORY OUTFIT ANCHOR"),
      expect.stringContaining("CHARACTER child (童童) — REAL PHOTO"),
      expect.stringContaining("CHARACTER mother (妈妈) — REAL PHOTO"),
      expect.stringContaining("CHARACTER child (童童) — CANONICAL CARTOON BODY"),
      expect.stringContaining("CHARACTER mother (妈妈) — CANONICAL CARTOON BODY"),
    ]);
    expect(referenceContent.filter((item) => item.type === "image_url").map((item) => item.image_url?.url)).toEqual([
      "data:image/webp;base64,cmVmZXJlbmNl",
      `data:image/webp;base64,${Buffer.from("child-source").toString("base64")}`,
      `data:image/png;base64,${Buffer.from("mother-source").toString("base64")}`,
      `data:image/webp;base64,${Buffer.from("child-canonical").toString("base64")}`,
      `data:image/png;base64,${Buffer.from("mother-canonical").toString("base64")}`,
    ]);
    expect(body.messages[0].content[0].text).toContain(
      "powder-blue pajamas on every page",
    );
    expect(body.messages[0].content[0].text).not.toContain("same exact father face");
  });

  it("creates one neutral full-body story outfit anchor from face and cartoon references", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    const download = vi
      .fn()
      .mockResolvedValueOnce({
        data: new Blob(["source"], { type: "image/webp" }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: new Blob(["canonical"], { type: "image/png" }),
        error: null,
      });
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: () => ({ download }) },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "data:image/png;base64,YW5jaG9y" } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await generateCpaStoryCharacterAnchor({
      character: {
        id: "child",
        name: "童童",
        relation: "孩子",
        appearance: "五岁短发孩子",
        sourceReferenceAssetPath: "user/child/source.webp",
        canonicalReferenceAssetPath: "user/child/canonical.png",
        referenceAssetPath: "user/child/canonical.png",
      },
      visualBible: {
        version: 1,
        seriesStyleLock: "fixed clay style",
        paletteLock: "fixed warm palette",
        continuityPolicy: "never drift",
        characters: [
          {
            id: "child",
            name: "童童",
            identityLock: "same exact child face",
            outfitLock: "powder-blue pajamas with cream piping",
            referenceGuidance: "real photo controls face",
          },
        ],
      },
    });

    expect(image).toBe("data:image/png;base64,YW5jaG9y");
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.messages[0].content[0].text).toContain(
      "Create one fixed full-body character anchor",
    );
    expect(body.messages[0].content[0].text).toContain(
      "powder-blue pajamas with cream piping",
    );
    expect(body.messages[0].content[0].text).toContain(
      "Neutral warm studio background",
    );
    expect(body.messages[0].content.filter((item: { type: string }) => item.type === "image_url")).toHaveLength(2);
  });

  it("retries a transient Supabase family reference fetch failure", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    const download = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        data: new Blob(["source"], { type: "image/webp" }),
        error: null,
      });
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: () => ({ download }) },
    });
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "data:image/png;base64,Y3Bh" } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A child reads", 30, {
      pageNumber: 1,
      style: "fairytale",
      preferredProvider: "cpa",
      castIds: ["retry-child"],
      familyCharacters: [
        {
          id: "retry-child",
          name: "童童",
          relation: "孩子",
          appearance: "短发孩子",
          sourceReferenceAssetPath: "user/retry-child/source.webp",
        },
      ],
      referenceCacheKey: "retry-story",
    });

    expect(result.provider).toBe("cpa");
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("reuses downloaded family references for every page in the same story", async () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    const download = vi.fn().mockResolvedValue({
      data: new Blob(["source"], { type: "image/webp" }),
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: () => ({ download }) },
    });
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                images: [
                  { image_url: { url: "data:image/png;base64,Y3Bh" } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = {
      style: "fairytale" as const,
      preferredProvider: "cpa" as const,
      castIds: ["cached-child"],
      familyCharacters: [
        {
          id: "cached-child",
          name: "童童",
          relation: "孩子",
          appearance: "短发孩子",
          sourceReferenceAssetPath: "user/cached-child/source.webp",
        },
      ],
      referenceCacheKey: "cached-story",
    };

    await generateIllustration("Page one", 31, {
      ...options,
      pageNumber: 1,
    });
    await generateIllustration("Page two", 32, {
      ...options,
      pageNumber: 2,
    });

    expect(download).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    const sensitiveMessage =
      "Bearer known-auth-secret 童童 private prompt https://example.test?a=token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: sensitiveMessage } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const rejected = generateIllustration("A child at the pool", 5, {
      storyId: "story-safe",
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
    });

    await expect(rejected).rejects.toMatchObject({
      message: "All image providers failed.",
      errorClass: "upstream_5xx",
    });
    expect(warn).toHaveBeenCalledWith({
      operation: "illustration.provider_attempt",
      story: "story-safe",
      page: 1,
      provider: "cpa",
      model: "gemini-3.1-flash-image",
      status: "failed",
      duration: expect.any(Number),
      errorClass: "upstream_5xx",
    });
    const serializedLogs = JSON.stringify(warn.mock.calls);
    expect(serializedLogs).not.toContain("known-auth-secret");
    expect(serializedLogs).not.toContain("童童 private prompt");
    expect(serializedLogs).not.toContain("example.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relay.example/v1/chat/completions",
    );
  });

  it("stores only stable errors in failed provider attempts", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "cpa:1,agnes:1";
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.AGNES_API_KEY = "agnes-test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "Bearer private-key secret prompt for 童童" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ b64_json: "c2FmZS1pbWFnZQ==" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = await generateIllustration("private prompt for 童童", 5, {
      storyId: "story-safe",
      pageNumber: 1,
      style: "fairytale",
      characterReferenceId: "custom-upload",
      customCharacterReferenceToken: "a".repeat(43),
      preferredProvider: "cpa",
    });

    expect(result.provider).toBe("agnes");
    expect(result.attempts[0]).toMatchObject({
      provider: "cpa",
      model: "gemini-3.1-flash-image",
      status: "failed",
      error: "插图生成失败，请稍后重试。",
      errorClass: "upstream_5xx",
    });
    expect(JSON.stringify(result.attempts)).not.toContain("private-key");
    expect(JSON.stringify(result.attempts)).not.toContain("童童");
  });

  it("falls back to the next provider when image quality validation fails", async () => {
    process.env.IMAGE_PROVIDER_ORDER = "cpa:1,agnes:1";
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.CPA_IMAGE_MODEL = "gpt-image-1.5";
    process.env.AGNES_API_KEY = "agnes-test";
    const invalidQuality = Object.assign(new Error("invalid image"), {
      errorClass: "invalid_response" as const,
    });
    inspectIllustrationQualityMock
      .mockRejectedValueOnce(invalidQuality)
      .mockResolvedValueOnce({
        version: 1 as const,
        status: "passed" as const,
        width: 1024,
        height: 1024,
        format: "png",
        bytes: 2048,
      });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [{ b64_json: "Y3Bh" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [{ b64_json: "YWduZXM=" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );

    const result = await generateIllustration("A child tying a shoe", 9, {
      storyId: "story-safe",
      pageNumber: 1,
      style: "fairytale",
      preferredProvider: "cpa",
      requestAttempt: 2,
      retry: true,
    });

    expect(result.provider).toBe("agnes");
    expect(result.attempts).toEqual([
      expect.objectContaining({
        provider: "cpa",
        status: "failed",
        requestAttempt: 2,
        retry: true,
        errorClass: "invalid_response",
      }),
      expect.objectContaining({
        provider: "agnes",
        status: "success",
        requestAttempt: 2,
        retry: true,
        qualityStatus: "passed",
      }),
    ]);
  });
});
