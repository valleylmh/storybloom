"use client";

import Script from "next/script";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferChildNameFromStoryIdea } from "@/lib/story-input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AppLocale = "zh" | "en";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface Props {
  locale: AppLocale;
  freeGenerationLimit: number;
  remainingFreeGenerations: number;
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void;
}

type FamilyChoice = {
  id: string;
  display_name: string;
  relationship: string;
  source_photo_path: string | null;
  canonical_photo_path: string | null;
  status: string;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const DAILY_IDEA_QUERY_KEY = "idea";

const COPY = {
  zh: {
    prompts: [
      "一句话，一个绘本",
      "一天，一个绘本",
      "一个场景，一个绘本",
      "一个名字，一场冒险",
      "一件小事，一份童年纪念",
    ],
    title: "今天，想讲什么故事？",
    placeholder: "例如：小满第一次独自睡觉，月亮悄悄来陪她",
    action: "生成绘本",
    generating: "正在种下故事…",
    hint: (remaining: number, limit: number) => `今日剩余 ${remaining} / ${limit} 本`,
    empty: "先写下一句话",
    verify: "完成人机验证后即可生成",
    emailPlaceholder: "你的邮箱",
    subscribe: "订阅每日绘本灵感",
    subscribeShort: "每日灵感",
    subscribing: "正在发送确认邮件…",
    subscribed: "确认邮件已发送，请到邮箱完成订阅。",
    alreadySubscribed: "这个邮箱已经订阅。",
    subscribeError: "暂时无法订阅，请稍后再试。",
    privacy: "仅发送绘本灵感与重要更新，可随时退订。",
    familyTitle: "这次谁来当主角？",
    familyTool: "故事主角",
    familyEmpty: "添加孩子和家人的形象，让故事真正属于你们",
    familyManage: "管理家庭角色",
    familySelected: (count: number) => `已选择 ${count} 位角色`,
  },
  en: {
    prompts: [
      "One sentence, one storybook",
      "One day, one storybook",
      "One moment, one storybook",
      "One name, one adventure",
      "One little memory, kept forever",
    ],
    title: "What story shall we tell today?",
    placeholder: "Example: Emma sleeps alone for the first time, and the moon stays nearby",
    action: "Create storybook",
    generating: "Growing your story…",
    hint: (remaining: number, limit: number) => `${remaining} / ${limit} books left today`,
    empty: "Write one sentence first",
    verify: "Complete verification to generate",
    emailPlaceholder: "Your email",
    subscribe: "Get a daily story idea",
    subscribeShort: "Daily ideas",
    subscribing: "Sending confirmation…",
    subscribed: "Confirmation sent. Check your inbox to finish subscribing.",
    alreadySubscribed: "This email is already subscribed.",
    subscribeError: "Subscription is temporarily unavailable.",
    privacy: "Only thoughtful story ideas and important updates. Unsubscribe anytime.",
    familyTitle: "Who is in this story?",
    familyTool: "Story characters",
    familyEmpty: "Add family characters to make every story truly yours",
    familyManage: "Manage family characters",
    familySelected: (count: number) => `${count} characters selected`,
  },
} as const;

export default function MinimalStoryEntry({
  locale,
  freeGenerationLimit,
  remainingFreeGenerations,
  onSubmit,
}: Props) {
  const text = COPY[locale];
  const [promptIndex, setPromptIndex] = useState(0);
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "idle" | "loading" | "sent" | "confirmed" | "error"
  >("idle");
  const [familyChoices, setFamilyChoices] = useState<FamilyChoice[]>([]);
  const [familyUrls, setFamilyUrls] = useState<Record<string, string>>({});
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>([]);
  const [familyAccessToken, setFamilyAccessToken] = useState("");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPromptIndex((current) => (current + 1) % text.prompts.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [text.prompts.length]);

  useEffect(() => {
    setPromptIndex(0);
  }, [locale]);

  useEffect(() => {
    const sharedIdea = new URL(window.location.href).searchParams
      .get(DAILY_IDEA_QUERY_KEY)
      ?.trim();
    if (sharedIdea) {
      setIdea(sharedIdea.slice(0, 100));
    }
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setTurnstileEnabled(false);
      return;
    }
    setTurnstileEnabled(true);
  }, []);

  useEffect(() => {
    if (turnstileEnabled && window.turnstile) {
      setTurnstileLoaded(true);
    }
  }, [turnstileEnabled]);

  useEffect(() => {
    if (
      !turnstileEnabled ||
      !turnstileLoaded ||
      !window.turnstile ||
      !turnstileContainerRef.current ||
      widgetIdRef.current
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: setTurnstileToken,
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileEnabled, turnstileLoaded]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function loadFamily(client: SupabaseClient) {
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (!active) return;
      setFamilyAccessToken(session?.access_token || "");
      if (!session) {
        setFamilyChoices([]);
        setSelectedFamilyIds([]);
        return;
      }

      const { data } = await client
        .from("family_characters")
        .select(
          "id,display_name,relationship,source_photo_path,canonical_photo_path,status"
        )
        .eq("user_id", session.user.id)
        .not("source_photo_path", "is", null)
        .order("sort_order");
      if (!active) return;
      const choices = (data || []) as FamilyChoice[];
      setFamilyChoices(choices);

      const paths = choices
        .map((choice) => choice.canonical_photo_path || choice.source_photo_path)
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        const { data: signed } = await client.storage
          .from("family-photos")
          .createSignedUrls(paths, 3600);
        if (active) {
          const next: Record<string, string> = {};
          signed?.forEach((item, index) => {
            if (item.signedUrl) next[paths[index]] = item.signedUrl;
          });
          setFamilyUrls(next);
        }
      }
    }

    try {
      const client = getSupabaseBrowserClient();
      void loadFamily(client);
      const { data } = client.auth.onAuthStateChange(() => void loadFamily(client));
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      setFamilyChoices([]);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const storyIdea = idea.trim();
    if (!storyIdea) {
      setMessage(text.empty);
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setMessage(text.verify);
      return;
    }
    if (remainingFreeGenerations <= 0) {
      return;
    }

    setMessage(null);
    setSubmitting(true);
    try {
      await onSubmit({
        childName:
          familyChoices.find(
            (choice) =>
              selectedFamilyIds.includes(choice.id) && choice.relationship === "孩子"
          )?.display_name || inferChildNameFromStoryIdea(storyIdea, locale),
        ageGroup: "4-5",
        theme: "custom",
        customTheme: storyIdea,
        style: "fairytale",
        language: locale === "zh" ? "zh-en" : "en-zh",
        familyCharacterIds:
          selectedFamilyIds.length > 0 ? selectedFamilyIds : undefined,
        supabaseAccessToken: familyAccessToken || undefined,
        turnstileToken: turnstileEnabled ? turnstileToken : undefined,
      });
    } finally {
      setSubmitting(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken("");
      }
    }
  }

  async function handleSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }

    setSubscriptionStatus("loading");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          locale: locale === "zh" ? "zh-CN" : "en",
          source: "minimal-home",
          marketingConsent: true,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { status?: string };
      if (!response.ok) {
        throw new Error("subscribe_failed");
      }
      setSubscriptionStatus(data.status === "confirmed" ? "confirmed" : "sent");
    } catch {
      setSubscriptionStatus("error");
    }
  }

  const subscriptionMessage =
    subscriptionStatus === "sent"
      ? text.subscribed
      : subscriptionStatus === "confirmed"
        ? text.alreadySubscribed
        : subscriptionStatus === "error"
          ? text.subscribeError
          : null;

  return (
    <section className="minimal-entry" aria-labelledby="minimal-entry-title">
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileLoaded(true)}
          onReady={() => setTurnstileLoaded(true)}
        />
      ) : null}

      <div className="minimal-brand-row">
        <span className="minimal-brand-seed" aria-hidden="true">✦</span>
        <span>StoryBloom</span>
      </div>

      <div className="rolling-prompt" aria-live="polite">
        <span key={`${locale}-${promptIndex}`}>{text.prompts[promptIndex]}</span>
      </div>
      <h1 id="minimal-entry-title">{text.title}</h1>

      <form className="story-search" onSubmit={handleGenerate}>
        <span className="story-search-icon" aria-hidden="true">⌁</span>
        <input
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder={text.placeholder}
          maxLength={100}
          aria-label={text.title}
          autoFocus
        />
        <button
          type="submit"
          disabled={submitting || remainingFreeGenerations <= 0}
          aria-label={text.action}
        >
          {submitting ? <span className="story-search-loader" /> : <span aria-hidden="true">→</span>}
          <span className="story-search-action-label">
            {submitting ? text.generating : text.action}
          </span>
        </button>
      </form>

      {message ? <p className="minimal-entry-message" role="alert">{message}</p> : null}

      <div className="minimal-tools">
        <details className="minimal-tool minimal-family-picker" name="minimal-tools">
          <summary>
            {text.familyTool}
            {selectedFamilyIds.length > 0 ? <em>{selectedFamilyIds.length}</em> : null}
          </summary>
          <div className="minimal-tool-panel minimal-family-panel">
            <div className="minimal-family-copy">
              <strong>{text.familyTitle}</strong>
              <span>
                {selectedFamilyIds.length > 0
                  ? text.familySelected(selectedFamilyIds.length)
                  : text.familyEmpty}
              </span>
            </div>
            <Link href="/family" className="minimal-family-manage">
              {familyChoices.length > 0 ? text.familyManage : `＋ ${text.familyManage}`}
            </Link>
            {familyChoices.length > 0 ? (
              <div className="minimal-family-choices">
                {familyChoices.map((choice) => {
                  const path = choice.canonical_photo_path || choice.source_photo_path;
                  const selected = selectedFamilyIds.includes(choice.id);
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={selected ? "selected" : ""}
                      onClick={() =>
                        setSelectedFamilyIds((current) =>
                          current.includes(choice.id)
                            ? current.filter((id) => id !== choice.id)
                            : current.length < 4
                              ? [...current, choice.id]
                              : current
                        )
                      }
                    >
                      {path && familyUrls[path] ? (
                        <img src={familyUrls[path]} alt="" />
                      ) : (
                        <span>{choice.display_name.slice(0, 1)}</span>
                      )}
                      <em>{choice.display_name}</em>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </details>

        <span className="minimal-tools-separator" aria-hidden="true" />
        <p className="minimal-free-note">
          {text.hint(remainingFreeGenerations, freeGenerationLimit)}
        </p>
        <span className="minimal-tools-separator" aria-hidden="true" />

        <details className="minimal-tool minimal-subscribe-tool" name="minimal-tools">
          <summary>{text.subscribeShort}</summary>
          <div className="minimal-tool-panel minimal-subscribe-panel">
            <form className="minimal-subscribe" onSubmit={handleSubscribe}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={text.emailPlaceholder}
                required
                maxLength={254}
                aria-label={text.emailPlaceholder}
              />
              <button type="submit" disabled={subscriptionStatus === "loading"}>
                {subscriptionStatus === "loading" ? text.subscribing : text.subscribe}
              </button>
            </form>
            <p className="minimal-subscribe-note">{subscriptionMessage || text.privacy}</p>
          </div>
        </details>
      </div>

      {turnstileEnabled ? (
        <div className={`minimal-turnstile-wrap${turnstileToken ? " verified" : ""}`}>
          <div className="minimal-turnstile" ref={turnstileContainerRef} />
          {turnstileToken ? (
            <span className="minimal-turnstile-ok">
              <span aria-hidden="true">✓</span>
              {locale === "zh" ? "已通过安全验证" : "Security check passed"}
            </span>
          ) : null}
        </div>
      ) : null}

    </section>
  );
}
