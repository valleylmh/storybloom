/// <reference types="miniprogram-api-typings" />
import { catalog } from "./content";
import { saveProgress } from "./device";
import { pageAtTime, validBookAudio } from "./book-audio";
import type { Book, BookAudio, BookSummary } from "./types";

export interface BackgroundState {
  bookId: string; pageIndex: number;
  status: "idle" | "buffering" | "playing" | "paused" | "ended" | "error";
  error: string;
}
export class BackgroundNarration {
  state: BackgroundState = { bookId: "", pageIndex: 0, status: "idle", error: "" };
  autoNext = false;
  nextBookId = "";
  private queue: Array<{ book: Book; summary: BookSummary }> = [];
  configureQueue(books: Record<string, Book>) {
    this.queue = catalog.books.filter(summary => validBookAudio(books[summary.id]?.chineseAudio, books[summary.id]?.pages.length || 0)).map(summary => ({ summary, book: books[summary.id] }));
  }
  playNext(currentId = this.state.bookId) {
    const index = this.queue.findIndex(item => item.book.id === currentId);
    const next = this.nextBookId ? this.queue.find(item => item.book.id === this.nextBookId) : this.queue[index + 1];
    this.nextBookId = "";
    if (!next || index < 0) return false;
    this.start(next.book, next.summary, 0);
    return true;
  }
  private manager?: WechatMiniprogram.BackgroundAudioManager;
  private audio?: BookAudio;
  private url = "";
  private seeking?: number;
  private listeners = new Set<(state: BackgroundState) => void>();
  subscribe(listener: (state: BackgroundState) => void) {
    this.listeners.add(listener); listener({ ...this.state });
    return () => { this.listeners.delete(listener); };
  }
  private emit(status = this.state.status, error = "") {
    this.state = { ...this.state, status, error };
    this.listeners.forEach(listener => listener({ ...this.state }));
  }
  private current() { return Boolean(this.url) && this.manager?.src === this.url; }
  private getManager() {
    if (this.manager) return this.manager;
    const manager = wx.getBackgroundAudioManager();
    this.manager = manager;
    manager.onPlay(() => { if (this.current()) { this.emit("playing"); this.syncPosition(); } });
    manager.onPause(() => { if (this.current()) { this.syncPosition(); this.emit("paused"); } });
    manager.onStop(() => { if (this.current()) { this.url = ""; this.emit("idle"); } });
    manager.onWaiting(() => { if (this.current() && this.state.status !== "paused") this.emit("buffering"); });
    manager.onTimeUpdate(() => this.syncPosition());
    manager.onSeeked(() => { if (this.current()) { this.seeking = undefined; this.syncPosition(); } });
    manager.onEnded(() => {
      if (!this.current()) return;
      this.seeking = undefined;
      this.setPage((this.audio?.pageStarts.length || 1) - 1);
      this.url = ""; this.emit("ended");
      if (this.autoNext) this.playNext();
    });
    manager.onNext(() => this.playNext());
    manager.onError(() => { if (this.current()) this.fail("音频播放失败，请点击播放重试"); });
    return manager;
  }
  private setPage(pageIndex: number) {
    if (pageIndex === this.state.pageIndex) return;
    this.state.pageIndex = pageIndex;
    saveProgress(catalog.books, this.state.bookId, pageIndex);
    this.emit();
  }
  syncPosition() {
    if (!this.current() || !this.audio || !Number.isFinite(this.manager!.currentTime)) return;
    const time = this.manager!.currentTime;
    // Ignore time notifications from before a pending seek/start offset.
    if (this.seeking !== undefined) {
      if (Math.abs(time - this.seeking) > 1) return;
      this.seeking = undefined;
    }
    this.setPage(pageAtTime(this.audio.pageStarts, time));
  }
  private fail(message: string) {
    this.url = ""; this.seeking = undefined;
    this.manager?.stop(); this.emit("error", message);
  }
  stop() {
    this.url = ""; this.audio = undefined; this.seeking = undefined;
    this.state.bookId = ""; this.manager?.stop(); this.emit("idle");
  }
  pause() {
    if (!this.current()) return;
    this.manager?.pause(); this.emit("paused");
  }
  selectPage(pageIndex: number) {
    if (!this.audio || pageIndex < 0 || pageIndex >= this.audio.pageStarts.length || !this.current()) return false;
    try {
      this.seeking = this.audio.pageStarts[pageIndex];
      this.setPage(pageIndex);
      this.manager!.seek(this.seeking);
      return true;
    } catch { this.fail("跳转音频失败，请点击播放重试"); return false; }
  }
  start(book: Book, summary: BookSummary, pageIndex: number) {
    if (this.state.bookId === book.id && this.current()) {
      if (pageIndex !== this.state.pageIndex && !this.selectPage(pageIndex)) return;
      try { this.manager!.play(); } catch { this.fail("无法恢复朗读，请重试"); }
      return;
    }
    this.stop();
    this.state = { bookId: book.id, pageIndex, status: "buffering", error: "" };
    try {
      if (!validBookAudio(book.chineseAudio, book.pages.length)) throw new Error("这本书的中文音频尚未准备好");
      if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= book.pages.length) throw new Error("阅读页码无效");
      saveProgress(catalog.books, book.id, pageIndex);
      const manager = this.getManager();
      this.audio = book.chineseAudio;
      manager.title = summary.title;
      manager.epname = summary.seriesTitle;
      manager.singer = "StoryBloom 绘本馆";
      manager.coverImgUrl = summary.cover;
      manager.startTime = this.audio.pageStarts[pageIndex];
      this.seeking = manager.startTime;
      this.url = this.audio.url;
      this.emit("buffering");
      manager.src = this.url;
    } catch (error) { this.fail(error instanceof Error ? error.message : "无法开始朗读"); }
  }
}
export const backgroundNarration = new BackgroundNarration();
