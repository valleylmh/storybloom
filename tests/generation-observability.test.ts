import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GENERATION_ERROR_CLASSES,
  createGenerationLogPayload,
  logGenerationEvent,
  type GenerationEvent,
} from "@/lib/generation-observability";
import {
  GenerationProviderError,
  classifyGenerationError,
  getGenerationErrorDisposition,
} from "@/lib/generation-error";

const SECRET = "Bearer known-auth-secret";
const PROMPT = "童童在卧室里抱着小恐龙的完整插画 Prompt";
const SIGNED_URL =
  "https://example.test/private/photo.webp?token=known-signed-token";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generation observability", () => {
  it("rebuilds payloads from the approved field allowlist", () => {
    const event: GenerationEvent = {
      operation: "illustration.generate",
      task: "task_123456789012",
      story: "story-123",
      page: 2,
      provider: "cpa",
      model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      status: "failed",
      duration: 1234.6,
      errorClass: "upstream_5xx",
      // @ts-expect-error Raw errors are deliberately excluded from the logger contract.
      error: new Error(`${SECRET} ${PROMPT} ${SIGNED_URL}`),
      prompt: PROMPT,
      requestBody: { childName: "童童" },
      authorization: SECRET,
      url: SIGNED_URL,
    };

    const payload = createGenerationLogPayload(event);

    expect(payload).toEqual({
      operation: "illustration.generate",
      status: "failed",
      task: "task_123456789012",
      story: "story-123",
      page: 2,
      provider: "cpa",
      model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      duration: 1235,
      errorClass: "upstream_5xx",
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "duration",
        "errorClass",
        "model",
        "operation",
        "page",
        "provider",
        "status",
        "story",
        "task",
      ].sort(),
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(PROMPT);
    expect(serialized).not.toContain("童童");
    expect(serialized).not.toContain("known-signed-token");
  });

  it("uses a fixed error class set and drops invalid runtime values", () => {
    expect(GENERATION_ERROR_CLASSES).toEqual([
      "timeout",
      "rate_limit",
      "authentication",
      "configuration",
      "network",
      "upstream_4xx",
      "upstream_5xx",
      "invalid_response",
      "storage_unavailable",
      "stale_result",
      "not_found",
      "conflict",
      "unknown",
    ]);

    const payload = createGenerationLogPayload({
      operation: `generate ${PROMPT}`,
      status: SECRET,
      task: SIGNED_URL,
      story: "story-safe",
      page: 1.5,
      provider: SIGNED_URL,
      model: "data:image/png;base64,known-photo",
      duration: Number.NaN,
      errorClass: "raw_provider_message",
    } as unknown as GenerationEvent);

    expect(payload).toEqual({
      operation: "unknown",
      status: "unknown",
      story: "story-safe",
    });
  });

  it("classifies errors without exposing their message", () => {
    expect(
      classifyGenerationError(
        new GenerationProviderError("upstream_5xx", PROMPT),
      ),
    ).toBe("upstream_5xx");
    expect(classifyGenerationError(new DOMException(PROMPT, "AbortError"))).toBe(
      "timeout",
    );
    expect(classifyGenerationError({ status: 429, message: SECRET })).toBe(
      "rate_limit",
    );
    expect(classifyGenerationError({ statusCode: "401", message: PROMPT })).toBe(
      "authentication",
    );
    expect(classifyGenerationError(new Error("missing CPA_API_KEY"))).toBe(
      "configuration",
    );
    expect(classifyGenerationError(new Error("invalid JSON response"))).toBe(
      "invalid_response",
    );
    expect(classifyGenerationError(new TypeError("fetch failed"))).toBe(
      "network",
    );
    expect(classifyGenerationError(new Error("provider failed: HTTP 503"))).toBe(
      "upstream_5xx",
    );
    expect(classifyGenerationError(new Error("provider failed: HTTP 422"))).toBe(
      "upstream_4xx",
    );
    expect(classifyGenerationError(new Error(PROMPT))).toBe("unknown");
  });

  it("uses a fail-closed retry policy for durable jobs", () => {
    for (const errorClass of [
      "timeout",
      "rate_limit",
      "network",
      "upstream_5xx",
      "storage_unavailable",
    ] as const) {
      expect(getGenerationErrorDisposition(errorClass)).toBe("retryable");
    }
    for (const errorClass of [
      "authentication",
      "configuration",
      "upstream_4xx",
      "invalid_response",
      "not_found",
      "conflict",
      "unknown",
    ] as const) {
      expect(getGenerationErrorDisposition(errorClass)).toBe("terminal");
    }
    expect(getGenerationErrorDisposition("stale_result")).toBe("stale");
  });

  it("writes one allowlisted object to the selected console level", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const runtimeEvent = {
      operation: "text.generate",
      task: "task-safe",
      story: "story-safe",
      provider: "cpa",
      model: "gemini-3-flash",
      status: "failed",
      duration: 80,
      errorClass: "timeout",
      error: new Error(`${SECRET} ${PROMPT}`),
      query: SIGNED_URL,
    } as unknown as GenerationEvent;

    const payload = logGenerationEvent(runtimeEvent, "error");

    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(payload);
    expect(JSON.stringify(error.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(error.mock.calls)).not.toContain(PROMPT);
    expect(JSON.stringify(error.mock.calls)).not.toContain("known-signed-token");
  });
});
