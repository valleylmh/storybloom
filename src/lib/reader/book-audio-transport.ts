import type { BookAudio } from "../../../miniprogram/src/core/types";
import { pageAtTime } from "../../../miniprogram/src/core/book-audio";
export type { BookAudio };

export type BookAudioTransportOptions = {
  intro?: {
    endSec: number;
    onFinished: () => void;
  };
};

/** One continuous media source with page-relative progress for existing reading records. */
export class BookAudioTransport {
  pageIndex: number;
  private alive = true;
  private finished = false;
  private pendingTime: number | undefined;
  private introCompleted: boolean;
  constructor(private audio: HTMLAudioElement, private asset: BookAudio, pageIndex: number, resumeMs: number,
    private callbacks: {
      autoAdvance: () => boolean;
      position: (page: number, positionMs: number, durationMs: number) => void;
      playing: () => void;
      paused: (positionMs: number) => void;
      ended: (page: number) => void;
      error: () => void;
    },
    private options?: BookAudioTransportOptions) {
    this.pageIndex = pageIndex;
    this.introCompleted = !options?.intro;
    if (options?.intro) {
      this.pendingTime = 0;
    } else {
      const length = this.end(pageIndex) - asset.pageStarts[pageIndex];
      this.pendingTime = asset.pageStarts[pageIndex] + (resumeMs > 0 && resumeMs / 1000 < length - 0.5 ? resumeMs / 1000 : 0);
    }
    audio.onloadedmetadata = () => {
      if (!this.alive || this.pendingTime === undefined) return;
      const targetTime = this.pendingTime;
      this.pendingTime = undefined;
      if (targetTime > 0 || audio.currentTime > 0.05) {
        audio.currentTime = targetTime;
      }
      this.sync();
    };
    audio.ontimeupdate = () => this.sync();
    audio.onplay = () => { if (this.alive) callbacks.playing(); };
    audio.onpause = () => { if (this.alive && !this.finished && !audio.ended) callbacks.paused(this.positionMs()); };
    audio.onended = () => {
      if (!this.alive || this.finished) return;
      this.completeIntroIfNeeded();
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
  private completeIntroIfNeeded() {
    if (this.introCompleted || !this.options?.intro) return;
    this.introCompleted = true;
    this.options.intro.onFinished();
  }
  inIntro() {
    return !this.introCompleted && Boolean(this.options?.intro);
  }
  skipIntro() {
    if (!this.alive || !this.options?.intro || this.introCompleted) return;
    const target = this.options.intro.endSec;
    if (this.pendingTime !== undefined) {
      this.pendingTime = target;
    } else {
      this.audio.currentTime = target;
    }
    this.completeIntroIfNeeded();
    this.sync();
  }
  sync() {
    if (!this.alive || this.finished || this.pendingTime !== undefined || !Number.isFinite(this.audio.currentTime)) return;
    if (!this.introCompleted && this.options?.intro) {
      if (this.audio.currentTime < this.options.intro.endSec - 0.05) {
        return;
      }
      this.completeIntroIfNeeded();
    }
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
    this.completeIntroIfNeeded();
    this.finished = false;
    this.pageIndex = page;
    if (this.pendingTime !== undefined) this.pendingTime = this.asset.pageStarts[page];
    else this.audio.currentTime = this.asset.pageStarts[page];
    this.callbacks.position(page, 0, (this.end(page) - this.asset.pageStarts[page]) * 1000);
  }
  destroy() { this.alive = false; }
}
