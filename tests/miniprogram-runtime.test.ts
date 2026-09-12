import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { exportMiniContent } from "../scripts/lib/miniprogram-content";
import { getAllSeries, getSeriesBooks } from "../src/lib/library";

type Definition = Record<string, unknown> & { data: Record<string, unknown> };
function invoke(target: Definition, method: string, ...args: unknown[]) {
  return (target[method] as (...args: unknown[]) => unknown).apply(target, args);
}
function runtime(narrated = false, background = false) {
  const series = getAllSeries().slice(0, 1);
  const fixture = exportMiniContent(series, id => getSeriesBooks(id).slice(0, 2), "https://media.example.com");
  if (narrated) {
    for (const summary of fixture.catalog.books) {
      summary.readerPath = "/reader-0/index";
      if (background) fixture.books[summary.id].chineseAudio = { url: "https://example.com/book.mp3", pageStarts: fixture.books[summary.id].pages.map((_, i) => i * 10), duration: fixture.books[summary.id].pages.length * 10, contentHash: "test" };
      fixture.books[summary.id].pages.forEach((page, index) => { page.audio = { zh: `${background ? "https://example.com" : ""}/reader-0/audio/${index}-zh.mp3`, en: `${background ? "https://example.com" : ""}/reader-0/audio/${index}-en.mp3` }; });
    }
  }
  const tracks: Array<{ src: string; events: Record<string, () => void>; pause: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }> = [];
  const directory = path.resolve("miniprogram/src");
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const definitions: Definition[] = [];
  const stored = new Map<string, unknown>();
  const wx = {
    showShareMenu: vi.fn(), navigateTo: vi.fn(), switchTab: vi.fn(), pageScrollTo: vi.fn(), showToast: vi.fn(),
    setNavigationBarTitle: vi.fn(), previewImage: vi.fn(), setInnerAudioOption: vi.fn(),
    getStorageSync: (key: string) => stored.get(key),
    setStorageSync: (key: string, value: unknown) => stored.set(key, structuredClone(value)),
    getBackgroundAudioManager: () => {
      if (tracks.length) return tracks[0];
      const track = wx.createInnerAudioContext();
      return Object.assign(track, {
        onNext: (fn: () => void) => { track.events.next = fn; },
        onTimeUpdate: (fn: () => void) => { track.events.time = fn; },
        onSeeked: (fn: () => void) => { track.events.seeked = fn; },
        currentTime: 0, seek: vi.fn(),
        onPause: (fn: () => void) => { track.events.pause = fn; },
        onStop: (fn: () => void) => { track.events.stop = fn; },
      });
    },
    createInnerAudioContext: vi.fn(() => {
      if (!narrated) throw new Error("No audio expected in text/image test");
      const events: Record<string, () => void> = {};
      const track = { src: "", autoplay: false, events, play: vi.fn(), pause: vi.fn(), stop: vi.fn(), destroy: vi.fn(),
        onPlay: (fn: () => void) => { events.play = fn; }, onWaiting: (fn: () => void) => { events.waiting = fn; },
        onEnded: (fn: () => void) => { events.ended = fn; }, onError: (fn: () => void) => { events.error = fn; } };
      tracks.push(track);
      return track;
    }),
  };
  function load(filename: string): Record<string, unknown> {
    // The native mini program loader resolves JS modules, never Node-style JSON imports.
    if (filename.endsWith(".json")) throw new Error("Native runtime does not require JSON");
    if (filename === path.join(directory, "data/catalog")) return { __esModule: true, default: fixture.catalog };
    if (filename === path.join(directory, "reader/data/books")) return { __esModule: true, default: fixture.books };
    if (cache.has(filename)) return cache.get(filename)!.exports;
    const loadedModule = { exports: {} as Record<string, unknown> };
    cache.set(filename, loadedModule);
    const source = readFileSync(`${filename}.ts`, "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    runInNewContext(code, {
      module: loadedModule, exports: loadedModule.exports,
      require: (request: string) => load(path.resolve(path.dirname(filename), request)),
      wx, App: (definition: Definition) => definitions.push(definition), Page: (definition: Definition) => definitions.push(definition),
      Component: (definition: Definition) => definitions.push(definition), setTimeout, clearTimeout,
    });
    return loadedModule.exports;
  }
  function open(relative: string): Definition {
    load(path.join(directory, relative));
    const definition = definitions[definitions.length - 1];
    definition.setData = (data: Record<string, unknown>, done?: () => void) => { Object.assign(definition.data, data); done?.(); };
    return definition;
  }
  return { open, fixture, wx, stored, tracks };
}

