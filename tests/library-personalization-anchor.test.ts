import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL(
      "../src/app/api/library/personalization/anchor/route.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("private library personalization Anchor", () => {
  it("requires authentication and binds the reference to an owned family character", () => {
    expect(source).toContain("requireAuthenticatedUser(request)");
    expect(source).toContain('.eq("user_id", user.id)');
    expect(source).toContain(
      'referenceAssetPath.startsWith(`${user.id}/${data.id}/`)',
    );
  });

  it("returns a private no-store preview without changing provider configuration", () => {
    expect(source).toContain("createStoryCharacterAnchorToken");
    expect(source).toContain("getCachedCharacterReferenceDataUri");
    expect(source).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(source).not.toContain("BAILIAN_TOKEN_KEY");
    expect(source).not.toContain("CPA_BASE_URL =");
  });
});
