import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeAccountRows, shouldUpload } from "@/lib/sync/account-sync-model";
import { canSaveRecord, claimRecord, setActiveRecordOwner } from "@/lib/sync/account-ownership";
import type { SyncMeta } from "@/lib/sync/sync-meta";
const meta: SyncMeta = { entityType: "story", localId: "a", status: "synced", lastSyncedAt: "2026-09-12T10:00:00Z" };
const row = (id: string, updatedAt: string, text = "") => ({ id, updatedAt, text });
const merge = (local: ReturnType<typeof row>[], cloud: ReturnType<typeof row>[], metadata: SyncMeta[] = []) => mergeAccountRows(local, cloud, r => r.id, r => r.updatedAt, metadata);
afterEach(() => { setActiveRecordOwner(null); vi.unstubAllGlobals(); });
describe("unified account sync", () => {
  it("merges first-device uploads and second-device downloads into one row", () => {
    expect(merge([row("a", "2026-09-12")], [row("a", "2026-09-13", "cloud"), row("b", "2026-09-13")])).toHaveLength(2);
    expect(merge([row("a", "2026-09-12")], [row("a", "2026-09-13", "cloud")])[0].text).toBe("cloud");
  });
  it("retains an offline edit while waiting for upload", () => {
    expect(shouldUpload("a", "2026-09-13", new Set(["a"]), meta)).toBe(true);
    expect(merge([row("a", "2026-09-13", "pending")], [row("a", "2026-09-12")], [meta])[0].text).toBe("pending");
  });
  it("never resurrects a deleted remote row, including an older failed retry", () => {
    for (const status of ["synced", "failed", "pending"] as const) {
      const previous = { ...meta, status };
      expect(shouldUpload("a", "2026-09-13", new Set(), previous)).toBe(false);
      expect(merge([row("a", "2026-09-13")], [], [previous])).toEqual([]);
    }
  });
  it("keeps never-uploaded records visible and retries their first upload", () => {
    const failed: SyncMeta = { entityType: "story", localId: "a", status: "failed" };
    expect(shouldUpload("a", "2026-09-13", new Set(), failed)).toBe(true);
    expect(merge([row("a", "2026-09-13")], [], [failed])).toHaveLength(1);
  });
  it("does not repeatedly upload unchanged records", () => {
    expect(shouldUpload("a", "2026-09-12T09:00:00Z", new Set(["a"]), meta)).toBe(false);
  });
  it("binds device records to the first account and never silently reassigns them", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => store.get(key) || null, setItem: (key: string, value: string) => store.set(key, value) } });
    setActiveRecordOwner("account-a");
    expect(claimRecord("story", "shared-id")).toBe(true);
    setActiveRecordOwner("account-b");
    expect(claimRecord("story", "shared-id")).toBe(false);
    expect(canSaveRecord("story", "shared-id")).toBe(false);
    expect(claimRecord("story", "new-id")).toBe(true);
    setActiveRecordOwner(null);
    expect(claimRecord("story", "anonymous")).toBe(false);
    expect(canSaveRecord("story", "anonymous")).toBe(true);
  });
  it("fails closed when the ownership ledger cannot be persisted", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => { throw new Error("quota"); } } });
    expect(() => claimRecord("story", "a", "user")).toThrow("quota");
  });
});
