import { describe, expect, it } from "vitest";
import {
  canAccessGenerationResource,
  getGenerationPrincipalIds,
  isGenerationResourceOwned,
} from "@/lib/generation-authorization";

const anonymous = { type: "anonymous" as const, id: `v1_${"a".repeat(64)}` };
const otherAnonymous = { type: "anonymous" as const, id: `v1_${"b".repeat(64)}` };
const user = { type: "user" as const, id: `v1_${"c".repeat(64)}` };

describe("generation resource authorization", () => {
  it("allows either the same device principal or the granted user principal", () => {
    const resource = {
      generationPrincipalIds: getGenerationPrincipalIds({
        anonymousPrincipal: anonymous,
        userPrincipal: user,
      }),
    };
    expect(canAccessGenerationResource(resource, { anonymousPrincipal: anonymous })).toBe(true);
    expect(
      canAccessGenerationResource(resource, {
        anonymousPrincipal: otherAnonymous,
        userPrincipal: user,
      }),
    ).toBe(true);
    expect(
      canAccessGenerationResource(resource, {
        anonymousPrincipal: otherAnonymous,
      }),
    ).toBe(false);
  });

  it("keeps legacy resources readable until they are recreated with ownership", () => {
    expect(isGenerationResourceOwned({})).toBe(false);
    expect(
      canAccessGenerationResource({}, { anonymousPrincipal: otherAnonymous }),
    ).toBe(true);
  });
});
