import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  getCachedCharacterReferenceDataUri: vi.fn(async () =>
    "data:image/webp;base64,cmVmZXJlbmNl"
  ),
}));

vi.mock("@/lib/email/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import {
  generateIllustration,
  getImageToImageProviderForPage,
} from "@/lib/image-generator";

const envKeys = [
  "IMAGE_TO_IMAGE_PROVIDER_ORDER",
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
});
