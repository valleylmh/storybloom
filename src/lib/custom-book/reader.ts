import type { CustomWorkbenchDraft } from "@/lib/custom-workbench";
/** Cover, endpaper / page 1, then physical facing pages 2–3, 4–5, … */
export function bookOpenings(pageCount: number): number[] {
  return [
    0,
    1,
    ...Array.from({ length: Math.floor(pageCount / 2) }, (_, i) => (i + 1) * 2),
  ];
}
export function openingForPage(page: number): number {
  return page < 2 ? page : page - (page % 2);
}

export function pdfPageNumbers(
  draft: Pick<CustomWorkbenchDraft, "pageCount" | "spreads">,
) {
  const pages = [0];
  for (let p = 1; p <= draft.pageCount; p++) {
    pages.push(p);
    if (p % 2 === 0 && draft.spreads.includes(p) && p + 1 <= draft.pageCount)
      p++;
  }
  return pages;
}
