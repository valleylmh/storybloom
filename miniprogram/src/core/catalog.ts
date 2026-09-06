import type { BookSummary, ShelfState } from "./types";
export function filterBooks(books: BookSummary[], query: string, seriesId: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return books.filter(book => (!seriesId || book.seriesId === seriesId) &&
    words.every(word => book.searchText.toLowerCase().includes(word)));
}
export function shelfBooks(books: BookSummary[], state: ShelfState, tab: "recent" | "favorites") {
  return books.filter(book => tab === "recent" ? Boolean(state.progress[book.id]) : Boolean(state.favorites[book.id]))
    .sort((a, b) => tab === "recent"
      ? state.progress[b.id].updatedAt - state.progress[a.id].updatedAt
      : state.favorites[b.id] - state.favorites[a.id]);
}
