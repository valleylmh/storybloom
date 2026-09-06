import { describe, expect, it, vi } from "vitest";
import { normalizeShelf, ShelfRepository } from "../miniprogram/src/core/storage";
import { filterBooks, shelfBooks } from "../miniprogram/src/core/catalog";
import type { BookSummary } from "../miniprogram/src/core/types";

const books: BookSummary[] = [
  { id: "poem/moon", title: "静夜思", seriesId: "poem", seriesTitle: "唐诗", subtitle: "月亮", searchText: "静夜思 李白 moon 唐诗", pageCount: 9, ageLabel: "4–8岁", cover: "" },
  { id: "science/moon", title: "月亮为什么变圆", seriesId: "science", seriesTitle: "科普", subtitle: "月亮", searchText: "月亮 为什么 moon science", pageCount: 12, ageLabel: "4–8岁", cover: "" },
];
describe("mini library discovery and local shelf", () => {
  it("combines series and case-insensitive keyword search without changing source order", () => {
    expect(filterBooks(books, " MOON ", "")).toEqual(books);
    expect(filterBooks(books, "moon 李白", "poem")).toEqual([books[0]]);
    expect(filterBooks(books, "李白", "science")).toEqual([]);
  });
  it("discards unknown books and corrupt records; clamps saved position after a shorter content update", () => {
    const state = normalizeShelf({ version: 1, favorites: { "poem/moon": 50, missing: 1, "science/moon": "bad" }, progress: { "poem/moon": { pageIndex: 99, updatedAt: 200 }, "science/moon": { pageIndex: NaN, updatedAt: 20 } } }, books);
    expect(state.favorites).toEqual({ "poem/moon": 50 });
    expect(state.progress).toEqual({ "poem/moon": { pageIndex: 8, updatedAt: 200 } });
    expect(normalizeShelf("corrupt", books).progress).toEqual({});
    expect(normalizeShelf({ version: 99 }, books).favorites).toEqual({});
  });
  it("persists favorites and reading position across repository instances", () => {
    const store = new Map();
    const port = { get: (key: string) => store.get(key), set: (key: string, value: unknown) => { store.set(key, structuredClone(value)); } };
    const first = new ShelfRepository(port, vi.fn(), () => 100);
    first.toggle(books, books[0].id);
    first.progress(books, books[0].id, 5);
    const second = new ShelfRepository(port, vi.fn());
    expect(second.read(books).progress[books[0].id].pageIndex).toBe(5);
    expect(second.read(books).favorites[books[0].id]).toBe(100);
    expect(second.toggle(books, books[0].id)).toBe(false);
  });
  it("orders favorites by time added and recent reads by time opened", () => {
    let now = 100;
    const repo = new ShelfRepository({ get: () => undefined, set: () => {} }, vi.fn(), () => now++);
    repo.toggle(books, books[0].id);
    repo.toggle(books, books[1].id);
    repo.progress(books, books[1].id, 4);
    repo.progress(books, books[0].id, 2);
    expect(shelfBooks(books, repo.read(books), "favorites").map(b => b.id)).toEqual([books[1].id, books[0].id]);
    expect(shelfBooks(books, repo.read(books), "recent").map(b => b.id)).toEqual([books[0].id, books[1].id]);
  });
  it("keeps session state when storage is full and warns only once", () => {
    const warning = vi.fn();
    const repo = new ShelfRepository({ get: () => { throw new Error("unavailable"); }, set: () => { throw new Error("full"); } }, warning);
    repo.toggle(books, books[0].id);
    repo.progress(books, books[0].id, 3);
    expect(repo.read(books).progress[books[0].id].pageIndex).toBe(3);
    expect(repo.read(books).favorites[books[0].id]).toBeTruthy();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
