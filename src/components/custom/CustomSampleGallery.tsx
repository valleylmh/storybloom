"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BookPreview from "@/components/book/BookPreview";
import { CUSTOM_BOOKS, type CustomBook } from "@/lib/custom-books";
import type { GenerateResponse } from "@/types";

type CustomSample = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  book: CustomBook;
};

const customSamples: CustomSample[] = CUSTOM_BOOKS.map((book) => ({
  id: book.customMeta.id,
  title: book.customMeta.title,
  subtitle: book.customMeta.subtitle,
  meta: `${book.customMeta.scenarioLabel} · ${book.customMeta.ageLabel}`,
  book,
}));

export default function CustomSampleGallery() {
  const [activeSample, setActiveSample] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    if (!activeSample) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveSample(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSample]);

  const sampleModal =
    activeSample && typeof document !== "undefined"
      ? createPortal(
        <div
          className="sample-modal-backdrop"
          role="presentation"
          onClick={() => setActiveSample(null)}
        >
          <div
            className="sample-modal"
            role="dialog"
            aria-modal="true"
            aria-label={activeSample.coverTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <BookPreview
              result={activeSample}
              variant="custom"
              backLabel="返回定制案例"
              onBack={() => setActiveSample(null)}
            />
          </div>
        </div>,
        document.body,
      )
      : null;

  return (
    <>
      <div className="custom-sample-grid">
        {customSamples.map((sample) => {
          return (
            <button
              key={sample.id}
              type="button"
              className="custom-sample"
              aria-label={`阅读${sample.title}完整定制案例`}
              onClick={() => setActiveSample(sample.book)}
            >
              <img
                src={sample.book.customMeta.coverImage}
                alt={`${sample.title}封面`}
              />
              <span className="custom-sample-title">{sample.title}</span>
              <span className="custom-sample-subtitle">{sample.subtitle}</span>
              <span className="custom-sample-meta">{sample.meta}</span>
              <span className="custom-sample-open">查看完整案例</span>
            </button>
          );
        })}
      </div>

      {sampleModal}
    </>
  );
}
