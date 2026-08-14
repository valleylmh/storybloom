import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608140001_growth_moments_storybook_versions.sql",
  ),
  "utf8",
);

describe("growth moment cloud compatibility foundation", () => {
  it("separates Moments, original assets, and storybook versions", () => {
    for (const table of [
      "growth_moments",
      "growth_moment_assets",
      "storybook_versions",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      for (const operation of ["select", "insert", "update", "delete"]) {
        expect(migration).toContain(`${table}_${operation}_own`);
      }
    }
    expect(migration).toContain("active_storybook_version_id uuid");
    expect(migration).toContain("legacy_growth_record_id uuid");
    expect(migration).toContain("unique (user_id, growth_moment_id, client_story_id)");
  });

  it("keeps every relationship user-scoped without binding a character to the Moment", () => {
    expect(migration).toMatch(
      /foreign key \(child_profile_id, user_id\)[\s\S]*?references public\.child_profiles\(id, user_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(growth_moment_id, user_id\)[\s\S]*?references public\.growth_moments\(id, user_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(character_reference_id, character_profile_id, user_id\)[\s\S]*?references public\.family_characters\(id, profile_id, user_id\)/i,
    );
    const momentTable = migration.slice(
      migration.indexOf("create table if not exists public.growth_moments"),
      migration.indexOf("create table if not exists public.growth_moment_assets"),
    );
    expect(momentTable).not.toContain("character_reference_id");
    expect(momentTable).not.toContain("reading_stage");
    expect(momentTable).not.toContain("story_treatment");
  });

  it("does not deploy storage access, backfill legacy rows, or embed private media", () => {
    expect(migration).not.toContain("storage.objects");
    expect(migration).not.toContain("insert into public.growth_moments");
    expect(migration).not.toContain("update public.growth_records");
    expect(migration).toContain("story_snapshot::text !~*");
    expect(migration).toContain("storage_path !~* '^(data|blob|https?):'");
  });
});
