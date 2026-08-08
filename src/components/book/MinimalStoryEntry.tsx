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
import {
  blobToDataUrl,
  imageUrlToDataUrl,
  isSupportedPrivateImage,
  preparePrivateImage,
} from "@/lib/client-images";
import {
  isValidGrowthDate,
  type GrowthRecordDraft,
  type GrowthRecordPhoto,
} from "@/lib/growth-records";
import { useAuth } from "@/hooks/useAuth";
import { recordGuardianConsent } from "@/lib/auth/guardian-consent";
import {
  MAX_FAMILY_CHARACTER_GENERATIONS,
  getRemainingFamilyCharacterGenerations,
  normalizeFamilyCharacterGenerationCount,
} from "@/lib/family-character-generation";
import {
  dedupeFamilyCharacters,
  findReusableFamilyCharacter,
} from "@/lib/family-character-dedupe";

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
  cartoonize: boolean;
  canonical_generation_count: number;
  status: string;
  sort_order: number;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const DAILY_IDEA_QUERY_KEY = "idea";
const PENDING_IDENTITY_KEY = "storybloom:minimal-identity-draft";

async function cleanFamilyPhoto(file: File): Promise<Blob> {
  try {
    return await preparePrivateImage(file);
  } catch {
    throw new Error("请选择 8MB 内的 JPG、PNG 或 WebP 图片");
  }
}

function getLocalDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function isChildRelationship(relationship: string) {
  return relationship === "孩子" || relationship === "Child";
}

function isPetRelationship(relationship: string) {
  return relationship === "宠物" || relationship === "Pet";
}

function getFamilyChoicePhotoPath(choice: FamilyChoice) {
  return choice.cartoonize === false
    ? choice.source_photo_path || choice.canonical_photo_path
    : choice.canonical_photo_path || choice.source_photo_path;
}

