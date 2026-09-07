import type { BookPage } from "./types";
/** Keep lookahead bounded so distant pages do not compete with the visible illustration. */
export function readerImageLookahead(pages: BookPage[], index: number): string[] {
  return Array.from(new Set(pages.slice(index + 1, index + 3).map(page => page.image).filter(Boolean)));
}
