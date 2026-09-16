import { describe, expect, it } from 'vitest';
import { createWorkbenchDraft, makeAsset, nextWeeklyReset, serializeWorkbench, setWorkbenchPageCount, spreadStart, toggleWorkbenchSpread } from '../src/lib/custom-workbench';

describe('custom workbench page preservation', () => {
  it('preserves hidden edited pages, assets and spread relationships when reducing and restoring', () => {
    let draft = createWorkbenchDraft();
    draft.pages[6].text = '用户的第七页';
    draft.pages[6].asset = makeAsset('blob:test-photo', '孩子.png', 'page');
    draft = toggleWorkbenchSpread(draft, 6);
    const reduced = setWorkbenchPageCount(draft, 4);
    expect(spreadStart(reduced, 6)).toBeNull();
    const restored = setWorkbenchPageCount(reduced, 8);
    expect(restored.pages[6]).toEqual(draft.pages[6]);
    expect(spreadStart(restored, 7)).toBe(6);
  });
  it('bounds input to 4–12 integer pages without trimming stored content', () => {
    const draft = createWorkbenchDraft();
    for (const [input, expected] of [[0, 4], [99, 12], [7.6, 8], [NaN, 8]]) {
      const next = setWorkbenchPageCount(draft, input);
      expect(next.pageCount).toBe(expected);
      expect(next.pages).toHaveLength(12);
    }
  });
  it('only pairs physical facing pages and leaves cover, first and trailing pages independent', () => {
    let draft = setWorkbenchPageCount(createWorkbenchDraft(), 5);
    for (const invalid of [0, 1, 3, 5, 6]) expect(toggleWorkbenchSpread(draft, invalid)).toBe(draft);
    draft = toggleWorkbenchSpread(draft, 4);
    expect(spreadStart(draft, 4)).toBe(4);
    expect(spreadStart(draft, 5)).toBe(4);
    expect(spreadStart(draft, 0)).toBeNull();
    expect(spreadStart(draft, 1)).toBeNull();
    draft = setWorkbenchPageCount(draft, 4);
    expect(spreadStart(draft, 4)).toBeNull();
  });
  it('unpairing restores the original independent right-page asset and text', () => {
    const original = createWorkbenchDraft();
    const paired = toggleWorkbenchSpread(original, 2);
    const restored = toggleWorkbenchSpread(paired, 2);
    expect(restored.pages).toEqual(original.pages);
    expect(restored.spreads).toEqual([]);
  });
});
describe('draft export and week boundary', () => {
  it('excludes transient image bytes and URLs but preserves processing metadata', () => {
    const draft = createWorkbenchDraft(false);
    draft.cover = makeAsset('data:image/png;base64,PRIVATE', '原图.png', 'cover');
    draft.cover.crop = { x: 20, y: 70, zoom: 1.5 };
    draft.cover.retouch = ['去背景'];
    const text = serializeWorkbench(draft);
    expect(text).not.toContain('PRIVATE');
    const exported = JSON.parse(text);
    expect(exported.version).toBe(1);
    expect(exported.cover.crop).toEqual(draft.cover.crop);
    expect(exported.cover.retouch).toEqual(['去背景']);
  });
  it('resets exactly at the next Beijing Monday midnight across UTC dates', () => {
    expect(nextWeeklyReset(new Date('2026-09-20T15:59:59Z'))).toBe('2026-09-20T16:00:00.000Z');
    expect(nextWeeklyReset(new Date('2026-09-20T16:00:00Z'))).toBe('2026-09-27T16:00:00.000Z');
    expect(nextWeeklyReset(new Date('2026-12-31T18:00:00Z'))).toBe('2027-01-03T16:00:00.000Z');
  });
});
