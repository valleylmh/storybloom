"use client";

import Script from "next/script";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeStoryProtagonist,
  matchStoryProtagonist,
  normalizeCharacterName,
} from "@/lib/story-input";
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
  kind: "person" | "pet";
  description: string | null;
  source_photo_path: string | null;
  canonical_photo_path: string | null;
  status: string;
  sort_order: number;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const DAILY_IDEA_QUERY_KEY = "idea";
const PENDING_IDENTITY_KEY = "storybloom:minimal-identity-draft";

async function cleanFamilyPhoto(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  ) {
    throw new Error("请选择 8MB 内的 JPG、PNG 或 WebP 图片");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("照片处理失败"))),
      "image/webp",
      0.88,
    ),
  );
}

async function fetchFamilyChoices(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("family_characters")
    .select(
      "id,display_name,relationship,kind,description,source_photo_path,canonical_photo_path,status,sort_order",
    )
    .eq("user_id", userId)
    .order("sort_order");
  if (error) throw error;
  const choices = (data || []) as FamilyChoice[];
  const paths = choices
    .map((choice) => choice.canonical_photo_path || choice.source_photo_path)
    .filter(Boolean) as string[];
  const urls: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await client.storage
      .from("family-photos")
      .createSignedUrls(paths, 3600);
    signed?.forEach((item, index) => {
      if (item.signedUrl) urls[paths[index]] = item.signedUrl;
    });
  }
  return { choices, urls };
}

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
    confirmTitle: "确认故事主角",
    confirmHint: "正文会继续用“我”来讲，姓名只用于标题和人物形象。",
    nameLabel: "人物名称",
    relationLabel: "这是",
    continueOnce: "仅本次使用并继续",
    saveCharacter: "保存这个名字，下次自动匹配",
    useCharacter: "使用这个角色",
    useMe: "不指定姓名，继续用“我”",
    photoTitle: "添加参考照片（可选）",
    cartoonizePerson: "将照片转换成统一的卡通绘本形象",
    cartoonizePet: "将照片转换成统一的卡通拟人形象",
    loginHint: "登录后可以保存姓名、私密照片和绘本形象。",
    loginAction: "发送登录链接",
    previewTitle: "确认绘本形象",
    previewUse: "使用这个形象生成绘本",
    previewRetry: "重新生成形象",
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
    confirmTitle: "Confirm the main character",
    confirmHint: "The story still uses I/me; the name is for the title and visual identity.",
    nameLabel: "Character name",
    relationLabel: "Relationship",
    continueOnce: "Use once and continue",
    saveCharacter: "Save this name for next time",
    useCharacter: "Use this character",
    useMe: "Continue as “I” without a name",
    photoTitle: "Add a reference photo (optional)",
    cartoonizePerson: "Turn the photo into a consistent storybook character",
    cartoonizePet: "Turn the photo into a consistent anthropomorphic character",
    loginHint: "Sign in to save names, private photos, and character artwork.",
    loginAction: "Send sign-in link",
    previewTitle: "Confirm the storybook character",
    previewUse: "Use this character",
    previewRetry: "Generate another version",
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
  const [familyUserId, setFamilyUserId] = useState("");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityPhase, setIdentityPhase] = useState<
    "confirm" | "generating" | "preview"
  >("confirm");
  const [pendingIdea, setPendingIdea] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityRelationship, setIdentityRelationship] = useState("孩子");
  const [identitySelectedId, setIdentitySelectedId] = useState("");
  const [identityMatchingIds, setIdentityMatchingIds] = useState<string[]>([]);
  const [identitySave, setIdentitySave] = useState(false);
  const [identityFile, setIdentityFile] = useState<File>();
  const [identityCartoonize, setIdentityCartoonize] = useState(true);
  const [identityPreviewChoice, setIdentityPreviewChoice] =
    useState<FamilyChoice | null>(null);
  const [identityPreviewUrl, setIdentityPreviewUrl] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityLoginSent, setIdentityLoginSent] = useState(false);

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
      setFamilyUserId(session?.user.id || "");
      if (!session) {
        setFamilyChoices([]);
        setFamilyUrls({});
        setSelectedFamilyIds([]);
        return;
      }
      const family = await fetchFamilyChoices(client, session.user.id);
      if (!active) return;
      setFamilyChoices(family.choices);
      setFamilyUrls(family.urls);
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PENDING_IDENTITY_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        savedAt?: number;
        idea?: string;
        name?: string;
        relationship?: string;
      };
      if (!draft.savedAt || Date.now() - draft.savedAt > 30 * 60 * 1000) {
        window.localStorage.removeItem(PENDING_IDENTITY_KEY);
        return;
      }
      if (draft.idea) {
        setIdea(draft.idea);
        setPendingIdea(draft.idea);
        setIdentityName(draft.name || "");
        setIdentityRelationship(draft.relationship || "孩子");
        setIdentitySave(true);
        setIdentityOpen(true);
      }
    } catch {
      window.localStorage.removeItem(PENDING_IDENTITY_KEY);
    }
  }, []);

  async function refreshFamilyChoices() {
    if (!familyUserId) return familyChoices;
    const client = getSupabaseBrowserClient();
    const family = await fetchFamilyChoices(client, familyUserId);
    setFamilyChoices(family.choices);
    setFamilyUrls(family.urls);
    return family.choices;
  }

  async function ensureFamilyProfile(client: SupabaseClient) {
    if (!familyUserId) throw new Error("请先登录后保存家庭角色。");
    const existing = await client
      .from("family_profiles")
      .select("id")
      .eq("user_id", familyUserId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) return existing.data.id as string;
    const created = await client
      .from("family_profiles")
      .upsert(
        {
          user_id: familyUserId,
          display_name: "我的家庭",
          locale: locale === "zh" ? "zh-CN" : "en",
          guardian_consent_at: new Date().toISOString(),
          guardian_consent_version: "2026-07",
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (created.error) throw created.error;
    return created.data.id as string;
  }

  async function saveIdentityCharacter() {
    if (!familyUserId) throw new Error(text.loginHint);
    const client = getSupabaseBrowserClient();
    const existing = familyChoices.find((choice) => choice.id === identitySelectedId);
    const profileId = await ensureFamilyProfile(client);
    const id = existing?.id || crypto.randomUUID();
    let sourcePath = existing?.source_photo_path || null;
    if (identityFile && identityCartoonize) {
      const photo = await cleanFamilyPhoto(identityFile);
      sourcePath = `${familyUserId}/${id}/source.webp`;
      const { error } = await client.storage
        .from("family-photos")
        .upload(sourcePath, photo, { contentType: "image/webp", upsert: true });
      if (error) throw error;
    }
    const payload = {
      id,
      profile_id: profileId,
      user_id: familyUserId,
      display_name: identityName.trim(),
      relationship: identityRelationship,
      kind: identityRelationship === "宠物" ? "pet" : "person",
      description: existing?.description || "",
      source_photo_path: sourcePath,
      canonical_photo_path: identityFile ? null : existing?.canonical_photo_path || null,
      status: identityFile
        ? "source_uploaded"
        : existing?.canonical_photo_path
          ? "ready"
          : sourcePath
            ? "source_uploaded"
            : existing?.status || "draft",
      sort_order: existing?.sort_order ?? familyChoices.length,
    };
    const { error } = await client.from("family_characters").upsert(payload);
    if (error) throw error;
    const choices = await refreshFamilyChoices();
    return choices.find((choice) => choice.id === id) || ({ ...payload } as FamilyChoice);
  }

  async function generateCanonicalPreview(choice: FamilyChoice) {
    setIdentityPhase("generating");
    setIdentityError("");
    const response = await fetch(`/api/family/characters/${choice.id}/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${familyAccessToken}` },
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(body.error || "绘本形象生成失败");
    const choices = await refreshFamilyChoices();
    const refreshed = choices.find((item) => item.id === choice.id);
    if (!refreshed?.canonical_photo_path) {
      throw new Error("绘本形象已经生成，但暂时无法加载预览。");
    }
    const client = getSupabaseBrowserClient();
    const { data } = await client.storage
      .from("family-photos")
      .createSignedUrl(refreshed.canonical_photo_path, 3600);
    if (!data?.signedUrl) throw new Error("绘本形象预览加载失败。");
    setIdentityPreviewChoice(refreshed);
    setIdentityPreviewUrl(`${data.signedUrl}#${Date.now()}`);
    setIdentityPhase("preview");
  }

  async function submitStory(
    storyIdea: string,
    childName: string,
    protagonist?: FamilyChoice,
  ) {
    if (turnstileEnabled && !turnstileToken) {
      setIdentityError(
        locale === "zh"
          ? "登录后请先关闭弹窗完成安全验证，再重新点击生成。人物信息已经保留。"
          : "Close this dialog, complete the security check, then create again. Your character details are saved.",
      );
      return;
    }
    const protagonistId = protagonist?.id;
    const nextFamilyIds = protagonistId
      ? [protagonistId, ...selectedFamilyIds.filter((id) => id !== protagonistId)].slice(0, 4)
      : selectedFamilyIds.filter((id) => id !== identitySelectedId);
    setSubmitting(true);
    setMessage(null);
    try {
      await onSubmit({
        childName: childName.trim() || (locale === "zh" ? "我" : "I"),
        narrativePerspective: "first-person",
        protagonistFamilyCharacterId: protagonistId || undefined,
        ageGroup: "4-5",
        theme: "custom",
        customTheme: storyIdea,
        style: "fairytale",
        language: locale === "zh" ? "zh-en" : "en-zh",
        familyCharacterIds: nextFamilyIds.length > 0 ? nextFamilyIds : undefined,
        supabaseAccessToken: familyAccessToken || undefined,
        turnstileToken: turnstileEnabled ? turnstileToken : undefined,
      });
      setIdentityOpen(false);
      setIdentityPhase("confirm");
      window.localStorage.removeItem(PENDING_IDENTITY_KEY);
    } finally {
      setSubmitting(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken("");
      }
    }
  }

  function openIdentityConfirmation(
    storyIdea: string,
    candidateName: string | null,
    matchingCharacterIds: string[],
  ) {
    setPendingIdea(storyIdea);
    setIdentityName(candidateName || "");
    setIdentityMatchingIds(matchingCharacterIds);
    setIdentitySelectedId(matchingCharacterIds.length === 1 ? matchingCharacterIds[0] : "");
    setIdentityRelationship("孩子");
    setIdentitySave(Boolean(familyUserId));
    setIdentityFile(undefined);
    setIdentityCartoonize(true);
    setIdentityPreviewChoice(null);
    setIdentityPreviewUrl("");
    setIdentityError("");
    setIdentityPhase("confirm");
    setIdentityOpen(true);
  }

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
    if (remainingFreeGenerations <= 0) return;

    const explicitlySelectedChild = familyChoices.find(
      (choice) =>
        selectedFamilyIds.includes(choice.id) && choice.relationship === "孩子",
    );
    if (explicitlySelectedChild) {
      if (!explicitlySelectedChild.source_photo_path || explicitlySelectedChild.canonical_photo_path) {
        await submitStory(storyIdea, explicitlySelectedChild.display_name, explicitlySelectedChild);
        return;
      }
      openIdentityConfirmation(
        storyIdea,
        explicitlySelectedChild.display_name,
        [explicitlySelectedChild.id],
      );
      return;
    }

    const analysis = analyzeStoryProtagonist(storyIdea, locale);
    const match = matchStoryProtagonist(analysis, familyChoices);
    if (match.status === "matched") {
      const choice = familyChoices.find((item) => item.id === match.characterId)!;
      if (!choice.source_photo_path || choice.canonical_photo_path) {
        await submitStory(storyIdea, choice.display_name, choice);
        return;
      }
      openIdentityConfirmation(storyIdea, choice.display_name, [choice.id]);
      return;
    }
    openIdentityConfirmation(storyIdea, analysis.candidateName, match.matchingCharacterIds);
  }

  async function handleIdentityContinue() {
    setIdentityError("");
    const trimmedName = identityName.trim();
    const selected = familyChoices.find((choice) => choice.id === identitySelectedId);
    if (!trimmedName && !selected) {
      await submitStory(pendingIdea, locale === "zh" ? "我" : "I");
      return;
    }
    if (!trimmedName) {
      setIdentityError("请确认人物名称，或选择继续用“我”叙述。");
      return;
    }

    try {
      let choice = selected;
      if ((identitySave || identityFile) && familyUserId) {
        choice = await saveIdentityCharacter();
      }
      const wantsCanonical = identityCartoonize && Boolean(
        identityFile || (choice?.source_photo_path && !choice.canonical_photo_path),
      );
      if (wantsCanonical) {
        if (!choice) throw new Error("请先登录并保存角色，再生成绘本形象。");
        await generateCanonicalPreview(choice);
        return;
      }
      await submitStory(
        pendingIdea,
        trimmedName,
        choice && (!choice.source_photo_path || choice.canonical_photo_path) ? choice : undefined,
      );
    } catch (error) {
      setIdentityPhase("confirm");
      setIdentityError(error instanceof Error ? error.message : "人物保存失败，请稍后重试。");
    }
  }

  async function handleIdentityLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityError("");
    try {
      window.localStorage.setItem(
        PENDING_IDENTITY_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          idea: pendingIdea,
          name: identityName,
          relationship: identityRelationship,
        }),
      );
      const client = getSupabaseBrowserClient();
      const { error } = await client.auth.signInWithOtp({
        email: identityEmail,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) throw error;
      setIdentityLoginSent(true);
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "登录链接发送失败。");
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

      {identityOpen ? (
        <div
          className="minimal-identity-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="minimal-identity-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && identityPhase === "confirm") {
              setIdentityOpen(false);
            }
          }}
        >
          <div className="minimal-identity-dialog">
            {identityPhase !== "generating" ? (
              <button
                type="button"
                className="minimal-identity-close"
                aria-label="关闭"
                onClick={() => setIdentityOpen(false)}
              >
                ×
              </button>
            ) : null}
            {identityPhase === "preview" && identityPreviewChoice ? (
              <>
                <p className="family-kicker">CPA BANANA CHARACTER</p>
                <h2 id="minimal-identity-title">{text.previewTitle}</h2>
                <p>{text.confirmHint}</p>
                <div className="minimal-identity-preview">
                  <img src={identityPreviewUrl} alt={identityPreviewChoice.display_name} />
                </div>
                {identityError ? <p className="minimal-identity-error">{identityError}</p> : null}
                <div className="minimal-identity-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={submitting}
                    onClick={() => {
                      setIdentityError("");
                      void generateCanonicalPreview(identityPreviewChoice).catch((error) => {
                        setIdentityPhase("preview");
                        setIdentityError(
                          error instanceof Error ? error.message : "形象重新生成失败。",
                        );
                      });
                    }}
                  >
                    {text.previewRetry}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={submitting}
                    onClick={() =>
                      void submitStory(
                        pendingIdea,
                        identityPreviewChoice.display_name,
                        identityPreviewChoice,
                      )
                    }
                  >
                    {submitting ? text.generating : text.previewUse}
                  </button>
                </div>
              </>
            ) : identityPhase === "generating" ? (
              <div className="minimal-identity-generating">
                <span className="story-search-loader" />
                <h2 id="minimal-identity-title">
                  {locale === "zh" ? "正在生成统一绘本形象…" : "Creating the storybook character…"}
                </h2>
                <p>{locale === "zh" ? "完成后请确认形象，再开始生成整本。" : "You can review it before creating the book."}</p>
              </div>
            ) : (
              <>
                <p className="family-kicker">STORY PROTAGONIST</p>
                <h2 id="minimal-identity-title">{text.confirmTitle}</h2>
                <p>{text.confirmHint}</p>

                {familyChoices.length > 0 ? (
                  <div className="minimal-identity-existing">
                    {familyChoices.map((choice) => {
                      const path = choice.canonical_photo_path || choice.source_photo_path;
                      const selected = identitySelectedId === choice.id;
                      const suggested = identityMatchingIds.includes(choice.id);
                      return (
                        <button
                          type="button"
                          key={choice.id}
                          className={selected ? "selected" : ""}
                          onClick={() => {
                            setIdentitySelectedId(choice.id);
                            setIdentityName(choice.display_name);
                            setIdentityRelationship(choice.relationship);
                            setIdentitySave(true);
                            setIdentityFile(undefined);
                          }}
                        >
                          {path && familyUrls[path] ? (
                            <img src={familyUrls[path]} alt="" />
                          ) : (
                            <span>{choice.display_name.slice(0, 1)}</span>
                          )}
                          <em>{choice.display_name}</em>
                          {suggested ? <small>{locale === "zh" ? "识别匹配" : "Suggested"}</small> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="minimal-identity-fields">
                  <label>
                    <span>{text.nameLabel}</span>
                    <input
                      maxLength={40}
                      value={identityName}
                      onChange={(event) => {
                        setIdentityName(event.target.value);
                        if (
                          identitySelectedId &&
                          normalizeCharacterName(event.target.value) !==
                            normalizeCharacterName(
                              familyChoices.find((choice) => choice.id === identitySelectedId)
                                ?.display_name || "",
                            )
                        ) {
                          setIdentitySelectedId("");
                        }
                      }}
                      placeholder={locale === "zh" ? "例如：童童" : "Example: Emma"}
                    />
                  </label>
                  <label>
                    <span>{text.relationLabel}</span>
                    <select
                      value={identityRelationship}
                      onChange={(event) => setIdentityRelationship(event.target.value)}
                    >
                      {(locale === "zh"
                        ? ["孩子", "我", "爸爸", "妈妈", "其他家人", "宠物"]
                        : ["Child", "Me", "Parent", "Family", "Pet"]
                      ).map((relation) => <option key={relation}>{relation}</option>)}
                    </select>
                  </label>
                </div>

                {familyUserId ? (
                  <>
                    <label className="minimal-identity-check">
                      <input
                        type="checkbox"
                        checked={identitySave}
                        onChange={(event) => setIdentitySave(event.target.checked)}
                      />
                      <span>{text.saveCharacter}</span>
                    </label>
                    <label className="minimal-identity-upload">
                      <span>{text.photoTitle}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          setIdentityFile(event.target.files?.[0]);
                          if (event.target.files?.[0]) setIdentitySave(true);
                        }}
                      />
                      {identityFile ? <em>{identityFile.name}</em> : null}
                    </label>
                    {(identityFile || familyChoices.find((choice) => choice.id === identitySelectedId)?.source_photo_path) ? (
                      <label className="minimal-identity-check">
                        <input
                          type="checkbox"
                          checked={identityCartoonize}
                          onChange={(event) => setIdentityCartoonize(event.target.checked)}
                        />
                        <span>
                          {identityRelationship === "宠物" || identityRelationship === "Pet"
                            ? text.cartoonizePet
                            : text.cartoonizePerson}
                        </span>
                      </label>
                    ) : null}
                    {identityFile ? (
                      <p className="minimal-identity-consent">
                        {locale === "zh"
                          ? "上传即表示你是照片中的本人或其监护人，并同意照片仅用于生成私密家庭绘本形象。"
                          : "By uploading, you confirm that you are the person shown or their guardian and consent to private storybook generation."}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="minimal-identity-login">
                    <p>{text.loginHint}</p>
                    {identityLoginSent ? (
                      <strong>{locale === "zh" ? "登录链接已发送，请查看邮箱。" : "Sign-in link sent."}</strong>
                    ) : (
                      <form onSubmit={handleIdentityLogin}>
                        <input
                          type="email"
                          required
                          value={identityEmail}
                          onChange={(event) => setIdentityEmail(event.target.value)}
                          placeholder={text.emailPlaceholder}
                        />
                        <button type="submit">{text.loginAction}</button>
                      </form>
                    )}
                  </div>
                )}

                {identityError ? <p className="minimal-identity-error">{identityError}</p> : null}
                <div className="minimal-identity-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={submitting}
                    onClick={() => void submitStory(pendingIdea, locale === "zh" ? "我" : "I")}
                  >
                    {text.useMe}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={submitting}
                    onClick={() => void handleIdentityContinue()}
                  >
                    {submitting ? text.generating : identitySelectedId ? text.useCharacter : text.continueOnce}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

    </section>
  );
}