async function fetchFamilyChoices(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("family_characters")
    .select(
      "id,display_name,relationship,kind,description,source_photo_path,canonical_photo_path,cartoonize,canonical_generation_count,status,sort_order",
    )
    .eq("user_id", userId)
    .order("sort_order");
  if (error) throw error;
  const choices = dedupeFamilyCharacters((data || []) as FamilyChoice[]);
  const paths = choices
    .map(getFamilyChoicePhotoPath)
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
    confirmHint: "输入姓名后，标题和人物形象会使用这个名字；正文仍以“我”叙述。",
    nameLabel: "主角姓名",
    relationLabel: "角色身份",
    continueOnce: "确认主角并继续",
    saveAndContinue: "保存角色并继续",
    saveCharacter: "保存为家庭角色，下次自动匹配",
    saveCharacterHint: "取消勾选时，姓名只用于这一本绘本。",
    savedCharacter: "已选择保存过的家庭角色",
    useCharacter: "使用这个角色继续",
    useMe: "改用“我”来讲",
    photoTitle: "添加参考照片（可选）",
    photoHint: "JPG / PNG / WebP，最大 8MB",
    photoChoose: "选择照片",
    photoChange: "更换照片",
    cartoonizePerson: "将照片转换成统一的卡通绘本形象",
    cartoonizePet: "将照片转换成统一的卡通拟人形象",
    cartoonizeUsage: (remaining: number) =>
      `每个家庭角色最多生成 ${MAX_FAMILY_CHARACTER_GENERATIONS} 次，还剩 ${remaining} 次`,
    loginHint: "登录后可以保存姓名、私密照片和绘本形象。",
    loginAction: "发送登录链接",
    previewTitle: "确认绘本形象",
    previewUse: "使用这个形象生成绘本",
    previewRetry: "重新生成形象",
    growthTool: "成长记录",
    growthPageTitle: "把今天的小成长，写进故事里",
    growthTitle: "把这件小事放进孩子的成长书架",
    growthHint: "文字、现场照片和生成后的绘本场景会一起保存在本机。",
    growthEnable: "保存为成长记录",
    growthChild: "记录主角",
    growthChildPending: "生成时确认孩子姓名",
    growthPhotos: "成长现场照片",
    growthPhotoHint: "可选，最多 4 张。照片只用于记录，不会发送给模型。",
    growthPhotoAction: "添加照片",
    growthPhotoProcessing: "正在处理照片…",
    growthPhotoInvalid: "请选择 8MB 内的 JPG、PNG 或 WebP 图片，最多 4 张。",
    growthDate: "发生时间",
    growthNote: "家长备注（选填）",
    growthNotePlaceholder: "例如：他收好以后特别骄傲",
    growthPrivacy: "当前版本仅保存在本机，可随时查看、修改或删除。",
    growthLibrary: "查看成长书架",
    growthNameRequired: "保存成长记录前，请确认孩子的姓名。",
    growthChildRequired: "成长记录的主角需要选择为孩子。",
    growthDateRequired: "请选择这件事发生的日期。",
    growthAction: "生成并记录",
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
    confirmHint: "The title and character will use this name; the story itself is still told as “I”.",
    nameLabel: "Main character name",
    relationLabel: "Character role",
    continueOnce: "Confirm and continue",
    saveAndContinue: "Save character and continue",
    saveCharacter: "Save as a family character for next time",
    saveCharacterHint: "Turn this off to use the name for this book only.",
    savedCharacter: "Using a saved family character",
    useCharacter: "Use this character and continue",
    useMe: "Tell it as “I” instead",
    photoTitle: "Add a reference photo (optional)",
    photoHint: "JPG / PNG / WebP, up to 8 MB",
    photoChoose: "Choose photo",
    photoChange: "Change photo",
    cartoonizePerson: "Turn the photo into a consistent storybook character",
    cartoonizePet: "Turn the photo into a consistent anthropomorphic character",
    cartoonizeUsage: (remaining: number) =>
      `Up to ${MAX_FAMILY_CHARACTER_GENERATIONS} generations per character · ${remaining} left`,
    loginHint: "Sign in to save names, private photos, and character artwork.",
    loginAction: "Send sign-in link",
    previewTitle: "Confirm the storybook character",
    previewUse: "Use this character",
    previewRetry: "Generate another version",
    growthTool: "Growth record",
    growthPageTitle: "Turn today's little milestone into a story",
    growthTitle: "Keep this moment in the child's growth shelf",
    growthHint: "The note, photos, and generated storybook scene stay together on this device.",
    growthEnable: "Save as a growth record",
    growthChild: "Child",
    growthChildPending: "Confirm the child's name before generation",
    growthPhotos: "Moment photos",
    growthPhotoHint: "Optional, up to 4. Photos are saved as records and are not sent to the model.",
    growthPhotoAction: "Add photos",
    growthPhotoProcessing: "Processing photos…",
    growthPhotoInvalid: "Choose up to 4 JPG, PNG, or WebP images under 8 MB each.",
    growthDate: "Date",
    growthNote: "Parent note (optional)",
    growthNotePlaceholder: "Example: He was very proud after finishing it",
    growthPrivacy: "This version stays on this device and can be edited or deleted anytime.",
    growthLibrary: "Open growth shelf",
    growthNameRequired: "Confirm the child's name before saving a growth record.",
    growthChildRequired: "Choose a child as the main character for a growth record.",
    growthDateRequired: "Choose the date when this moment happened.",
    growthAction: "Create and save",
  },
} as const;

