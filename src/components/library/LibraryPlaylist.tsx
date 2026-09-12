"use client";

import Link from "next/link";
import { ListBullets } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

export default function LibraryPlaylist({ books, currentId }: {
  books: Array<{ id: string; title: string; href: string; cover?: string }>;
  currentId: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details ref={ref} className="library-book-playlist" onKeyDown={(event) => {
      if (event.key === "Escape" && ref.current?.open) {
        event.stopPropagation();
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }}>
      <summary className="library-reader-icon-btn" aria-label="播放列表" title="播放列表">
        <ListBullets aria-hidden="true" />
      </summary>
      <nav aria-label="同系列绘本播放列表">
        <p>同系列 · {books.length} 本</p>
        <ol>
          {books.map((item) => (
            <li key={item.id}>
              <Link href={item.href} prefetch={false} aria-current={item.id === currentId ? "page" : undefined} onClick={() => { if (ref.current) ref.current.open = false; }}>
                <span className="library-playlist-cover" aria-hidden="true">
                  <span>{item.title.slice(0, 1)}</span>
                  {item.cover ? <img src={item.cover} alt="" width={64} height={64} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
                </span>
                <span className="library-playlist-copy">
                  <span>{item.title}</span>
                  {item.id === currentId ? <small>当前绘本</small> : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
