import { catalog } from "../core/content";
import { readShelf, saveProgress, toggleFavorite } from "../core/device";
import type { Book, BookPage, BookSummary, GuideSection } from "../core/types";
import content from "./data/books";
import { ApiNarrationSource } from "../core/api-narration";
import { NarrationController, type NarrationState } from "../core/narration";
import type { AudioMode } from "../core/types";

const books = content as unknown as Record<string, Book>;
const EMPTY_PAGE: BookPage = { zh: "", en: "", image: "", audio: { zh: "", en: "" } };

const MODES: AudioMode[] = ["zh", "en", "both"];
Page({
  data: {
    ready: false, missing: false, summary: null as BookSummary | null,
    current: EMPTY_PAGE, pageIndex: 0, pageCount: 0, favorite: false,
    guide: [] as GuideSection[], guideOpen: false,
    audioEnabled: false, active: false, status: "idle", highlight: "", audioError: "",
    languageLabels: ["中文", "英文", "中英"], modeIndex: 0,
  },
  _book: undefined as Book | undefined,
  _audio: undefined as NarrationController | undefined,
  _touch: undefined as { x: number; y: number } | undefined,

  onLoad(options: Record<string, string | undefined>) {
    let id = options.id || "";
    try { id = decodeURIComponent(id); } catch { /* invalid link uses the empty state */ }
    const summary = catalog.books.find(book => book.id === id);
    const book = books[id];
    if (!summary || !book?.pages.length) { this.setData({ missing: true }); return; }
    this._book = book;
    const state = readShelf(catalog.books);
    const pageIndex = state.progress[id]?.pageIndex ?? 0;
    this.setData({ ready: true, summary, current: book.pages[pageIndex], pageIndex, pageCount: book.pages.length, guide: book.guide, favorite: Boolean(state.favorites[id]) });
    wx.setNavigationBarTitle({ title: summary.title });
    saveProgress(catalog.books, id, pageIndex);
    const audioEnabled = Boolean(book.narrationEndpoint) || book.pages.some(page => page.audio.zh || page.audio.en);
    this.setData({ audioEnabled });
    if (audioEnabled) this._audio = new NarrationController(book.pages, () => wx.createInnerAudioContext(), state => this.syncAudio(state), pageIndex, book.narrationEndpoint ? new ApiNarrationSource(book.narrationEndpoint, book.pages) : undefined);
  },
  onHide() { this.pauseNarration(); },
  onUnload() { this.pauseNarration(); this._audio?.destroy(); },
  pauseNarration() {
    this._audio?.pause();
  },
  syncAudio(state: NarrationState) {
    if (!this._book) return;
    const moved = state.pageIndex !== this.data.pageIndex;
    this.setData({ ...(moved ? { current: this._book.pages[state.pageIndex] } : {}),
      pageIndex: state.pageIndex, modeIndex: MODES.indexOf(state.mode), active: state.active,
      status: state.status, highlight: state.language || "", audioError: state.error });
    if (moved) {
      saveProgress(catalog.books, this._book.id, state.pageIndex);
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    }
  },
  toggleAudio() {
    if (this.data.active) this._audio?.pause(); else this._audio?.play();
  },
  changeLanguage(event: WechatMiniprogram.PickerChange) { this._audio?.setMode(MODES[Number(event.detail.value)] || "zh"); },
  selectPage(pageIndex: number) {
    if (this._audio) { this._audio.selectPage(pageIndex); return; }
    if (!this._book || pageIndex < 0 || pageIndex >= this._book.pages.length || pageIndex === this.data.pageIndex) return;
    this.setData({ pageIndex, current: this._book.pages[pageIndex] });
    saveProgress(catalog.books, this._book.id, pageIndex);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  previous() { this.selectPage(this.data.pageIndex - 1); },
  next() { this.selectPage(this.data.pageIndex + 1); },
  favorite() {
    if (this._book) this.setData({ favorite: toggleFavorite(catalog.books, this._book.id) });
  },
  touchStart(event: WechatMiniprogram.TouchEvent) {
    const touch = event.touches[0];
    this._touch = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : undefined;
  },
  touchEnd(event: WechatMiniprogram.TouchEvent) {
    const start = this._touch;
    this._touch = undefined;
    const end = event.changedTouches[0];
    if (!start || !end || this.data.guideOpen) return;
    const dx = end.clientX - start.x, dy = end.clientY - start.y;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      if (dx < 0) this.next(); else this.previous();
    }
  },
  touchCancel() { this._touch = undefined; },
  preview() {
    if (!this.data.current.image) return;
    this.pauseNarration();
    wx.previewImage({ urls: [this.data.current.image], current: this.data.current.image });
  },
  openGuide() { this.pauseNarration(); this.setData({ guideOpen: true }); },
  closeGuide() { this.setData({ guideOpen: false }); },
  blockMove() { /* keep the backdrop from scrolling the reader */ },
  browse() { wx.switchTab({ url: "/pages/catalog/index" }); },
});
