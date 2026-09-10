import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import manifest from "../src/app/manifest";

function worker() {
  const listeners: Record<string, (event: any) => void> = {};
  const fallback = new Response("offline");
  const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), keys: vi.fn().mockResolvedValue([]), delete: vi.fn() };
  const fetch = vi.fn().mockResolvedValue(new Response("image"));
  const caches = { open: vi.fn().mockResolvedValue(cache), match: vi.fn().mockResolvedValue(fallback) };
  const context = vm.createContext({ URL, Response, fetch, caches, self: { location: { origin: "https://example.com" }, addEventListener: (name: string, fn: any) => { listeners[name] = fn; } } });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);
  function request(path: string, options: Record<string, unknown> = {}) {
    const respondWith = vi.fn();
    listeners.fetch({ request: { url: new URL(path, "https://example.com").href, method: "GET", mode: "cors", headers: new Headers(), ...options }, respondWith });
    return respondWith;
  }
  return { request, fetch, cache, fallback };
}

describe("Web App caching boundaries", () => {
  it("does not intercept private, RSC, remote, audio range, or mutation requests", () => {
    const w = worker();
    for (const path of ["/api/photos", "/me/books", "/library?_rsc=abc", "https://other.com/library/a.webp", "/library/a.mp3"]) expect(w.request(path)).not.toHaveBeenCalled();
    expect(w.request("/library/a.webp", { method: "POST" })).not.toHaveBeenCalled();
    expect(w.request("/library/a.webp", { headers: new Headers({ range: "bytes=0-10" }) })).not.toHaveBeenCalled();
  });
  it("returns the offline shell after navigation network failure without storing pages", async () => {
    const w = worker(); w.fetch.mockRejectedValue(new Error("offline"));
    const response = await w.request("/me/books", { mode: "navigate" }).mock.calls[0][0];
    expect(response).toBe(w.fallback);
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it("serves cached public assets without network", async () => {
    const w = worker(); const cached = new Response("cached"); w.cache.match.mockResolvedValue(cached);
    expect(await w.request("/library/a/1.webp").mock.calls[0][0]).toBe(cached);
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it("keeps successful responses available when cache quota fails", async () => {
    const w = worker(); w.cache.put.mockRejectedValue(new Error("quota"));
    const response = await w.request("/library/a/1.webp").mock.calls[0][0];
    expect(await response.text()).toBe("image");
  });
  it("honors private response cache directives", async () => {
    const w = worker(); w.fetch.mockResolvedValue(new Response("private", { headers: { "cache-control": "private, no-store" } }));
    await w.request("/library/a/1.webp").mock.calls[0][0];
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it("provides standalone launch and real PNG icons", () => {
    expect(manifest()).toMatchObject({ display: "standalone", start_url: "/library", scope: "/" });
    for (const icon of manifest().icons!) expect(readFileSync(`public${icon.src}`).subarray(1, 4).toString()).toBe("PNG");
  });
});
