import type { AudioMode, BookPage, Language } from "./types";

export interface AudioPort {
  src: string;
  autoplay: boolean;
  play(): void;
  pause(): void;
  stop(): void;
  destroy(): void;
  onPlay(callback: () => void): void;
  onWaiting(callback: () => void): void;
  onEnded(callback: () => void): void;
  onError(callback: () => void): void;
  onTimeUpdate?(callback: () => void): void;
}
export interface NarrationState {
  pageIndex: number;
  mode: AudioMode;
  language: Language | null;
  status: "idle" | "loading" | "playing" | "paused" | "ended" | "error";
  active: boolean;
  error: string;
}
export interface NarrationSource {
  resolve(pageIndex: number, language: Language): Promise<string>;
  cancel(): void;
}

/** One context per segment: callbacks from a destroyed track cannot move the new page. */
export class NarrationController {
  private context?: AudioPort;
  private epoch = 0;
  private wanted = false;
  private disposed = false;
  private timeout?: ReturnType<typeof setTimeout>;
  private segment: Language = "zh";
  readonly state: NarrationState;

  constructor(
    private pages: BookPage[],
    private createAudio: () => AudioPort,
    private changed: (state: NarrationState) => void,
    pageIndex = 0,
    private source?: NarrationSource,
  ) {
    this.state = {
      pageIndex: Math.max(0, Math.min(pages.length - 1, pageIndex)),
      mode: "zh", language: null, status: "idle", active: false, error: "",
    };
  }

  private emit() {
    this.state.active = this.wanted;
    this.changed({ ...this.state });
  }
  private clearTimeout() {
    if (this.timeout !== undefined) clearTimeout(this.timeout);
    this.timeout = undefined;
  }
  private armTimeout(token: number, milliseconds = 20000) {
    this.clearTimeout();
    this.timeout = setTimeout(() => {
      if (token === this.epoch && this.wanted) this.fail("音频加载超时，请点击播放重试");
    }, milliseconds);
  }
  private release() {
    this.epoch++;
    this.source?.cancel();
    this.clearTimeout();
    const context = this.context;
    this.context = undefined;
    if (context) {
      try { context.stop(); } finally { context.destroy(); }
    }
  }
  private firstLanguage(): Language { return this.state.mode === "en" ? "en" : "zh"; }
  private fail(message: string) {
    this.wanted = false;
    this.release();
    this.state.status = "error";
    this.state.language = null;
    this.state.error = message;
    this.emit();
  }

  private startSegment(language: Language) {
    this.release();
    this.segment = language;
    this.state.language = null;
    this.state.error = "";
    if (this.source) {
      this.state.status = "loading";
      this.emit();
      const token = this.epoch;
      this.armTimeout(token, 65000);
      this.source.resolve(this.state.pageIndex, language).then(url => {
        if (token !== this.epoch || !this.wanted || this.disposed) return;
        this.openAudio(url, token);
      }).catch(error => {
        if (token === this.epoch && this.wanted && !this.disposed) this.fail(error instanceof Error ? error.message : "音频生成失败，请重试");
      });
      return;
    }
    const source = this.pages[this.state.pageIndex]?.audio[language];
    if (!source) { this.fail("本页暂无该语言音频，可以继续阅读"); return; }
    this.state.status = "loading";
    this.emit();
    const token = this.epoch;
    this.openAudio(source, token);
  }

  private openAudio(source: string, token: number) {
    try {
      const context = this.createAudio();
      this.context = context;
      context.autoplay = false;
      context.onPlay(() => {
        if (token !== this.epoch || this.disposed) return;
        if (!this.wanted) { context.pause(); return; }
        this.clearTimeout();
        this.state.status = "playing";
        this.state.language = this.segment;
        this.emit();
      });
      context.onWaiting(() => {
        if (token !== this.epoch || !this.wanted || this.disposed) return;
        this.state.status = "loading";
        this.state.language = null;
        this.armTimeout(token);
        this.emit();
      });
      context.onTimeUpdate?.(() => {
        if (token !== this.epoch || !this.wanted || this.disposed || this.state.status !== "loading") return;
        this.clearTimeout();
        this.state.status = "playing";
        this.state.language = this.segment;
        this.emit();
      });
      context.onError(() => {
        if (token === this.epoch && !this.disposed) this.fail("音频加载失败，请点击播放重试");
      });
      context.onEnded(() => {
        if (token !== this.epoch || !this.wanted || this.disposed) return;
        if (this.state.mode === "both" && this.segment === "zh") {
          this.startSegment("en");
        } else if (this.state.pageIndex + 1 < this.pages.length) {
          this.state.pageIndex++;
          this.startSegment(this.firstLanguage());
        } else {
          this.wanted = false;
          this.release();
          this.state.status = "ended";
          this.state.language = null;
          this.emit();
        }
      });
      context.src = source;
      this.armTimeout(token);
      context.play();
    } catch { this.fail("暂时无法播放音频，请重试"); }
  }

  play() {
    if (this.disposed || this.wanted) return;
    this.wanted = true;
    if (this.context && this.state.status === "paused") {
      this.state.status = "loading";
      this.armTimeout(this.epoch);
      this.emit();
      try { this.context.play(); } catch { this.fail("暂时无法播放音频，请重试"); }
    } else this.startSegment(this.firstLanguage());
  }
  pause() {
    if (this.disposed) return;
    const wasActive = this.wanted;
    this.wanted = false;
    this.clearTimeout();
    if (!this.context) { this.epoch++; this.source?.cancel(); }
    this.context?.pause();
    if (wasActive) this.state.status = "paused";
    this.state.language = null;
    this.emit();
  }
  selectPage(index: number) {
    if (this.disposed || index < 0 || index >= this.pages.length || index === this.state.pageIndex) return;
    this.state.pageIndex = index;
    if (this.wanted) this.startSegment(this.firstLanguage());
    else {
      this.release();
      this.state.status = "idle";
      this.state.language = null;
      this.state.error = "";
      this.emit();
    }
  }
  setMode(mode: AudioMode) {
    if (this.disposed || mode === this.state.mode) return;
    this.state.mode = mode;
    if (this.wanted) this.startSegment(this.firstLanguage());
    else {
      this.release();
      this.state.status = "idle";
      this.state.language = null;
      this.state.error = "";
      this.emit();
    }
  }
  destroy() {
    this.disposed = true;
    this.wanted = false;
    this.release();
  }
}
