"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, SpinnerGap, UploadSimple } from "@phosphor-icons/react";
import type { AgeGroup, IllustrationStyle, Language, StoryTheme } from "@/types";

type AppLocale = "zh" | "en";
type TurnstileMode = "checking" | "enabled" | "disabled";
type FormMode = "quick" | "custom";
type CharacterUploadStatus = "idle" | "analyzing" | "ready" | "error";

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
  onSubmit: (data: Record<string, unknown>) => void;
  freeGenerationLimit: number;
  remainingFreeGenerations: number;
}

const FORM_COPY = {
  zh: {
    modeLabel: "生成模式",
    quickMode: "快速模式",
    customMode: "自定义模式",
    quickHint: "只输入名字，系统会自动搭配主角、年龄段、主题和插画风格。",
    nameRequiredToast: "先输入孩子的名字",
    disabledVerificationHint: "完成人机验证后就可以生成。",
    disabledCheckingHint: "正在检查人机验证环境，请稍候。",
    childName: "孩子的名字",
    childNamePlaceholder: "例如：小满 / Emma",
    characterTitle: "主角形象",
    characterHint: "选择预设人物，或上传一张单人照片。后续每页插图会按同一角色描述保持一致。",
    uploadCharacter: "上传自定义人物",
    uploadCharacterHint: "请使用清晰的单人照片，系统会提取发型、脸型和服装等可见特征。",
    uploadCharacterFormats: "JPG / PNG / WebP · 最大 8MB",
    uploadCharacterPrivacy: "原图仅作为本次绘本的临时图生图参考，不会返回前端或写入作品记录。",
    uploadCharacterAnalyzing: "正在识别人物特征…",
    uploadCharacterReady: "已识别为单人角色",
    uploadCharacterAgain: "重新上传",
    uploadCharacterUse: "使用这个人物",
    uploadCharacterInvalid: "请上传一张主体清晰的单人照片。",
    ageGroup: "年龄段",
    ageSuffix: "岁",
    personalizationTitle: "孩子的小偏好（选填）",
    personalizationHint: "填一两项就够了，系统会自然融入故事，不会生硬罗列。",
    favoriteToy: "最爱的玩具",
    favoriteToyPlaceholder: "例如：蓝色小恐龙、兔子玩偶",
    favoriteFood: "最爱吃的食物",
    favoriteFoodPlaceholder: "例如：草莓、番茄鸡蛋面",
    bestFriend: "最好的朋友",
    bestFriendPlaceholder: "例如：朵朵、幼儿园的乐乐",
    otherDetails: "其他小细节",
    otherDetailsPlaceholder: "例如：喜欢消防车、害怕打雷、常说“我可以”",
    themeTitle: "故事主题",
    themeHint: "保留 6 个高频主题，也支持自定义孩子最近在意的小事。",
    customTheme: "自定义主题",
    customThemeHint: "输入孩子最近在意的一件小事",
    customThemePlaceholder: "例如：第一次自己去幼儿园、学会骑平衡车",
    styleTitle: "插画风格",
    styleHint: "系统会直接生成完整内容；8 页插图会进入预览、朗读和分享长图。",
    languageMode: "语言模式",
    optional: "更多高级设定",
    characterDescription: "主角形象描述",
    characterDescriptionPlaceholder: "例如：卷卷短发、爱背黄色小书包",
    dedication: "扉页寄语",
    dedicationPlaceholder: "例如：送给勇敢长大的你",
    submitGenerating: "正在生成绘本...",
    quotaExhausted: "今日免费次数已用完",
    submit: (remaining: number) => `免费生成 ${remaining} 次`,
    submitNotesLabel: "免费生成说明",
    submitQuotaNote: (limit: number, remaining: number) =>
      `每天 ${limit} 次免费生成，当前浏览器今日还剩 ${remaining} 次。`,
    submitImageNote:
      "免费版会尝试多种 AI 生图模型，适合快速预览故事效果；不同页面的人物细节可能略有差异。",
    turnstileExpired: "人机验证已过期，请重新验证。",
    turnstileFailed: "人机验证加载失败，请刷新后重试。",
    turnstileRequired: "请先完成人机验证。",
  },
  en: {
    modeLabel: "Generation mode",
    quickMode: "Quick",
    customMode: "Custom",
    quickHint: "Enter a name only. StoryBloom will match the character, age, theme, and illustration style.",
    nameRequiredToast: "Enter the child's name first",
    disabledVerificationHint: "Complete human verification to generate.",
    disabledCheckingHint: "Checking human verification. Please wait.",
    childName: "Child name",
    childNamePlaceholder: "Example: Emma / Lucas",
    characterTitle: "Main character",
    characterHint: "Choose a preset or upload one clear portrait. Every illustration will preserve the same character description.",
    uploadCharacter: "Upload a custom character",
    uploadCharacterHint: "Use a clear photo of one person. StoryBloom will read visible features such as hair, face shape, and clothing.",
    uploadCharacterFormats: "JPG / PNG / WebP · 8MB max",
    uploadCharacterPrivacy: "The original is kept only as a temporary image-to-image reference and is never returned in the story data.",
    uploadCharacterAnalyzing: "Reading character features…",
    uploadCharacterReady: "One-person character recognized",
    uploadCharacterAgain: "Upload another",
    uploadCharacterUse: "Use this character",
    uploadCharacterInvalid: "Upload a clear photo containing one main person.",
    ageGroup: "Age range",
    ageSuffix: "yrs",
    personalizationTitle: "A few personal details (optional)",
    personalizationHint: "One or two details are enough. StoryBloom will weave them in naturally.",
    favoriteToy: "Favorite toy",
    favoriteToyPlaceholder: "Example: blue dinosaur, bunny plush",
    favoriteFood: "Favorite food",
    favoriteFoodPlaceholder: "Example: strawberries, tomato noodles",
    bestFriend: "Best friend",
    bestFriendPlaceholder: "Example: Mia, Leo from kindergarten",
    otherDetails: "Other little details",
    otherDetailsPlaceholder: "Example: loves fire trucks, fears thunder, often says “I can do it”",
    themeTitle: "Story theme",
    themeHint: "Choose from common themes, or describe a recent moment your child cares about.",
    customTheme: "Custom theme",
    customThemeHint: "Describe one recent moment your child cares about",
    customThemePlaceholder: "Example: first day at kindergarten, learning to ride a balance bike",
    styleTitle: "Illustration style",
    styleHint: "StoryBloom generates the full story and sends all 8 pages into preview, narration, and sharing.",
    languageMode: "Story language",
    optional: "More advanced settings",
    characterDescription: "Character description",
    characterDescriptionPlaceholder: "Example: curly short hair, yellow backpack",
    dedication: "Dedication",
    dedicationPlaceholder: "Example: For the brave little explorer",
    submitGenerating: "Generating storybook...",
    quotaExhausted: "No free generations left today",
    submit: (remaining: number) => `Generate free (${remaining} left)`,
    submitNotesLabel: "Free generation notes",
    submitQuotaNote: (limit: number, remaining: number) =>
      `${limit} free generations per day. This browser has ${remaining} left today.`,
    submitImageNote:
      "The free version tries multiple AI image models for fast previews; minor character details may vary between pages.",
    turnstileExpired: "Human verification expired. Please verify again.",
    turnstileFailed: "Human verification failed to load. Please refresh and try again.",
    turnstileRequired: "Please complete human verification first.",
  },
};

