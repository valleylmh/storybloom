import { describe, expect, it } from "vitest";
import { AuthenticationError } from "@/lib/supabase/server-auth";

describe("server authentication errors", () => {
  it("uses a user-facing Chinese message by default", () => {
    expect(new AuthenticationError().message).toBe(
      "登录状态已失效，请重新登录后再试。",
    );
  });
});
