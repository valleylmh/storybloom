import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../miniprogram/src/core/device", () => ({ saveProgress: vi.fn() }));
vi.mock("../miniprogram/src/core/content", () => ({ catalog: { books: [] } }));
import { BackgroundNarration } from "../miniprogram/src/core/background-narration";
import { pageAtTime, validBookAudio } from "../miniprogram/src/core/book-audio";
import { saveProgress } from "../miniprogram/src/core/device";
import type { Book, BookSummary } from "../miniprogram/src/core/types";
const book: Book = { id: "test/book", title: "测试", guide: [], pages: [0, 1, 2].map(i => ({
  zh: `中文${i}`, en: `English${i}`, image: "", audio: { zh: "", en: "" },
})), chineseAudio: { url: "https://media.example.com/book.mp3", pageStarts: [0, 3.75, 12.4], duration: 18, contentHash: "hash" } };
const summary = { id: book.id, title: book.title, pageCount: 3, cover: "https://example.com/cover.jpg", seriesTitle: "测试系列" } as BookSummary;
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
function setup() {
  const events: Record<string, () => void> = {};
  const manager = { src: "", title: "", currentTime: 0, startTime: 0, play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(),
    onNext: (fn: () => void) => { events.next = fn; },
    onPlay: (fn: () => void) => { events.play = fn; }, onPause: (fn: () => void) => { events.pause = fn; },
    onStop: (fn: () => void) => { events.stop = fn; }, onEnded: (fn: () => void) => { events.ended = fn; },
    onWaiting: (fn: () => void) => { events.waiting = fn; }, onError: (fn: () => void) => { events.error = fn; },
    onTimeUpdate: (fn: () => void) => { events.time = fn; }, onSeeked: (fn: () => void) => { events.seeked = fn; },
  };
  const request = vi.fn();
  vi.stubGlobal("wx", { getBackgroundAudioManager: () => manager, request });
  return { narration: new BackgroundNarration(), manager, events, request };
}
describe("single Chinese book track with sample-based timeline", () => {
  it("validates complete ordered timelines and exact boundaries", () => {
    expect(validBookAudio(book.chineseAudio, 3)).toBe(true);
    for (const pageStarts of [[0, 3.75], [0, 4, 4], [1, 4, 6], [0, NaN, 6], [0, 4, 19]]) {
      expect(validBookAudio({ ...book.chineseAudio!, pageStarts }, 3)).toBe(false);
    }
    expect(validBookAudio({ ...book.chineseAudio!, url: "https://host/a?token=secret" }, 3)).toBe(false);
    expect(pageAtTime([0, 3.75, 12.4], 3.749)).toBe(0);
    expect(pageAtTime([0, 3.75, 12.4], 3.75)).toBe(1);
    expect(pageAtTime([0, 3.75, 12.4], 999)).toBe(2);
  });
  it("updates page from playback time without replacing src or making API calls", () => {
    const { narration, manager, events, request } = setup();
    narration.start(book, summary, 0); events.play();
    manager.currentTime = 3.75; events.time();
    expect(narration.state).toMatchObject({ pageIndex: 1, status: "playing" });
    manager.currentTime = 12.4; events.time();
    expect(narration.state.pageIndex).toBe(2);
    expect(manager.src).toBe(book.chineseAudio!.url); expect(request).not.toHaveBeenCalled();
    events.ended(); expect(narration.state.status).toBe("ended");
  });
  it("starts from saved page and ignores old time events while seeking", () => {
    const { narration, manager, events } = setup();
    narration.start(book, summary, 2); events.play();
    expect(manager.startTime).toBe(12.4); expect(narration.state.pageIndex).toBe(2);
    manager.currentTime = 12.4; events.time();
    narration.selectPage(1); expect(manager.seek).toHaveBeenCalledWith(3.75);
    events.time(); expect(narration.state.pageIndex).toBe(1);
    manager.currentTime = 3.75; events.seeked(); expect(narration.state.pageIndex).toBe(1);
    expect(narration.selectPage(-1)).toBe(false);
  });
  it("keeps pause intent on manual seek and resumes from there", () => {
    const { narration, events, manager } = setup();
    narration.start(book, summary, 0); events.play(); narration.pause();
    narration.selectPage(1); manager.currentTime = 3.75; events.seeked(); events.waiting();
    expect(narration.state.status).toBe("paused"); expect(manager.play).not.toHaveBeenCalled();
    narration.start(book, summary, 1); events.play();
    expect(manager.play).toHaveBeenCalledOnce(); expect(narration.state.status).toBe("playing");
  });
  it("survives listener removal and resyncs after background time notifications were suspended", () => {
    const { narration, events, manager } = setup();
    const listener = vi.fn(); const unsubscribe = narration.subscribe(listener);
    narration.start(book, summary, 0); events.play(); unsubscribe(); listener.mockClear();
    manager.currentTime = 14; narration.syncPosition();
    expect(saveProgress).toHaveBeenLastCalledWith(expect.any(Array), book.id, 2);
    expect(listener).not.toHaveBeenCalled();
    const restored = vi.fn(); narration.subscribe(restored);
    expect(restored).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 2, status: "playing" }));
  });
  it("follows native seeking backwards, stop, errors and retries", () => {
    const { narration, events, manager } = setup();
    narration.start(book, summary, 0); events.play();
    manager.currentTime = 14; events.time(); manager.currentTime = 1; events.seeked();
    expect(narration.state.pageIndex).toBe(0);
    events.error(); expect(narration.state.status).toBe("error");
    events.ended(); expect(narration.state.status).toBe("error");
    narration.start(book, summary, 1); expect(manager.startTime).toBe(3.75);
    events.stop(); expect(narration.state.status).toBe("idle");
  });
  it("rejects missing assets instead of generating during playback", () => {
    const { narration, request } = setup();
    narration.start({ ...book, chineseAudio: undefined }, summary, 0);
    expect(narration.state.error).toContain("尚未准备好"); expect(request).not.toHaveBeenCalled();
  });
});

it("stops at the end of the current book and can restart from the beginning", () => {
  const { narration, manager, events } = setup();
  narration.start(book, summary, 2); events.ended();
  expect(narration.state).toMatchObject({ bookId: book.id, status: "ended", pageIndex: 2 });
  expect(events.next).toBeUndefined();
  narration.start(book, summary, 0);
  expect(manager.startTime).toBe(0);
  expect(narration.state).toMatchObject({ bookId: book.id, pageIndex: 0 });
});
