/** Baked text follows the asset, even when the draft's next-generation mode changes. */
export function artworkText(
  draft: {
    title: string;
    subtitle: string;
    author: string;
    pages: Array<{ text: string }>;
    pageCount: number;
    spreads: number[];
  },
  page: number,
): string[] {
  if (!page) return [draft.title, draft.subtitle, draft.author];
  const candidate = page % 2 === 0 ? page : page - 1;
  const start =
    candidate >= 2 &&
    candidate + 1 <= draft.pageCount &&
    draft.spreads.includes(candidate)
      ? candidate
      : null;
  return start
    ? [draft.pages[start - 1].text, draft.pages[start].text]
    : [draft.pages[page - 1].text];
}
export function artworkMatchesText(baked: string[], expected: string[]) {
  return (
    baked.length === expected.length &&
    baked.every((text, i) => text === expected[i])
  );
}