const THEMES: Array<{
  id: StoryTheme;
  label: Record<AppLocale, string>;
  emoji: string;
  hint: Record<AppLocale, string>;
}> = [
  {
    id: "courage",
    label: { zh: "勇气冒险", en: "Courage" },
    emoji: "🏕️",
    hint: {
      zh: "适合怕黑、怕新环境的小朋友",
      en: "For children facing darkness, change, or new places",
    },
  },
  {
    id: "friendship",
    label: { zh: "友谊分享", en: "Friendship" },
    emoji: "🤝",
    hint: {
      zh: "适合社交启蒙和分享主题",
      en: "For social growth, sharing, and kindness",
    },
  },
  {
    id: "nature",
    label: { zh: "自然探索", en: "Nature" },
    emoji: "🌿",
    hint: {
      zh: "适合喜欢动物、花园和季节故事",
      en: "For animals, gardens, and seasonal stories",
    },
  },
  {
    id: "family",
    label: { zh: "家庭温暖", en: "Family" },
    emoji: "🏠",
    hint: {
      zh: "适合亲子共读和睡前故事",
      en: "For bedtime reading and family warmth",
    },
  },
  {
    id: "fear",
    label: { zh: "克服害怕", en: "Overcome Fear" },
    emoji: "✨",
    hint: {
      zh: "适合建立安全感和表达情绪",
      en: "For safety, confidence, and emotional expression",
    },
  },
  {
    id: "creativity",
    label: { zh: "想象创造", en: "Creativity" },
    emoji: "🎨",
    hint: {
      zh: "适合喜欢画画、搭建和幻想的孩子",
      en: "For children who love drawing, building, and imagination",
    },
  },
];

