import Link from "next/link";
import type { PublicDailyInspiration } from "@/lib/inspiration/types";
import styles from "./TodayInspirationCard.module.css";

export interface TodayInspirationCardProps {
  inspiration: PublicDailyInspiration;
  variant?: "full" | "compact";
  className?: string;
}

function formatIssueDate(issueDate: string) {
  return new Date(`${issueDate}T12:00:00Z`).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function TodayInspirationCard({
  inspiration,
  variant = "full",
  className = "",
}: TodayInspirationCardProps) {
  const compact = variant === "compact";
  const titleId = `daily-inspiration-${inspiration.id}`;
  const createHref = `/?mode=minimal&idea=${encodeURIComponent(
    inspiration.storyPromptZh,
  )}`;

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : styles.full} ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.meta}>
          <span className={styles.badge}>今日灵感</span>
          <time dateTime={inspiration.issueDate}>
            {formatIssueDate(inspiration.issueDate)}
          </time>
        </div>
        <p className={styles.theme}>{inspiration.theme}</p>
        <h2 id={titleId}>{inspiration.titleZh}</h2>
        <p className={styles.englishTitle} lang="en">
          {inspiration.titleEn}
        </p>
      </header>

      <div className={styles.opening}>
        <p>{inspiration.openingZh}</p>
        {!compact ? <p lang="en">{inspiration.openingEn}</p> : null}
      </div>

      {!compact ? (
        <section className={styles.questions} aria-labelledby={`${titleId}-questions`}>
          <div className={styles.questionHeading}>
            <span aria-hidden="true">✦</span>
            <div>
              <h3 id={`${titleId}-questions`}>今天可以和孩子聊聊</h3>
              <p lang="en">Talk about it together</p>
            </div>
          </div>
          <div className={styles.questionColumns}>
            <ol>
              {inspiration.questionsZh.map((question, index) => (
                <li key={`${index}-${question}`}>{question}</li>
              ))}
            </ol>
            <ol lang="en">
              {inspiration.questionsEn.map((question, index) => (
                <li key={`${index}-${question}`}>{question}</li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <p>{compact ? "把今天的主题写成你们自己的故事。" : "灵感已经准备好，主角和细节仍由你来决定。"}</p>
        <Link className={styles.action} href={createHref}>
          用这个灵感创作 <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </article>
  );
}
