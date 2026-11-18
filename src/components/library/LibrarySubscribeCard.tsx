"use client";

import { useState, type FormEvent } from "react";
import styles from "./LibrarySubscribeCard.module.css";

const COPY = {
  zh: {
    title: "明天还想给孩子讲点新的？",
    lead: "订阅每日绘本灵感：每天一个故事开头和几个亲子提问，发到你的邮箱。",
    placeholder: "你的邮箱",
    action: "订阅每日灵感",
    loading: "正在发送确认邮件…",
    sent: "确认邮件已发送，请到邮箱完成订阅。",
    confirmed: "这个邮箱已经订阅。",
    error: "暂时无法订阅，请稍后再试。",
    note: "仅发送绘本灵感与重要更新，可随时退订。",
  },
  en: {
    title: "Want a new story idea tomorrow?",
    lead: "Get a daily story idea: an opening line and a few questions to ask together, sent to your inbox.",
    placeholder: "Your email",
    action: "Get daily ideas",
    loading: "Sending confirmation…",
    sent: "Confirmation sent. Check your inbox to finish subscribing.",
    confirmed: "This email is already subscribed.",
    error: "Subscription is temporarily unavailable.",
    note: "Only thoughtful story ideas and important updates. Unsubscribe anytime.",
  },
};

export default function LibrarySubscribeCard({ locale = "zh" }: { locale?: "zh" | "en" }) {
  const text = COPY[locale];
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "confirmed" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          locale: locale === "zh" ? "zh-CN" : "en",
          source: "library-book",
          marketingConsent: true,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { status?: string };
      if (!response.ok) throw new Error("subscribe_failed");
      setStatus(data.status === "confirmed" ? "confirmed" : "sent");
    } catch {
      setStatus("error");
    }
  }

  const done = status === "sent" || status === "confirmed";

  return (
    <section className={styles.card} aria-labelledby="library-subscribe-title" lang={locale === "en" ? "en" : "zh-CN"}>
      <h2 id="library-subscribe-title">{text.title}</h2>
      <p>{text.lead}</p>
      {done ? null : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={text.placeholder}
            aria-label={text.placeholder}
            autoComplete="email"
            required
            maxLength={254}
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? text.loading : text.action}
          </button>
        </form>
      )}
      <p className={styles.note} role="status">
        {status === "sent" ? text.sent : status === "confirmed" ? text.confirmed : status === "error" ? text.error : text.note}
      </p>
    </section>
  );
}
