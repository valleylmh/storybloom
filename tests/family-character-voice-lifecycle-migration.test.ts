import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608090004_family_character_voice_lifecycle.sql",
  ),
  "utf8",
);

describe("family character voice lifecycle migration", () => {
  it("upgrades already-deployed voice rows without capping cleanup queues", () => {
    expect(migration).toMatch(
      /add column if not exists retired_sample_paths text\[\][\s\S]*?not null default '\{\}'/i,
    );
    expect(migration).toMatch(
      /add column if not exists provider_voice_ids_before_attempt text\[\]/i,
    );
    expect(migration).toMatch(
      /status in \('processing', 'ready', 'failed', 'deleting'\)/i,
    );
    expect(migration).toMatch(
      /drop constraint if exists family_character_voices_retired_voice_ids_check/i,
    );
    expect(migration).not.toMatch(
      /add constraint family_character_voices_retired_voice_ids_check/i,
    );
    expect(migration).toMatch(
      /family_character_voices_character_owner_fkey[\s\S]*?on delete restrict/i,
    );
    expect(migration).toMatch(
      /family_character_voices_sample_path_check[\s\S]*?\\\.\(wav\|mp3\|m4a\|mp4\|webm\|ogg\)\$/i,
    );
  });

  it("keeps the account deletion lock service-only", () => {
    expect(migration).toContain(
      "create table if not exists public.account_voice_deletion_locks",
    );
    expect(migration).toMatch(
      /revoke all on table public\.account_voice_deletion_locks[\s\S]*?from public, anon, authenticated;/i,
    );
    expect(migration).toContain(
      "grant all on table public.account_voice_deletion_locks to service_role;",
    );
    expect(migration).toMatch(
      /create policy account_voice_deletion_locks_service_role_all[\s\S]*?to service_role[\s\S]*?using \(true\)[\s\S]*?with check \(true\)/i,
    );
  });

  it("blocks direct character or profile deletion while voice metadata exists", () => {
    expect(migration).toMatch(
      /create policy family_characters_delete_own[\s\S]*?not exists \([\s\S]*?from public\.family_character_voices/i,
    );
    expect(migration).toMatch(
      /create policy family_profiles_delete_own[\s\S]*?not exists \([\s\S]*?from public\.family_character_voices/i,
    );
    expect(migration).toMatch(
      /revoke all on table public\.family_character_voices[\s\S]*?from public, anon, authenticated;/i,
    );
    expect(migration).not.toMatch(
      /create policy family_character_voices_(?:insert|update|delete)_own/i,
    );
  });

  it("limits new samples to 10 MiB provider-compatible audio", () => {
    const bucketBlock = migration.match(
      /insert into storage\.buckets[\s\S]*?on conflict \(id\) do update set[\s\S]*?allowed_mime_types = excluded\.allowed_mime_types;/i,
    )?.[0];
    expect(bucketBlock).toBeTruthy();
    expect(bucketBlock).toContain("10485760");
    expect(bucketBlock).toContain("'audio/wav'");
    expect(bucketBlock).toContain("'audio/mpeg'");
    expect(bucketBlock).toContain("'audio/mp4'");
    expect(bucketBlock).toContain("'audio/x-m4a'");
    expect(bucketBlock).not.toContain("audio/webm");
    expect(bucketBlock).not.toContain("audio/ogg");

    const insertPolicy = migration.match(
      /create policy family_voice_samples_insert_own[\s\S]*?\n\);/i,
    )?.[0];
    expect(insertPolicy).toBeTruthy();
    expect(insertPolicy).toMatch(
      /lower\(storage\.extension\(name\)\) in \('wav', 'mp3', 'm4a'\)/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.can_upload_family_voice_sample[\s\S]*?from public\.account_voice_deletion_locks/i,
    );
  });

  it("uses rerunnable DDL for manual Dashboard deployment", () => {
    expect(migration).toMatch(/add column if not exists enrollment_attempt_id/i);
    expect(migration).toMatch(/add column if not exists retired_voice_ids/i);
    expect(migration).toMatch(/add column if not exists previous_ready_voice/i);
    expect(migration).toMatch(/drop constraint if exists/i);
    expect(migration).toMatch(/drop policy if exists/i);
    expect(migration).toMatch(/create table if not exists/i);
    expect(migration).toMatch(/create or replace function/i);
    expect(migration).toMatch(/on conflict \(id\) do update/i);
  });
});
