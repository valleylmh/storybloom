import type { BookAudio } from "../../../miniprogram/src/core/types";
import { pageAtTime } from "../../../miniprogram/src/core/book-audio";
export type { BookAudio };

/** One continuous media source with page-relative progress for existing reading records. */
export class BookAudioTransport {
  pageIndex: number;
  private alive = true;
  private finished = false;
  private pendingTime: number | undefined;
  constructor(private audio: HTMLAudioElement, private asset: BookAudio, pageIndex: number, resumeMs: number,
    private callbacks: {
      autoAdvance: () => boolean;
      position: (page: number, positionMs: number, durationMs: number) => void;
      playing: () => void;
      paused: (positionMs: number) => void;
      ended: (page: number) => void;
      error: () => void;
    }) {
    this.pageIndex = pageIndex;
    const length = this.end(pageIndex) - asset.pageStarts[pageIndex];
    this.pendingTime = asset.pageStarts[pageIndex] + (resumeMs > 0 && resumeMs / 1000 < length - 0.5 ? resumeMs / 1000 : 0);
    audio.onloadedmetadata = () => { if (this.alive && this.pendingTime !== undefined) { audio.currentTime = this.pendingTime; this.pendingTime = undefined; this.sync(); } };
    audio.ontimeupdate = () => this.sync();
    audio.onplay = () => { if (this.alive) callbacks.playing(); };
    audio.onpause = () => { if (this.alive && !this.finished && !audio.ended) callbacks.paused(this.positionMs()); };
    audio.onended = () => {
      if (!this.alive || this.finished) return;
      this.finished = true;
      this.pageIndex = asset.pageStarts.length - 1;
      callbacks.position(this.pageIndex, 0, (this.end(this.pageIndex) - asset.pageStarts[this.pageIndex]) * 1000);
      callbacks.ended(this.pageIndex);
    };
    audio.onerror = () => { if (this.alive) callbacks.error(); };
    audio.src = asset.url;
    audio.preload = "auto";
    audio.load();
  }
  private end(page: number) { return this.asset.pageStarts[page + 1] ?? this.asset.duration; }
  private positionMs() { return Math.max(0, (this.audio.currentTime - this.asset.pageStarts[this.pageIndex]) * 1000); }
  sync() {
    if (!this.alive || this.finished || this.pendingTime !== undefined || !Number.isFinite(this.audio.currentTime)) return;
    if (!this.callbacks.autoAdvance() && this.audio.currentTime >= this.end(this.pageIndex)) {
      const page = this.pageIndex;
      this.finished = true;
      this.audio.pause();
      this.callbacks.ended(page);
      return;
    }
    this.pageIndex = pageAtTime(this.asset.pageStarts, this.audio.currentTime);
    this.callbacks.position(this.pageIndex, this.positionMs(), (this.end(this.pageIndex) - this.asset.pageStarts[this.pageIndex]) * 1000);
  }
  selectPage(page: number) {
    if (!this.alive || page < 0 || page >= this.asset.pageStarts.length) return;
    this.finished = false;
    this.pageIndex = page;
    if (this.pendingTime !== undefined) this.pendingTime = this.asset.pageStarts[page];
    else this.audio.currentTime = this.asset.pageStarts[page];
    this.callbacks.position(page, 0, (this.end(page) - this.asset.pageStarts[page]) * 1000);
  }
  destroy() { this.alive = false; }
}
