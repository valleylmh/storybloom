import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608090001_cloud_growth_archive.sql",
  ),
  "utf8",
);

describe("cloud growth archive migration", () => {
  it("keeps cloud sync opt-in and separates the core entities", () => {
    expect(migration).toMatch(
      /cloud_sync_enabled boolean not null default false/i,
    );
    for (const table of [
      "account_settings",
      "child_profiles",
      "saved_stories",
      "growth_records",
      "growth_record_photos",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      for (const operation of ["select", "insert", "update", "delete"]) {
        expect(migration).toContain(`${table}_${operation}_own`);
      }
    }
  });

  it("uses idempotency keys and user-scoped composite foreign keys", () => {
    expect(migration).toContain("unique (user_id, client_story_id)");
    expect(migration).toContain("unique (user_id, client_record_id)");
    expect(migration).toMatch(
      /foreign key \(child_profile_id, user_id\)[\s\S]*?references public\.child_profiles\(id, user_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(saved_story_id, user_id\)[\s\S]*?references public\.saved_stories\(id, user_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(growth_record_id, user_id\)[\s\S]*?references public\.growth_records\(id, user_id\)/i,
    );
  });

  it("creates private buckets whose policies check the first path segment", () => {
    expect(migration).toContain("'story-archive'");
    expect(migration).toContain("'growth-record-photos'");
    expect(migration).toMatch(
      /'story-archive',[\s\S]*?false,[\s\S]*?array\['image\/webp'\]/i,
    );
    expect(migration).toMatch(
      /'growth-record-photos',[\s\S]*?false,[\s\S]*?array\['image\/webp'\]/i,
    );
    const firstFolderChecks = migration.match(
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/g,
    );
    expect(firstFolderChecks?.length).toBe(10);
  });
});
