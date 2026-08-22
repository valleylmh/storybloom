"use client";

import Script from "next/script";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DeviceMobile,
  Gift,
  HeartStraight,
  MagicWand,
  Plant,
  ShieldCheck,
} from "@phosphor-icons/react";
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
  getGrowthAssetMetadataFromBlob,
  normalizeAndDedupeGrowthAssets,
  sumGrowthAssetDataUrlBytes,
} from "@/lib/growth-asset-metadata";
import {
  assessGrowthStorageCapacity,
  estimateGrowthPhotoWriteBytes,
  estimateGrowthStorageCapacity,
  formatGrowthStorageBytes,
  type GrowthStorageCapacitySnapshot,
} from "@/lib/growth-storage-capacity";
import {
  isValidGrowthDate,
  MAX_GROWTH_CONFIRMATION_LENGTH,
  type GrowthRecordDraft,
  type GrowthRecordPhoto,
} from "@/lib/growth-records";
import type {
  AgeGroup,
  GrowthStoryTreatment,
  IllustrationStyle,
  LibraryStorySpec,
  PersonalizationAnchorConfirmation,
  PersonalizationDraft,
} from "@/types";
import type { GrowthVersionCreationPreset } from "@/lib/growth-version-creation";
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
import {
  createFamilyPhotoUrls,
  ensureFamilyProfile,
  listFamilyCharacters,
  removeFamilyPhotos,
  uploadFamilyPhoto,
  upsertFamilyCharacter,
} from "@/lib/repositories/family-character-repository";
import {
  createPersonalizationDraft,
  getLatestPersonalizationDraft,
  updatePersonalizationDraft,
} from "@/lib/personalization-drafts";
import { getStoryContinuationDraft } from "@/lib/story-continuation-drafts";

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
  initialGrowthEnabled?: boolean;
  initialGrowthVersion?: GrowthVersionCreationPreset;
  homeHero?: boolean;
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

type LibraryPersonalizationContext = {
  storySpec: LibraryStorySpec;
  suggestedPrompt: string;
};

type IdentityAnchorPreview = {
  choice?: FamilyChoice;
  displayName: string;
  relationship: string;
  appearance: string;
  imageUrl?: string;
  referenceType: PersonalizationAnchorConfirmation["referenceType"];
  storyReferenceToken?: string;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const DAILY_IDEA_QUERY_KEY = "idea";
const PERSONALIZATION_QUERY_KEY = "personalize";
const CONTINUATION_QUERY_KEY = "continue";
const PENDING_IDENTITY_KEY = "storybloom:minimal-identity-draft";
const GROWTH_PREFERENCES_KEY = "storybloom.growthStoryPreferences";

type GrowthPreferences = {
  readingStage: AgeGroup;
  storyTreatment: GrowthStoryTreatment;
  illustrationStyle?: IllustrationStyle;
};

function getDefaultGrowthPreferences(): GrowthPreferences {
  return {
    readingStage: "4-5",
    storyTreatment: "documentary",
    illustrationStyle: "watercolor",
  };
}

function isGrowthPreferences(value: unknown): value is GrowthPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Partial<GrowthPreferences>;
  return (
    (preferences.readingStage === "2-3" ||
      preferences.readingStage === "4-5" ||
      preferences.readingStage === "6-8") &&
    (preferences.storyTreatment === "documentary" ||
      preferences.storyTreatment === "warm-imagination" ||
      preferences.storyTreatment === "fairytale") &&
    (preferences.illustrationStyle === undefined ||
      preferences.illustrationStyle === "watercolor" ||
      preferences.illustrationStyle === "cartoon" ||
      preferences.illustrationStyle === "fairytale")
  );
}

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

function getDefaultAnchorAppearance(
  name: string,
  relationship: string,
  ageGroup: AgeGroup = "4-5",
) {
  const ageLabel =
    ageGroup === "2-3" ? "2-3 岁" : ageGroup === "6-8" ? "6-8 岁" : "4-5 岁";
  return `${name || "孩子"}，${relationship || "孩子"}，${ageLabel}年龄感，保持日常发型、脸型和显著特征，穿舒适简洁的绘本服装`;
}

function getFamilyChoicePhotoPath(choice: FamilyChoice) {
  return choice.cartoonize === false
    ? choice.source_photo_path || choice.canonical_photo_path
    : choice.canonical_photo_path || choice.source_photo_path;
}