export default function MinimalStoryEntry({
  locale,
  freeGenerationLimit,
  remainingFreeGenerations,
  onSubmit,
}: Props) {
  const text = COPY[locale];
  const { supabase, session, signInWithMagicLink } = useAuth();
  const familyAccessToken = session?.access_token || "";
  const familyUserId = session?.user.id || "";
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
  const [growthEnabled, setGrowthEnabled] = useState(false);
  const [growthOccurredOn, setGrowthOccurredOn] = useState(getLocalDateValue);
  const [growthNote, setGrowthNote] = useState("");
  const [growthPhotos, setGrowthPhotos] = useState<GrowthRecordPhoto[]>([]);
  const [growthPhotoBusy, setGrowthPhotoBusy] = useState(false);
  const [growthError, setGrowthError] = useState("");
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
  const [identityGuardianConsent, setIdentityGuardianConsent] = useState(false);
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

    if (!supabase || !session) {
      setFamilyChoices([]);
      setFamilyUrls({});
      setSelectedFamilyIds([]);
      return;
    }

    void fetchFamilyChoices(supabase, session.user.id)
      .then((family) => {
        if (!active) return;
        setFamilyChoices(family.choices);
        setFamilyUrls(family.urls);
        const availableIds = new Set(family.choices.map((choice) => choice.id));
        setSelectedFamilyIds((current) =>
          current.filter((id) => availableIds.has(id)),
        );
      })
      .catch(() => {
        if (!active) return;
        setFamilyChoices([]);
        setFamilyUrls({});
      });

    return () => {
      active = false;
    };
  }, [session?.user.id, supabase]);

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
    if (!familyUserId || !supabase) return familyChoices;
    const family = await fetchFamilyChoices(supabase, familyUserId);
    setFamilyChoices(family.choices);
    setFamilyUrls(family.urls);
    const availableIds = new Set(family.choices.map((choice) => choice.id));
    setSelectedFamilyIds((current) =>
      current.filter((id) => availableIds.has(id)),
    );
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
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (created.error) throw created.error;
    return created.data.id as string;
  }

  async function saveIdentityCharacter() {
    if (!familyUserId || !supabase) throw new Error(text.loginHint);
    const client = supabase;
    const existing =
      familyChoices.find((choice) => choice.id === identitySelectedId) ||
      findReusableFamilyCharacter(
        familyChoices,
        identityName,
        identityRelationship,
      );
    const profileId = await ensureFamilyProfile(client);
    const id = existing?.id || crypto.randomUUID();
    const currentGenerationCount = normalizeFamilyCharacterGenerationCount(
      existing?.canonical_generation_count,
    );
    const needsNewCanonical = Boolean(
      identityCartoonize &&
      (identityFile || existing?.source_photo_path) &&
      (identityFile || !existing?.canonical_photo_path),
    );
    if (
      needsNewCanonical &&
      currentGenerationCount >= MAX_FAMILY_CHARACTER_GENERATIONS
    ) {
      throw new Error(
        locale === "zh"
          ? "这个角色已经用完 5 次卡通形象生成机会，请关闭卡通化后使用真实照片。"
          : "This character has used all 5 cartoon generations. Turn off cartoonization to use the real photo.",
      );
    }
    let sourcePath = existing?.source_photo_path || null;
    const uploadsPhoto = Boolean(identityFile);
    const uploadsPersonPhoto = uploadsPhoto && !isPetRelationship(identityRelationship);
    if (uploadsPersonPhoto && !identityGuardianConsent) {
      throw new Error(
        locale === "zh"
          ? "上传人物照片前，请确认你已获得本人或监护人的明确授权。"
          : "Confirm permission from the person shown or their guardian before uploading.",
      );
    }
    if (identityFile) {
      const photo = await cleanFamilyPhoto(identityFile);
      if (uploadsPersonPhoto) {
        await recordGuardianConsent(client, familyUserId);
      }
      sourcePath = `${familyUserId}/${id}/source.webp`;
      const { error } = await client.storage
        .from("family-photos")
        .upload(sourcePath, photo, { contentType: "image/webp", upsert: true });
      if (error) throw error;
    }
    const canonicalPath = uploadsPhoto
      ? null
      : existing?.canonical_photo_path || null;
    const payload = {
      id,
      profile_id: profileId,
      user_id: familyUserId,
      display_name: identityName.trim(),
      relationship: identityRelationship,
      kind: isPetRelationship(identityRelationship) ? "pet" : "person",
      description: existing?.description || "",
      source_photo_path: sourcePath,
      canonical_photo_path: canonicalPath,
      cartoonize: identityCartoonize,
      status: sourcePath
        ? identityCartoonize
          ? canonicalPath
            ? "ready"
            : "source_uploaded"
          : "ready"
        : "draft",
      sort_order: existing?.sort_order ?? familyChoices.length,
    };
    const { error } = await client.from("family_characters").upsert(payload);
    if (error) throw error;
    if (uploadsPhoto && existing?.canonical_photo_path) {
      await client.storage
        .from("family-photos")
        .remove([existing.canonical_photo_path]);
    }
    const choices = await refreshFamilyChoices();
    return choices.find((choice) => choice.id === id) || ({
      ...payload,
      canonical_generation_count:
        existing?.canonical_generation_count || 0,
    } as FamilyChoice);
  }

  async function generateCanonicalPreview(choice: FamilyChoice) {
    if (getRemainingFamilyCharacterGenerations(choice.canonical_generation_count) === 0) {
      throw new Error(
        locale === "zh"
          ? "这个家庭角色已经用完 5 次卡通形象生成机会。"
          : "This family character has used all 5 cartoon generations.",
      );
    }
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
    if (!supabase) throw new Error("账户服务尚未准备好，请稍后再试。");
    const { data } = await supabase.storage
      .from("family-photos")
      .createSignedUrl(refreshed.canonical_photo_path, 3600);
    if (!data?.signedUrl) throw new Error("绘本形象预览加载失败。");
    setIdentityPreviewChoice(refreshed);
    setIdentityPreviewUrl(`${data.signedUrl}#${Date.now()}`);
    setIdentityPhase("preview");
  }

  async function handleGrowthPhotoFiles(files: File[]) {
    setGrowthError("");
    if (files.length === 0) return;
    if (
      growthPhotos.length + files.length > 4 ||
      files.some((file) => !isSupportedPrivateImage(file))
    ) {
      setGrowthError(text.growthPhotoInvalid);
      return;
    }

    setGrowthPhotoBusy(true);
    try {
      const photos = await Promise.all(
        files.map(async (file) => {
          const blob = await preparePrivateImage(file, {
            maxDimension: 1400,
            quality: 0.84,
          });
          return {
            id: crypto.randomUUID(),
            name: file.name,
            dataUrl: await blobToDataUrl(blob),
          } satisfies GrowthRecordPhoto;
        }),
      );
      setGrowthPhotos((current) => [...current, ...photos].slice(0, 4));
    } catch {
      setGrowthError(text.growthPhotoInvalid);
    } finally {
      setGrowthPhotoBusy(false);
    }
  }

  async function buildGrowthRecordDraft(
    storyIdea: string,
    childName: string,
    protagonist?: FamilyChoice,
  ): Promise<GrowthRecordDraft | undefined> {
    if (!growthEnabled) return undefined;

    const normalizedName = normalizeCharacterName(childName);
    if (!normalizedName || normalizedName === "我" || normalizedName === "i") {
      throw new Error(text.growthNameRequired);
    }
    if (protagonist && !isChildRelationship(protagonist.relationship)) {
      throw new Error(text.growthChildRequired);
    }
    if (!isValidGrowthDate(growthOccurredOn)) {
      throw new Error(text.growthDateRequired);
    }

    const imagePath = protagonist
      ? getFamilyChoicePhotoPath(protagonist)
      : undefined;
    const avatarUrl = imagePath ? familyUrls[imagePath] : identityPreviewUrl || undefined;

    return {
      version: 1,
      childKey: protagonist?.id || `name:${normalizedName}`,
      childName: childName.trim(),
      childCharacterId: protagonist?.id,
      childAvatarDataUrl: await imageUrlToDataUrl(avatarUrl),
      occurredOn: growthOccurredOn,
      note: growthNote.trim(),
      idea: storyIdea,
      photos: growthPhotos,
    };
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
    let growthRecordDraft: GrowthRecordDraft | undefined;
    try {
      growthRecordDraft = await buildGrowthRecordDraft(storyIdea, childName, protagonist);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : text.growthNameRequired;
      setGrowthError(nextMessage);
      if (identityOpen) setIdentityError(nextMessage);
      else setMessage(nextMessage);
      return;
    }
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
        growthRecordDraft,
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
    const matchedChoice =
      matchingCharacterIds.length === 1
        ? familyChoices.find((choice) => choice.id === matchingCharacterIds[0])
        : undefined;
    setPendingIdea(storyIdea);
    setIdentityName(candidateName || "");
    setIdentityMatchingIds(matchingCharacterIds);
    setIdentitySelectedId(matchingCharacterIds.length === 1 ? matchingCharacterIds[0] : "");
    setIdentityRelationship(matchedChoice?.relationship || (locale === "zh" ? "孩子" : "Child"));
    setIdentitySave(Boolean(familyUserId));
    setIdentityFile(undefined);
    setIdentityCartoonize(matchedChoice?.cartoonize ?? true);
    setIdentityGuardianConsent(false);
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
        selectedFamilyIds.includes(choice.id) && isChildRelationship(choice.relationship),
    );
    if (explicitlySelectedChild) {
      if (
        !explicitlySelectedChild.source_photo_path ||
        explicitlySelectedChild.canonical_photo_path ||
        explicitlySelectedChild.cartoonize === false
      ) {
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
      if (
        !choice.source_photo_path ||
        choice.canonical_photo_path ||
        choice.cartoonize === false
      ) {
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
      if (growthEnabled) {
        setIdentityError(text.growthNameRequired);
        return;
      }
      await submitStory(pendingIdea, locale === "zh" ? "我" : "I");
      return;
    }
    if (!trimmedName) {
      setIdentityError("请确认人物名称，或选择继续用“我”叙述。");
      return;
    }
    if (growthEnabled && !isChildRelationship(identityRelationship)) {
      setIdentityError(text.growthChildRequired);
      return;
    }

    try {
      let choice = selected;
      if (
        identityFile &&
        !isPetRelationship(identityRelationship) &&
        !identityGuardianConsent
      ) {
        throw new Error(
          locale === "zh"
            ? "上传人物照片前，请勾选并确认已获得本人或监护人的明确授权。"
            : "Confirm permission from the person shown or their guardian before uploading.",
        );
      }
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
        choice &&
          (!choice.source_photo_path ||
            choice.canonical_photo_path ||
            choice.cartoonize === false)
          ? choice
          : undefined,
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
      await signInWithMagicLink(
        identityEmail,
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
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
  const selectedGrowthChild = familyChoices.find(
    (choice) => selectedFamilyIds.includes(choice.id) && isChildRelationship(choice.relationship),
  );
  const selectedGrowthChildPath = selectedGrowthChild
    ? getFamilyChoicePhotoPath(selectedGrowthChild)
    : null;
  const selectedIdentityChoice = familyChoices.find(
    (choice) => choice.id === identitySelectedId,
  );
  const identityRemainingGenerations = getRemainingFamilyCharacterGenerations(
    selectedIdentityChoice?.canonical_generation_count,
  );
  const analyzedGrowthName = idea.trim()
    ? analyzeStoryProtagonist(idea.trim(), locale).candidateName
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
      <h1 id="minimal-entry-title">
        {growthEnabled ? text.growthPageTitle : text.title}
      </h1>

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
          disabled={submitting || growthPhotoBusy || remainingFreeGenerations <= 0}
          aria-label={growthEnabled ? text.growthAction : text.action}
        >
          {submitting ? <span className="story-search-loader" /> : <span aria-hidden="true">→</span>}
          <span className="story-search-action-label">
            {submitting
              ? text.generating
              : growthEnabled
                ? text.growthAction
                : text.action}
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
                  const path = getFamilyChoicePhotoPath(choice);
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

        <details className="minimal-tool minimal-growth-tool" name="minimal-tools">
          <summary>
            {text.growthTool}
            {growthEnabled ? <em>✓</em> : null}
          </summary>
          <div className="minimal-tool-panel minimal-growth-panel">
            <div className="minimal-growth-heading">
              <div>
                <strong>{text.growthTitle}</strong>
                <span>{text.growthHint}</span>
              </div>
              <label className="minimal-growth-switch">
                <input
                  type="checkbox"
                  checked={growthEnabled}
                  onChange={(event) => {
                    setGrowthEnabled(event.target.checked);
                    setGrowthError("");
                  }}
                />
                <span>{text.growthEnable}</span>
              </label>
            </div>

            {growthEnabled ? (
              <>
                <div className="minimal-growth-child">
                  {selectedGrowthChildPath && familyUrls[selectedGrowthChildPath] ? (
                    <img src={familyUrls[selectedGrowthChildPath]} alt="" />
                  ) : (
                    <span aria-hidden="true">
                      {(selectedGrowthChild?.display_name || analyzedGrowthName || "?").slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <small>{text.growthChild}</small>
                    <strong>
                      {selectedGrowthChild?.display_name ||
                        analyzedGrowthName ||
                        text.growthChildPending}
                    </strong>
                  </div>
                </div>

                <div className="minimal-growth-photo-section">
                  <div className="minimal-growth-photo-copy">
                    <strong>{text.growthPhotos}</strong>
                    <span>{text.growthPhotoHint}</span>
                  </div>
                  <div className="minimal-growth-photo-grid">
                    {growthPhotos.map((photo) => (
                      <div className="minimal-growth-photo-preview" key={photo.id}>
                        <img src={photo.dataUrl} alt={photo.name} />
                        <button
                          type="button"
                          aria-label={locale === "zh" ? `移除 ${photo.name}` : `Remove ${photo.name}`}
                          onClick={() => {
                            setGrowthError("");
                            setGrowthPhotos((current) =>
                              current.filter((item) => item.id !== photo.id),
                            );
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {growthPhotos.length < 4 ? (
                      <label className="minimal-growth-photo-upload">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={growthPhotoBusy}
                          onChange={(event) => {
                            const files = Array.from(event.currentTarget.files || []);
                            event.currentTarget.value = "";
                            void handleGrowthPhotoFiles(files);
                          }}
                        />
                        <span aria-hidden="true">＋</span>
                        <strong>
                          {growthPhotoBusy
                            ? text.growthPhotoProcessing
                            : text.growthPhotoAction}
                        </strong>
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="minimal-growth-fields">
                  <label>
                    <span>{text.growthDate}</span>
                    <input
                      type="date"
                      required
                      value={growthOccurredOn}
                      onChange={(event) => {
                        setGrowthOccurredOn(event.target.value);
                        setGrowthError("");
                      }}
                    />
                  </label>
                  <label>
                    <span>{text.growthNote}</span>
                    <input
                      maxLength={200}
                      value={growthNote}
                      onChange={(event) => setGrowthNote(event.target.value)}
                      placeholder={text.growthNotePlaceholder}
                    />
                  </label>
                </div>

                {growthError ? (
                  <p className="minimal-growth-error" role="alert">{growthError}</p>
                ) : null}
                <div className="minimal-growth-footer">
                  <span>{text.growthPrivacy}</span>
                  <Link href="/growth">{text.growthLibrary}</Link>
                </div>
              </>
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
                <p className="minimal-identity-generation-usage">
                  {text.cartoonizeUsage(
                    getRemainingFamilyCharacterGenerations(
                      identityPreviewChoice.canonical_generation_count,
                    ),
                  )}
                </p>
                {identityError ? <p className="minimal-identity-error">{identityError}</p> : null}
                <div className="minimal-identity-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={
                      submitting ||
                      getRemainingFamilyCharacterGenerations(
                        identityPreviewChoice.canonical_generation_count,
                      ) === 0
                    }
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
                    {getRemainingFamilyCharacterGenerations(
                      identityPreviewChoice.canonical_generation_count,
                    ) === 0
                      ? locale === "zh" ? "已达 5 次上限" : "5 generation limit reached"
                      : text.previewRetry}
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
                      const path = getFamilyChoicePhotoPath(choice);
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
                            setIdentityCartoonize(choice.cartoonize ?? true);
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
                    {identitySelectedId ? (
                      <div className="minimal-identity-saved-status">
                        <span aria-hidden="true">✓</span>
                        <strong>{text.savedCharacter}</strong>
                      </div>
                    ) : (
                      <label className="minimal-identity-check minimal-identity-save-check">
                        <input
                          type="checkbox"
                          checked={identitySave}
                          onChange={(event) => setIdentitySave(event.target.checked)}
                        />
                        <span>
                          <strong>{text.saveCharacter}</strong>
                          <small>{text.saveCharacterHint}</small>
                        </span>
                      </label>
                    )}
                    <label className="minimal-identity-upload">
                      <input
                        className="minimal-identity-file-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          setIdentityFile(event.target.files?.[0]);
                          setIdentityGuardianConsent(false);
                          if (event.target.files?.[0]) setIdentitySave(true);
                        }}
                      />
                      <span className="minimal-identity-upload-icon" aria-hidden="true">＋</span>
                      <span className="minimal-identity-upload-copy">
                        <strong>{text.photoTitle}</strong>
                        <small>{identityFile?.name || text.photoHint}</small>
                      </span>
                      <span className="minimal-identity-upload-action">
                        {identityFile ? text.photoChange : text.photoChoose}
                      </span>
                    </label>
                    {(identityFile || familyChoices.find((choice) => choice.id === identitySelectedId)?.source_photo_path) ? (
                      <label className="minimal-identity-check">
                        <input
                          type="checkbox"
                          checked={identityCartoonize}
                          onChange={(event) => setIdentityCartoonize(event.target.checked)}
                        />
                        <span>
                          <strong>
                            {identityRelationship === "宠物" || identityRelationship === "Pet"
                              ? text.cartoonizePet
                              : text.cartoonizePerson}
                          </strong>
                          <small>{text.cartoonizeUsage(identityRemainingGenerations)}</small>
                        </span>
                      </label>
                    ) : null}
                    {identityFile && !isPetRelationship(identityRelationship) ? (
                      <label className="minimal-identity-check minimal-identity-consent-check">
                        <input
                          type="checkbox"
                          checked={identityGuardianConsent}
                          onChange={(event) => setIdentityGuardianConsent(event.target.checked)}
                        />
                        <span>
                          {locale === "zh"
                            ? "我确认自己是照片中的本人或其监护人，已获得明确授权，并同意将照片用于生成私密家庭绘本形象。"
                            : "I confirm I am the person shown or their guardian, have explicit permission, and consent to private storybook generation."}
                        </span>
                      </label>
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
                    onClick={() => {
                      if (growthEnabled) {
                        setIdentityError(text.growthNameRequired);
                        return;
                      }
                      void submitStory(pendingIdea, locale === "zh" ? "我" : "I");
                    }}
                  >
                    {text.useMe}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={submitting || (!identityName.trim() && !identitySelectedId)}
                    onClick={() => void handleIdentityContinue()}
                  >
                    {submitting
                      ? text.generating
                      : identitySelectedId
                        ? text.useCharacter
                        : identitySave && familyUserId
                          ? text.saveAndContinue
                          : text.continueOnce}
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
