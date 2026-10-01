"use client";

import { useEffect, useRef, useState } from "react";
import {
  NEXT_BOOK_COUNTDOWN_SECONDS,
  startNextBookCountdown,
} from "@/lib/reader/continuous-playback";

export default function LibraryNextBookCountdown({
  title,
  onComplete,
  onCancel,
}: {
  title: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(NEXT_BOOK_COUNTDOWN_SECONDS);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  const complete = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    stopRef.current?.();
    onComplete();
  };
  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    stopRef.current?.();
    onCancel();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    settledRef.current = false;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    stopRef.current = startNextBookCountdown(setSeconds, () => {
      if (settledRef.current) return;
      settledRef.current = true;
      onComplete();
    });
    return () => {
      stopRef.current?.();
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [onComplete]);

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
        <strong>{seconds}</strong>
        <span>秒后自动播放</span>
      </p>
      <div className="library-next-book-actions">
        <button type="button" onClick={cancel} autoFocus>取消连播</button>
        <button type="button" className="library-next-book-play" onClick={complete}>立即播放</button>
      </div>
    </dialog>
  );
}
