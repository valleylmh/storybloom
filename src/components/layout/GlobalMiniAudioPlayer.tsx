"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  BookOpenText,
  CaretDown,
  ListBullets,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { CONTINUOUS_PLAYBACK_STORAGE_KEY } from "@/lib/reader/continuous-playback";
import {
  seriesAudioPlayer,
  shouldShowMiniAudioPlayer,
  type SeriesPlayerState,
} from "@/lib/reader/series-audio-player";
import styles from "./GlobalMiniAudioPlayer.module.css";

type DisplayMode = "bar" | "bubble";

const BUBBLE_RING_RADIUS = 25;
const BUBBLE_RING_CIRCUMFERENCE = 2 * Math.PI * BUBBLE_RING_RADIUS;

export default function GlobalMiniAudioPlayer() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [playerState, setPlayerState] = useState<SeriesPlayerState | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("bar");
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const previousPhaseRef = useRef<SeriesPlayerState["phase"]>("idle");
  const activeItemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const apply = (next: SeriesPlayerState) => {
      if (next.phase === "idle") {
        setDisplayMode("bar");
        setPlaylistOpen(false);
      } else if (previousPhaseRef.current === "idle") {
        setDisplayMode("bar");
      }
      previousPhaseRef.current = next.phase;
      setPlayerState(next);
    };
    apply(seriesAudioPlayer.getState());
    return seriesAudioPlayer.subscribe(apply);
  }, []);

  useEffect(() => {
    setPlaylistOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!playlistOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlaylistOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const scrollTimer = window.setTimeout(() => {
      activeItemRef.current?.scrollIntoView?.({ block: "nearest" });
    }, 0);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(scrollTimer);
    };
  }, [playlistOpen]);

  if (!playerState || !shouldShowMiniAudioPlayer(playerState, pathname)) {
    return null;
  }

  const isAnnouncing =
    playerState.phase === "announcing" && Boolean(playerState.pendingTarget);
  const displayTitle = isAnnouncing
    ? `即将播放：${playerState.pendingTarget!.title}`
    : playerState.bookTitle;
  const displayCover =
    (isAnnouncing ? playerState.pendingTarget?.cover : undefined) ??
    playerState.bookCover;
  const targetHref =
    (isAnnouncing ? playerState.pendingTarget?.href : undefined) ??
    playerState.bookHref;

  const pageLabel =
    playerState.totalPages > 0
      ? `第 ${playerState.pageIndex + 1}/${playerState.totalPages} 页`
      : "";

  const subtitle = isAnnouncing
    ? "正在语音提示，播报完自动播放"
    : playerState.phase === "loading"
      ? `正在准备${pageLabel ? ` ${pageLabel}` : ""}…`
      : playerState.phase === "paused"
        ? `已暂停${pageLabel ? ` · ${pageLabel}` : ""}`
        : playerState.phase === "ended"
          ? "已播完 · 点击重新播放"
          : playerState.phase === "error"
            ? "播放中断 · 点击重试"
            : [playerState.seriesTitle, pageLabel].filter(Boolean).join(" · ") ||
              "正在朗读";

  const isPlaying =
    playerState.phase === "playing" || playerState.phase === "announcing";
  const isLoading = playerState.phase === "loading";
  const isInactivePhase =
    playerState.phase === "paused" ||
    playerState.phase === "ended" ||
    playerState.phase === "error";
  const progressRatio = Math.max(0, Math.min(1, playerState.bookProgressRatio));
  const progressPercent = Math.round(progressRatio * 100);
  const hasPlaylist = playerState.playlist.length > 0;

  const handlePrimaryClick = () => {
    if (isLoading) return;
    if (isPlaying) {
      seriesAudioPlayer.pause();
      return;
    }
    if (playerState.phase === "paused") {
      void seriesAudioPlayer.resume();
      return;
    }
    seriesAudioPlayer.replayCurrentBook(0, 0);
  };

  const handleNextClick = () => {
    if (isAnnouncing) {
      seriesAudioPlayer.playPendingTargetNow();
      return;
    }
    seriesAudioPlayer.skipToAdjacentBook(1);
  };

  const handleSelectPlaylistBook = (bookId: string, href: string) => {
    const started = seriesAudioPlayer.playPlaylistBook(bookId);
    if (!started) {
      setPlaylistOpen(false);
      router.push(href);
    }
  };

  const handleToggleContinuous = (enabled: boolean) => {
    seriesAudioPlayer.setContinuousPlayback(enabled);
    try {
      localStorage.setItem(CONTINUOUS_PLAYBACK_STORAGE_KEY, String(enabled));
    } catch {
      // Session state remains active without storage.
    }
  };

  const handleCloseAll = () => {
    setPlaylistOpen(false);
    setDisplayMode("bar");
    seriesAudioPlayer.stop();
  };

  const canGoNext =
    isAnnouncing ||
    (playerState.hasNextBook && playerState.languageMode === "zh");
  const canGoPrev =
    !isAnnouncing &&
    playerState.hasPreviousBook &&
    playerState.languageMode === "zh";

  const primaryLabel = isLoading
    ? "正在准备音频"
    : isPlaying
      ? "暂停播放"
      : playerState.phase === "paused"
        ? "继续播放"
        : "重新播放";

  if (displayMode === "bubble") {
    const ringOffset = BUBBLE_RING_CIRCUMFERENCE * (1 - progressRatio);
    const bubbleStatusText = isAnnouncing
      ? "正在语音提示下一本"
      : playerState.phase === "playing"
        ? `正在播放 ${pageLabel}`
        : playerState.phase === "paused"
          ? "已暂停"
          : playerState.phase === "ended"
            ? "已播完"
            : "音频播放器";

    return (
      <div
        className={`global-mini-audio-player global-mini-audio-player-bubble ${styles.bubbleWrap}`}
        data-playback-phase={playerState.phase}
      >
        <button
          type="button"
          className={styles.bubbleBtn}
          aria-label={`展开迷你播放器：${displayTitle}（${bubbleStatusText}）`}
          title={`展开播放器：${displayTitle}`}
          onClick={() => setDisplayMode("bar")}
        >
          <svg
            className={styles.bubbleRing}
            viewBox="0 0 56 56"
            aria-hidden="true"
          >
            <circle
              className={styles.bubbleRingTrack}
              cx="28"
              cy="28"
              r={BUBBLE_RING_RADIUS}
            />
            <circle
              className={styles.bubbleRingFill}
              cx="28"
              cy="28"
              r={BUBBLE_RING_RADIUS}
              strokeDasharray={BUBBLE_RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <span
            className={`${styles.bubbleCover} ${
              isPlaying ? styles.bubbleCoverSpinning : ""
            }`}
            aria-hidden="true"
          >
            {displayCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayCover} alt="" />
            ) : (
              <BookOpenText size={21} weight="duotone" />
            )}
          </span>
          <span
            className={`${styles.bubbleBadge} ${
              isInactivePhase ? styles.bubbleBadgeMuted : ""
            }`}
            aria-hidden="true"
          >
            {isLoading ? (
              <SpinnerGap size={11} className={styles.spinner} />
            ) : playerState.phase === "playing" ? (
              <span className={styles.bubbleEqualizer}>
                <i />
                <i />
                <i />
              </span>
            ) : isAnnouncing ? (
              <SpeakerHigh size={11} weight="fill" />
            ) : playerState.phase === "ended" ? (
              <ArrowClockwise size={11} weight="bold" />
            ) : (
              <Play size={10} weight="fill" />
            )}
          </span>
        </button>

        <button
          type="button"
          className={styles.bubbleCloseBtn}
          aria-label="关闭播放器并停止播放"
          title="关闭播放器"
          onClick={handleCloseAll}
        >
          <X size={12} weight="bold" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <>
      {playlistOpen ? (
        <div
          className={styles.backdrop}
          aria-hidden="true"
          onClick={() => setPlaylistOpen(false)}
        />
      ) : null}

      <aside
        className={`global-mini-audio-player global-mini-audio-player-bar ${styles.dockWrap}`}
        aria-label="迷你绘本播放器"
        data-playback-phase={playerState.phase}
      >
        {playlistOpen && hasPlaylist ? (
          <section
            className={styles.sheet}
            role="dialog"
            aria-label="绘本播放列表"
          >
            <header className={styles.sheetHeader}>
              <div className={styles.sheetHeading}>
                <strong>{playerState.seriesTitle || "当前播放列表"}</strong>
                <small>共 {playerState.playlist.length} 本</small>
              </div>
              <div className={styles.sheetHeaderActions}>
                <button
                  type="button"
                  className={styles.sheetStopBtn}
                  onClick={handleCloseAll}
                >
                  关闭播放器
                </button>
                <button
                  type="button"
                  className={styles.sheetCloseBtn}
                  aria-label="收起播放列表"
                  onClick={() => setPlaylistOpen(false)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </header>

            <label className={styles.sheetToggle}>
              <input
                type="checkbox"
                checked={playerState.continuousPlayback}
                onChange={(event) => handleToggleContinuous(event.target.checked)}
              />
              <span>连续播放：听完后语音提示并播放同系列下一本</span>
            </label>

            <ol className={styles.sheetList}>
              {playerState.playlist.map((item, index) => {
                const isCurrent = item.id === playerState.bookId;
                const isPendingNext =
                  isAnnouncing && playerState.pendingTarget?.id === item.id;
                const itemStatus = isPendingNext
                  ? "即将播放"
                  : isCurrent
                    ? playerState.phase === "playing"
                      ? "正在播放"
                      : playerState.phase === "paused"
                        ? "已暂停"
                        : playerState.phase === "ended"
                          ? "已播完"
                          : playerState.phase === "loading"
                            ? "准备中…"
                            : "当前绘本"
                    : null;

                return (
                  <li
                    key={item.id}
                    ref={isCurrent ? activeItemRef : undefined}
                    className={`${styles.sheetItem} ${
                      isCurrent ? styles.sheetItemActive : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={styles.sheetItemPlayBtn}
                      aria-current={isCurrent ? "true" : undefined}
                      onClick={() => handleSelectPlaylistBook(item.id, item.href)}
                    >
                      <span className={styles.sheetIndex} aria-hidden="true">
                        {isCurrent && playerState.phase === "playing" ? (
                          <span className={styles.equalizer}>
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className={styles.sheetCover} aria-hidden="true">
                        <span>{item.title.slice(0, 1)}</span>
                        {item.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.cover}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        ) : null}
                      </span>
                      <span className={styles.sheetCopy}>
                        <span className={styles.sheetTitle}>{item.title}</span>
                        {itemStatus ? (
                          <span className={styles.sheetStatus}>{itemStatus}</span>
                        ) : null}
                      </span>
                    </button>

                    <Link
                      href={item.href}
                      prefetch={false}
                      className={styles.sheetOpenLink}
                      aria-label={`查看《${item.title}》绘本页`}
                      title="查看绘本页"
                      onClick={() => setPlaylistOpen(false)}
                    >
                      <BookOpenText size={17} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <div className={styles.dock}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className={styles.inner}>
            <Link
              href={targetHref}
              className={styles.bookLink}
              aria-label={`回到正在播放的绘本：${playerState.bookTitle}`}
            >
              <span className={styles.cover} aria-hidden="true">
                {displayCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayCover} alt="" />
                ) : (
                  <BookOpenText size={21} weight="duotone" />
                )}
              </span>
              <span className={styles.copy}>
                <strong className={styles.title}>{displayTitle}</strong>
                <span className={styles.meta}>
                  {playerState.phase === "playing" ? (
                    <span className={styles.equalizer} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : isAnnouncing ? (
                    <SpeakerHigh
                      size={13}
                      weight="fill"
                      className={styles.speakerIcon}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className={styles.metaText}>{subtitle}</span>
                </span>
              </span>
            </Link>

            <div className={styles.controls}>
              {canGoPrev ? (
                <button
                  type="button"
                  className={`${styles.controlBtn} ${styles.prevBtn}`}
                  aria-label="播放上一本"
                  title="播放上一本"
                  onClick={() => seriesAudioPlayer.skipToAdjacentBook(-1)}
                >
                  <SkipBack size={17} weight="fill" aria-hidden="true" />
                </button>
              ) : null}

              <button
                type="button"
                className={styles.primaryBtn}
                aria-label={primaryLabel}
                title={primaryLabel}
                disabled={isLoading}
                onClick={handlePrimaryClick}
              >
                {isLoading ? (
                  <SpinnerGap size={19} className={styles.spinner} aria-hidden="true" />
                ) : isPlaying ? (
                  <Pause size={18} weight="fill" aria-hidden="true" />
                ) : playerState.phase === "ended" ? (
                  <ArrowClockwise size={18} weight="bold" aria-hidden="true" />
                ) : (
                  <Play size={18} weight="fill" aria-hidden="true" />
                )}
              </button>

              {canGoNext ? (
                <button
                  type="button"
                  className={`${styles.controlBtn} ${
                    isInactivePhase ? styles.mobileHideNextWhenIdle : ""
                  }`}
                  aria-label={isAnnouncing ? "立即播放下一本" : "播放下一本"}
                  title={isAnnouncing ? "立即播放下一本" : "播放下一本"}
                  onClick={handleNextClick}
                >
                  <SkipForward size={17} weight="fill" aria-hidden="true" />
                </button>
              ) : null}

              {hasPlaylist ? (
                <button
                  type="button"
                  className={`${styles.controlBtn} ${
                    playlistOpen ? styles.controlBtnActive : ""
                  }`}
                  aria-label="打开播放列表"
                  title="播放列表"
                  aria-expanded={playlistOpen}
                  aria-haspopup="dialog"
                  onClick={() => setPlaylistOpen((open) => !open)}
                >
                  <ListBullets size={18} weight="bold" aria-hidden="true" />
                </button>
              ) : null}

              <button
                type="button"
                className={styles.controlBtn}
                aria-label="收起为悬浮气泡"
                title="收起为悬浮气泡"
                onClick={() => {
                  setPlaylistOpen(false);
                  setDisplayMode("bubble");
                }}
              >
                <CaretDown size={17} weight="bold" aria-hidden="true" />
              </button>

              <button
                type="button"
                className={`${styles.closeBtn} ${
                  isInactivePhase ? "" : styles.desktopOnlyClose
                }`}
                aria-label="关闭播放器并停止播放"
                title="关闭播放器"
                onClick={handleCloseAll}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