const STYLES: Array<{
  id: IllustrationStyle;
  label: Record<AppLocale, string>;
  preview: string;
  desc: Record<AppLocale, string>;
}> = [
  {
    id: "watercolor",
    label: { zh: "水彩柔和", en: "Soft Watercolor" },
    preview: "🎨",
    desc: { zh: "温柔、适合睡前阅读", en: "Gentle and warm for bedtime reading" },
  },
  {
    id: "cartoon",
    label: { zh: "卡通活泼", en: "Playful Cartoon" },
    preview: "⭐",
    desc: { zh: "高饱和、角色表情更夸张", en: "Brighter colors and expressive characters" },
  },
  {
    id: "fairytale",
    label: { zh: "童话梦境", en: "Fairytale Dream" },
    preview: "🏰",
    desc: { zh: "更浪漫、适合魔法冒险感", en: "Dreamy and magical for fairytale adventures" },
  },
];

const LANGUAGE_OPTIONS: Array<{ value: Language; label: Record<AppLocale, string> }> = [
  { value: "zh-en", label: { zh: "中文为主 + 英文辅助", en: "Chinese primary + English support" } },
  { value: "en-zh", label: { zh: "英文为主 + 中文辅助", en: "English primary + Chinese support" } },
  { value: "zh", label: { zh: "纯中文", en: "Chinese only" } },
  { value: "en", label: { zh: "纯英文", en: "English only" } },
];

const CHARACTER_REFERENCES = [
  {
    id: "boy-sunshine",
    label: { zh: "阳光男孩", en: "Sunshine Boy" },
    image: "/characters/boy-sunshine.png",
    prompt:
      "A cheerful preschool-age boy in premium 3D cartoon style, tousled warm brown hair, large brown eyes, bright open smile, yellow shirt and blue denim overalls, soft rounded face, polished clay-like animation render.",
  },
  {
    id: "boy-forest",
    label: { zh: "森林男孩", en: "Forest Boy" },
    image: "/characters/boy-forest.png",
    prompt:
      "A calm preschool-age boy in premium 3D cartoon style, short dark brown hair, gentle green-brown eyes, soft smile, green shirt and muted green overalls, rounded child proportions, polished clay-like animation render.",
  },
  {
    id: "boy-dreamer",
    label: { zh: "梦境男孩", en: "Dreamer Boy" },
    image: "/characters/boy-dreamer.png",
    prompt:
      "A dreamy preschool-age boy in premium 3D cartoon style, short blue-black hair, big curious dark eyes, lavender blue shirt and purple overalls, thoughtful upward gaze, polished clay-like animation render.",
  },
  {
    id: "girl-starlight",
    label: { zh: "星光女孩", en: "Starlight Girl" },
    image: "/characters/girl-starlight.png",
    prompt:
      "A bright preschool-age girl in premium 3D cartoon style, warm brown bob haircut with a small pink hair clip, big brown eyes, joyful smile, pink shirt and blue denim overalls, polished clay-like animation render.",
  },
  {
    id: "girl-sprout",
    label: { zh: "花园女孩", en: "Garden Girl" },
    image: "/characters/girl-sprout.png",
    prompt:
      "A fresh preschool-age girl in premium 3D cartoon style, chestnut wavy hair with a small yellow flower clip, gentle smile, yellow shirt and green overalls, warm friendly expression, polished clay-like animation render.",
  },
  {
    id: "girl-moon",
    label: { zh: "月光女孩", en: "Moonlight Girl" },
    image: "/characters/girl-moon.png",
    prompt:
      "A quiet preschool-age girl in premium 3D cartoon style, dark violet-black hair tied in a side bun with a yellow star clip, purple eyes, lavender shirt and blue-purple overalls, thoughtful pose, polished clay-like animation render.",
  },
];

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const AGE_OPTIONS: AgeGroup[] = ["2-3", "4-5", "6-8"];
const CUSTOM_CHARACTER_REFERENCE_ID = "custom-upload";
const ACCEPTED_CHARACTER_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CHARACTER_IMAGE_BYTES = 8 * 1024 * 1024;
const QUICK_THEMES: Exclude<StoryTheme, "custom">[] = [
  "courage",
  "friendship",
  "nature",
  "family",
  "fear",
  "creativity",
];
const STYLE_OPTIONS: IllustrationStyle[] = ["watercolor", "cartoon", "fairytale"];

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function prepareCharacterPhoto(file: File) {
  if (!ACCEPTED_CHARACTER_IMAGE_TYPES.has(file.type) || file.size > MAX_CHARACTER_IMAGE_BYTES) {
    throw new Error("invalid-file");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("image-processing-failed");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("image-processing-failed"))),
      "image/webp",
      0.86
    );
  });
}

