import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeriesPlaylistItem } from "@/lib/reader/continuous-playback";
import {
  getReadyAnnouncementUrl,
  invalidateAnnouncementAudio,
  prefetchAnnouncementAudio,
  resetAnnouncementMemoryCache,
} from "@/lib/reader/next-book-announcement";
import {
  SeriesAudioPlayer,
  shouldShowMiniAudioPlayer,
} from "@/lib/reader/series-audio-player";
import type { MediaSessionHandlers } from "@/lib/reader/shared-audio-element";

function createBook(id: string, title: string, url: string): SeriesPlaylistItem {
  return {
    id,
    title,
    href: `/library/chengyu/${id.split("/")[1]}`,
    cover: `/library/chengyu/${id.split("/")[1]}/cover.webp`,
    chineseAudio: {
      url,
      pageStarts: [0, 5, 10],
      duration: 15,
      contentHash: `hash-${id}`,
    },
  };
}

function createFakeAudio() {
  const audio = {
    src: "",
    preload: "metadata",
    currentTime: 0,
    ended: false,
    paused: true,
    load: vi.fn(),
    pause: vi.fn(() => {
      audio.paused = true;
      audio.onpause?.();
    }),
    play: vi.fn(() => {
      audio.paused = false;
      audio.ended = false;
      audio.onplay?.();
      return Promise.resolve();
    }),
    onloadedmetadata: null as (() => void) | null,
    ontimeupdate: null as (() => void) | null,
    onplay: null as (() => void) | null,
    onpause: null as (() => void) | null,
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  return audio;
}

describe("next-book announcement cache and prefetcher", () => {
  afterEach(() => {
    resetAnnouncementMemoryCache();
    vi.restoreAllMocks();
  });

  it("prefetches once, caches synchronously in memory, and evicts expired or invalidated URLs", async () => {
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          audioUrl: "https://cdn.example.com/announce-2.mp3",
          model: "qwen-audio-3.0-tts-plus",
          voice: "longanlingxin",
          signedUrlExpiresAt: futureExpiry,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const book = { title: "狐假虎威" };

    expect(getReadyAnnouncementUrl(book, "zh")).toBeNull();
    const [first, second] = await Promise.all([
      prefetchAnnouncementAudio(book, "zh", { fetchImpl: fetchMock as unknown as typeof fetch }),
      prefetchAnnouncementAudio(book, "zh", { fetchImpl: fetchMock as unknown as typeof fetch }),
    ]);

    expect(first).toBe("https://cdn.example.com/announce-2.mp3");
    expect(second).toBe("https://cdn.example.com/announce-2.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReadyAnnouncementUrl(book, "zh")).toBe("https://cdn.example.com/announce-2.mp3");

    invalidateAnnouncementAudio(book, "zh");
    expect(getReadyAnnouncementUrl(book, "zh")).toBeNull();
  });

  it("treats nearly-expired signed announcement URLs as unusable and returns null on network error", async () => {
    const expiredSoon = new Date(Date.now() + 10_000).toISOString();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          audioUrl: "https://cdn.example.com/expiring.mp3",
          signedUrlExpiresAt: expiredSoon,
        }),
        { status: 200 },
      ),
    );
    const book = { title: "画蛇添足" };
    await prefetchAnnouncementAudio(book, "zh", { fetchImpl: fetchMock as unknown as typeof fetch });
    expect(getReadyAnnouncementUrl(book, "zh")).toBeNull();

    const failingFetch = vi.fn(async () => new Response("error", { status: 503 }));
    expect(
      await prefetchAnnouncementAudio({ title: "拔苗助长" }, "zh", {
        fetchImpl: failingFetch as unknown as typeof fetch,
      }),
    ).toBeNull();
  });
});

