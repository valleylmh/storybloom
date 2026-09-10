import { readerImageLookahead } from "../core/reader-images";
import { catalog } from "../core/content";
import { readShelf, saveProgress, toggleFavorite } from "../core/device";
import type { Book, BookPage, BookSummary, GuideSection } from "../core/types";
import content from "./data/books";
import { backgroundNarration, type BackgroundState } from "../core/background-narration";
import { NarrationController, type NarrationState } from "../core/narration";

const books = content as unknown as Record<string, Book>;
const EMPTY_PAGE: BookPage = { zh: "", en: "", image: "", audio: { zh: "", en: "" } };

Page({
  data: {
    ready: false, missing: false, summary: null as BookSummary | null,
    current: EMPTY_PAGE, pageIndex: 0, pageCount: 0, favorite: false,
    guide: [] as GuideSection[], guideOpen: false,
    backgroundEnabled: false, queueOpen: false, autoNext: false, nextBookId: "",
    listeningBooks: [] as BookSummary[],
    imageLookahead: [] as string[], waitingForImage: false,
    audioEnabled: false, active: false, status: "idle", highlight: "", audioError: "",
  },
  _book: undefined as Book | undefined,
  _audio: undefined as NarrationController | undefined,
  _unsubscribeBackground: undefined as (() => void) | undefined,
  _visible: true,
  _observedBookId: "",
  _loadedImage: "",
  _touch: undefined as { x: number; y: number } | undefined,

  onLoad(options: Record<string, string | undefined>) {
    backgroundNarration.configureQueue(books);
    this.setData({ autoNext: backgroundNarration.autoNext, nextBookId: backgroundNarration.nextBookId, listeningBooks: catalog.books.filter(item => Boolean(books[item.id]?.chineseAudio)) });
    this.loadBook(options.id || "");
    this._observedBookId = backgroundNarration.state.bookId;
    this._unsubscribeBackground = backgroundNarration.subscribe(state => this.syncBackground(state));
  },
  loadBook(rawId: string) {
    let id = rawId;
    try { id = decodeURIComponent(id); } catch { /* invalid link uses the empty state */ }
    const summary = catalog.books.find(book => book.id === id);
    const book = books[id];
    if (!summary || !book?.pages.length) { this.setData({ missing: true }); return; }
    this._audio?.destroy(); this._audio = undefined;
    this._loadedImage = "";
    this._book = book;
    const state = readShelf(catalog.books);
    const pageIndex = state.progress[id]?.pageIndex ?? 0;
    this.setData({ ready: true, missing: false, waitingForImage: false, imageLookahead: [], summary, current: book.pages[pageIndex], pageIndex, pageCount: book.pages.length, guide: book.guide, favorite: Boolean(state.favorites[id]) });
    wx.setNavigationBarTitle({ title: summary.title });
    saveProgress(catalog.books, id, pageIndex);
    const audioEnabled = Boolean(book.chineseAudio) || book.pages.some(page => page.audio.zh);
    this.setData({ audioEnabled, backgroundEnabled: Boolean(book.chineseAudio) });
    if (audioEnabled && !this.data.backgroundEnabled) this._audio = new NarrationController(book.pages, () => wx.createInnerAudioContext(), state => this.syncAudio(state), pageIndex);
  },
  onHide() { this._visible = false; this.setData({ imageLookahead: [], waitingForImage: false }); this._audio?.pause(); this._unsubscribeBackground?.(); this._unsubscribeBackground = undefined; },
  onUnload() { this.onHide(); this._audio?.destroy(); },
  onShow() {
    this._visible = true;
    backgroundNarration.syncPosition();
    if (!this._unsubscribeBackground) this._unsubscribeBackground = backgroundNarration.subscribe(state => this.syncBackground(state));
    else this.syncBackground(backgroundNarration.state);
    this.preloadImages();
  },
  imageLoaded(event: WechatMiniprogram.CustomEvent<{ src: string }>) {
    if (event.detail.src !== this.data.current.image) return;
    this._loadedImage = event.detail.src;
    this.preloadImages();
    if (this.data.waitingForImage && this._visible) {
      this.setData({ waitingForImage: false }); this.toggleAudio();
    }
  },
  preloadImages() {
    if (!this._book || !this._visible || this._loadedImage !== this.data.current.image) return;
    this.setData({ imageLookahead: readerImageLookahead(this._book.pages, this.data.pageIndex) });
  },
  syncBackground(state: BackgroundState) {
    const changedBook = Boolean(state.bookId && state.bookId !== this._observedBookId);
    if (state.bookId) this._observedBookId = state.bookId;
    if (changedBook && state.bookId !== this._book?.id && state.status !== "idle" && books[state.bookId]) {
      this.loadBook(state.bookId);
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    }
    if (!this.data.backgroundEnabled) return;
    if (state.bookId !== this._book?.id) {
      this.setData({ active: false, status: "idle", highlight: "", audioError: "" }); return;
    }
    this.syncAudio({ pageIndex: state.pageIndex, mode: "zh",
      active: ["buffering", "playing"].includes(state.status),
      language: state.status === "playing" ? "zh" : null,
      status: state.status === "buffering" ? "loading" : state.status,
      error: state.error });
  },
  pauseNarration() {
    this._audio?.pause();
    if (backgroundNarration.state.bookId === this._book?.id) backgroundNarration.pause();
  },
  syncAudio(state: NarrationState) {
    if (!this._book) return;
    const moved = state.pageIndex !== this.data.pageIndex;
    this.setData({ ...(moved ? { current: this._book.pages[state.pageIndex] } : {}),
      pageIndex: state.pageIndex, active: state.active,
      status: state.status, highlight: state.language || "", audioError: state.error });
    if (moved) {
      saveProgress(catalog.books, this._book.id, state.pageIndex);
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    }
  },
  toggleAudio() {
    if (!this._book || !this.data.summary) return;
    if (this.data.waitingForImage) { this.setData({ waitingForImage: false }); return; }
    if (!this.data.active && this._loadedImage !== this.data.current.image) {
      this.setData({ waitingForImage: true }); return;
    }
    if (this.data.backgroundEnabled) {
      if (this.data.active) backgroundNarration.pause();
      else void backgroundNarration.start(this._book, this.data.summary, this.data.pageIndex);
    } else {
      backgroundNarration.stop();
      if (this.data.active) this._audio?.pause(); else this._audio?.play();
    }
  },
  selectPage(pageIndex: number) {
    if (!this._book || pageIndex < 0 || pageIndex >= this._book.pages.length || pageIndex === this.data.pageIndex) return;
    this.setData({ waitingForImage: false });
    if (this._audio) { this._audio.selectPage(pageIndex); return; }
    if (backgroundNarration.state.bookId === this._book.id && backgroundNarration.selectPage(pageIndex)) return;
    const active = this.data.active;
    backgroundNarration.stop();
    this.setData({ pageIndex, current: this._book.pages[pageIndex], active: false, status: "idle", highlight: "" });
    saveProgress(catalog.books, this._book.id, pageIndex);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    if (active) this.toggleAudio();
  },
  restart() {
    this.pauseNarration();
    if (this.data.backgroundEnabled) backgroundNarration.stop();
    this.selectPage(0);
    this.setData({ active: false, waitingForImage: false });
    this.toggleAudio();
  },
  openQueue() { this.setData({ queueOpen: true, nextBookId: backgroundNarration.nextBookId }); },
  closeQueue() { this.setData({ queueOpen: false }); },
  changeAutoNext(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
    backgroundNarration.autoNext = event.detail.value;
    this.setData({ autoNext: event.detail.value });
  },
  queueNext(event: WechatMiniprogram.TouchEvent) {
    backgroundNarration.nextBookId = String(event.currentTarget.dataset.id);
    this.setData({ nextBookId: backgroundNarration.nextBookId });
    wx.showToast({ title: "已设为下一本", icon: "none" });
  },
  playBook(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const summary = catalog.books.find(item => item.id === id);
    if (!summary || !books[id]) return;
    this.setData({ queueOpen: false });
    backgroundNarration.start(books[id], summary, 0);
  },
  nextBook() {
    if (!backgroundNarration.playNext(this._book?.id)) wx.showToast({ title: "已经是最后一本", icon: "none" });
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
    if (!start || !end || this.data.guideOpen || this.data.queueOpen) return;
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
