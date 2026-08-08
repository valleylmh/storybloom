import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  buildLoginPath,
  sanitizeReturnTo,
} from "@/lib/auth/return-to";

describe("auth return paths", () => {
  it("keeps same-site relative paths including query and hash", () => {
    expect(sanitizeReturnTo("/family?from=home#members")).toBe(
      "/family?from=home#members",
    );
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "\\\\evil.example\\steal",
    "/\\evil.example/steal",
    "/%2f%2fevil.example/steal",
    "javascript:alert(1)",
    "family",
    "",
  ])("rejects unsafe next value %j", (value) => {
    expect(sanitizeReturnTo(value, "/family")).toBe("/family");
  });

  it("uses a safe fallback when the provided fallback is unsafe", () => {
    expect(sanitizeReturnTo("//evil.example", "https://evil.example")).toBe("/");
  });

  it("encodes the safe return path in login and callback URLs", () => {
    expect(buildLoginPath("/family?view=all")).toBe(
      "/login?next=%2Ffamily%3Fview%3Dall",
    );
    expect(buildAuthCallbackUrl("https://storybloom.example", "/family")).toBe(
      "https://storybloom.example/auth/callback?next=%2Ffamily",
    );
  });
});