export default function StoryForm({
  locale,
  freeGenerationLimit,
  remainingFreeGenerations,
  onSubmit,
}: Props) {
  const text = FORM_COPY[locale];
  const [formMode, setFormMode] = useState<FormMode>("quick");
  const [childName, setChildName] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("4-5");
  const [favoriteToy, setFavoriteToy] = useState("");
  const [favoriteFood, setFavoriteFood] = useState("");
  const [bestFriend, setBestFriend] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [theme, setTheme] = useState<StoryTheme>("courage");
  const [customTheme, setCustomTheme] = useState("");
  const [style, setStyle] = useState<IllustrationStyle>("watercolor");
  const [language, setLanguage] = useState<Language>(locale === "zh" ? "zh-en" : "en-zh");
  const [characterReferenceId, setCharacterReferenceId] = useState("boy-sunshine");
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterUploadStatus, setCharacterUploadStatus] =
    useState<CharacterUploadStatus>("idle");
  const [customCharacterPrompt, setCustomCharacterPrompt] = useState("");
  const [customCharacterSummary, setCustomCharacterSummary] = useState("");
  const [customCharacterReferenceToken, setCustomCharacterReferenceToken] = useState("");
  const [customCharacterPreview, setCustomCharacterPreview] = useState("");
  const [characterUploadError, setCharacterUploadError] = useState("");
  const [dedication, setDedication] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileMode, setTurnstileMode] = useState<TurnstileMode>(
    TURNSTILE_SITE_KEY ? "checking" : "disabled"
  );
  const childNameInputRef = useRef<HTMLInputElement | null>(null);
  const characterRecognitionRequestRef = useRef(0);
  const characterRecognitionAbortRef = useRef<AbortController | null>(null);
  const namePromptTimerRef = useRef<number | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileEnabled =
    Boolean(TURNSTILE_SITE_KEY) && turnstileMode === "enabled";
  const turnstileChecking =
    Boolean(TURNSTILE_SITE_KEY) && turnstileMode === "checking";
  const quotaExhausted = remainingFreeGenerations <= 0;
  const childNameReady = Boolean(childName.trim());
  const verificationBlocked =
    turnstileChecking || (turnstileEnabled && !turnstileToken);
  const customCharacterBlocked =
    formMode === "custom" &&
    characterReferenceId === CUSTOM_CHARACTER_REFERENCE_ID &&
    (characterUploadStatus !== "ready" || !customCharacterReferenceToken);
  const submitDisabled =
    submitting ||
    quotaExhausted ||
    customCharacterBlocked ||
    (childNameReady && verificationBlocked);
  const submitHint = turnstileChecking
    ? text.disabledCheckingHint
    : turnstileEnabled && !turnstileToken
      ? text.disabledVerificationHint
      : null;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setTurnstileMode("disabled");
      return;
    }

    setTurnstileMode("enabled");
  }, []);

  useEffect(() => {
    if (turnstileEnabled && window.turnstile) {
      setTurnstileLoaded(true);
    }
  }, [turnstileEnabled]);

  useEffect(() => {
    setLanguage((current) => {
      if (current === "zh-en" || current === "en-zh") {
        return locale === "zh" ? "zh-en" : "en-zh";
      }

      return current;
    });
  }, [locale]);

  useEffect(() => {
    if (
      !turnstileEnabled ||
      !turnstileLoaded ||
      !window.turnstile ||
      !turnstileContainerRef.current ||
      turnstileWidgetIdRef.current
    ) {
      return;
    }

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError(null);
      },
      "expired-callback": () => {
        setTurnstileToken("");
        setTurnstileError(text.turnstileExpired);
      },
      "error-callback": () => {
        setTurnstileToken("");
        setTurnstileError(text.turnstileFailed);
      },
    });

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [text.turnstileExpired, text.turnstileFailed, turnstileEnabled, turnstileLoaded]);

  useEffect(() => {
    return () => {
      if (namePromptTimerRef.current) {
        window.clearTimeout(namePromptTimerRef.current);
      }
      characterRecognitionAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (customCharacterPreview) {
        URL.revokeObjectURL(customCharacterPreview);
      }
    };
  }, [customCharacterPreview]);

  async function handleCharacterUpload(file: File) {
    const requestId = characterRecognitionRequestRef.current + 1;
    characterRecognitionRequestRef.current = requestId;
    characterRecognitionAbortRef.current?.abort();
    const controller = new AbortController();
    characterRecognitionAbortRef.current = controller;

    setCharacterReferenceId(CUSTOM_CHARACTER_REFERENCE_ID);
    setCharacterUploadStatus("analyzing");
    setCharacterUploadError("");
    setCustomCharacterPrompt("");
    setCustomCharacterSummary("");
    setCustomCharacterReferenceToken("");
    setCustomCharacterPreview("");

    try {
      const photo = await prepareCharacterPhoto(file);
      if (requestId !== characterRecognitionRequestRef.current) return;

      setCustomCharacterPreview(URL.createObjectURL(photo));
      const formData = new FormData();
      formData.append("image", photo, "character.webp");
      formData.append("locale", locale);

      const response = await fetch("/api/character-recognition", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        prompt?: string;
        summary?: string;
        referenceToken?: string;
      };

      if (!response.ok || !payload.prompt || !payload.summary || !payload.referenceToken) {
        throw new Error(payload.error || text.uploadCharacterInvalid);
      }
      if (requestId !== characterRecognitionRequestRef.current) return;

      setCustomCharacterPrompt(payload.prompt);
      setCustomCharacterSummary(payload.summary);
      setCustomCharacterReferenceToken(payload.referenceToken);
      setCharacterUploadStatus("ready");
    } catch (error) {
      if (controller.signal.aborted || requestId !== characterRecognitionRequestRef.current) {
        return;
      }
      const message =
        error instanceof Error && error.message === "invalid-file"
          ? `${text.uploadCharacterInvalid} ${text.uploadCharacterFormats}`
          : error instanceof Error && error.message !== "image-processing-failed"
            ? error.message
            : text.uploadCharacterInvalid;
      setCharacterUploadStatus("error");
      setCharacterUploadError(message);
    }
  }

  function showNameRequiredPrompt() {
    setNamePromptVisible(true);
    if (namePromptTimerRef.current) {
      window.clearTimeout(namePromptTimerRef.current);
    }
    namePromptTimerRef.current = window.setTimeout(() => {
      setNamePromptVisible(false);
      namePromptTimerRef.current = null;
    }, 1800);

    childNameInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => {
      childNameInputRef.current?.focus({ preventScroll: true });
    }, 240);
  }

  function handleSubmitClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (childNameReady) {
      return;
    }

    event.preventDefault();
    showNameRequiredPrompt();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!childNameReady) {
      showNameRequiredPrompt();
      return;
    }

    if (quotaExhausted) {
      return;
    }

    if (turnstileChecking) {
      return;
    }

    if (turnstileEnabled && !turnstileToken) {
      setTurnstileError(text.turnstileRequired);
      return;
    }

    if (
      formMode === "custom" &&
      characterReferenceId === CUSTOM_CHARACTER_REFERENCE_ID &&
      (characterUploadStatus !== "ready" || !customCharacterReferenceToken)
    ) {
      return;
    }

    const isQuickMode = formMode === "quick";
    const nextAgeGroup = isQuickMode ? getRandomItem(AGE_OPTIONS) : ageGroup;
    const nextTheme = isQuickMode ? getRandomItem(QUICK_THEMES) : theme;
    const nextStyle = isQuickMode ? getRandomItem(STYLE_OPTIONS) : style;
    const nextCharacterReferenceId = isQuickMode
      ? getRandomItem(CHARACTER_REFERENCES).id
      : characterReferenceId;
    const selectedCharacter = CHARACTER_REFERENCES.find(
      (item) => item.id === nextCharacterReferenceId
    );
    const isCustomCharacter = nextCharacterReferenceId === CUSTOM_CHARACTER_REFERENCE_ID;
    const characterReferencePrompt = isCustomCharacter
      ? customCharacterPrompt
      : selectedCharacter?.prompt;
    const characterReferenceLabel = isCustomCharacter
      ? locale === "zh"
        ? "自定义照片"
        : "Custom photo"
      : selectedCharacter?.label[locale];
    const extraCharacterDescription = isQuickMode ? "" : characterDescription.trim();
    const characterProfile = [
      characterReferencePrompt,
      extraCharacterDescription ? `Extra user detail: ${extraCharacterDescription}` : null,
      "Character consistency lock: keep the same child identity, gender presentation, haircut, hair color, face shape, outfit color, and illustration rendering across every page.",
      "Rendering lock: keep a premium 3D cartoon animation look, soft studio lighting, rounded clay-like materials, clean storybook background, and no watercolor style drift.",
    ]
      .filter(Boolean)
      .join(" ");

    setSubmitting(true);
    onSubmit({
      childName: childName.trim(),
      ageGroup: nextAgeGroup,
      favoriteToy: isQuickMode ? undefined : favoriteToy.trim() || undefined,
      favoriteFood: isQuickMode ? undefined : favoriteFood.trim() || undefined,
      bestFriend: isQuickMode ? undefined : bestFriend.trim() || undefined,
      otherDetails: isQuickMode ? undefined : otherDetails.trim() || undefined,
      theme: nextTheme,
      customTheme: nextTheme === "custom" ? customTheme.trim() : undefined,
      style: nextStyle,
      language,
      characterReferenceId: isCustomCharacter
        ? CUSTOM_CHARACTER_REFERENCE_ID
        : selectedCharacter?.id,
      characterReferenceLabel,
      characterReferencePrompt,
      customCharacterReferenceToken: isCustomCharacter
        ? customCharacterReferenceToken
        : undefined,
      characterDescription: characterProfile || undefined,
      dedication: isQuickMode ? undefined : dedication.trim() || undefined,
      turnstileToken: turnstileEnabled ? turnstileToken || undefined : undefined,
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="story-form" noValidate>
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileLoaded(true)}
          onReady={() => setTurnstileLoaded(true)}
          onError={() => setTurnstileError(text.turnstileFailed)}
        />
      ) : null}

      <div className="mode-field" aria-label={text.modeLabel}>
        <div className="mode-toggle">
          {(["quick", "custom"] as FormMode[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`mode-option ${formMode === value ? "mode-option-active" : ""}`}
              aria-pressed={formMode === value}
              data-selected={formMode === value}
              onClick={() => setFormMode(value)}
            >
              {value === "quick" ? text.quickMode : text.customMode}
            </button>
          ))}
        </div>
      </div>

      <section className="form-section">
        <div className="field child-name-field">
          <label className="field-label" htmlFor="childName">
            <svg
              className="child-name-icon"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" />
            </svg>
            {text.childName}
          </label>
          <input
            ref={childNameInputRef}
            id="childName"
            className="text-input"
            type="text"
            placeholder={text.childNamePlaceholder}
            value={childName}
            onChange={(event) => {
              setChildName(event.target.value);
              if (event.target.value.trim()) {
                setNamePromptVisible(false);
              }
            }}
            maxLength={20}
            required
          />
        </div>

        {formMode === "quick" ? (
          <div className="quick-summary" role="note">
            {text.quickHint}
          </div>
        ) : (
          <>
            <div className="field character-field">
              <div className="section-header compact">
                <h3>{text.characterTitle}</h3>
                <p>{text.characterHint}</p>
              </div>
              <div
                className={`character-upload-panel ${
                  characterReferenceId === CUSTOM_CHARACTER_REFERENCE_ID
                    ? "character-upload-panel-active"
                    : ""
                }`}
                data-selected={characterReferenceId === CUSTOM_CHARACTER_REFERENCE_ID}
                aria-busy={characterUploadStatus === "analyzing"}
              >
                <label className="character-upload-picker">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void handleCharacterUpload(file);
                    }}
                  />
                  <span className="character-upload-preview" aria-hidden="true">
                    {customCharacterPreview ? (
                      <img src={customCharacterPreview} alt="" />
                    ) : characterUploadStatus === "analyzing" ? (
                      <SpinnerGap className="spin" size={26} />
                    ) : (
                      <UploadSimple size={27} />
                    )}
                  </span>
                  <span className="character-upload-copy" aria-live="polite">
                    <strong>
                      {characterUploadStatus === "analyzing"
                        ? text.uploadCharacterAnalyzing
                        : characterUploadStatus === "ready"
                          ? text.uploadCharacterReady
                          : text.uploadCharacter}
                    </strong>
                    <span>
                      {characterUploadStatus === "ready"
                        ? customCharacterSummary
                        : text.uploadCharacterHint}
                    </span>
                    <small>
                      {characterUploadStatus === "ready"
                        ? text.uploadCharacterAgain
                        : text.uploadCharacterFormats}
                    </small>
                  </span>
                  {characterUploadStatus === "ready" ? (
                    <CheckCircle className="character-upload-check" size={24} weight="fill" />
                  ) : null}
                </label>
                {characterUploadStatus === "ready" &&
                characterReferenceId !== CUSTOM_CHARACTER_REFERENCE_ID ? (
                  <button
                    type="button"
                    className="character-upload-use"
                    onClick={() => setCharacterReferenceId(CUSTOM_CHARACTER_REFERENCE_ID)}
                  >
                    {text.uploadCharacterUse}
                  </button>
                ) : null}
                {characterUploadError ? (
                  <p className="character-upload-error" role="alert">
                    {characterUploadError}
                  </p>
                ) : null}
                <p className="character-upload-privacy">{text.uploadCharacterPrivacy}</p>
              </div>
              <div className="character-grid">
                {CHARACTER_REFERENCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`character-card ${
                      characterReferenceId === item.id ? "character-card-active" : ""
                    }`}
                    aria-pressed={characterReferenceId === item.id}
                    data-selected={characterReferenceId === item.id}
                    onClick={() => setCharacterReferenceId(item.id)}
                  >
                    <img src={item.image} alt="" aria-hidden="true" />
                    <span>{item.label[locale]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">{text.ageGroup}</span>
              <div className="pill-group">
                {AGE_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`pill ${ageGroup === value ? "pill-active" : ""}`}
                    aria-pressed={ageGroup === value}
                    data-selected={ageGroup === value}
                    onClick={() => setAgeGroup(value)}
                  >
                    {value} {text.ageSuffix}
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="personalization-fieldset">
              <legend>{text.personalizationTitle}</legend>
              <p className="personalization-hint">{text.personalizationHint}</p>
              <div className="personalization-grid">
                <div className="field">
                  <label className="field-label" htmlFor="favoriteToy">
                    {text.favoriteToy}
                  </label>
                  <input
                    id="favoriteToy"
                    className="text-input"
                    type="text"
                    placeholder={text.favoriteToyPlaceholder}
                    value={favoriteToy}
                    onChange={(event) => setFavoriteToy(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="favoriteFood">
                    {text.favoriteFood}
                  </label>
                  <input
                    id="favoriteFood"
                    className="text-input"
                    type="text"
                    placeholder={text.favoriteFoodPlaceholder}
                    value={favoriteFood}
                    onChange={(event) => setFavoriteFood(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="bestFriend">
                    {text.bestFriend}
                  </label>
                  <input
                    id="bestFriend"
                    className="text-input"
                    type="text"
                    placeholder={text.bestFriendPlaceholder}
                    value={bestFriend}
                    onChange={(event) => setBestFriend(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="otherDetails">
                    {text.otherDetails}
                  </label>
                  <input
                    id="otherDetails"
                    className="text-input"
                    type="text"
                    placeholder={text.otherDetailsPlaceholder}
                    value={otherDetails}
                    onChange={(event) => setOtherDetails(event.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>
            </fieldset>
          </>
        )}
      </section>

      {formMode === "custom" ? (
        <>
          <section className="form-section">
            <div className="section-header">
              <h3>{text.themeTitle}</h3>
              <p>{text.themeHint}</p>
            </div>
            <div className="theme-grid">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`theme-card ${theme === item.id ? "theme-card-active" : ""}`}
                  aria-pressed={theme === item.id}
                  data-selected={theme === item.id}
                  onClick={() => setTheme(item.id)}
                >
                  <span className="theme-emoji">{item.emoji}</span>
                  <span className="theme-title">{item.label[locale]}</span>
                  <span className="theme-hint">{item.hint[locale]}</span>
                </button>
              ))}
              <button
                type="button"
                className={`theme-card ${theme === "custom" ? "theme-card-active" : ""}`}
                aria-pressed={theme === "custom"}
                data-selected={theme === "custom"}
                onClick={() => setTheme("custom")}
              >
                <span className="theme-emoji">📝</span>
                <span className="theme-title">{text.customTheme}</span>
                <span className="theme-hint">{text.customThemeHint}</span>
              </button>
            </div>
            {theme === "custom" ? (
              <input
                className="text-input"
                type="text"
                placeholder={text.customThemePlaceholder}
                value={customTheme}
                onChange={(event) => setCustomTheme(event.target.value)}
                maxLength={100}
              />
            ) : null}
          </section>

          <section className="form-section">
            <div className="section-header">
              <h3>{text.styleTitle}</h3>
              <p>{text.styleHint}</p>
            </div>
            <div className="style-grid">
              {STYLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`style-card ${style === item.id ? "style-card-active" : ""}`}
                  aria-pressed={style === item.id}
                  data-selected={style === item.id}
                  onClick={() => setStyle(item.id)}
                >
                  <span className="style-preview">{item.preview}</span>
                  <span className="style-name">{item.label[locale]}</span>
                  <span className="style-desc">{item.desc[locale]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="field">
              <label className="field-label" htmlFor="languageMode">
                {text.languageMode}
              </label>
              <select
                id="languageMode"
                className="select-input"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                {LANGUAGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label[locale]}
                  </option>
                ))}
              </select>
            </div>

            <details className="optional-panel">
              <summary>{text.optional}</summary>
              <div className="optional-fields">
                <div className="field">
                  <label className="field-label" htmlFor="characterDescription">
                    {text.characterDescription}
                  </label>
                  <input
                    id="characterDescription"
                    className="text-input"
                    type="text"
                    placeholder={text.characterDescriptionPlaceholder}
                    value={characterDescription}
                    onChange={(event) => setCharacterDescription(event.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="dedication">
                    {text.dedication}
                  </label>
                  <input
                    id="dedication"
                    className="text-input"
                    type="text"
                    placeholder={text.dedicationPlaceholder}
                    value={dedication}
                    onChange={(event) => setDedication(event.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
            </details>
          </section>
        </>
      ) : null}

      <div className="submit-row">
        {turnstileEnabled ? (
          <div className="turnstile-block">
            <div ref={turnstileContainerRef} className="turnstile-widget" />
            {turnstileError ? <p className="turnstile-error">{turnstileError}</p> : null}
          </div>
        ) : null}
        <button
          type="submit"
          className="submit-btn"
          disabled={submitDisabled}
          aria-disabled={submitDisabled || !childNameReady}
          onClick={handleSubmitClick}
          title={submitHint || undefined}
          aria-describedby={submitHint ? "submitHint" : undefined}
        >
          {submitting
            ? text.submitGenerating
            : quotaExhausted
              ? text.quotaExhausted
              : text.submit(remainingFreeGenerations)}
        </button>
        {submitHint ? (
          <p className="submit-hint" id="submitHint">
            {submitHint}
          </p>
        ) : null}
        <div className="submit-notes" aria-label={text.submitNotesLabel}>
          <p className="submit-note">
            <span>{locale === "zh" ? "次数" : "Quota"}</span>
            {text.submitQuotaNote(freeGenerationLimit, remainingFreeGenerations)}
          </p>
          <p className="submit-note">
            <span>{locale === "zh" ? "图片" : "Images"}</span>
            {text.submitImageNote}
          </p>
        </div>
      </div>
      </form>
      {namePromptVisible && typeof document !== "undefined"
        ? createPortal(
            <div className="form-toast" role="status" aria-live="polite">
              {text.nameRequiredToast}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
