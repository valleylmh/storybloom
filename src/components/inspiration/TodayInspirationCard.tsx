import type { PublicDailyInspiration } from "@/lib/inspiration/types";
import { storyCreationHref } from "@/lib/story-creation-url";
import styles from "./TodayInspirationCard.module.css";

export interface TodayInspirationCardProps {
  inspiration: PublicDailyInspiration;
  variant?: "full" | "compact";
  className?: string;
  locale?: "zh" | "en";
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
  locale = "zh",
}: TodayInspirationCardProps) {
  const en = locale === "en";
  const compact = variant === "compact";
  const titleId = `daily-inspiration-${inspiration.id}`;
  const createHref = storyCreationHref({
    locale,
    idea: en ? inspiration.storyPromptEn : inspiration.storyPromptZh,
  });

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : styles.full} ${className}`.trim()}
      aria-labelledby={titleId}
      lang={en ? "en" : "zh-CN"}
    >
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.meta}>
          <span className={styles.badge}>{en ? "Story idea" : "每日灵感"}</span>
          <time dateTime={inspiration.issueDate}>
            {en ? inspiration.issueDate : formatIssueDate(inspiration.issueDate)}
          </time>
        </div>
        <p className={styles.theme} lang="zh-CN">{inspiration.theme}</p>
        <h2 id={titleId}>{en ? inspiration.titleEn : inspiration.titleZh}</h2>
        <p className={styles.englishTitle} lang={en ? "zh-CN" : "en"}>
          {en ? inspiration.titleZh : inspiration.titleEn}
        </p>
      </header>

      <div className={styles.opening}>
        <p>{en ? inspiration.openingEn : inspiration.openingZh}</p>
        {!compact ? <p lang={en ? "zh-CN" : "en"}>{en ? inspiration.openingZh : inspiration.openingEn}</p> : null}
      </div>

      {!compact ? (
        <section className={styles.questions} aria-labelledby={`${titleId}-questions`}>
          <div className={styles.questionHeading}>
            <span aria-hidden="true">✦</span>
            <div>
              <h3 id={`${titleId}-questions`}>{en ? "Talk about it together" : "今天可以和孩子聊聊"}</h3>
              <p lang={en ? "zh-CN" : "en"}>{en ? "今天可以和孩子聊聊" : "Talk about it together"}</p>
            </div>
          </div>
          <div className={styles.questionColumns}>
            <ol>
              {(en ? inspiration.questionsEn : inspiration.questionsZh).map((question, index) => (
                <li key={`${index}-${question}`}>{question}</li>
              ))}
            </ol>
            <ol lang={en ? "zh-CN" : "en"}>
              {(en ? inspiration.questionsZh : inspiration.questionsEn).map((question, index) => (
                <li key={`${index}-${question}`}>{question}</li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <p>{en ? "Make this idea your own. You choose the characters and details." : compact ? "把今天的主题写成你们自己的故事。" : "灵感已经准备好，主角和细节仍由你来决定。"}</p>
        <a className={styles.action} href={createHref}>
          {en ? "Create a story from this idea" : "用这个灵感创作"} <span aria-hidden="true">→</span>
        </a>
      </footer>
    </article>
  );
}