describe("mini native page wiring", () => {
  it("configures iPhone media sound independently of the ringer without autoplay", () => {
    const { open, wx } = runtime();
    const app = open("app");
    invoke(app, "onLaunch");
    expect(wx.setInnerAudioOption).toHaveBeenCalledWith(expect.objectContaining({ obeyMuteSwitch: false, speakerOn: true }));
    expect(wx.createInnerAudioContext).not.toHaveBeenCalled();
    const options = wx.setInnerAudioOption.mock.calls[0][0];
    options.fail();
    expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "声音设置失败，请关闭手机静音后重试" }));
  });
  it("routes packaged Chinese narration and pauses foreground audio when hidden", () => {
    const { open, fixture, tracks, wx } = runtime(true);
    const book = fixture.catalog.books[0];
    const catalogPage = open("pages/catalog/index");
    invoke(catalogPage, "openBook", { currentTarget: { dataset: { id: book.id } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: `/reader-0/index?id=${encodeURIComponent(book.id)}` }));
    const reader = open("reader/index");
    invoke(reader, "onLoad", { id: book.id });
    expect(reader.data.audioEnabled).toBe(true);
    expect(tracks).toHaveLength(0);
    invoke(reader, "imageLoaded", { detail: { src: (reader.data.current as { image: string }).image } });
    invoke(reader, "toggleAudio"); tracks[0].events.play();
    expect(reader.data.highlight).toBe("zh");
    tracks[0].events.ended(); tracks[1].events.play();
    expect(reader.data.highlight).toBe("zh");
    expect(reader.data.pageIndex).toBe(1);
    tracks[1].events.ended(); tracks[2].events.play();
    expect(reader.data.pageIndex).toBe(2);
    expect(reader.data.current).toEqual(fixture.books[book.id].pages[2]);
    invoke(reader, "onHide");
    expect(reader.data.active).toBe(false);
    expect(reader.data.highlight).toBe("");
    expect(tracks[2].pause).toHaveBeenCalled();
    invoke(reader, "next");
    expect(tracks).toHaveLength(3);
    invoke(reader, "onUnload");
    const shelf = open("pages/shelf/index"); invoke(shelf, "onShow");
    expect(shelf.data.books).toEqual(expect.arrayContaining([expect.objectContaining({ id: book.id, pageNumber: 4 })]));
    invoke(shelf, "openBook", { currentTarget: { dataset: { id: book.id } } });
    expect(wx.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: `/reader-0/index?id=${encodeURIComponent(book.id)}` }));
  });
  it("uses one Chinese track for hidden page sync and paused navigation without a language picker", () => {
    const { open, fixture, tracks } = runtime(true, true);
    const reader = open("reader/index");
    invoke(reader, "onLoad", { id: fixture.catalog.books[0].id });
    invoke(reader, "imageLoaded", { detail: { src: (reader.data.current as { image: string }).image } });
    invoke(reader, "toggleAudio"); tracks[0].events.play();
    expect(reader.data.highlight).toBe("zh");
    expect(reader.changeLanguage).toBeUndefined();
    const manager = tracks[0] as typeof tracks[0] & { currentTime: number };
    invoke(reader, "onHide"); expect(reader.data.active).toBe(true);
    manager.currentTime = 12; tracks[0].events.time(); expect(reader.data.pageIndex).toBe(0);
    invoke(reader, "onShow"); expect(reader.data.pageIndex).toBe(1);
    invoke(reader, "next"); manager.currentTime = 20; tracks[0].events.seeked();
    expect(reader.data.pageIndex).toBe(2); expect(reader.data.active).toBe(true);
    invoke(reader, "toggleAudio"); expect(reader.data.active).toBe(false);
    invoke(reader, "next"); manager.currentTime = 30; tracks[0].events.seeked(); invoke(reader, "onShow");
    expect(reader.data.pageIndex).toBe(3); expect(reader.data.active).toBe(false);
    invoke(reader, "imageLoaded", { detail: { src: (reader.data.current as { image: string }).image } });
    invoke(reader, "toggleAudio"); tracks[0].events.play();
    invoke(reader, "onUnload"); manager.currentTime = 42;
    invoke(reader, "onLoad", { id: fixture.catalog.books[0].id }); invoke(reader, "onShow");
    expect(reader.data.pageIndex).toBe(4); expect(reader.data.active).toBe(true);
    expect(tracks).toHaveLength(1);
  });
  it("loads catalog through native JS module resolution and retains filter state on navigation", () => {
    const { open, fixture, wx } = runtime();
    const page = open("pages/catalog/index");
    invoke(page, "onSearch", { detail: { value: fixture.catalog.books[0].title } });
    invoke(page, "selectSeries", { currentTarget: { dataset: { id: fixture.catalog.series[0].id } } });
    expect(page.data.books).toHaveLength(1);
    invoke(page, "openBook", { currentTarget: { dataset: { id: fixture.catalog.books[0].id } } });
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: `/reader/index?id=${encodeURIComponent(fixture.catalog.books[0].id)}` }));
    expect(page.data.query).toBe(fixture.catalog.books[0].title);
    expect(page.data.seriesId).toBe(fixture.catalog.series[0].id);
  });
  it("connects reader actions, storage, shelf and resume without creating an audio context", () => {
    const { open, fixture, wx } = runtime();
    const book = fixture.catalog.books[0];
    const reader = open("reader/index");
    invoke(reader, "onLoad", { id: book.id });
    expect(reader.data.pageIndex).toBe(0);
    invoke(reader, "favorite"); invoke(reader, "next"); invoke(reader, "next");
    expect(wx.createInnerAudioContext).not.toHaveBeenCalled();
    invoke(reader, "openGuide"); expect(reader.data.guideOpen).toBe(true);
    invoke(reader, "closeGuide");
    const shelf = open("pages/shelf/index"); invoke(shelf, "onShow");
    expect(shelf.data.books).toEqual(expect.arrayContaining([expect.objectContaining({ id: book.id, favorite: true, pageNumber: 3 })]));
    invoke(reader, "onLoad", { id: book.id });
    expect(reader.data.pageIndex).toBe(2);
  });
  it("ignores vertical and cancelled swipes but accepts a clear horizontal swipe", () => {
    const { open, fixture } = runtime();
    const reader = open("reader/index"); invoke(reader, "onLoad", { id: fixture.catalog.books[0].id });
    const start = () => invoke(reader, "touchStart", { touches: [{ clientX: 300, clientY: 100 }] });
    start(); invoke(reader, "touchEnd", { changedTouches: [{ clientX: 210, clientY: 280 }] });
    expect(reader.data.pageIndex).toBe(0);
    start(); invoke(reader, "touchCancel"); invoke(reader, "touchEnd", { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(reader.data.pageIndex).toBe(0);
    start(); invoke(reader, "touchEnd", { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(reader.data.pageIndex).toBe(1);
  });
  it("handles invalid deep links and permits returning to the library", () => {
    const { open, wx } = runtime();
    const reader = open("reader/index"); invoke(reader, "onLoad", { id: "missing" });
    expect(reader.data.missing).toBe(true);
    invoke(reader, "browse"); expect(wx.switchTab).toHaveBeenCalledWith({ url: "/pages/catalog/index" });
  });
  it("keeps a complete book within its first and last page without an audio controller", () => {
    const { open, fixture, wx } = runtime();
    const reader = open("reader/index");
    const book = fixture.catalog.books[0];
    invoke(reader, "onLoad", { id: book.id });
    invoke(reader, "previous");
    expect(reader.data.pageIndex).toBe(0);
    for (let i = 0; i < book.pageCount + 2; i++) invoke(reader, "next");
    expect(reader.data.pageIndex).toBe(book.pageCount - 1);
    expect(reader.data.current).toEqual(fixture.books[book.id].pages.at(-1));
    invoke(reader, "preview");
    expect(wx.previewImage).toHaveBeenCalledWith({
      current: fixture.books[book.id].pages.at(-1)!.image,
      urls: [fixture.books[book.id].pages.at(-1)!.image],
    });
    expect(wx.createInnerAudioContext).not.toHaveBeenCalled();
  });
  it("does not reset an already loaded image when parent data repeats the same src", () => {
    const { open } = runtime();
    const component = open("components/media-image/index");
    const observer = (component.observers as Record<string, (src: string) => void>).src;
    const loaded = (component.methods as Record<string, () => void>).loaded;
    observer.call(component, "/image-1.jpg"); loaded.call(component);
    observer.call(component, "/image-1.jpg");
    expect(component.data.status).toBe("ready");
    observer.call(component, "/image-2.jpg");
    expect(component.data.status).toBe("loading");
  });
  it("requests covers only when visible and disconnects observers on removal", () => {
    const { open } = runtime();
    const component = open("components/media-image/index");
    Object.assign(component, component.methods);
    component.properties = { src: "/cover.webp", eager: false };
    let visible!: (result: { intersectionRatio: number }) => void;
    const disconnect = vi.fn();
    const observer = { disconnect, relativeToViewport: () => observer, observe: (_selector: string, callback: typeof visible) => { visible = callback; } };
    component.createIntersectionObserver = () => observer;
    const lifecycle = component.lifetimes as Record<string, () => void>;
    lifecycle.attached.call(component);
    expect(component.data.requested).toBe(false);
    visible({ intersectionRatio: 0 });
    expect(component.data.requested).toBe(false);
    visible({ intersectionRatio: 0.2 });
    expect(component.data.requested).toBe(true);
    expect(disconnect).toHaveBeenCalled();
    lifecycle.detached.call(component);
    component.data.requested = false;
    visible({ intersectionRatio: 1 });
    expect(component.data.requested).toBe(false);
  });
  it("offers retry after 15 seconds and accepts a late image success", () => {
    vi.useFakeTimers();
    try {
      const { open } = runtime(); const component = open("components/media-image/index");
      Object.assign(component, component.methods);
      component.properties = { src: "/slow.webp", eager: true };
      component.data.sourceKey = "/slow.webp";
      component.triggerEvent = vi.fn();
      const life = component.lifetimes as Record<string, () => void>;
      life.attached.call(component); vi.advanceTimersByTime(15000);
      expect(component.data.status).toBe("slow");
      invoke(component, "loaded", { currentTarget: { dataset: { source: "/slow.webp" } } });
      expect(component.data.status).toBe("ready");
      expect(component.triggerEvent).toHaveBeenCalledWith("ready", { src: "/slow.webp" });
      invoke(component, "retry"); life.detached.call(component); vi.advanceTimersByTime(15000);
      expect(component.data.status).toBe("loading");
    } finally { vi.useRealTimers(); }
  });
  it("waits for the illustration before starting audio and cancels that intent on hide", () => {
    const { open, fixture, tracks } = runtime(true, true); const reader = open("reader/index");
    const book = fixture.books[fixture.catalog.books[0].id];
    invoke(reader, "onLoad", { id: book.id }); invoke(reader, "toggleAudio");
    expect(reader.data.waitingForImage).toBe(true); expect(tracks).toHaveLength(0);
    invoke(reader, "onHide");
    invoke(reader, "imageLoaded", { detail: { src: book.pages[0].image } });
    expect(tracks).toHaveLength(0);
    invoke(reader, "onShow"); invoke(reader, "next"); invoke(reader, "toggleAudio");
    invoke(reader, "imageLoaded", { detail: { src: book.pages[1].image } });
    expect(tracks).toHaveLength(1); expect(reader.data.waitingForImage).toBe(false);
  });
  it("preloads only the next two pages after the current image is ready", () => {
    const { open, fixture } = runtime(); const reader = open("reader/index");
    const book = fixture.books[fixture.catalog.books[0].id];
    invoke(reader, "onLoad", { id: book.id });
    expect(reader.data.imageLookahead).toEqual([]);
    invoke(reader, "imageLoaded", { detail: { src: "/stale.webp" } });
    expect(reader.data.imageLookahead).toEqual([]);
    invoke(reader, "imageLoaded", { detail: { src: book.pages[0].image } });
    expect(reader.data.imageLookahead).toEqual(book.pages.slice(1, 3).map(p => p.image));
    invoke(reader, "onHide"); expect(reader.data.imageLookahead).toEqual([]);
    invoke(reader, "onShow"); expect(reader.data.imageLookahead).toHaveLength(2);
  });
  it("loads the current reading illustration immediately and ignores stale image events", () => {
    const { open } = runtime();
    const component = open("components/media-image/index");
    Object.assign(component, component.methods);
    component.properties = { src: "/page-2.webp", eager: true };
    component.data.sourceKey = "/page-2.webp";
    component.createIntersectionObserver = vi.fn();
    (component.lifetimes as Record<string, () => void>).attached.call(component);
    expect(component.data.requested).toBe(true);
    expect(component.createIntersectionObserver).not.toHaveBeenCalled();
    invoke(component, "failed", { currentTarget: { dataset: { source: "/page-1.webp" } } });
    expect(component.data.status).toBe("loading");
    invoke(component, "loaded", { currentTarget: { dataset: { source: "/page-2.webp" } } });
    expect(component.data.status).toBe("ready");
  });
});

it("restarts a completed book without advancing to another and keeps sharing", () => {
  const { open, fixture, tracks } = runtime(true, true);
  const first = fixture.catalog.books[0];
  const reader = open("reader/index");
  invoke(reader, "onLoad", { id: first.id });
  invoke(reader, "selectPage", first.pageCount - 1);
  invoke(reader, "imageLoaded", { detail: { src: (reader.data.current as { image: string }).image } });
  invoke(reader, "toggleAudio"); tracks[0].events.play(); tracks[0].events.ended();
  expect(reader.data.status).toBe("ended");
  expect((reader.data.summary as { id: string }).id).toBe(first.id);
  invoke(reader, "restart");
  expect(reader.data.pageIndex).toBe(0);
  invoke(reader, "imageLoaded", { detail: { src: (reader.data.current as { image: string }).image } });
  tracks[0].events.play();
  expect(reader.data.active).toBe(true);
  expect(reader.openQueue).toBeUndefined();
  expect(reader.nextBook).toBeUndefined();
  expect(invoke(reader, "onShareAppMessage")).toMatchObject({ title: first.title });
  invoke(reader, "onUnload");
});
