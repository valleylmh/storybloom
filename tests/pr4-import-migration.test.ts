import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const archiveMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608090001_cloud_growth_archive.sql",
  ),
  "utf8",
);

const importMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608090002_local_import_sync_foundation.sql",
  ),
  "utf8",
);

describe("PR-4 local import migration", () => {
  it("keeps story and growth imports idempotent and adds a stable child key", () => {
    expect(archiveMigration).toContain("unique (user_id, client_story_id)");
    expect(archiveMigration).toContain("unique (user_id, client_record_id)");
    expect(importMigration).toMatch(
      /add column if not exists client_child_id text/i,
    );
    expect(importMigration).toContain(
      "unique (user_id, client_child_id)",
    );
    expect(importMigration).toMatch(
      /client_child_id is null[\s\S]*?char_length\(client_child_id\) between 1 and 200/i,
    );
  });

  it("gives story and growth images deterministic metadata upsert targets", () => {
    expect(importMigration).toContain(
      "create table if not exists public.saved_story_assets",
    );
    expect(importMigration).toContain(
      "unique (user_id, saved_story_id, asset_key)",
    );
    expect(importMigration).toContain("unique (user_id, storage_path)");
    expect(importMigration).toMatch(
      /foreign key \(saved_story_id, user_id\)[\s\S]*?references public\.saved_stories\(id, user_id\)/i,
    );

    expect(importMigration).toMatch(
      /add column if not exists client_photo_id text/i,
    );
    expect(importMigration).toContain(
      "unique (user_id, growth_record_id, client_photo_id)",
    );
    expect(importMigration).toContain(
      "unique (user_id, growth_record_id, storage_path)",
    );
    expect(importMigration).toContain(
      "unique (user_id, growth_record_id, sort_order)",
    );
    expect(importMigration).toContain("check (sort_order between 0 and 3)");
  });

  it("prevents embedded image data and less complete story overwrites", () => {
    expect(importMigration).toMatch(
      /story_snapshot::text !~\* 'data:image\/'/i,
    );
    expect(importMigration).toMatch(
      /asset_manifest::text !~\* 'data:image\/'/i,
    );
    expect(importMigration).toMatch(
      /growth_records_no_embedded_image_data_check[\s\S]*?note !~\* 'data:image\/'/i,
    );
    expect(importMigration).toContain(
      "create or replace function public.story_snapshot_completeness",
    );
    expect(importMigration).toContain("page_value ->> 'imageStatus'");
    expect(importMigration).toContain("page_value ->> 'image_status'");
    expect(importMigration).toMatch(
      /lower\(old\.status\) = 'complete'[\s\S]*?lower\(new\.status\) = 'generating'/i,
    );
    expect(importMigration).toMatch(
      /story_snapshot_completeness\(new\.story_snapshot\)[\s\S]*?< public\.story_snapshot_completeness\(old\.story_snapshot\)/i,
    );
    for (const field of ["title", "story_snapshot", "asset_manifest", "status"]) {
      expect(importMigration).toContain(`new.${field} := old.${field};`);
    }
  });

  it("keeps metadata and storage private to the authenticated user", () => {
    expect(importMigration).toContain(
      "alter table public.saved_story_assets enable row level security;",
    );
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(importMigration).toContain(`saved_story_assets_${operation}_own`);
    }
    const userFolderChecks = importMigration.match(
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/g,
    );
    const uuidFolderChecks = importMigration.match(
      /\(storage\.foldername\(name\)\)\[2\]/g,
    );
    const webpChecks = importMigration.match(
      /lower\(storage\.extension\(name\)\) = 'webp'/g,
    );
    expect(userFolderChecks?.length).toBe(10);
    expect(uuidFolderChecks?.length).toBe(10);
    expect(webpChecks?.length).toBe(10);
  });
});
