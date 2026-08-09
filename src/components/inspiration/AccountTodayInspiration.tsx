"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicDailyInspiration } from "@/lib/inspiration/types";
import TodayInspirationCard from "./TodayInspirationCard";
import styles from "./TodayInspirationCard.module.css";

function isPublicDailyInspiration(value: unknown): value is PublicDailyInspiration {
  if (!value || typeof value !== "object") return false;
  const inspiration = value as Partial<PublicDailyInspiration>;
  return (
    typeof inspiration.id === "string" &&
    typeof inspiration.issueDate === "string" &&
    typeof inspiration.theme === "string" &&
    typeof inspiration.titleZh === "string" &&
    typeof inspiration.titleEn === "string" &&
    typeof inspiration.openingZh === "string" &&
    typeof inspiration.openingEn === "string" &&
    Array.isArray(inspiration.questionsZh) &&
    inspiration.questionsZh.every((item) => typeof item === "string") &&
    Array.isArray(inspiration.questionsEn) &&
    inspiration.questionsEn.every((item) => typeof item === "string") &&
    typeof inspiration.storyPromptZh === "string" &&
    typeof inspiration.storyPromptEn === "string"
  );
}

export default function AccountTodayInspiration() {
  const [inspiration, setInspiration] = useState<PublicDailyInspiration | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/inspiration/today", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("inspiration_unavailable");
        const payload: unknown = await response.json();
        if (!isPublicDailyInspiration(payload)) {
          throw new Error("invalid_inspiration");
        }
        setInspiration(payload);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(true);
      });

    return () => controller.abort();
  }, []);

  if (inspiration) {
    return <TodayInspirationCard inspiration={inspiration} variant="compact" />;
  }

  return (
    <section className={styles.statusCard} aria-live="polite" aria-busy={!error}>
      <div>
        <h2>今日灵感</h2>
        <p>{error ? "暂时没能读取今日灵感，你仍然可以从一句话开始。" : "正在准备今天的亲子故事灵感…"}</p>
      </div>
      {error ? (
        <Link className={styles.statusLink} href="/?mode=minimal">
          直接开始创作 →
        </Link>
      ) : null}
    </section>
  );
}
