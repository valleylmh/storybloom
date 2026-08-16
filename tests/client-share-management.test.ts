import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createShareManagementCode,
  getStoredShare,
  restoreShareManagementCode,
  revokeSharesBeforeStoryDeletion,
  storeShare,
} from "@/lib/client-share-management";

function createBrowser() {
  const values = new Map<string, string>();
  return {
    localStorage: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    dispatchEvent: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", createBrowser());
  vi.stubGlobal("Event", class Event {
    constructor(public type: string) {}
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("anonymous share recovery", () => {
  it("restores a revocation credential from a portable management code", () => {
    const share = {
      shareId: "share_12345678",
      deleteToken: "delete_token_123456789012",
      url: "https://story.example/s/share_12345678",
    };
    expect(storeShare("story-1", share)).toBe(true);
    const code = createShareManagementCode(share);

    expect(
      restoreShareManagementCode(
        "story-2",
        code,
        "https://story.example",
      ),
    ).toMatchObject(share);
    expect(getStoredShare("story-2")).toMatchObject(share);
  });

  it("keeps the local delete token when revocation fails", async () => {
    const share = {
      shareId: "share_12345678",
      deleteToken: "delete_token_123456789012",
      url: "https://story.example/s/share_12345678",
    };
    storeShare("story-1", share);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(
      revokeSharesBeforeStoryDeletion({ storyId: "story-1" }),
    ).rejects.toThrow("share-revocation-failed");
    expect(getStoredShare("story-1")).toEqual(share);
  });
});
