import { describe, expect, it, vi } from "vitest";
import { BookAudioTransport, type BookAudio } from "../src/lib/reader/book-audio-transport";
import { getLibraryChineseAudio } from "../src/lib/library-book-audio";
import { getAllSeries, getSeriesBooks } from "../src/lib/library";
const asset: BookAudio = { url: "https://example.com/book.mp3", pageStarts: [0, 5.5, 13], duration: 20, contentHash: "test" };
function setup(page = 0, resume = 0) {
  const audio = { src: "", currentTime: 0, ended: false, paused: false, load: vi.fn(), pause: vi.fn(),
    onloadedmetadata: null, ontimeupdate: null, onplay: null, onpause: null, onended: null, onerror: null } as unknown as HTMLAudioElement;
  const callbacks = { autoAdvance: vi.fn(() => true), position: vi.fn(), playing: vi.fn(), paused: vi.fn(), ended: vi.fn(), error: vi.fn() };
  const transport = new BookAudioTransport(audio, asset, page, resume, callbacks);
  const fire = (name: string) => (audio as unknown as Record<string, () => void>)[name]?.();
  fire("onloadedmetadata");
  return { audio, callbacks, transport, fire };
}
describe("reused library Chinese audio", () => {
  it("resolves matching public assets for all published illustrated books and rejects changed text", () => {
    let matched = 0;
    for (const series of getAllSeries()) for (const book of getSeriesBooks(series.id)) {
      const audio = getLibraryChineseAudio(series.id, book.id, book.pages);
      if (!audio) continue;
      matched++;
      expect(audio.pageStarts).toHaveLength(book.pages.length);
      const pages = book.pages.map((p, i) => i ? p : { ...p, zhText: p.zhText + "修改" });
      expect(getLibraryChineseAudio(series.id, book.id, pages)).toBeUndefined();
    }
    expect(matched).toBe(210);
  });
  it("continues through variable page boundaries with one source and page-relative progress", () => {
    const { audio, callbacks, transport, fire } = setup();
    audio.currentTime = 6.2; fire("ontimeupdate");
    expect(transport.pageIndex).toBe(1);
    expect(callbacks.position).toHaveBeenLastCalledWith(1, expect.closeTo(700), 7500);
    audio.currentTime = 14; fire("ontimeupdate"); expect(transport.pageIndex).toBe(2);
    expect(audio.load).toHaveBeenCalledOnce(); expect(audio.src).toBe(asset.url);
  });
  it("restores a page-relative position and seeks manually without resuming paused audio", () => {
    const { audio, transport, fire, callbacks } = setup(1, 2000);
    expect(audio.currentTime).toBe(7.5);
    fire("onpause"); expect(callbacks.paused).toHaveBeenLastCalledWith(2000);
    transport.selectPage(2); expect(audio.currentTime).toBe(13);
    expect(audio.load).toHaveBeenCalledOnce(); expect(callbacks.playing).not.toHaveBeenCalled();
  });
  it("stops at a page boundary when auto advance is off", () => {
    const { audio, callbacks, fire } = setup(); callbacks.autoAdvance.mockReturnValue(false);
    audio.currentTime = 5.6; fire("ontimeupdate");
    expect(audio.pause).toHaveBeenCalledOnce(); expect(callbacks.ended).toHaveBeenLastCalledWith(0);
    fire("onpause"); fire("ontimeupdate");
    expect(callbacks.paused).not.toHaveBeenCalled(); expect(callbacks.ended).toHaveBeenCalledOnce();
  });
  it("ignores callbacks from a disposed language/story session and exposes failures", () => {
    const { transport, callbacks, fire } = setup();
    fire("onerror"); expect(callbacks.error).toHaveBeenCalledOnce();
    transport.destroy(); fire("onended"); fire("onplay");
    expect(callbacks.ended).not.toHaveBeenCalled(); expect(callbacks.playing).not.toHaveBeenCalled();
  });
});
