import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608090003_family_character_voices.sql",
  ),
  "utf8",
);

describe("family character voices migration", () => {
  it("binds one consented enrollment to the owned family character", () => {
    expect(migration).toContain(
      "create table if not exists public.family_character_voices",
    );
    expect(migration).toContain("unique (family_character_id)");
    expect(migration).toMatch(
      /foreign key \(family_character_id, profile_id, user_id\)[\s\S]*?references public\.family_characters\(id, profile_id, user_id\)/i,
    );
    expect(migration).toContain("unique (id, profile_id, user_id)");
    expect(migration).toMatch(
      /sample_duration_seconds between 10 and 60/i,
    );
    expect(migration).toMatch(
      /target_model text not null default 'qwen-audio-3\.0-tts-plus'/i,
    );
    expect(migration).toMatch(
      /status <> 'ready'[\s\S]*?nullif\(trim\(voice_id\), ''\) is not null/i,
    );
    expect(migration).toMatch(
      /sample_audio_path like[\s\S]*?user_id::text \|\| '\/' \|\| family_character_id::text/i,
    );
    expect(migration).toMatch(
      /enrollment_attempt_id uuid not null default gen_random_uuid\(\)/i,
    );
    expect(migration).toMatch(
      /retired_voice_ids text\[\] not null default '\{\}'/i,
    );
    expect(migration).toMatch(/previous_ready_voice jsonb/i);
    expect(migration).toMatch(
      /status in \('processing', 'ready', 'failed', 'deleting'\)/i,
    );
  });

  it("gives authenticated users only their safe metadata columns", () => {
    const grant = migration.match(
      /grant select \(([\s\S]*?)\) on table public\.family_character_voices to authenticated;/i,
    )?.[1];
    expect(grant).toBeTruthy();
    expect(grant).toContain("sample_audio_path");
    expect(grant).toContain("status");
    expect(grant).not.toContain("voice_id");
    expect(grant).not.toContain("provider_request_id");
    expect(grant).not.toContain("enrollment_attempt_id");
    expect(grant).not.toContain("retired_voice_ids");
    expect(grant).not.toContain("previous_ready_voice");
    expect(migration).toContain("family_character_voices_select_own");
    expect(migration).not.toContain("family_character_voices_insert_own");
    expect(migration).not.toContain("family_character_voices_update_own");
    expect(migration).not.toContain("family_character_voices_delete_own");
    expect(migration).toContain(
      "grant all on table public.family_character_voices to service_role;",
    );
  });

  it("creates a private insert/delete-only audio bucket", () => {
    expect(migration).toMatch(
      /'family-voice-samples',[\s\S]*?'family-voice-samples',[\s\S]*?false/i,
    );
    expect(migration).toContain("family_voice_samples_insert_own");
    expect(migration).toContain("family_voice_samples_delete_own");
    expect(migration).not.toContain("create policy family_voice_samples_select_own");
    expect(migration).not.toContain("create policy family_voice_samples_update_own");
    expect(migration).toMatch(
      /array_length\(storage\.foldername\(name\), 1\) = 2/i,
    );
    expect(migration).toMatch(
      /lower\(storage\.extension\(name\)\) in \('webm', 'wav', 'mp3', 'mp4', 'ogg'\)/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.can_upload_family_voice_sample[\s\S]*?select count\(\*\) < 8/i,
    );
    expect(migration).toContain(
      "public.can_upload_family_voice_sample(",
    );
  });
});
