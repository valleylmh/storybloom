"use client";

import { useEffect, useRef, useState } from "react";
import type { StoryPage } from "@/types";
import IntegratedPaperBook from "./IntegratedPaperBook";

export default function PaperBookPreview({ title, subtitle, pages }: {
  title: string; subtitle: string; pages: StoryPage[];
}) {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => { setOpened(true); setOpening(false); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600);
    return () => window.clearTimeout(timer);
  }, [opening]);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    if (!interacted.current) return;
    (opened ? closeButton : openButton).current?.focus({ preventScroll: true });
  }, [opened]);

  return (
    <section className={`paper-edition ${opened ? "paper-edition-open" : ""}`} aria-label={`${title}立体绘本`}>
      {!opened ? (
        <div className="paper-cover-stage">
          <p className="paper-eyebrow">STORYBLOOM · 珍藏故事</p>
          <button ref={openButton} className={`paper-cover ${opening ? "paper-cover-opening" : ""}`} disabled={opening} aria-label={`打开绘本：${title}`} onClick={() => { interacted.current = true; setOpening(true); }}>
            <span className="paper-cover-art">{pages[0]?.imageUrl ? <img src={pages[0].imageUrl} alt="" /> : null}</span>
            <span className="paper-cover-type"><span>中英双语 · 成语故事</span><strong>{title}</strong><span>{subtitle}</span></span>
            <span className="paper-cover-footer">STORYBLOOM<span>打开绘本 ↗</span></span>
          </button>
          <p className="paper-cover-caption">把时光放慢，翻开一个故事。</p>
          <span className="paper-cover-meta">{pages.length} 页插画 · 适合亲子共读</span>
        </div>
      ) : (
        <div className="paper-open-content">
          <div className="paper-edition-heading"><div><span className="paper-eyebrow">STORYBLOOM</span><h1>{title}</h1></div><button ref={closeButton} className="paper-close" onClick={() => setOpened(false)}>合上绘本</button></div>
          <IntegratedPaperBook title={title} pages={pages} />
        </div>
      )}
    </section>
  );
}
