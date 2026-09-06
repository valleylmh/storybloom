import type { BookSummary, ShelfState } from "./types";
const KEY = "storybloom.mini.shelf.v1";
export function normalizeShelf(raw: unknown, books: BookSummary[]): ShelfState {
  const result: ShelfState = { version: 1, favorites: {}, progress: {} };
  if (!raw || typeof raw !== "object") return result;
  const value = raw as Partial<ShelfState>;
  if (value.version !== 1) return result;
  for (const book of books) {
    const favorite = value.favorites?.[book.id];
    if (typeof favorite === "number" && Number.isFinite(favorite) && favorite > 0) result.favorites[book.id] = favorite;
    const progress = value.progress?.[book.id];
    if (progress && Number.isFinite(progress.pageIndex) && Number.isFinite(progress.updatedAt)) {
      result.progress[book.id] = { pageIndex: Math.max(0, Math.min(book.pageCount - 1, Math.floor(progress.pageIndex))), updatedAt: progress.updatedAt };
    }
  }
  return result;
}
export interface StoragePort { get(key: string): unknown; set(key: string, state: ShelfState): void }
export class ShelfRepository {
  private warned = false;
  private memory?: ShelfState;
  constructor(private storage: StoragePort, private onError: () => void, private now = Date.now) {}
  private warn() { if (!this.warned) { this.warned = true; this.onError(); } }
  read(books: BookSummary[]): ShelfState {
    if (this.memory) return normalizeShelf(this.memory, books);
    try { return normalizeShelf(this.storage.get(KEY), books); }
    catch { this.warn(); return normalizeShelf(undefined, books); }
  }
  private save(state: ShelfState) {
    this.memory = state;
    try { this.storage.set(KEY, state); } catch { this.warn(); }
  }
  toggle(books: BookSummary[], id: string) {
    const state = this.read(books);
    if (!books.some(book => book.id === id)) return false;
    if (state.favorites[id]) delete state.favorites[id];
    else state.favorites[id] = this.now();
    this.save(state);
    return Boolean(state.favorites[id]);
  }
  progress(books: BookSummary[], id: string, pageIndex: number) {
    const state = this.read(books);
    state.progress[id] = { pageIndex, updatedAt: this.now() };
    this.save(normalizeShelf(state, books));
  }
}