describe("SeriesAudioPlayer continuous screen-off playback and voice prompts", () => {
  const book1 = createBook("chengyu/book-1", "守株待兔", "https://cdn.example.com/book-1.mp3");
  const book2 = createBook("chengyu/book-2", "狐假虎威", "https://cdn.example.com/book-2.mp3");
  const book3 = createBook("chengyu/book-3", "画蛇添足", "https://cdn.example.com/book-3.mp3");
  const playlist = [book1, book2, book3];

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup(options: {
    hidden?: boolean;
    readyUrls?: Record<string, string>;
    fetchImpl?: typeof fetch;
    announcementWatchdogMs?: number;
  } = {}) {
    let hidden = options.hidden ?? false;
    const readyUrls = new Map(Object.entries(options.readyUrls ?? {}));
    const audio = createFakeAudio();
    const prefetchAnnouncement = vi.fn(async () => null);
    const invalidateAnnouncement = vi.fn((book: { title: string }) => {
      readyUrls.delete(book.title);
    });
    let latestHandlers: MediaSessionHandlers = {};
    const updateMediaSession = vi.fn((input: { handlers?: MediaSessionHandlers }) => {
      if (input.handlers) {
        latestHandlers = { ...latestHandlers, ...input.handlers };
      }
    });
    const updateMediaSessionPosition = vi.fn();
    const clearMediaSession = vi.fn();
    const getProgress = vi.fn(async () => null);
    const saveProgress = vi.fn(async () => undefined);

    const player = new SeriesAudioPlayer({
      getAudio: () => audio as unknown as HTMLAudioElement,
      isDocumentHidden: () => hidden,
      getReadyAnnouncementUrl: (book) => readyUrls.get(book.title) ?? null,
      prefetchAnnouncement,
      invalidateAnnouncement,
      updateMediaSession: updateMediaSession as unknown as typeof import("@/lib/reader/shared-audio-element").updateMediaSession,
      updateMediaSessionPosition,
      clearMediaSession,
      getProgress,
      saveProgress,
      fetchImpl: options.fetchImpl,
      announcementWatchdogMs: options.announcementWatchdogMs ?? 6_000,
    });

    return {
      player,
      audio,
      setHidden: (value: boolean) => {
        hidden = value;
      },
      readyUrls,
      prefetchAnnouncement,
      invalidateAnnouncement,
      updateMediaSession,
      clearMediaSession,
      saveProgress,
      getHandlers: () => latestHandlers,
    };
  }

  it("chains synchronously through spoken prompts across multiple books while screen is locked", async () => {
    const { player, audio, prefetchAnnouncement, updateMediaSession, clearMediaSession, saveProgress } = setup({
      hidden: true,
      readyUrls: {
        "狐假虎威": "https://cdn.example.com/prompt-2.mp3",
        "画蛇添足": "https://cdn.example.com/prompt-3.mp3",
      },
    });

    player.claimBook(book1.id);
    player.startBook({
      book: book1,
      playlist,
      seriesTitle: "成语故事",
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: true,
    });

    expect(audio.src).toBe(book1.chineseAudio!.url);
    expect(player.getState().phase).toBe("playing");
    expect(prefetchAnnouncement).toHaveBeenCalledWith(book2, "zh");

    // Book 1 finishes while locked -> speaks Book 2 prompt synchronously without pausing.
    audio.ended = true;
    audio.onended?.();

    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.src).toBe("https://cdn.example.com/prompt-2.mp3");
    expect(player.getState()).toMatchObject({
      bookId: book1.id,
      phase: "announcing",
      announcementPlaying: true,
      announcementText: "接下来播放下一本故事，狐假虎威。",
      pendingTarget: book2,
    });
    expect(updateMediaSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "即将播放：狐假虎威", playbackState: "playing" }),
    );

    // Announcement ends -> synchronously plays Book 2 on the same audio element & prefetches Book 3.
    audio.ended = true;
    audio.onended?.();

    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.src).toBe(book2.chineseAudio!.url);
    expect(player.getState()).toMatchObject({
      bookId: book2.id,
      phase: "playing",
      pageIndex: 0,
      pendingTarget: null,
    });
    expect(prefetchAnnouncement).toHaveBeenCalledWith(book3, "zh");

    // Book 2 finishes while still locked -> speaks Book 3 prompt -> plays Book 3.
    audio.ended = true;
    audio.onended?.();
    expect(audio.src).toBe("https://cdn.example.com/prompt-3.mp3");
    audio.ended = true;
    audio.onended?.();
    expect(audio.src).toBe(book3.chineseAudio!.url);
    expect(player.getState().bookId).toBe(book3.id);

    // Book 3 (last book) finishes -> stops cleanly.
    audio.ended = true;
    audio.onended?.();
    expect(player.getState()).toMatchObject({
      bookId: book3.id,
      phase: "ended",
      pendingTarget: null,
    });
    expect(clearMediaSession).toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({ contentId: book1.id, progressPercent: 100 }),
      );
      expect(saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({ contentId: book2.id, progressPercent: 100 }),
      );
      expect(saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({ contentId: book3.id, progressPercent: 100 }),
      );
    });
  });

  it("chains straight into the next book while locked when announcement audio is not ready", () => {
    const { player, audio } = setup({ hidden: true, readyUrls: {} });
    player.startBook({
      book: book1,
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: true,
    });

    audio.ended = true;
    audio.onended?.();

    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.src).toBe(book2.chineseAudio!.url);
    expect(player.getState()).toMatchObject({
      bookId: book2.id,
      phase: "playing",
      pageIndex: 0,
    });
  });

  it("recovers from announcement audio errors and watchdog timeouts by continuing to the next book", () => {
    vi.useFakeTimers();
    const { player, audio, invalidateAnnouncement } = setup({
      hidden: false,
      readyUrls: {
        "狐假虎威": "https://cdn.example.com/broken-prompt.mp3",
        "画蛇添足": "https://cdn.example.com/stalled-prompt.mp3",
      },
      announcementWatchdogMs: 5_000,
    });

    player.startBook({
      book: book1,
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: true,
    });

    // Book 1 ends -> announcement errors -> invalidates & immediately plays Book 2.
    audio.ended = true;
    audio.onended?.();
    expect(audio.src).toBe("https://cdn.example.com/broken-prompt.mp3");
    audio.onerror?.();
    expect(invalidateAnnouncement).toHaveBeenCalledWith(book2, "zh");
    expect(audio.src).toBe(book2.chineseAudio!.url);
    expect(player.getState().bookId).toBe(book2.id);

    // Book 2 ends -> announcement hangs without firing onplay -> watchdog advances to Book 3.
    audio.play.mockImplementationOnce(() => Promise.resolve());
    audio.ended = true;
    audio.onended?.();
    expect(audio.src).toBe("https://cdn.example.com/stalled-prompt.mp3");
    vi.advanceTimersByTime(5_000);
    expect(audio.src).toBe(book3.chineseAudio!.url);
    expect(player.getState().bookId).toBe(book3.id);
  });

  it("supports foreground immediate skip, cancel continuous playback, and stops in bedtime mode", () => {
    const { player, audio } = setup({
      hidden: false,
      readyUrls: {
        "狐假虎威": "https://cdn.example.com/prompt-2.mp3",
        "画蛇添足": "https://cdn.example.com/prompt-3.mp3",
      },
    });

    player.startBook({
      book: book1,
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: true,
    });

    // Book 1 ends -> user clicks "立即播放" mid-announcement.
    audio.ended = true;
    audio.onended?.();
    expect(player.getState().phase).toBe("announcing");
    expect(player.playPendingTargetNow()).toBe(true);
    expect(player.getState().bookId).toBe(book2.id);
    expect(audio.src).toBe(book2.chineseAudio!.url);

    // Book 2 ends -> user clicks "取消连播" mid-announcement.
    audio.ended = true;
    audio.onended?.();
    expect(player.getState().phase).toBe("announcing");
    player.cancelPendingTarget();
    expect(player.getState()).toMatchObject({
      phase: "ended",
      continuousPlayback: false,
      pendingTarget: null,
      announcementPlaying: false,
    });

    // Bedtime mode (continuousPlayback: false) stops at end of Book 1 without announcing.
    player.startBook({
      book: book1,
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: false,
    });
    audio.ended = true;
    audio.onended?.();
    expect(player.getState()).toMatchObject({
      bookId: book1.id,
      phase: "ended",
      pendingTarget: null,
    });
  });

  it("keeps playing, paused, and ended states across Back navigation and supports playlist selection", () => {
    const { player, audio, prefetchAnnouncement } = setup({ hidden: false });

    player.claimBook(book1.id);
    player.startBook({
      book: book1,
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: false,
    });

    // Playlist is exposed in player state for the mini player drawer.
    expect(player.getState().playlist).toHaveLength(3);

    // Enabling continuous playback from the mini player drawer prefetches the next announcement.
    player.setContinuousPlayback(true);
    expect(player.getState().continuousPlayback).toBe(true);
    expect(prefetchAnnouncement).toHaveBeenCalledWith(book2, "zh");

    // User presses Back to /library/chengyu -> Book 1 detail unmounts, playback keeps running for mini player!
    player.releaseBook(book1.id);
    expect(player.getState()).toMatchObject({
      bookId: book1.id,
      phase: "playing",
      hasPreviousBook: false,
      hasNextBook: true,
    });

    // User picks Book 3 directly from the mini player playlist -> plays immediately!
    expect(player.playPlaylistBook(book3.id)).toBe(true);
    expect(audio.src).toBe(book3.chineseAudio!.url);
    expect(player.getState()).toMatchObject({
      bookId: book3.id,
      phase: "playing",
      hasPreviousBook: true,
      hasNextBook: false,
    });

    // User pauses Book 3 -> clicking Book 3 again in playlist resumes it.
    player.pause();
    expect(player.getState().phase).toBe("paused");
    expect(player.playPlaylistBook(book3.id)).toBe(true);
    expect(player.getState().phase).toBe("playing");

    // User opens Book 2 to browse without pressing Play -> Book 3 stays playing in the mini player!
    player.claimBook(book2.id);
    expect(player.getState()).toMatchObject({
      bookId: book3.id,
      phase: "playing",
    });

    // Book 3 finishes -> even when leaving its detail page, ended state stays visible in the mini player/bubble.
    audio.ended = true;
    audio.onended?.();
    expect(player.getState().phase).toBe("ended");
    player.releaseBook(book3.id);
    expect(player.getState()).toMatchObject({
      bookId: book3.id,
      phase: "ended",
    });

    // Picking ended Book 3 in playlist replays it from page 0.
    expect(player.playPlaylistBook(book3.id)).toBe(true);
    expect(player.getState()).toMatchObject({
      bookId: book3.id,
      phase: "playing",
      pageIndex: 0,
    });

    // User closes the mini player -> playback stops cleanly.
    player.stop();
    expect(player.getState().phase).toBe("idle");
    expect(audio.pause).toHaveBeenCalled();
  });

  it("keeps per-page English/bilingual library playback running across Back navigation", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}")) as { text?: string };
      return new Response(
        JSON.stringify({
          audioUrl: `data:audio/mpeg;base64,${Buffer.from(payload.text || "page").toString("base64")}`,
          model: "qwen-audio-3.0-tts-plus",
          voice: "longanlufeng",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const { player, audio } = setup({
      hidden: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const pages = [
      { page: 1, zhText: "第一页", enText: "Page one.", imageStatus: "complete" as const },
      { page: 2, zhText: "第二页", enText: "Page two.", imageStatus: "complete" as const },
    ];

    player.claimBook(book1.id);
    player.startPerPageBook({
      book: book1,
      pages,
      storyKey: "library-chengyu-book-1",
      mode: "en",
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: true,
    });

    await vi.waitFor(() => {
      expect(player.getState()).toMatchObject({
        bookId: book1.id,
        languageMode: "en",
        pageIndex: 0,
        totalPages: 2,
        phase: "playing",
      });
    });

    // User presses Back while English page 1 is playing -> keeps playing and auto-advances to page 2!
    player.releaseBook(book1.id);
    expect(player.getState().phase).toBe("playing");

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    audio.ended = true;
    audio.onended?.();
    expect(player.getState()).toMatchObject({
      bookId: book1.id,
      pageIndex: 1,
      phase: "playing",
    });

    // Page 2 ends -> completes cleanly and supports replay from mini player.
    audio.ended = true;
    audio.onended?.();
    expect(player.getState().phase).toBe("ended");
    expect(player.replayCurrentBook(0, 0)).toBe(true);
    expect(player.getState()).toMatchObject({
      bookId: book1.id,
      pageIndex: 0,
      phase: "playing",
    });
  });

  it("shows the bottom mini player on other routes and hides it on the playing book detail page", () => {
    const active = {
      phase: "playing" as const,
      bookId: book1.id,
      bookHref: "/library/chengyu/book-1",
      handoffOnly: false,
    };

    expect(shouldShowMiniAudioPlayer(active, "/library/chengyu")).toBe(true);
    expect(shouldShowMiniAudioPlayer({ ...active, phase: "paused" }, "/library/chengyu")).toBe(true);
    expect(shouldShowMiniAudioPlayer({ ...active, phase: "ended" }, "/library/chengyu")).toBe(true);
    expect(shouldShowMiniAudioPlayer({ ...active, phase: "announcing" }, "/library/chengyu")).toBe(true);
    expect(shouldShowMiniAudioPlayer(active, "/library")).toBe(true);
    expect(shouldShowMiniAudioPlayer(active, "/")).toBe(true);
    expect(shouldShowMiniAudioPlayer(active, "/library/chengyu/book-2")).toBe(true);
    expect(shouldShowMiniAudioPlayer(active, "/library/chengyu/book-1")).toBe(false);
    expect(shouldShowMiniAudioPlayer(active, "/library/chengyu/book-1/")).toBe(false);
    expect(shouldShowMiniAudioPlayer(active, "/login")).toBe(false);
    expect(shouldShowMiniAudioPlayer(active, "/auth/callback")).toBe(false);
    expect(shouldShowMiniAudioPlayer({ ...active, phase: "idle" }, "/library")).toBe(false);
    expect(shouldShowMiniAudioPlayer({ ...active, bookHref: "" }, "/library")).toBe(false);
  });

  it("handles lock-screen MediaSession next/previous track controls and en/zh-en handoff announcements", () => {
    const { player, audio, getHandlers } = setup({ hidden: true });

    player.claimBook(book1.id);
    player.startBook({
      book: book1,
      playlist,
      pageIndex: 0,
      resumeFromMs: 0,
      autoAdvance: true,
      continuousPlayback: true,
    });

    getHandlers().nexttrack?.();
    expect(player.getState().bookId).toBe(book2.id);
    expect(audio.src).toBe(book2.chineseAudio!.url);

    getHandlers().previoustrack?.();
    expect(player.getState().bookId).toBe(book1.id);
    expect(audio.src).toBe(book1.chineseAudio!.url);

    // Per-page en/zh-en handoff announcement bridges route mount and triggers Book 2 start on end.
    player.stop();
    const book2Start = vi.fn();
    expect(
      player.startHandoffAnnouncement({
        fromBookId: book1.id,
        target: book2,
        mode: "en",
        announcementUrl: "https://cdn.example.com/en-prompt.mp3",
      }),
    ).toBe(true);
    expect(player.isPlayingHandoffFor(book2.id)).toBe(true);
    // Book 1 unmounts & Book 2 mounts while announcement is playing.
    player.releaseBook(book1.id);
    player.claimBook(book2.id);
    expect(player.isPlayingHandoffFor(book2.id)).toBe(true);
    player.whenHandoffAnnouncementEnds(book2.id, book2Start);
    expect(book2Start).not.toHaveBeenCalled();

    audio.ended = true;
    audio.onended?.();
    expect(book2Start).toHaveBeenCalledTimes(1);
    expect(player.getState().phase).toBe("idle");
  });
});