async function fetchFamilyChoices(
  client: SupabaseClient,
  userId: string,
) {
  const choices = dedupeFamilyCharacters(
    await listFamilyCharacters<FamilyChoice>(client, { userId }),
  );
  const paths = choices
    .map(getFamilyChoicePhotoPath)
    .filter(Boolean) as string[];
  const urls = await createFamilyPhotoUrls(client, paths);
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
    growthPlaceholder: "例如：周六，小满第一次自己骑车，爸爸在旁边陪着她",
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
    confirmHint: "确认姓名后，标题和人物形象会使用这个名字；你也可以选择用姓名或“我”来讲。",
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
    loginHint: "登录是可选的；需要跨设备保存姓名、私密照片或家庭角色时再登录。",
    loginAction: "前往登录",
    previewTitle: "确认绘本形象",
    previewUse: "使用这个形象生成绘本",
    previewRetry: "重新生成形象",
    growthTool: "成长记录",
    growthPageTitle: "把今天的小成长，写进故事里",
    growthTitle: "把这件小事放进孩子的成长书架",
    growthHint: "文字、现场照片和生成后的绘本场景会一起保存在本机。",
    growthEnable: "同时生成绘本并保存为成长记录（默认开启）",
    growthChild: "记录主角",
    growthChildPending: "生成时确认孩子姓名",
    growthPhotos: "成长现场照片",
    growthPhotoHint: "可选，最多 4 张。照片只用于记录，不会发送给模型。",
    growthPhotoAction: "添加照片",
    growthPhotoProcessing: "正在处理照片…",
    growthPhotoInvalid: "请选择 8MB 内的 JPG、PNG 或 WebP 图片，最多 4 张。",
    growthPhotoDuplicate: (count: number) => `已跳过 ${count} 张内容相同的重复照片。`,
    growthPhotoQuota: "当前浏览器为本站保留的空间不足，无法再加入这些照片。请先到成长时间轴删除部分现场照片或时刻。",
    growthCapacityUnavailable: "浏览器未提供容量估算；保存时仍会进行实际检查。",
    growthCapacity: (usage: string, quota: string, planned: string) =>
      `本站本机空间已用 ${usage} / ${quota}；本次照片预计新增 ${planned}。`,
    growthCapacityWarning: "本机空间接近上限，建议先删除不再需要的现场照片或成长时刻。",
    growthDate: "发生时间",
    growthNote: "家长备注（选填）",
    growthNotePlaceholder: "例如：他收好以后特别骄傲",
    growthReadingStage: "阅读阶段",
    growthReadingOptions: {
      "2-3": "2–3 岁 · 简短重复",
      "4-5": "4–5 岁 · 清楚连贯",
      "6-8": "6–8 岁 · 更丰富表达",
    },
    growthStyle: "本版本插画风格",
    growthStyleOptions: {
      watercolor: "柔和水彩",
      cartoon: "明快卡通",
      fairytale: "童话绘本",
    },
    growthVersionTitle: (count: number) =>
      count > 0 ? `为这个成长时刻创作第 ${count + 1} 个版本` : "为这个成长时刻创作第一本绘本",
    growthVersionHint: "真实日期、事实、备注和现场照片保持不变；这里只调整新绘本版本。",
    growthMomentLocked: "真实时刻内容已锁定，如需修改请先返回时间轴编辑。",
    growthTreatment: "故事处理方式",
    growthTreatments: {
      documentary: {
        label: "温暖纪实",
        hint: "保留真实日常，不强加困难或寓意",
      },
      "warm-imagination": {
        label: "温暖想象",
        hint: "事实不变，只加入家长允许的轻柔想象",
      },
      fairytale: {
        label: "童话延展",
        hint: "从真实时刻展开冒险，结尾回到真实记忆",
      },
    },
    growthFacts: "家长确认的事实",
    growthFactsPlaceholder: "例如：周六和爸爸去公园；第一次自己骑车；妈妈在终点等候",
    growthFactsHint: "人物关系、地点和结果会以这里为准。",
    growthImaginations: "允许进行的想象（选填）",
    growthImaginationsPlaceholder: "例如：树叶像在鼓掌，小鸟在旁边加油",
    growthImaginationsHint: "留空时，纪实模式不会主动加入魔法事件或新角色。",
    growthConfirmTitle: "生成前确认",
    growthConfirmHint: "AI 只会使用文字事实和允许的想象；现场照片仍只保存在成长记录中。",
    growthConfirmCheck: "我已确认故事想法和上述事实准确，并决定了允许的想象范围。",
    growthConfirmRequired: "请先由家长确认真实事实和允许的想象范围。",
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
    growthPlaceholder: "Example: On Saturday, Emma rode her bike alone while Dad stayed nearby",
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
    confirmHint: "The title and character use this name; choose whether the story is told with the name or as “I”.",
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
    loginHint: "Sign-in is optional. Use it when you want names, private photos, or family characters across devices.",
    loginAction: "Go to sign in",
    previewTitle: "Confirm the storybook character",
    previewUse: "Use this character",
    previewRetry: "Generate another version",
    growthTool: "Growth record",
    growthPageTitle: "Turn today's little milestone into a story",
    growthTitle: "Keep this moment in the child's growth shelf",
    growthHint: "The note, photos, and generated storybook scene stay together on this device.",
    growthEnable: "Create the book and save it as a growth record (on by default)",
    growthChild: "Child",
    growthChildPending: "Confirm the child's name before generation",
    growthPhotos: "Moment photos",
    growthPhotoHint: "Optional, up to 4. Photos are saved as records and are not sent to the model.",
    growthPhotoAction: "Add photos",
    growthPhotoProcessing: "Processing photos…",
    growthPhotoInvalid: "Choose up to 4 JPG, PNG, or WebP images under 8 MB each.",
    growthPhotoDuplicate: (count: number) => `Skipped ${count} duplicate photo${count === 1 ? "" : "s"} with identical content.`,
    growthPhotoQuota: "This browser does not have enough site storage for these photos. Remove unneeded Moment photos or Moments from the timeline first.",
    growthCapacityUnavailable: "This browser does not expose a storage estimate. The actual save will still be checked.",
    growthCapacity: (usage: string, quota: string, planned: string) =>
      `Site storage: ${usage} used of ${quota}; these photos are expected to add ${planned}.`,
    growthCapacityWarning: "Local site storage is close to its limit. Consider removing unneeded Moment photos or Moments.",
    growthDate: "Date",
    growthNote: "Parent note (optional)",
    growthNotePlaceholder: "Example: He was very proud after finishing it",
    growthReadingStage: "Reading stage",
    growthReadingOptions: {
      "2-3": "Ages 2–3 · short and repetitive",
      "4-5": "Ages 4–5 · clear and connected",
      "6-8": "Ages 6–8 · richer language",
    },
    growthStyle: "Illustration style for this version",
    growthStyleOptions: {
      watercolor: "Soft watercolor",
      cartoon: "Bright cartoon",
      fairytale: "Fairytale picture book",
    },
    growthVersionTitle: (count: number) =>
      count > 0
        ? `Create version ${count + 1} for this moment`
        : "Create the first storybook for this moment",
    growthVersionHint: "The real date, facts, note, and photos stay unchanged. Only this storybook version is adjusted here.",
    growthMomentLocked: "The real Moment is locked here. Return to the timeline to edit it.",
    growthTreatment: "Story treatment",
    growthTreatments: {
      documentary: {
        label: "Warm documentary",
        hint: "Keep the real moment without forcing a problem or lesson",
      },
      "warm-imagination": {
        label: "Warm imagination",
        hint: "Preserve facts and add only parent-approved imagination",
      },
      fairytale: {
        label: "Fairytale extension",
        hint: "Grow an adventure from the moment, then return to the memory",
      },
    },
    growthFacts: "Parent-confirmed facts",
    growthFactsPlaceholder: "Example: Saturday at the park with Dad; first solo bike ride; Mom waited at the finish",
    growthFactsHint: "People, place, and outcome will follow these facts.",
    growthImaginations: "Allowed imagination (optional)",
    growthImaginationsPlaceholder: "Example: leaves clap and a bird quietly cheers",
    growthImaginationsHint: "Leave blank to avoid adding magical events or new characters in documentary mode.",
    growthConfirmTitle: "Confirm before generating",
    growthConfirmHint: "AI receives only the written facts and approved imagination. Moment photos stay in the record.",
    growthConfirmCheck: "I confirm the story idea and facts are accurate, and I chose the allowed imagination boundary.",
    growthConfirmRequired: "Ask a parent or guardian to confirm the facts and imagination boundary first.",
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
  initialGrowthEnabled = false,
  initialGrowthVersion,
  homeHero = false,
  onSubmit,
}: Props) {
  const text = COPY[locale];
  const initialGrowthDraft = initialGrowthVersion?.draft;
  const creatingGrowthVersion = Boolean(initialGrowthVersion);
  const { supabase, session } = useAuth();
  const familyAccessToken = session?.access_token || "";
  const familyUserId = session?.user.id || "";
  const [promptIndex, setPromptIndex] = useState(0);
  const [idea, setIdea] = useState(initialGrowthDraft?.idea || "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const growthDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "idle" | "loading" | "sent" | "confirmed" | "error"
  >("idle");
  const [familyChoices, setFamilyChoices] = useState<FamilyChoice[]>([]);
  const [familyUrls, setFamilyUrls] = useState<Record<string, string>>({});
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>(
    initialGrowthDraft?.childCharacterId
      ? [initialGrowthDraft.childCharacterId]
      : [],
  );
  const [growthEnabled, setGrowthEnabled] = useState(
    creatingGrowthVersion || initialGrowthEnabled,
  );
  const [growthOccurredOn, setGrowthOccurredOn] = useState(
    initialGrowthDraft?.occurredOn || getLocalDateValue(),
  );
  const [growthNote, setGrowthNote] = useState(initialGrowthDraft?.note || "");
  const [growthReadingStage, setGrowthReadingStage] =
    useState<AgeGroup>(initialGrowthDraft?.readingStage || "4-5");
  const [growthStoryTreatment, setGrowthStoryTreatment] =
    useState<GrowthStoryTreatment>(
      initialGrowthDraft?.storyTreatment || "documentary",
    );
  const [growthIllustrationStyle, setGrowthIllustrationStyle] =
    useState<IllustrationStyle>(
      initialGrowthVersion?.illustrationStyle || "watercolor",
    );
  const [growthPreferencesLoaded, setGrowthPreferencesLoaded] = useState(false);
  const [growthParentFacts, setGrowthParentFacts] = useState(
    initialGrowthDraft?.parentFacts || "",
  );
  const [growthAllowedImaginations, setGrowthAllowedImaginations] =
    useState(initialGrowthDraft?.allowedImaginations || "");
  const [growthFactsConfirmed, setGrowthFactsConfirmed] = useState(false);
  const [growthPhotos, setGrowthPhotos] = useState<GrowthRecordPhoto[]>(
    initialGrowthDraft?.photos.map((photo) => ({ ...photo })) || [],
  );
  const [growthPhotoBusy, setGrowthPhotoBusy] = useState(false);
  const [growthPhotoNotice, setGrowthPhotoNotice] = useState("");
  const [growthStorageCapacity, setGrowthStorageCapacity] =
    useState<GrowthStorageCapacitySnapshot | null>(null);
  const [growthError, setGrowthError] = useState("");
  const growthPhotoWriteBytes = estimateGrowthPhotoWriteBytes(
    sumGrowthAssetDataUrlBytes(growthPhotos),
  );
  const growthCapacityAssessment = growthStorageCapacity
    ? assessGrowthStorageCapacity(growthStorageCapacity, growthPhotoWriteBytes)
    : null;
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
  const [identityAppearance, setIdentityAppearance] = useState("");
  const [identityAnchorPreview, setIdentityAnchorPreview] =
    useState<IdentityAnchorPreview | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [personalizationContext, setPersonalizationContext] =
    useState<LibraryPersonalizationContext | null>(null);
  const [personalizationDraft, setPersonalizationDraft] =
    useState<PersonalizationDraft | null>(null);
  const [personalizationError, setPersonalizationError] = useState("");
  const [continuationStyle, setContinuationStyle] =
    useState<IllustrationStyle>();
  const activePersonalizationDraftId = personalizationDraft?.id || "";
  const continuationLoadedRef = useRef("");

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
    if (
      (creatingGrowthVersion || (initialGrowthEnabled && !homeHero)) &&
      growthDetailsRef.current
    ) {
      growthDetailsRef.current.open = true;
    }
  }, [creatingGrowthVersion, homeHero, initialGrowthEnabled]);

  useEffect(() => {
    if (!growthEnabled || creatingGrowthVersion) return;
    let active = true;
    void estimateGrowthStorageCapacity().then((snapshot) => {
      if (active) setGrowthStorageCapacity(snapshot);
    });
    return () => {
      active = false;
    };
  }, [creatingGrowthVersion, growthEnabled]);

  useEffect(() => {
    if (initialGrowthVersion) {
      setGrowthReadingStage(initialGrowthVersion.draft.readingStage || "4-5");
      setGrowthStoryTreatment(
        initialGrowthVersion.draft.storyTreatment || "documentary",
      );
      setGrowthIllustrationStyle(initialGrowthVersion.illustrationStyle);
      setGrowthPreferencesLoaded(true);
      return;
    }
    try {
      const preferences = JSON.parse(
        window.localStorage.getItem(GROWTH_PREFERENCES_KEY) || "null",
      ) as unknown;
      const nextPreferences = isGrowthPreferences(preferences)
        ? preferences
        : getDefaultGrowthPreferences();
      setGrowthReadingStage(nextPreferences.readingStage);
      setGrowthStoryTreatment(nextPreferences.storyTreatment);
      setGrowthIllustrationStyle(
        nextPreferences.illustrationStyle || "watercolor",
      );
    } catch {
      const defaults = getDefaultGrowthPreferences();
      setGrowthReadingStage(defaults.readingStage);
      setGrowthStoryTreatment(defaults.storyTreatment);
      setGrowthIllustrationStyle(defaults.illustrationStyle || "watercolor");
    }
    setGrowthPreferencesLoaded(true);
  }, [initialGrowthVersion]);

  useEffect(() => {
    if (!growthPreferencesLoaded || initialGrowthVersion) return;
    window.localStorage.setItem(
      GROWTH_PREFERENCES_KEY,
      JSON.stringify({
        readingStage: growthReadingStage,
        storyTreatment: growthStoryTreatment,
        illustrationStyle: growthIllustrationStyle,
      } satisfies GrowthPreferences),
    );
  }, [
    growthIllustrationStyle,
    growthPreferencesLoaded,
    growthReadingStage,
    growthStoryTreatment,
    initialGrowthVersion,
  ]);

  useEffect(() => {
    const sharedIdea = new URL(window.location.href).searchParams
      .get(DAILY_IDEA_QUERY_KEY)
      ?.trim();
    if (sharedIdea && !initialGrowthVersion) {
      setIdea(sharedIdea.slice(0, 100));
    }
  }, [initialGrowthVersion]);

  useEffect(() => {
    if (initialGrowthVersion) return;
    const contentId = new URL(window.location.href).searchParams
      .get(PERSONALIZATION_QUERY_KEY)
      ?.trim();
    if (!contentId) {
      setPersonalizationContext(null);
      setPersonalizationDraft(null);
      setPersonalizationError("");
      return;
    }

    const controller = new AbortController();
    setPersonalizationError("");
    void fetch(
      `/api/library/personalization?book=${encodeURIComponent(contentId)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as
          | LibraryPersonalizationContext
          | { error?: string };
        if (!response.ok || !("storySpec" in body)) {
          throw new Error(
            "error" in body && body.error
              ? body.error
              : "来源绘本暂时无法读取。",
          );
        }
        return body;
      })
      .then((context) => {
        if (controller.signal.aborted) return;
        setPersonalizationContext(context);
        setIdea((current) => current.trim() || context.suggestedPrompt);
        const existing = getLatestPersonalizationDraft(
          context.storySpec.sourceLibraryBookId,
        );
        const draft =
          existing && !existing.generatedStoryId
            ? existing
            : createPersonalizationDraft({
                sourceLibraryBookId:
                  context.storySpec.sourceLibraryBookId,
                sourceTitle: context.storySpec.sourceTitle,
                prompt: context.suggestedPrompt,
                ageGroup: context.storySpec.ageGroup,
                userId: familyUserId || undefined,
              });
        setPersonalizationDraft(draft);
        if (draft.selectedCharacterIds.length > 0) {
          setSelectedFamilyIds(draft.selectedCharacterIds);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPersonalizationContext(null);
        setPersonalizationDraft(null);
        setPersonalizationError(
          error instanceof Error ? error.message : "来源绘本暂时无法读取。",
        );
      });

    return () => controller.abort();
  }, [familyUserId, initialGrowthVersion]);

  useEffect(() => {
    if (!activePersonalizationDraftId || !personalizationContext) return;
    const updated = updatePersonalizationDraft(activePersonalizationDraftId, {
      selectedCharacterIds: selectedFamilyIds,
      storySettings: {
        prompt: idea.trim() || personalizationContext.suggestedPrompt,
        ageGroup: personalizationContext.storySpec.ageGroup,
      },
    });
    if (updated) setPersonalizationDraft(updated);
  }, [
    idea,
    activePersonalizationDraftId,
    personalizationContext,
    selectedFamilyIds,
  ]);

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
    const sourceStoryId = new URL(window.location.href).searchParams
      .get(CONTINUATION_QUERY_KEY)
      ?.trim();
    if (
      !sourceStoryId ||
      continuationLoadedRef.current === sourceStoryId ||
      familyChoices.length === 0
    ) {
      return;
    }
    const draft = getStoryContinuationDraft(sourceStoryId);
    if (!draft) return;
    const character = familyChoices.find(
      (choice) => choice.id === draft.characterId,
    );
    if (!character) {
      setMessage("原绘本使用的家庭角色在当前账户中不可用，请重新选择角色。");
      continuationLoadedRef.current = sourceStoryId;
      return;
    }
    continuationLoadedRef.current = sourceStoryId;
    setIdea((current) => current.trim() || draft.suggestedIdea);
    setSelectedFamilyIds([character.id]);
    setIdentitySelectedId(character.id);
    setIdentityName(character.display_name || draft.characterName);
    setIdentityRelationship(character.relationship || draft.relationship);
    // Reuse the durable family identity, not story-specific clothes or scene
    // details that may have been present in the previous Anchor description.
    setIdentityAppearance(character.description || "");
    setContinuationStyle(draft.style);
    setMessage("已沿用家庭角色和画风。请修改新冒险内容后生成；旧服装和场景不会自动带入。");
  }, [familyChoices]);

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
    const profileId = await ensureFamilyProfile(client, familyUserId, {
      locale: locale === "zh" ? "zh-CN" : "en",
    });
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
      await uploadFamilyPhoto(client, sourcePath, photo);
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
      description:
        identityAppearance.trim() || existing?.description || "",
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
    await upsertFamilyCharacter(client, payload);
    if (uploadsPhoto && existing?.canonical_photo_path) {
      await removeFamilyPhotos(client, [existing.canonical_photo_path]);
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
    if (personalizationContext) {
      await generateStoryAnchorPreview(refreshed);
      return;
    }
    if (!supabase) throw new Error("账户服务尚未准备好，请稍后再试。");
    const { data } = await supabase.storage
      .from("family-photos")
      .createSignedUrl(refreshed.canonical_photo_path, 3600);
    if (!data?.signedUrl) throw new Error("绘本形象预览加载失败。");
    setIdentityAnchorPreview({
      choice: refreshed,
      displayName: refreshed.display_name,
      relationship: refreshed.relationship,
      appearance:
        identityAppearance.trim() ||
        refreshed.description?.trim() ||
        getDefaultAnchorAppearance(
          refreshed.display_name,
          refreshed.relationship,
        ),
      imageUrl: `${data.signedUrl}#${Date.now()}`,
      referenceType: "canonical",
    });
    if (personalizationDraft) {
      const updated = updatePersonalizationDraft(personalizationDraft.id, {
        selectedCharacterIds: [refreshed.id],
        anchorStatus: "preview",
      });
      if (updated) setPersonalizationDraft(updated);
    }
    setIdentityPhase("preview");
  }

  async function generateStoryAnchorPreview(choice: FamilyChoice) {
    if (!personalizationContext || !familyAccessToken) {
      throw new Error("请先登录并选择一个已有家庭角色。");
    }
    setIdentityPhase("generating");
    setIdentityError("");
    const appearance =
      identityAppearance.trim() ||
      choice.description?.trim() ||
      getDefaultAnchorAppearance(
        choice.display_name,
        choice.relationship,
        personalizationContext.storySpec.ageGroup,
      );
    const response = await fetch("/api/library/personalization/anchor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${familyAccessToken}`,
      },
      body: JSON.stringify({
        sourceLibraryBookId:
          personalizationContext.storySpec.sourceLibraryBookId,
        characterId: choice.id,
        personalizationDraftId: personalizationDraft?.id,
        appearance,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      storyReferenceToken?: string;
      imageDataUrl?: string;
      referenceType?: "canonical" | "source";
    };
    if (
      !response.ok ||
      !body.storyReferenceToken ||
      !body.imageDataUrl
    ) {
      throw new Error(body.error || "角色 Anchor 生成失败，请重试。");
    }
    setIdentityAnchorPreview({
      choice,
      displayName: choice.display_name,
      relationship: choice.relationship,
      appearance,
      imageUrl: body.imageDataUrl,
      referenceType: body.referenceType || "canonical",
      storyReferenceToken: body.storyReferenceToken,
    });
    if (personalizationDraft) {
      const updated = updatePersonalizationDraft(personalizationDraft.id, {
        selectedCharacterIds: [choice.id],
        anchorStatus: "preview",
      });
      if (updated) setPersonalizationDraft(updated);
    }
    setIdentityPhase("preview");
  }

  async function handleGrowthPhotoFiles(files: File[]) {
    setGrowthError("");
    setGrowthPhotoNotice("");
    if (files.length === 0) return;
    if (
      files.length > 4 ||
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
            ...(await getGrowthAssetMetadataFromBlob(blob)),
          } satisfies GrowthRecordPhoto;
        }),
      );
      const normalized = await normalizeAndDedupeGrowthAssets(
        [...growthPhotos, ...photos],
        { strict: true },
      );
      if (normalized.assets.length > 4) {
        setGrowthError(text.growthPhotoInvalid);
        return;
      }
      const snapshot = await estimateGrowthStorageCapacity();
      const assessment = assessGrowthStorageCapacity(
        snapshot,
        estimateGrowthPhotoWriteBytes(
          sumGrowthAssetDataUrlBytes(normalized.assets),
        ),
      );
      setGrowthStorageCapacity(snapshot);
      if (assessment.blocked) {
        setGrowthError(text.growthPhotoQuota);
        return;
      }
      const duplicateCount = growthPhotos.length + photos.length - normalized.assets.length;
      setGrowthPhotos(normalized.assets);
      if (duplicateCount > 0) {
        setGrowthPhotoNotice(text.growthPhotoDuplicate(duplicateCount));
      }
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
    if (!growthFactsConfirmed) {
      throw new Error(text.growthConfirmRequired);
    }

    if (initialGrowthVersion) {
      return {
        ...initialGrowthVersion.draft,
        ...(protagonist?.id
          ? { childCharacterId: protagonist.id }
          : { childCharacterId: undefined }),
        photos: initialGrowthVersion.draft.photos.map((photo) => ({ ...photo })),
        readingStage: growthReadingStage,
        storyTreatment: growthStoryTreatment,
      };
    }

    const imagePath = protagonist
      ? getFamilyChoicePhotoPath(protagonist)
      : undefined;
    const avatarUrl = imagePath
      ? familyUrls[imagePath]
      : identityAnchorPreview?.imageUrl;
    const normalizedPhotos = await normalizeAndDedupeGrowthAssets(growthPhotos, {
      verifyExisting: true,
      strict: true,
    });
    const storageSnapshot = await estimateGrowthStorageCapacity();
    setGrowthStorageCapacity(storageSnapshot);
    const storageAssessment = assessGrowthStorageCapacity(
      storageSnapshot,
      estimateGrowthPhotoWriteBytes(
        sumGrowthAssetDataUrlBytes(normalizedPhotos.assets),
      ),
    );
    if (storageAssessment.blocked) {
      throw new Error(text.growthPhotoQuota);
    }
    if (normalizedPhotos.changed) setGrowthPhotos(normalizedPhotos.assets);

    return {
      version: 1,
      childKey: protagonist?.id || `name:${normalizedName}`,
      childName: childName.trim(),
      childCharacterId: protagonist?.id,
      childAvatarDataUrl: await imageUrlToDataUrl(avatarUrl),
      occurredOn: growthOccurredOn,
      note: growthNote.trim(),
      idea: storyIdea,
      photos: normalizedPhotos.assets,
      readingStage: growthReadingStage,
      storyTreatment: growthStoryTreatment,
      parentFacts: growthParentFacts.trim() || undefined,
      allowedImaginations: growthAllowedImaginations.trim() || undefined,
    };
  }

  function resetGrowthDraft() {
    if (creatingGrowthVersion) {
      setGrowthFactsConfirmed(false);
      setGrowthError("");
      return;
    }
    setGrowthOccurredOn(getLocalDateValue());
    setGrowthNote("");
    setGrowthPhotos([]);
    setGrowthPhotoNotice("");
    setGrowthParentFacts("");
    setGrowthAllowedImaginations("");
    setGrowthFactsConfirmed(false);
    setGrowthError("");
  }

  async function submitStory(
    storyIdea: string,
    childName: string,
    protagonist?: FamilyChoice,
    anchorConfirmation?: PersonalizationAnchorConfirmation,
  ) {
    if (turnstileEnabled && !turnstileToken) {
      setIdentityError(
        locale === "zh"
          ? "登录后请先关闭弹窗完成安全验证，再重新点击生成。人物信息已经保留。"
          : "Close this dialog, complete the security check, then create again. Your character details are saved.",
      );
      return;
    }
    if (
      personalizationContext &&
      (!personalizationDraft || !anchorConfirmation)
    ) {
      setIdentityError(
        locale === "zh"
          ? "请先确认角色 Anchor，再生成完整绘本。"
          : "Confirm the character Anchor before creating the full book.",
      );
      return;
    }
    const protagonistId = protagonist?.id;
    const availableSelectedFamilyIds = selectedFamilyIds.filter((id) =>
      familyChoices.some((choice) => choice.id === id),
    );
    const nextFamilyIds = protagonistId
      ? [
          protagonistId,
          ...availableSelectedFamilyIds.filter((id) => id !== protagonistId),
        ].slice(0, 4)
      : availableSelectedFamilyIds.filter((id) => id !== identitySelectedId);
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
      if (personalizationDraft && anchorConfirmation) {
        const updated = updatePersonalizationDraft(personalizationDraft.id, {
          selectedCharacterIds: protagonist?.id ? [protagonist.id] : [],
          anchorStatus: "confirmed",
          anchor: anchorConfirmation,
        });
        if (updated) setPersonalizationDraft(updated);
      }
      await onSubmit({
        childName: childName.trim() || (locale === "zh" ? "我" : "I"),
        narrativePerspective: growthEnabled ? "third-person" : "first-person",
        protagonistFamilyCharacterId: protagonistId || undefined,
        ageGroup: personalizationContext
          ? personalizationContext.storySpec.ageGroup
          : growthEnabled
            ? growthReadingStage
            : "4-5",
        theme: "custom",
        customTheme: storyIdea,
        style: growthEnabled
          ? growthIllustrationStyle
          : continuationStyle || "fairytale",
        characterDescription:
          personalizationContext && !protagonist
            ? anchorConfirmation?.appearance
            : undefined,
        parentFacts: growthEnabled ? growthParentFacts.trim() || undefined : undefined,
        allowedImaginations: growthEnabled
          ? growthAllowedImaginations.trim() || undefined
          : undefined,
        storyTreatment: growthEnabled ? growthStoryTreatment : undefined,
        language: locale === "zh" ? "zh-en" : "en-zh",
        familyCharacterIds: nextFamilyIds.length > 0 ? nextFamilyIds : undefined,
        sourceLibraryBookId:
          personalizationContext?.storySpec.sourceLibraryBookId,
        personalizationDraftId: personalizationDraft?.id,
        personalizationAnchor: anchorConfirmation,
        supabaseAccessToken: familyAccessToken || undefined,
        turnstileToken: turnstileEnabled ? turnstileToken : undefined,
        growthRecordDraft,
        ...(growthEnabled && initialGrowthVersion
          ? { targetMomentId: initialGrowthVersion.targetMomentId }
          : {}),
      });
      if (growthRecordDraft) resetGrowthDraft();
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
    setIdentityAppearance(
      matchedChoice?.description?.trim() ||
        getDefaultAnchorAppearance(
          candidateName || matchedChoice?.display_name || "孩子",
          matchedChoice?.relationship || (locale === "zh" ? "孩子" : "Child"),
          personalizationContext?.storySpec.ageGroup,
        ),
    );
    setIdentityAnchorPreview(null);
    setIdentityError("");
    if (homeHero && growthEnabled) {
      setGrowthParentFacts((current) => current.trim() || storyIdea);
      setGrowthFactsConfirmed(true);
    }
    setIdentityPhase("confirm");
    setIdentityOpen(true);
    if (personalizationDraft) {
      const updated = updatePersonalizationDraft(personalizationDraft.id, {
        selectedCharacterIds: matchingCharacterIds,
        anchorStatus: "pending",
      });
      if (updated) setPersonalizationDraft(updated);
    }
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
    if (homeHero) {
      const analysis = analyzeStoryProtagonist(storyIdea, locale);
      const match = matchStoryProtagonist(analysis, familyChoices);
      if (match.status === "matched") {
        const choice = familyChoices.find((item) => item.id === match.characterId);
        openIdentityConfirmation(
          storyIdea,
          choice?.display_name || analysis.candidateName,
          choice ? [choice.id] : [match.characterId],
        );
      } else {
        openIdentityConfirmation(
          storyIdea,
          analysis.candidateName,
          match.matchingCharacterIds,
        );
      }
      return;
    }
    if (growthEnabled && !growthFactsConfirmed) {
      setGrowthError(text.growthConfirmRequired);
      setMessage(text.growthConfirmRequired);
      window.requestAnimationFrame(() => {
        if (!growthDetailsRef.current) return;
        growthDetailsRef.current.open = true;
        growthDetailsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }

    const explicitlySelectedChild = familyChoices.find(
      (choice) =>
        selectedFamilyIds.includes(choice.id) && isChildRelationship(choice.relationship),
    );
    if (explicitlySelectedChild) {
      if (personalizationContext) {
        openIdentityConfirmation(
          storyIdea,
          explicitlySelectedChild.display_name,
          [explicitlySelectedChild.id],
        );
        return;
      }
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

    if (initialGrowthVersion) {
      await submitStory(
        storyIdea,
        initialGrowthVersion.draft.childName,
      );
      return;
    }

    const analysis = analyzeStoryProtagonist(storyIdea, locale);
    const match = matchStoryProtagonist(analysis, familyChoices);
    if (match.status === "matched") {
      const choice = familyChoices.find((item) => item.id === match.characterId)!;
      if (personalizationContext) {
        openIdentityConfirmation(storyIdea, choice.display_name, [choice.id]);
        return;
      }
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
      if (personalizationContext) {
        if (
          choice &&
          (choice.canonical_photo_path || choice.source_photo_path)
        ) {
          await generateStoryAnchorPreview(choice);
          return;
        }
        const path = choice ? getFamilyChoicePhotoPath(choice) : null;
        const appearance =
          identityAppearance.trim() ||
          choice?.description?.trim() ||
          getDefaultAnchorAppearance(
            trimmedName,
            identityRelationship,
            personalizationContext.storySpec.ageGroup,
          );
        const referenceType = choice?.canonical_photo_path
          ? "canonical"
          : choice?.source_photo_path
            ? "source"
            : "text";
        setIdentityAnchorPreview({
          ...(choice ? { choice } : {}),
          displayName: choice?.display_name || trimmedName,
          relationship: choice?.relationship || identityRelationship,
          appearance,
          ...(path && familyUrls[path]
            ? { imageUrl: familyUrls[path] }
            : {}),
          referenceType,
        });
        if (personalizationDraft) {
          const updated = updatePersonalizationDraft(personalizationDraft.id, {
            selectedCharacterIds: choice?.id ? [choice.id] : [],
            anchorStatus: "preview",
          });
          if (updated) setPersonalizationDraft(updated);
        }
        setIdentityPhase("preview");
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
    <section
      className={`minimal-entry${homeHero ? " minimal-entry-home" : ""}`}
      aria-labelledby="minimal-entry-title"
    >
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileLoaded(true)}
          onReady={() => setTurnstileLoaded(true)}
        />
      ) : null}

      {homeHero ? null : (
        <>
          <div className="minimal-brand-row">
            <span className="minimal-brand-seed" aria-hidden="true">✦</span>
            <span>StoryBloom</span>
          </div>

          <div className="rolling-prompt" aria-live="polite">
            <span key={`${locale}-${promptIndex}`}>{text.prompts[promptIndex]}</span>
          </div>
        </>
      )}
      <h1 id="minimal-entry-title">
        {homeHero
          ? locale === "zh"
            ? (
                <>
                  <span>把今天的小事，</span>
                  <span>写进故事里</span>
                </>
              )
            : (
                <>
                  <span>Turn today’s little moment</span>
                  <span>into a story</span>
                </>
              )
          : personalizationContext
          ? locale === "zh"
            ? `让孩子成为《${personalizationContext.storySpec.sourceTitle}》的主角`
            : `Make your child the hero of ${personalizationContext.storySpec.sourceTitle}`
          : growthEnabled
            ? text.growthPageTitle
            : text.title}
      </h1>
      {homeHero ? (
        <div className="minimal-home-ornament" aria-hidden="true">
          <span />
          <Plant weight="fill" />
          <HeartStraight weight="fill" />
          <Plant className="minimal-home-ornament-reverse" weight="fill" />
          <span />
        </div>
      ) : null}
      {homeHero ? (
        <p className="minimal-home-description">
          {locale === "zh"
            ? "写下一句话，为孩子生成一本可以反复阅读的专属故事。"
            : "Write one sentence and create a personal story your family can revisit."}
        </p>
      ) : null}

      {initialGrowthVersion ? (
        <div className="minimal-growth-version-banner" role="status">
          <strong>
            {text.growthVersionTitle(initialGrowthVersion.existingVersionCount)}
          </strong>
          <span>{text.growthVersionHint}</span>
        </div>
      ) : null}

      {personalizationContext ? (
        <section className="minimal-personalization-source" aria-label="来源绘本改编">
          <div>
            <span>来源绘本</span>
            <strong>{personalizationContext.storySpec.sourceTitle}</strong>
            <small>
              已继承主题、8 页结构、适龄阶段和内容基调；不会只做名字替换。
            </small>
          </div>
          <ol>
            <li>选择家庭角色</li>
            <li>确认角色 Anchor</li>
            <li>生成并保存到书架</li>
          </ol>
          <Link
            href={`/library/${personalizationContext.storySpec.sourceLibraryBookId}`}
          >
            返回原始绘本
          </Link>
        </section>
      ) : null}

      {personalizationError ? (
        <p className="minimal-entry-message" role="alert">
          {personalizationError} 你仍可以按普通创作继续。
        </p>
      ) : null}

      <form className="story-search" onSubmit={handleGenerate}>
        {homeHero ? null : <span className="story-search-icon" aria-hidden="true">⌁</span>}
        <input
          value={idea}
          readOnly={creatingGrowthVersion}
          onChange={(event) => {
            setIdea(event.target.value);
            if (growthEnabled) setGrowthFactsConfirmed(false);
          }}
          placeholder={growthEnabled ? text.growthPlaceholder : text.placeholder}
          maxLength={100}
          aria-label={text.title}
          autoFocus
        />
        <button
          type="submit"
          disabled={submitting || growthPhotoBusy || remainingFreeGenerations <= 0}
          aria-label={
            homeHero
              ? locale === "zh"
                ? "AI 生成绘本"
                : "Create with AI"
              : personalizationContext
              ? locale === "zh"
                ? "选择家庭角色"
                : "Choose a family character"
              : growthEnabled
                ? text.growthAction
                : text.action
          }
        >
          {submitting ? (
            <span className="story-search-loader" />
          ) : homeHero ? (
            <MagicWand aria-hidden="true" weight="fill" />
          ) : (
            <span aria-hidden="true">→</span>
          )}
          {homeHero ? null : (
            <span className="story-search-action-label">
              {submitting
                ? text.generating
                : personalizationContext
                  ? locale === "zh"
                    ? "选择角色"
                    : "Choose character"
                : growthEnabled
                  ? text.growthAction
                  : text.action}
            </span>
          )}
        </button>
      </form>

      {homeHero ? (
        <div className="minimal-home-trust" aria-label="创作与数据说明">
          <span>
            <DeviceMobile aria-hidden="true" />
            {locale === "zh" ? "默认保存在当前设备" : "Saved on this device"}
          </span>
          <span>
            <ShieldCheck aria-hidden="true" />
            {locale === "zh"
              ? "成长照片不会进入故事生成请求"
              : "Moment photos stay out of story generation"}
          </span>
          <span>
            <Gift aria-hidden="true" />
            {locale === "zh"
              ? `每天 ${freeGenerationLimit} 次免费`
              : `${freeGenerationLimit} free each day`}
          </span>
        </div>
      ) : growthEnabled ? (
        <p className="minimal-capture-trust-note">
          {locale === "zh"
            ? "默认保存在当前设备 · 照片不会发送给故事模型 · 云端导入需你主动选择"
            : "Saved on this device by default · Photos are not sent to the story model · Cloud import is your choice"}
          <Link href="/child-family-data">
            {locale === "zh" ? "了解数据边界" : "Data details"}
          </Link>
        </p>
      ) : null}

      {message ? <p className="minimal-entry-message" role="alert">{message}</p> : null}

      {!homeHero ? (
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

        <details
          ref={growthDetailsRef}
          className="minimal-tool minimal-growth-tool"
          name="minimal-tools"
        >
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
              {homeHero ? null : (
                <label className="minimal-growth-switch">
                  <input
                    type="checkbox"
                    checked={growthEnabled}
                    disabled={creatingGrowthVersion}
                    onChange={(event) => {
                      setGrowthEnabled(event.target.checked);
                      setGrowthError("");
                    }}
                  />
                  <span>{text.growthEnable}</span>
                </label>
              )}
            </div>

            {growthEnabled ? (
              <>
                <div className="minimal-growth-child">
                  {selectedGrowthChildPath && familyUrls[selectedGrowthChildPath] ? (
                    <img src={familyUrls[selectedGrowthChildPath]} alt="" />
                  ) : (
                    <span aria-hidden="true">
                      {(
                        selectedGrowthChild?.display_name ||
                        initialGrowthDraft?.childName ||
                        analyzedGrowthName ||
                        "?"
                      ).slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <small>{text.growthChild}</small>
                    <strong>
                      {selectedGrowthChild?.display_name ||
                        initialGrowthDraft?.childName ||
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
                        {!creatingGrowthVersion ? (
                          <button
                            type="button"
                            aria-label={locale === "zh" ? `移除 ${photo.name}` : `Remove ${photo.name}`}
                            onClick={() => {
                              setGrowthError("");
                              setGrowthPhotoNotice("");
                              setGrowthPhotos((current) =>
                                current.filter((item) => item.id !== photo.id),
                              );
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {!creatingGrowthVersion && growthPhotos.length < 4 ? (
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
                  {!creatingGrowthVersion && growthStorageCapacity ? (
                    <div
                      className={`minimal-growth-capacity ${
                        growthCapacityAssessment?.warning
                          ? "minimal-growth-capacity-warning"
                          : ""
                      }`}
                    >
                      <span>
                        {growthStorageCapacity.usageBytes !== undefined &&
                        growthStorageCapacity.quotaBytes !== undefined
                          ? text.growthCapacity(
                              formatGrowthStorageBytes(
                                growthStorageCapacity.usageBytes,
                              ),
                              formatGrowthStorageBytes(
                                growthStorageCapacity.quotaBytes,
                              ),
                              formatGrowthStorageBytes(
                                growthPhotoWriteBytes,
                              ),
                            )
                          : text.growthCapacityUnavailable}
                      </span>
                      {growthCapacityAssessment?.warning ? (
                        <strong>{text.growthCapacityWarning}</strong>
                      ) : null}
                    </div>
                  ) : null}
                  {growthPhotoNotice ? (
                    <p className="minimal-growth-photo-notice" role="status">
                      {growthPhotoNotice}
                    </p>
                  ) : null}
                </div>

                <div className="minimal-growth-fields">
                  <label>
                    <span>{text.growthDate}</span>
                    <input
                      type="date"
                      required
                      value={growthOccurredOn}
                      disabled={creatingGrowthVersion}
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
                      readOnly={creatingGrowthVersion}
                      onChange={(event) => setGrowthNote(event.target.value)}
                      placeholder={text.growthNotePlaceholder}
                    />
                  </label>
                </div>

                {creatingGrowthVersion ? (
                  <p className="minimal-growth-locked-note">
                    {text.growthMomentLocked}
                  </p>
                ) : null}

                <div className="minimal-growth-story-settings">
                  <label>
                    <span>{text.growthReadingStage}</span>
                    <select
                      value={growthReadingStage}
                      onChange={(event) => {
                        setGrowthReadingStage(event.target.value as AgeGroup);
                        setGrowthFactsConfirmed(false);
                      }}
                    >
                      {(["2-3", "4-5", "6-8"] as AgeGroup[]).map((stage) => (
                        <option value={stage} key={stage}>
                          {text.growthReadingOptions[stage]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{text.growthStyle}</span>
                    <select
                      value={growthIllustrationStyle}
                      onChange={(event) =>
                        setGrowthIllustrationStyle(
                          event.target.value as IllustrationStyle,
                        )
                      }
                    >
                      {(
                        ["watercolor", "cartoon", "fairytale"] as IllustrationStyle[]
                      ).map((style) => (
                        <option value={style} key={style}>
                          {text.growthStyleOptions[style]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>{text.growthTreatment}</legend>
                    <div className="minimal-growth-treatment-options">
                      {(
                        [
                          "documentary",
                          "warm-imagination",
                          "fairytale",
                        ] as GrowthStoryTreatment[]
                      ).map((treatment) => (
                        <label
                          className={
                            growthStoryTreatment === treatment ? "selected" : ""
                          }
                          key={treatment}
                        >
                          <input
                            type="radio"
                            name="growth-story-treatment"
                            value={treatment}
                            checked={growthStoryTreatment === treatment}
                            onChange={() => {
                              setGrowthStoryTreatment(treatment);
                              setGrowthFactsConfirmed(false);
                            }}
                          />
                          <strong>{text.growthTreatments[treatment].label}</strong>
                          <small>{text.growthTreatments[treatment].hint}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <section
                  className="minimal-growth-confirmation"
                  aria-labelledby="growth-confirmation-title"
                >
                  <div className="minimal-growth-confirmation-heading">
                    <strong id="growth-confirmation-title">
                      {text.growthConfirmTitle}
                    </strong>
                    <span>{text.growthConfirmHint}</span>
                  </div>
                  <label>
                    <span>{text.growthFacts}</span>
                    <textarea
                      value={growthParentFacts}
                      readOnly={creatingGrowthVersion}
                      onChange={(event) => {
                        setGrowthParentFacts(event.target.value);
                        setGrowthFactsConfirmed(false);
                      }}
                      maxLength={MAX_GROWTH_CONFIRMATION_LENGTH}
                      placeholder={text.growthFactsPlaceholder}
                    />
                    <small>{text.growthFactsHint}</small>
                  </label>
                  <label>
                    <span>{text.growthImaginations}</span>
                    <textarea
                      value={growthAllowedImaginations}
                      readOnly={creatingGrowthVersion}
                      onChange={(event) =>
                        {
                          setGrowthAllowedImaginations(event.target.value);
                          setGrowthFactsConfirmed(false);
                        }
                      }
                      maxLength={MAX_GROWTH_CONFIRMATION_LENGTH}
                      placeholder={text.growthImaginationsPlaceholder}
                    />
                    <small>{text.growthImaginationsHint}</small>
                  </label>
                  <label className="minimal-growth-confirm-check">
                    <input
                      type="checkbox"
                      checked={growthFactsConfirmed}
                      onChange={(event) => {
                        setGrowthFactsConfirmed(event.target.checked);
                        setGrowthError("");
                      }}
                    />
                    <span>{text.growthConfirmCheck}</span>
                  </label>
                </section>

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

        {homeHero || creatingGrowthVersion ? null : growthEnabled ? (
          <button
            type="button"
            className="minimal-imagination-switch"
            onClick={() => {
              setGrowthEnabled(false);
              setGrowthError("");
            }}
          >
            {locale === "zh" ? "只创作想象故事" : "Create an imaginary story instead"}
          </button>
        ) : (
          <button
            type="button"
            className="minimal-imagination-switch"
            onClick={() => {
              setGrowthEnabled(true);
              setGrowthError("");
            }}
          >
            {locale === "zh" ? "切换到成长记录" : "Switch to a growth record"}
          </button>
        )}

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
      ) : null}

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
            {identityPhase === "preview" && identityAnchorPreview ? (
              <>
                <p className="family-kicker">CHARACTER ANCHOR</p>
                <h2 id="minimal-identity-title">
                  {personalizationContext
                    ? "确认孩子在这个故事里的形象"
                    : text.previewTitle}
                </h2>
                <p>
                  {personalizationContext
                    ? "确认后才会生成完整绘本，减少整本完成后再重画的浪费。"
                    : text.confirmHint}
                </p>
                <div className="minimal-identity-preview">
                  {identityAnchorPreview.imageUrl ? (
                    <img
                      src={identityAnchorPreview.imageUrl}
                      alt={identityAnchorPreview.displayName}
                    />
                  ) : (
                    <div className="minimal-identity-preview-placeholder" aria-hidden="true">
                      <span>{identityAnchorPreview.displayName.slice(0, 1)}</span>
                      <small>文字 Anchor</small>
                    </div>
                  )}
                </div>
                <div className="minimal-anchor-summary">
                  <strong>{identityAnchorPreview.displayName}</strong>
                  <span>{identityAnchorPreview.appearance}</span>
                  <ul>
                    <li>发型与脸型</li>
                    <li>年龄感</li>
                    <li>眼镜等显著特征</li>
                    <li>服装与鞋子</li>
                  </ul>
                  {!identityAnchorPreview.imageUrl ? (
                    <small>
                      未上传照片，将只按家长确认的文字特征生成，不会假装还原真实长相。
                    </small>
                  ) : null}
                </div>
                {identityAnchorPreview.choice?.source_photo_path &&
                identityAnchorPreview.choice.cartoonize ? (
                  <p className="minimal-identity-generation-usage">
                    {text.cartoonizeUsage(
                      getRemainingFamilyCharacterGenerations(
                        identityAnchorPreview.choice.canonical_generation_count,
                      ),
                    )}
                  </p>
                ) : null}
                {identityError ? <p className="minimal-identity-error">{identityError}</p> : null}
                <div className="minimal-identity-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={submitting}
                    onClick={() => {
                      setIdentityError("");
                      const choice = identityAnchorPreview.choice;
                      if (
                        personalizationContext &&
                        choice &&
                        (choice.canonical_photo_path ||
                          choice.source_photo_path)
                      ) {
                        void generateStoryAnchorPreview(choice).catch((error) => {
                          setIdentityPhase("preview");
                          setIdentityError(
                            error instanceof Error
                              ? error.message
                              : "角色 Anchor 生成失败。",
                          );
                        });
                        return;
                      }
                      if (
                        choice?.source_photo_path &&
                        choice.cartoonize &&
                        getRemainingFamilyCharacterGenerations(
                          choice.canonical_generation_count,
                        ) > 0
                      ) {
                        void generateCanonicalPreview(choice).catch((error) => {
                          setIdentityPhase("preview");
                          setIdentityError(
                            error instanceof Error
                              ? error.message
                              : "形象重新生成失败。",
                          );
                        });
                        return;
                      }
                      setIdentityPhase("confirm");
                    }}
                  >
                    {personalizationContext &&
                    identityAnchorPreview.choice &&
                    (identityAnchorPreview.choice.canonical_photo_path ||
                      identityAnchorPreview.choice.source_photo_path)
                      ? "重新生成 Anchor"
                      : identityAnchorPreview.choice?.source_photo_path &&
                    identityAnchorPreview.choice.cartoonize &&
                    getRemainingFamilyCharacterGenerations(
                      identityAnchorPreview.choice.canonical_generation_count,
                    ) > 0
                      ? text.previewRetry
                      : "返回调整"}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={submitting}
                    onClick={() => {
                      const anchor: PersonalizationAnchorConfirmation = {
                        version: 1,
                        displayName: identityAnchorPreview.displayName,
                        relationship: identityAnchorPreview.relationship,
                        appearance: identityAnchorPreview.appearance,
                        referenceType: identityAnchorPreview.referenceType,
                        ...(identityAnchorPreview.choice?.id
                          ? { characterId: identityAnchorPreview.choice.id }
                          : {}),
                        ...(identityAnchorPreview.storyReferenceToken
                          ? {
                              storyReferenceToken:
                                identityAnchorPreview.storyReferenceToken,
                            }
                          : {}),
                        confirmedAt: new Date().toISOString(),
                      };
                      void submitStory(
                        pendingIdea,
                        identityAnchorPreview.displayName,
                        identityAnchorPreview.choice,
                        personalizationContext ? anchor : undefined,
                      );
                    }}
                  >
                    {submitting
                      ? text.generating
                      : personalizationContext
                        ? "确认并生成专属版"
                        : text.previewUse}
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
                <p>
                  {homeHero && growthEnabled
                    ? locale === "zh"
                      ? "确认孩子姓名；本次会生成绘本并保存为成长记录，正文会使用孩子姓名进行第三人称叙述。"
                      : "Confirm the child's name. This book will also be saved as a Moment, using the child's name in third-person narration."
                    : text.confirmHint}
                </p>
                <p className="minimal-identity-perspective" aria-live="polite">
                  {growthEnabled
                    ? locale === "zh"
                      ? `叙事方式：用“${identityName.trim() || "孩子姓名"}”来讲（第三人称）`
                      : `Narration: tell it with “${identityName.trim() || "the child's name"}” (third person)`
                    : locale === "zh"
                      ? "叙事方式：用“我”来讲（第一人称）"
                      : "Narration: tell it as “I” (first person)"}
                </p>

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
                            setIdentityAppearance(
                              choice.description?.trim() ||
                                getDefaultAnchorAppearance(
                                  choice.display_name,
                                  choice.relationship,
                                  personalizationContext?.storySpec.ageGroup,
                                ),
                            );
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
                  {personalizationContext ? (
                    <label className="minimal-identity-appearance-field">
                      <span>角色外观特征</span>
                      <textarea
                        maxLength={1200}
                        value={identityAppearance}
                        onChange={(event) =>
                          setIdentityAppearance(event.target.value)
                        }
                        placeholder="例如：齐耳短发、圆框眼镜、6 岁年龄感、黄色外套和白色运动鞋"
                      />
                      <small>
                        请只填写你确认过的外观；不填写现实经历、学校或住址。
                      </small>
                    </label>
                  ) : null}
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
                    <Link href="/login">{text.loginAction} →</Link>
                  </div>
                )}

                {homeHero ? (
                  <div className="minimal-identity-growth-option">
                    <div>
                      <strong>
                        {locale === "zh"
                          ? "同时生成绘本并保存为成长记录（默认开启）"
                          : "Create the book and save it as a Moment (on by default)"}
                      </strong>
                      <span>
                        {growthEnabled
                          ? locale === "zh"
                            ? "当前开关已开启；故事想法会作为家长确认的事实，记录只保存在当前设备。"
                            : "This is on now. The story idea becomes a parent-confirmed fact, and the record stays on this device."
                          : locale === "zh"
                            ? "当前开关已关闭；只生成纯绘本，正文用第一人称，不保存成长记录。"
                            : "This is off. Create an imagination-first book in first person without saving a Moment."}
                      </span>
                      <Link href="/child-family-data">
                        {locale === "zh" ? "了解数据边界" : "Data details"}
                      </Link>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={growthEnabled}
                      aria-label={
                        locale === "zh"
                          ? "同时生成绘本并保存为成长记录"
                          : "Create the book and save it as a Moment"
                      }
                      className={growthEnabled ? "active" : ""}
                      onClick={() => {
                        const nextEnabled = !growthEnabled;
                        setGrowthEnabled(nextEnabled);
                        setGrowthError("");
                        setIdentityError("");
                        if (nextEnabled) {
                          setGrowthParentFacts(
                            (current) => current.trim() || pendingIdea.trim(),
                          );
                          setGrowthFactsConfirmed(true);
                        } else {
                          setGrowthFactsConfirmed(false);
                        }
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>
                ) : null}

                {identityError ? <p className="minimal-identity-error">{identityError}</p> : null}
                <div className="minimal-identity-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={submitting}
                    onClick={() => {
                      if (growthEnabled) {
                        setGrowthEnabled(false);
                        setGrowthFactsConfirmed(false);
                        setGrowthError("");
                        setIdentityError("");
                        return;
                      }
                      if (personalizationContext) {
                        const displayName = locale === "zh" ? "我" : "I";
                        const appearance =
                          identityAppearance.trim() ||
                          getDefaultAnchorAppearance(
                            displayName,
                            locale === "zh" ? "孩子" : "Child",
                            personalizationContext.storySpec.ageGroup,
                          );
                        setIdentityAnchorPreview({
                          displayName,
                          relationship: locale === "zh" ? "孩子" : "Child",
                          appearance,
                          referenceType: "text",
                        });
                        setIdentityPhase("preview");
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
