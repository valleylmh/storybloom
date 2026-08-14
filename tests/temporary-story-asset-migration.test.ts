import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608130001_temporary_story_generation_assets.sql",
  ),
  "utf8",
);

describe("temporary story generation asset migration", () => {
  it("creates a private, bounded image bucket for server-only access", () => {
    expect(migration).toContain("'story-generation-assets'");
    expect(migration).toMatch(
      /'story-generation-assets',[\s\S]*?false,[\s\S]*?16777216,[\s\S]*?image\/jpeg[\s\S]*?image\/png[\s\S]*?image\/webp/i,
    );
    expect(migration).not.toMatch(/create policy/i);
    expect(migration).toMatch(/service-role client/i);
    expect(migration).toMatch(/necessary but not sufficient/i);
    expect(migration).toMatch(/anon\/auth denial/i);
    expect(migration).toMatch(/upload\/download\/delete/i);
  });
});
