"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerHigh } from "@phosphor-icons/react";
import type { BrowserNarrationMode } from "@/lib/browser-narration";
import {
  NEXT_BOOK_COUNTDOWN_SECONDS,
  startNextBookCountdown,
} from "@/lib/reader/continuous-playback";
import { speakAnnouncementInForeground } from "@/lib/reader/next-book-announcement";

export default function LibraryNextBookCountdown({
  title,
  englishTitle,
  languageMode = "zh",
  announcementText,
  announcementPlaying = false,
  onComplete,
  onCancel,
}: {
  title: string;
  englishTitle?: string;
  languageMode?: BrowserNarrationMode;
  announcementText?: string | null;
  announcementPlaying?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(NEXT_BOOK_COUNTDOWN_SECONDS);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stopCountdownRef = useRef<(() => void) | null>(null);
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  const cleanupTimers = () => {
    stopCountdownRef.current?.();
    stopCountdownRef.current = null;
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
  };

  const complete = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    cleanupTimers();
    onComplete();
  };
  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    cleanupTimers();
    onCancel();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    settledRef.current = false;

    const openWhenVisible = () => {
      if (document.visibilityState === "hidden" || dialog.open) return;
      try {
        dialog.showModal();
        document.body.style.overflow = "hidden";
      } catch {
        // Ignore modal errors if dialog cannot open while hidden.
      }
    };

    openWhenVisible();
    document.addEventListener("visibilitychange", openWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", openWhenVisible);
      cleanupTimers();
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    cleanupTimers();
    if (announcementPlaying) return;
    stopSpeechRef.current = speakAnnouncementInForeground(
      { title, englishTitle },
      languageMode,
    );
    stopCountdownRef.current = startNextBookCountdown(setSeconds, () => {
      if (settledRef.current) return;
      settledRef.current = true;
      stopSpeechRef.current?.();
      stopSpeechRef.current = null;
      onComplete();
    });
    return () => {
      cleanupTimers();
    };
  }, [announcementPlaying, englishTitle, languageMode, onComplete, title]);

  return (
    <dialog
      ref={dialogRef}
      className="library-next-book-dialog"
      aria-labelledby="library-next-book-title"
      aria-describedby="library-next-book-countdown"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <p className="library-next-book-kicker">即将播放下一本故事</p>
      <h2 id="library-next-book-title">{title}</h2>
      <p id="library-next-book-countdown" className="library-next-book-countdown" role="status" aria-atomic="true">
        {announcementPlaying ? (
          <>
            <strong className="library-next-book-speaking" aria-hidden="true">
              <SpeakerHigh weight="fill" />
            </strong>
            <span>{announcementText ? `正在语音提示：${announcementText}` : "正在语音提示，播报完自动播放"}</span>
          </>
        ) : (
          <>
            <strong>{seconds}</strong>
            <span>秒后自动播放</span>
          </>
        )}
      </p>
      <div className="library-next-book-actions">
        <button type="button" onClick={cancel} autoFocus>取消连播</button>
        <button type="button" className="library-next-book-play" onClick={complete}>立即播放</button>
      </div>
    </dialog>
  );
}
