import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveStoryFamilyCast } from "@/lib/story-family-cast";
import type { StoryInput } from "@/types";

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
  generateStoryCharacterAnchor,
  generateReferenceImage,
  generateIllustration,
  getAgnesKeyIndexForPage,
  getImageToImageProviderForPage,
  getProviderForPage,
  parseAgnesApiKeys,
  regeneratePage,
} from "@/lib/image-generator";

const envKeys = [
  "IMAGE_TO_IMAGE_PROVIDER_ORDER",
  "IMAGE_PROVIDER_ORDER",
  "IMAGE_PROVIDER",
  "AGNES_API_KEY",
  "AGNES_IMAGE_REQUEST_DELAY_MS",
  "AGNES_IMAGE_MAX_ATTEMPTS",
  "CPA_API_KEY",
  "CPA_BASE_URL",
  "CPA_IMAGE_MODEL",
  "CPA_IMAGE_REQUEST_DELAY_MS",
  "CPA_IMAGE_MAX_ATTEMPTS",
  "CPA_IMAGE_RETRY_DELAY_MS",
  "CPA_IMAGE_TIMEOUT_MS",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_IMAGE_SIZE",
  "OPENAI_IMAGE_REQUEST_DELAY_MS",
  "OPENAI_IMAGE_RETRY_DELAY_MS",
  "OPENAI_IMAGE_MAX_ATTEMPTS",
  "OPENAI_IMAGE_TIMEOUT_MS",
  "ORBITIX_API_KEY",
  "ORBITIX_BASE_URL",
  "ORBITIX_IMAGE_MODEL",
  "ORBITIX_IMAGE_SIZE",
  "ORBITIX_IMAGE_REQUEST_DELAY_MS",
  "ORBITIX_IMAGE_RETRY_DELAY_MS",
  "ORBITIX_IMAGE_MAX_ATTEMPTS",
  "ORBITIX_IMAGE_TIMEOUT_MS",
  "DASHSCOPE_API_KEY",
  "HUGGINGFACE_API_TOKEN",
  "HUGGINGFACE_TOKEN",
  "HF_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CF_ACCOUNT_ID",
  "CF_API_TOKEN",
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
  for (const prefix of ["OPENAI", "ORBITIX"]) {
    delete process.env[`${prefix}_API_KEY`];
    delete process.env[`${prefix}_BASE_URL`];
    delete process.env[`${prefix}_IMAGE_MODEL`];
    delete process.env[`${prefix}_IMAGE_SIZE`];
    process.env[`${prefix}_IMAGE_REQUEST_DELAY_MS`] = "0";
    process.env[`${prefix}_IMAGE_RETRY_DELAY_MS`] = "0";
    process.env[`${prefix}_IMAGE_MAX_ATTEMPTS`] = "1";
    process.env[`${prefix}_IMAGE_TIMEOUT_MS`] = "5000";
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  for (const key of envKeys) {
    const original = originalEnv[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("image-to-image provider routing", () => {
  it("parses unique Agnes keys and assigns pages evenly with a stable order", () => {
    expect(parseAgnesApiKeys(" key-one, key-two ,, key-one, key-three ")).toEqual([
      "key-one",
      "key-two",
      "key-three",
    ]);
    expect(
      Array.from({ length: 8 }, (_, index) =>
        getAgnesKeyIndexForPage(index + 1, 2),
      ),
    ).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(getAgnesKeyIndexForPage(3, 0)).toBeNull();
  });

  it("routes concurrent Agnes pages across configured keys by page number", async () => {
    process.env.AGNES_API_KEY = "agnes-key-one, agnes-key-two";
    process.env.IMAGE_PROVIDER_ORDER = "agnes:1";
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({ data: [{ b64_json: "YWduZXMtaW1hZ2U=" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        generateIllustration(`Page ${index + 1}`, index + 1, {
          pageNumber: index + 1,
          style: "watercolor",
          preferredProvider: "agnes",
        }),
      ),
    );

    const authorizationByPrompt = new Map<string, string>();
    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      const body = JSON.parse(String(init.body)) as { prompt: string };
      authorizationByPrompt.set(
        body.prompt.match(/Page (\d+)/)?.[0] || "",
        String((init.headers as Record<string, string>).Authorization),
      );
    }
    expect(Array.from(authorizationByPrompt.entries()).sort()).toEqual([
      ["Page 1", "Bearer agnes-key-one"],
      ["Page 2", "Bearer agnes-key-two"],
      ["Page 3", "Bearer agnes-key-one"],
      ["Page 4", "Bearer agnes-key-two"],
      ["Page 5", "Bearer agnes-key-one"],
      ["Page 6", "Bearer agnes-key-two"],
      ["Page 7", "Bearer agnes-key-one"],
      ["Page 8", "Bearer agnes-key-two"],
    ]);
  });

  it("uses URL response mode for ordinary Agnes text-to-image requests", async () => {
    process.env.AGNES_API_KEY = "agnes-test";
    process.env.IMAGE_PROVIDER_ORDER = "agnes:1";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ url: "https://cdn.example/story.png" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateIllustration("A child packs a school bag", 1, {
      pageNumber: 1,
      style: "watercolor",
      preferredProvider: "agnes",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://apihub.agnes-ai.com/v1/images/generations");
    expect(body).not.toHaveProperty("return_base64");
    expect(body).not.toHaveProperty("extra_body");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://cdn.example/story.png");
    expect(result.imageUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("does not make pages assigned to different Agnes keys wait on one queue", async () => {
    process.env.AGNES_API_KEY = "agnes-key-one,agnes-key-two";
    process.env.IMAGE_PROVIDER_ORDER = "agnes:1";
    let releaseFirstRequest: (() => void) | undefined;
    const fetchMock = vi.fn((_: string, init: RequestInit) => {
      const authorization = String(
        (init.headers as Record<string, string>).Authorization,
      );
      if (authorization === "Bearer agnes-key-one") {
        return new Promise<Response>((resolve) => {
          releaseFirstRequest = () =>
            resolve(
              new Response(
                JSON.stringify({ data: [{ b64_json: "YWduZXMtaW1hZ2U=" }] }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              ),
            );
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ b64_json: "YWduZXMtaW1hZ2U=" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstPage = generateIllustration("Page one", 1, {
      pageNumber: 1,
      style: "watercolor",
      preferredProvider: "agnes",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const secondPage = generateIllustration("Page two", 2, {
      pageNumber: 2,
      style: "watercolor",
      preferredProvider: "agnes",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    releaseFirstRequest?.();
    await Promise.all([firstPage, secondPage]);
  });

  it("keeps configured ordinary providers distributed across book pages", () => {
    process.env.AGNES_API_KEY = "agnes-test";
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.IMAGE_PROVIDER_ORDER = "agnes:1,openai:1";

    expect(getProviderForPage(1)).toBe("agnes");
    expect(getProviderForPage(2)).toBe("openai");
    expect(getProviderForPage(3)).toBe("agnes");
    expect(getProviderForPage(8)).toBe("openai");
  });

  it("distributes weighted pages across OpenAI and Orbitix and skips missing keys", () => {
    process.env.AGNES_API_KEY = "agnes-test";
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env.IMAGE_PROVIDER_ORDER = "agnes:2,openai:1,orbitix:2";
    expect(Array.from({ length: 8 }, (_, index) => getProviderForPage(index + 1))).toEqual([
      "agnes", "agnes", "openai", "orbitix", "orbitix", "agnes", "agnes", "openai",
    ]);
    delete process.env.OPENAI_API_KEY;
    expect(Array.from({ length: 4 }, (_, index) => getProviderForPage(index + 1))).toEqual([
      "agnes", "agnes", "orbitix", "orbitix",
    ]);
  });

  it("includes both new providers in the default order", () => {
    delete process.env.IMAGE_PROVIDER_ORDER;
    delete process.env.IMAGE_PROVIDER;
    delete process.env.AGNES_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.HUGGINGFACE_API_TOKEN;
    delete process.env.HUGGINGFACE_TOKEN;
    delete process.env.HF_TOKEN;
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    expect(Array.from({ length: 4 }, (_, index) => getProviderForPage(index + 1))).toEqual([
      "openai", "openai", "orbitix", "orbitix",
    ]);
  });

  it("does not borrow credentials from CPA or the other new provider", () => {
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://relay.example/v1";
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "  ";
    process.env.IMAGE_PROVIDER_ORDER = "orbitix:1";
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "orbitix:1";
    expect(getProviderForPage(1)).toBeUndefined();
    expect(getImageToImageProviderForPage(1)).toBeUndefined();
    delete process.env.OPENAI_API_KEY;
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env.IMAGE_PROVIDER_ORDER = "openai:1";
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "openai:1";
    expect(getProviderForPage(1)).toBeUndefined();
    expect(getImageToImageProviderForPage(1)).toBeUndefined();
  });

  it.each(["pollinations", "cloudflare"] as const)(
    "skips removed provider %s in weights, preferred providers, and explicit fallbacks",
    async (retired) => {
      process.env.OPENAI_API_KEY = "openai-test";
      process.env.CLOUDFLARE_ACCOUNT_ID = "old-account";
      process.env.CLOUDFLARE_API_TOKEN = "old-token";
      process.env.IMAGE_PROVIDER_ORDER = `${retired}:6,openai:1`;
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ b64_json: "bmV3" }] }), {
          status: 200, headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      expect(getProviderForPage(1)).toBe("openai");
      expect(getProviderForPage(8)).toBe("openai");
      const result = await generateIllustration("A child reads", 1, {
        preferredProvider: retired,
        fallbackProviders: [retired, "openai"],
      });
      expect(result.provider).toBe("openai");
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/images/generations");
    },
  );

  it.each([
    ["openai", "https://api.openai.com/v1"],
    ["orbitix", "https://new.orbitix.site/v1"],
  ] as const)("generates images through %s with independent configuration", async (provider, baseUrl) => {
    const prefix = provider.toUpperCase();
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env[`${prefix}_IMAGE_MODEL`] = "gpt-image-2";
    process.env[`${prefix}_IMAGE_SIZE`] = "1536x1024";
    process.env.IMAGE_PROVIDER_ORDER = `${provider}:1`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "Z2VuZXJhdGVk" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateIllustration("A small red paper boat", 7);
    expect(result.imageUrl).toBe("data:image/png;base64,Z2VuZXJhdGVk");
    expect(result.provider).toBe(provider);
    expect(result.attempts[0]).toMatchObject({ provider, model: "gpt-image-2", status: "success" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${baseUrl}/images/generations`);
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${provider}-test`, "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "gpt-image-2", size: "1536x1024", n: 1, output_format: "png",
      prompt: expect.stringContaining("A small red paper boat"),
    });
    expect(body).not.toHaveProperty("response_format");
    expect(body).not.toHaveProperty("images");
  });

  it.each(["openai", "orbitix"] as const)(
    "sends uploaded references to %s edits and normalizes its base URL",
    async (provider) => {
      const prefix = provider.toUpperCase();
      process.env[`${prefix}_API_KEY`] = `${provider}-test`;
      process.env[`${prefix}_BASE_URL`] = ` https://${provider}.example/v1/// `;
      process.env[`${prefix}_IMAGE_SIZE`] = "1024x1536";
      process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = `${provider}:2`;
      expect(getImageToImageProviderForPage(1)).toBe(provider);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ b64_json: "ZWRpdGVk" }] }), {
          status: 200, headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = await generateIllustration("A child reads under a tree", 2, {
        customCharacterReferenceToken: "b".repeat(43),
      });
      expect(result.provider).toBe(provider);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://${provider}.example/v1/images/edits`);
      expect(init.headers).toMatchObject({ Authorization: `Bearer ${provider}-test` });
      if (provider === "openai") {
        const body = JSON.parse(String(init.body));
        expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
        expect(body).toMatchObject({
          model: "gpt-image-2.5-flare", size: "1024x1536", output_format: "png",
          images: [{ image_url: "data:image/webp;base64,cmVmZXJlbmNl" }],
          prompt: expect.stringContaining("Image 1: MAIN CHARACTER"),
        });
        expect(body).not.toHaveProperty("response_format");
      } else {
        expect(init.headers).not.toHaveProperty("Content-Type");
        expect(init.body).toBeInstanceOf(FormData);
        const form = init.body as FormData;
        expect(form.get("model")).toBe("gpt-image-2.5-flare");
        expect(form.get("size")).toBe("1024x1536");
        expect(form.get("output_format")).toBe("png");
        expect(form.has("response_format")).toBe(false);
        expect(form.getAll("image[]")).toHaveLength(1);
        expect((form.get("image[]") as Blob).type).toBe("image/webp");
        expect(await (form.get("image[]") as Blob).text()).toBe("reference");
        expect(String(form.get("prompt"))).toContain("Image 1: MAIN CHARACTER");
      }
    },
  );

  it("falls back from OpenAI to Orbitix without leaking upstream errors or keys", async () => {
    process.env.OPENAI_API_KEY = "openai-secret";
    process.env.ORBITIX_API_KEY = "orbitix-secret";
    process.env.IMAGE_PROVIDER_ORDER = "openai:1,orbitix:1";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Bearer openai-secret private prompt" } }), {
        status: 401, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ b64_json: "b3JiaXRpeA==" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateIllustration("A child reads", 1);
    expect(result.provider).toBe("orbitix");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ provider: "openai", errorClass: "authentication" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.openai.com/v1/images/generations",
      "https://new.orbitix.site/v1/images/generations",
    ]);
    expect(JSON.stringify(result.attempts)).not.toContain("openai-secret");
    expect(JSON.stringify(result.attempts)).not.toContain("private prompt");
  });

  it("retries Orbitix rate limits and downloads URL responses without forwarding credentials", async () => {
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env.ORBITIX_IMAGE_MAX_ATTEMPTS = "2";
    process.env.IMAGE_PROVIDER_ORDER = "orbitix:1";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: "https://images.example/result.png" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200, headers: { "Content-Type": "image/png" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateIllustration("A red boat", 1);
    expect(result.provider).toBe("orbitix");
    expect(result.imageUrl).toBe("data:image/png;base64,AQID");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe("https://images.example/result.png");
    expect(fetchMock.mock.calls[2][1]).not.toHaveProperty("headers");
  });

  it("does not queue Orbitix behind a pending official request", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    let releaseOfficial: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.openai.com")) return new Promise<Response>((resolve) => { releaseOfficial = resolve; });
      return new Response(JSON.stringify({ data: [{ b64_json: "b3JiaXRpeA==" }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const official = generateIllustration("Official page", 1, { fallbackProviders: ["openai"] });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    try {
      const relay = generateIllustration("Relay page", 2, { fallbackProviders: ["orbitix"] });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect((await relay).provider).toBe("orbitix");
    } finally {
      releaseOfficial?.(new Response(JSON.stringify({ data: [{ b64_json: "b3BlbmFp" }] }), { status: 200 }));
      await official;
    }
  });

  it.each([
    ["cpa", "gemini-3.1-flash-image"],
    ["cpa", "gpt-image-2.5-flare"],
    ["openai", "gpt-image-2.5-flare"],
    ["orbitix", "gpt-image-2.5-flare"],
  ] as const)(
    "returns promptly instead of sleeping through a long cooldown for %s / %s",
    async (provider, model) => {
      vi.useFakeTimers();
      const startedAt = Date.now();
      const prefix = provider.toUpperCase();
      process.env[`${prefix}_API_KEY`] = `${provider}-test`;
      process.env[`${prefix}_IMAGE_MODEL`] = model;
      process.env[`${prefix}_IMAGE_MAX_ATTEMPTS`] = "2";
      process.env.CPA_BASE_URL = "https://relay.example/v1";
      process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = `${provider}:1`;
      const fetchMock = vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify({ error: { message: "auth_unavailable" } }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Retry-After": "1787" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const rejected = expect(generateIllustration("A teddy bear reads", 1, {
        customCharacterReferenceToken: "b".repeat(43),
      })).rejects.toMatchObject({ errorClass: "upstream_5xx" });

      await vi.runAllTimersAsync();
      await rejected;

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(Date.now() - startedAt).toBeLessThan(30_000);
    },
  );

  it("falls back without retrying before an upstream HTTP-date cooldown expires", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env.OPENAI_IMAGE_MAX_ATTEMPTS = "2";
    process.env.IMAGE_PROVIDER_ORDER = "openai:1,orbitix:1";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", {
        status: 429,
        headers: { "Retry-After": new Date(Date.now() + 1_800_000).toUTCString() },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ b64_json: "c2FmZQ==" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const generation = generateIllustration("A teddy bear reads", 1);

    await vi.runAllTimersAsync();
    const result = await generation;

    expect(result.provider).toBe("orbitix");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.openai.com/v1/images/generations",
      "https://new.orbitix.site/v1/images/generations",
    ]);
    expect(result.attempts[0]).toMatchObject({ provider: "openai", errorClass: "rate_limit" });
    expect(Date.now() - startedAt).toBeLessThan(30_000);
  });

  it.each(["gemini-3.1-flash-image", "gpt-image-2.5-flare"])(
    "still honors short CPA retry waits for %s",
    async (model) => {
      vi.useFakeTimers();
      process.env.CPA_API_KEY = "cpa-test";
      process.env.CPA_BASE_URL = "https://relay.example/v1";
      process.env.CPA_IMAGE_MODEL = model;
      process.env.CPA_IMAGE_MAX_ATTEMPTS = "2";
      const requestTimes: number[] = [];
      const fetchMock = vi.fn().mockImplementation(async () => {
        requestTimes.push(Date.now());
        return requestTimes.length === 1
          ? new Response("{}", { status: 503, headers: { "Retry-After": "1" } })
          : new Response(JSON.stringify({ data: [{ b64_json: "c2FmZQ==" }] }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
      });
      vi.stubGlobal("fetch", fetchMock);
      const generation = generateCpaReferenceImage({
        prompt: "A teddy bear reads",
        referenceImages: ["data:image/png;base64,c2FmZQ=="],
      });

      await vi.runAllTimersAsync();

      expect(await generation).toBe("data:image/png;base64,c2FmZQ==");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(requestTimes[1] - requestTimes[0]).toBe(1000);
    },
  );

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
    expect(body.return_base64).toBe(true);
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
      expect.stringContaining("CHARACTER mother (妈妈) — CANONICAL CARTOON STYLE"),
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

  it.each(["openai", "orbitix"] as const)("sends automatically matched parents' actual reference bytes to %s", async (provider) => {
    process.env[`${provider.toUpperCase()}_API_KEY`] = "test-image-key";
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = `${provider}:1`;
    const prefix = `automatic-family-${provider}`;
    const download = vi.fn(async (assetPath: string) => ({
      data: new Blob([assetPath], { type: "image/webp" }), error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: () => ({ download }) } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [{ b64_json: "ZmFtaWx5" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const storyInput: StoryInput = {
      childName: "童童", protagonistFamilyCharacterId: "child", ageGroup: "4-5", theme: "family", style: "fairytale", language: "zh-en",
      familyCharacters: [
        { id: "child", name: "童童", relation: "孩子", appearance: "短发孩子", isProtagonist: true, sourceReferenceAssetPath: `${prefix}/child/source.webp` },
        { id: "dad", name: "童童爸", relation: "爸爸", appearance: "戴眼镜的成年人", sourceReferenceAssetPath: `${prefix}/dad/source.webp` },
        { id: "mom", name: "童童妈", relation: "妈妈", appearance: "长发成年妈妈", canonicalReferenceAssetPath: `${prefix}/mom/canonical.webp` },
        { id: "grandma", name: "奶奶", relation: "奶奶", appearance: "白发奶奶", sourceReferenceAssetPath: `${prefix}/grandma/source.webp` },
      ],
    };
    const page = { zhText: "我和爸妈一起做早餐。", enText: "I make breakfast with my parents.", illustrationPrompt: "童童帮爸爸准备早餐，妈妈把盘子摆在桌上。", castIds: ["child"] };
    const castIds = resolveStoryFamilyCast(storyInput, page);
    expect(castIds).toEqual(["child", "dad", "mom"]);
    await generateIllustration(page.illustrationPrompt, 25, {
      pageNumber: 1, style: "fairytale", preferredProvider: provider, fallbackProviders: [provider],
      familyCharacters: storyInput.familyCharacters, castIds, referenceCacheKey: prefix,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/images/edits");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    let referenceContents: string[];
    let prompt: string;
    if (provider === "openai") {
      const body = JSON.parse(String(request.body));
      referenceContents = body.images.map(({ image_url }: { image_url: string }) =>
        Buffer.from(image_url.split(",")[1], "base64").toString(),
      );
      prompt = body.prompt;
    } else {
      const form = request.body as FormData;
      referenceContents = await Promise.all(form.getAll("image[]").map((blob) => (blob as Blob).text()));
      prompt = String(form.get("prompt"));
    }
    expect(referenceContents).toEqual([
      `${prefix}/child/source.webp`, `${prefix}/dad/source.webp`, `${prefix}/mom/canonical.webp`,
    ]);
    expect(download.mock.calls.map(([assetPath]) => assetPath)).toEqual([
      `${prefix}/child/source.webp`, `${prefix}/dad/source.webp`, `${prefix}/mom/canonical.webp`,
    ]);
    expect(prompt).toContain("CHARACTER dad (童童爸)");
    expect(prompt).toContain("CHARACTER mom (童童妈)");
    expect(prompt).not.toContain("奶奶");
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
    process.env.IMAGE_PROVIDER_ORDER = "agnes:1";
    process.env.AGNES_API_KEY = "agnes-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "YWduZXM=" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
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

    expect(result.provider).toBe("agnes");
    expect(String(fetchMock.mock.calls[0][0])).toContain("apihub.agnes-ai.com");
  });

  it("replans saved family-photo pages across OpenAI and Orbitix instead of a stale CPA plan", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "openai:4,orbitix:4";
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://unused-cpa.example/v1";
    const download = vi.fn().mockResolvedValue({
      data: new Blob(["family-photo"], { type: "image/png" }), error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ storage: { from: () => ({ download }) } });
    const fetchMock = vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ data: [{ b64_json: "ZmFtaWx5" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const family = [{
      id: "configured-child", name: "童童", relation: "孩子", appearance: "短发孩子",
      sourceReferenceAssetPath: "user/configured-child/source.png",
      canonicalReferenceAssetPath: "user/configured-child/canonical.png",
      storyReferenceToken: "fixed-story-anchor-token", isProtagonist: true,
    }];
    const results = [];
    for (const page of [1, 5]) {
      results.push(await regeneratePage({
        page, zhText: "童童读书", enText: "Tongtong reads", illustrationPrompt: "A child reads",
        castIds: ["configured-child"], imagePlannedProvider: "cpa", imageStatus: "failed",
      }, 1, "fairytale", undefined, ["cpa"], family));
    }
    expect(results.map((result) => result.imageProvider)).toEqual(["openai", "orbitix"]);
    expect(results.map((result) => result.imagePlannedProvider)).toEqual(["openai", "orbitix"]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.openai.com/v1/images/edits", "https://new.orbitix.site/v1/images/edits",
    ]);
    const official = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(official.images).toHaveLength(3);
    expect(official.images[0].image_url).toBe("data:image/webp;base64,cmVmZXJlbmNl");
    expect(official.prompt).toContain("FIXED STORY OUTFIT ANCHOR");
    const relay = fetchMock.mock.calls[1][1].body as FormData;
    expect(relay.getAll("image[]")).toHaveLength(3);
    expect(String(relay.get("prompt"))).toContain("CANONICAL CARTOON BODY");
  });

  it.each(["openai", "orbitix", "agnes"] as const)(
    "creates family story anchors through configured %s without CPA credentials",
    async (provider) => {
      delete process.env.CPA_API_KEY;
      delete process.env.CPA_BASE_URL;
      process.env[`${provider.toUpperCase()}_API_KEY`] = `${provider}-test`;
      process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = `${provider}:1`;
      const download = vi.fn().mockResolvedValue({
        data: new Blob(["family-photo"], { type: "image/png" }), error: null,
      });
      getSupabaseAdminMock.mockReturnValue({ storage: { from: () => ({ download }) } });
      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ data: [{ b64_json: "YW5jaG9y" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
      vi.stubGlobal("fetch", fetchMock);
      const image = await generateStoryCharacterAnchor({
        character: {
          id: "anchor-child", name: "童童", relation: "孩子", appearance: "短发孩子",
          sourceReferenceAssetPath: "user/anchor-child/source.png",
        },
        visualBible: {
          version: 1, seriesStyleLock: "clay", paletteLock: "warm", continuityPolicy: "fixed identity",
          characters: [{ id: "anchor-child", name: "童童", identityLock: "same face",
            outfitLock: "powder-blue pajamas", referenceGuidance: "real photo controls the face" }],
        },
      });
      expect(image).toBe("data:image/png;base64,YW5jaG9y");
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(provider === "agnes"
        ? "https://apihub.agnes-ai.com/v1/images/generations"
        : `https://${provider === "openai" ? "api.openai.com" : "new.orbitix.site"}/v1/images/edits`);
      const prompt = init.body instanceof FormData
        ? String(init.body.get("prompt")) : JSON.parse(String(init.body)).prompt;
      expect(prompt).toContain("powder-blue pajamas");
      expect(prompt).toContain("REAL PHOTO");
    },
  );

  it("uses configured reference providers for canonical portraits and excludes CPA from fallbacks", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "openai:4,orbitix:4";
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.ORBITIX_API_KEY = "orbitix-test";
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://unused-cpa.example/v1";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ b64_json: "c2FmZQ==" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generateReferenceImage({
      prompt: "Create one fixed character", referenceImages: ["data:image/png;base64,c2FmZQ=="],
    })).toBe("data:image/png;base64,c2FmZQ==");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.openai.com/v1/images/edits", "https://new.orbitix.site/v1/images/edits",
    ]);
  });

  it("does not send family photos to CPA when the configured providers have no key", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "openai:4,orbitix:4";
    process.env.CPA_API_KEY = "cpa-test";
    process.env.CPA_BASE_URL = "https://unused-cpa.example/v1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateIllustration("A child reads", 1, {
      familyCharacters: [{ id: "child", name: "童童", relation: "孩子", appearance: "短发",
        sourceReferenceAssetPath: "user/child/source.png" }], castIds: ["child"],
    })).rejects.toMatchObject({ errorClass: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps family-photo fallbacks within the configured reference providers", async () => {
    process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER = "cpa:1";
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
