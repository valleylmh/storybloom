"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BookPreview from "@/components/book/BookPreview";
import MinimalStoryEntry from "@/components/book/MinimalStoryEntry";
import StoryForm from "@/components/book/StoryForm";
import {
  deleteHistory,
  listHistory,
  upsertHistory,
  type StoryHistoryRecord,
} from "@/lib/client-history";
import SampleStoryImage from "@/components/book/SampleStoryImage";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import type { GenerateErrorResponse, GenerateResponse } from "@/types";

type AppLocale = "zh" | "en";
type AppStep = "form" | "generating" | "preview";
type SampleReturnMode = "generating" | "preview";
type EntryMode = "minimal" | "full";

const LOCALE_STORAGE_KEY = "storybloom.locale";
const LOCALE_COOKIE_NAME = "storybloom_locale";
const BROWSER_ID_STORAGE_KEY = "storybloom.browserId";
const FREE_GENERATION_USAGE_STORAGE_KEY = "storybloom.freeGenerationUsage";
const ENTRY_MODE_STORAGE_KEY = "storybloom.entryMode";
const ENTRY_MODE_QUERY_KEY = "mode";
const STORY_QUERY_KEY = "book";
const VIEW_QUERY_KEY = "view";
const GENERATING_VIEW = "generating";

const FREE_GENERATION_DAILY_LIMIT = (() => {
  const parsed = Number.parseInt(process.env.NEXT_PUBLIC_FREE_GENERATION_DAILY_LIMIT || "3", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();

const COPY = {
  zh: {
    brandSub: "AI 儿童绘本生成器",
    meta: "完整 HTML 预览 · 图片分享 · 朗读",
    badge: (limit: number) => `今日可免费生成 ${limit} 次`,
    eyebrow: "Personalized storybook in 30 seconds",
    headlinePrefix: "30 秒，把孩子的名字",
    headlineEmphasis: "写进一本专属故事书",
    lead: "直接生成完整 8 页 HTML 绘本，适合预览、朗读和分享。",
    description:
      "选择年龄、主题和插画风格，系统会产出完整故事与插图；缺图时会提示重试，重点放在 HTML 预览、朗读和图片分享。",
    timing: "生成约需 1-3 分钟；故事会先展示，插图会逐张完成并自动替换。",
    points: [
      (limit: number) => `每天 ${limit} 次免费生成机会`,
      () => "直接展示完整 8 页内容",
      () => "中文、英文、中英三种朗读",
      () => "生成分享长图 PNG",
    ],
    metrics: [
      { value: (limit: number) => `${limit} 次`, label: "今日免费生成机会" },
      { value: () => "PNG", label: "可生成分享长图" },
      { value: () => "Audio", label: "本机语音朗读" },
    ],
    generatingTitle: "正在生成故事与插画",
    generatingKeepOpen: "请保持页面打开。",
    generatingSavedHint: "故事生成后会自动保存到本机，稍后回来也能继续看。",
    elapsed: "已等待",
    progressLabel: "生成进度",
    localLimitError: (limit: number) => `今日 ${limit} 次免费生成机会已用完，请明天再试。`,
    failedPages: (pages: string) => `失败页码：${pages}。`,
    genericFailure: "生成失败，请稍后再试。",
    localeLabel: "语言",
    zh: "中文",
    en: "English",
    steps: [
      { label: "故事构思", detail: "整理角色、年龄和主题" },
      { label: "文本生成", detail: "生成完整 8 页绘本文案" },
      { label: "画面提示", detail: "统一角色和每页构图" },
      { label: "插图生成", detail: "调用多平台图片模型逐页绘制" },
      { label: "作品装订", detail: "准备 HTML 预览和分享素材" },
    ],
    waitingTips: [
      "插图会逐页返回；512 尺寸会更快完成当前同步等待。",
      "插图生成阶段耗时最长，页面没有刷新时请求仍在继续。",
      "生成完成后可以直接预览、朗读，也可以导出分享长图。",
      "如果某一页插图失败，系统会返回具体失败页码，便于重试定位。",
    ],
    sampleShelfTitle: "先读一本精选绘本",
    sampleShelfHint: "你的专属绘本正在生成，可以先看看这些完整示例。",
    sampleOpen: "开始阅读",
    ownReadyTitle: "你的专属绘本已准备好",
    ownReadyAction: "查看我的绘本",
    backToGenerating: "返回生成进度",
    backToOwnPreview: "返回专属绘本",
    historyTitle: "最近作品",
    historyHint: "本机保存的作品，未完成绘本会置顶。",
    historyContinue: "继续查看",
    historyDelete: "删除",
    historyComplete: "已完成",
    historyGenerating: "生成中",
    historyFailed: "有页面需重试",
  },
  en: {
    brandSub: "AI storybook generator for children",
    meta: "HTML preview · Share image · Narration",
    badge: (limit: number) => `${limit} free generations today`,
    eyebrow: "Personalized storybook in 30 seconds",
    headlinePrefix: "Turn a child's name",
    headlineEmphasis: "into a personal storybook",
    lead: "Generate a complete 8-page HTML storybook for preview, narration, and sharing.",
    description:
      "Choose an age range, theme, and illustration style. StoryBloom creates the story and illustrations, with retry hints when an image fails.",
    timing: "Generation usually takes 1-3 minutes. The story appears first, then images are replaced page by page.",
    points: [
      (limit: number) => `${limit} free generations per day`,
      () => "Complete 8-page story preview",
      () => "Chinese, English, and bilingual narration",
      () => "Shareable long PNG image",
    ],
    metrics: [
      { value: (limit: number) => `${limit}`, label: "free generations today" },
      { value: () => "PNG", label: "share image export" },
      { value: () => "Audio", label: "Browser speech narration" },
    ],
    generatingTitle: "Generating story and illustrations",
    generatingKeepOpen: "Please keep this page open.",
    generatingSavedHint: "Once the story is ready, it will be saved locally so you can come back later.",
    elapsed: "Elapsed",
    progressLabel: "Generation progress",
    localLimitError: (limit: number) => `You have used all ${limit} free generations today. Please try again tomorrow.`,
    failedPages: (pages: string) => `Failed pages: ${pages}.`,
    genericFailure: "Generation failed. Please try again later.",
    localeLabel: "Language",
    zh: "中文",
    en: "English",
    steps: [
      { label: "Story idea", detail: "Organizing character, age, and theme" },
      { label: "Writing", detail: "Writing the complete 8-page story" },
      { label: "Scene prompts", detail: "Aligning character and page composition" },
      { label: "Illustrations", detail: "Generating each page across image providers" },
      { label: "Packaging", detail: "Preparing preview and share assets" },
    ],
    waitingTips: [
      "Illustrations return page by page; 512px helps synchronous generation finish faster.",
      "Image generation is the longest step. If the page is not refreshed, the request is still running.",
      "After generation, you can preview, narrate, or export a share image.",
      "If an illustration fails, StoryBloom returns the exact page number for retry.",
    ],
    sampleShelfTitle: "Read a featured book first",
    sampleShelfHint: "Your personal book is being generated. These complete samples are ready now.",
    sampleOpen: "Read now",
    ownReadyTitle: "Your personal book is ready",
    ownReadyAction: "Open my book",
    backToGenerating: "Back to generation",
    backToOwnPreview: "Back to my book",
    historyTitle: "Recent books",
    historyHint: "Saved on this browser. Unfinished books stay on top.",
    historyContinue: "Continue",
    historyDelete: "Delete",
    historyComplete: "Complete",
    historyGenerating: "Generating",
    historyFailed: "Needs retry",
  },
};

function detectInitialLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "zh";
  }

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (savedLocale === "zh" || savedLocale === "en") {
    return savedLocale;
  }

  const cookieLocale = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.split("=")[1];
  if (cookieLocale === "zh" || cookieLocale === "en") {
    return cookieLocale;
  }

  const languageHints = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const likelyChina =
    timeZone === "Asia/Shanghai" ||
    languageHints.some((language) => /^(zh|zh-CN|zh-Hans)/i.test(language));

  return likelyChina ? "zh" : "en";
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readLocalFreeUsage() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(FREE_GENERATION_USAGE_STORAGE_KEY);
    if (!raw) {
      return 0;
    }

    const parsed = JSON.parse(raw) as { date?: string; count?: number };
    if (parsed.date !== getTodayKey()) {
      return 0;
    }

    const count = typeof parsed.count === "number" ? parsed.count : 0;
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  } catch {
    return 0;
  }
}

function writeLocalFreeUsage(count: number) {
  const nextCount = Math.max(0, count);

  try {
    window.localStorage.setItem(
      FREE_GENERATION_USAGE_STORAGE_KEY,
      JSON.stringify({ date: getTodayKey(), count: nextCount })
    );
  } catch {
    return nextCount;
  }

  return nextCount;
}

function fallbackHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return `fallback-${Math.abs(hash)}`;
}

function getOrCreateBrowserId() {
  try {
    const existing = window.localStorage.getItem(BROWSER_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const id =
      window.crypto?.randomUUID?.() ||
      `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(BROWSER_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

async function getBrowserFingerprint() {
  const source = [
    getOrCreateBrowserId(),
    window.navigator.userAgent,
    window.navigator.language,
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    window.navigator.hardwareConcurrency || "",
  ].join("|");

  if (!window.crypto?.subtle) {
    return fallbackHash(source);
  }

  const buffer = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getGenerationStepIndex(elapsedSeconds: number, progress: number) {
  if (progress >= 96) {
    return 4;
  }

  if (elapsedSeconds < 8) {
    return 0;
  }

  if (elapsedSeconds < 22) {
    return 1;
  }

  if (elapsedSeconds < 42) {
    return 2;
  }

  return 3;
}

function formatElapsedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readEntryModeFromUrl(): EntryMode | null {
  const mode = new URL(window.location.href).searchParams.get(ENTRY_MODE_QUERY_KEY);
  return mode === "minimal" || mode === "full" ? mode : null;
}

function getEntryModeUrl(mode: EntryMode) {
  const url = new URL(window.location.href);

  if (mode === "minimal") {
    url.searchParams.set(ENTRY_MODE_QUERY_KEY, "minimal");
  } else {
    url.searchParams.delete(ENTRY_MODE_QUERY_KEY);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function replaceEntryModeUrl(mode: EntryMode) {
  const nextUrl = getEntryModeUrl(mode);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

function pushEntryModeUrl(mode: EntryMode) {
  const nextUrl = getEntryModeUrl(mode);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState(window.history.state, "", nextUrl);
  }
}

function readStoryIdFromUrl() {
  return new URL(window.location.href).searchParams.get(STORY_QUERY_KEY);
}

function readViewFromUrl() {
  return new URL(window.location.href).searchParams.get(VIEW_QUERY_KEY);
}

function pushGeneratingUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(STORY_QUERY_KEY);
  url.searchParams.set(VIEW_QUERY_KEY, GENERATING_VIEW);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState(window.history.state, "", nextUrl);
  }
}

function replaceStoryUrl(storyId: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(VIEW_QUERY_KEY);
  url.searchParams.set(STORY_QUERY_KEY, storyId);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function replaceFormUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(VIEW_QUERY_KEY);
  url.searchParams.delete(STORY_QUERY_KEY);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function pushStoryUrl(storyId: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(VIEW_QUERY_KEY);
  url.searchParams.set(STORY_QUERY_KEY, storyId);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState(window.history.state, "", nextUrl);
  }
}

export default function Home() {
  const [locale, setLocale] = useState<AppLocale>("zh");
  const [entryMode, setEntryMode] = useState<EntryMode>("full");
  const [step, setStep] = useState<AppStep>("form");
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waitingTipIndex, setWaitingTipIndex] = useState(0);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [sampleResult, setSampleResult] = useState<GenerateResponse | null>(null);
  const [sampleReturnMode, setSampleReturnMode] =
    useState<SampleReturnMode>("generating");
  const [ownReadyNotice, setOwnReadyNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFreeUsage, setLocalFreeUsage] = useState(0);
  const [historyRecords, setHistoryRecords] = useState<StoryHistoryRecord[]>([]);
  const sampleModalOpenRef = useRef(false);
  const historyPreviewOpenRef = useRef(false);
  const generationInFlightRef = useRef(false);
  const generationViewActiveRef = useRef(false);
  const latestGeneratedResultRef = useRef<GenerateResponse | null>(null);

  const text = COPY[locale];
  const generationSteps = text.steps;
  const waitingTips = text.waitingTips;

  useEffect(() => {
    const detectedLocale = detectInitialLocale();
    setLocale(detectedLocale);
    const urlEntryMode = readEntryModeFromUrl();
    const savedEntryMode = window.localStorage.getItem(ENTRY_MODE_STORAGE_KEY);
    const initialEntryMode =
      urlEntryMode ||
      (savedEntryMode === "minimal" || savedEntryMode === "full"
        ? savedEntryMode
        : "full");
    setEntryMode(initialEntryMode);
    window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, initialEntryMode);
    replaceEntryModeUrl(initialEntryMode);
    setLocalFreeUsage(readLocalFreeUsage());
    document.documentElement.lang = detectedLocale === "zh" ? "zh-CN" : "en";

    if (readViewFromUrl() === GENERATING_VIEW && !readStoryIdFromUrl()) {
      // A synchronous browser request cannot be resumed after a full reload.
      replaceFormUrl();
    }

    void listHistory().then((records) => {
      setHistoryRecords(records);
      const storyId = readStoryIdFromUrl();
      const record = storyId
        ? records.find((item) => item.storyId === storyId)
        : null;

      if (record) {
        showHistoryRecord(record);
      }
    });

    const handlePopState = () => {
      // A clean homepage URL is the canonical address for the original full mode.
      // This makes Back/Forward deterministic instead of reapplying the last saved preference.
      const nextMode = readEntryModeFromUrl() || "full";
      setEntryMode(nextMode);
      window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, nextMode);

      const storyId = readStoryIdFromUrl();
      if (storyId) {
        generationViewActiveRef.current = false;
        const generatedResult = latestGeneratedResultRef.current;
        if (generatedResult?.storyId === storyId) {
          historyPreviewOpenRef.current = true;
          setResult(generatedResult);
          setSampleResult(null);
          setError(null);
          setStep("preview");
          return;
        }

        void listHistory().then((records) => {
          if (readStoryIdFromUrl() !== storyId) {
            return;
          }

          setHistoryRecords(records);
          const record = records.find((item) => item.storyId === storyId);
          if (record) {
            showHistoryRecord(record);
          }
        });
        return;
      }

      if (readViewFromUrl() === GENERATING_VIEW) {
        historyPreviewOpenRef.current = false;
        generationViewActiveRef.current = true;
        setSampleResult(null);
        setError(null);

        if (generationInFlightRef.current) {
          setResult(null);
          setStep("generating");
          return;
        }

        const completedResult = latestGeneratedResultRef.current;
        if (completedResult) {
          historyPreviewOpenRef.current = true;
          setResult(completedResult);
          setStep("preview");
          replaceStoryUrl(completedResult.storyId);
          return;
        }

        generationViewActiveRef.current = false;
        replaceFormUrl();
        setResult(null);
        setStep("form");
        return;
      }

      generationViewActiveRef.current = false;
      historyPreviewOpenRef.current = false;
      setResult(null);
      setSampleResult(null);
      setError(null);
      setStep("form");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    sampleModalOpenRef.current = Boolean(sampleResult);
  }, [sampleResult]);

  useEffect(() => {
    if (
      step === "generating" &&
      result &&
      generationViewActiveRef.current &&
      !sampleModalOpenRef.current
    ) {
      setStep("preview");
    }
  }, [result, step]);

  useEffect(() => {
    if (!sampleResult) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sampleResult]);

  useEffect(() => {
    if (step === "generating" && !result) {
      document.title = "绘本生成中 · StoryBloom";
      return;
    }

    if (result && step === "preview") {
      document.title = "绘本好了 · StoryBloom";
      return;
    }

    document.title = "StoryBloom | 一句话生成一本儿童绘本";
  }, [result, step]);

  function changeLocale(nextLocale: AppLocale) {
    setLocale(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  function changeEntryMode(nextMode: EntryMode) {
    if (nextMode === entryMode) {
      return;
    }

    setEntryMode(nextMode);
    window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, nextMode);
    pushEntryModeUrl(nextMode);
  }

  async function handleGenerate(formData: Record<string, unknown>) {
    const currentLocalUsage = readLocalFreeUsage();
    if (currentLocalUsage >= FREE_GENERATION_DAILY_LIMIT) {
      setLocalFreeUsage(currentLocalUsage);
      setError(text.localLimitError(FREE_GENERATION_DAILY_LIMIT));
      return;
    }

    generationInFlightRef.current = true;
    generationViewActiveRef.current = true;
    latestGeneratedResultRef.current = null;
    historyPreviewOpenRef.current = false;
    pushGeneratingUrl();
    setStep("generating");
    setSampleResult(null);
    setOwnReadyNotice(false);
    setResult(null);
    setProgress(8);
    setElapsedSeconds(0);
    setWaitingTipIndex(0);
    setError(null);

    const progressInterval = window.setInterval(() => {
      setProgress((current) => {
        const increment = current < 35 ? 3 : current < 70 ? 1.2 : 0.35;
        return Math.min(current + increment, 92);
      });
    }, 1200);
    const elapsedInterval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    const tipInterval = window.setInterval(() => {
      setWaitingTipIndex((current) => (current + 1) % waitingTips.length);
    }, 6500);

    const stopTimers = () => {
      window.clearInterval(progressInterval);
      window.clearInterval(elapsedInterval);
      window.clearInterval(tipInterval);
    };

    try {
      const browserFingerprint = await getBrowserFingerprint();
      const { supabaseAccessToken, ...generationData } = formData;
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(typeof supabaseAccessToken === "string" && supabaseAccessToken
            ? { Authorization: `Bearer ${supabaseAccessToken}` }
            : {}),
        },
        body: JSON.stringify({ ...generationData, browserFingerprint }),
      });

      const data = (await response.json()) as GenerateResponse | GenerateErrorResponse;
      stopTimers();

      if (!response.ok || ("error" in data && data.error)) {
        const failedPages =
          "failedPages" in data && data.failedPages?.length
            ? text.failedPages(data.failedPages.join(", "))
            : "";
        const message = "error" in data ? `${data.error}${failedPages}` : text.genericFailure;
        throw new Error(message ?? text.genericFailure);
      }

      const generatedResult = data as GenerateResponse;
      generationInFlightRef.current = false;
      latestGeneratedResultRef.current = generatedResult;
      setProgress(100);
      setResult(generatedResult);
      setLocalFreeUsage(writeLocalFreeUsage(currentLocalUsage + 1));
      void upsertHistory(generatedResult)
        .then(setHistoryRecords)
        .catch((historyError) => {
          console.warn("[story-history] failed to save generated story", historyError);
        });

      if (generationViewActiveRef.current) {
        historyPreviewOpenRef.current = true;
        replaceStoryUrl(generatedResult.storyId);
        if (sampleModalOpenRef.current) {
          setOwnReadyNotice(true);
        } else {
          setStep("preview");
        }
      }
    } catch (requestError) {
      stopTimers();
      generationInFlightRef.current = false;
      latestGeneratedResultRef.current = null;
      if (generationViewActiveRef.current) {
        generationViewActiveRef.current = false;
        replaceFormUrl();
      }
      setError(requestError instanceof Error ? requestError.message : text.genericFailure);
      setStep("form");
    }
  }

  function openSampleBook(
    sample: GenerateResponse,
    returnMode: SampleReturnMode = step === "preview" ? "preview" : "generating"
  ) {
    setSampleResult(sample);
    setSampleReturnMode(returnMode);
  }

  function showOwnResult() {
    if (!result) {
      return;
    }

    setOwnReadyNotice(false);
    setSampleResult(null);
    setStep("preview");
  }

  function handleSampleBack() {
    setSampleResult(null);
  }

  function showHistoryRecord(record: StoryHistoryRecord) {
    historyPreviewOpenRef.current = true;
    setResult(record.result);
    setSampleResult(null);
    setOwnReadyNotice(false);
    setError(null);
    setProgress(0);
    setStep("preview");
  }

  function handleHistoryContinue(record: StoryHistoryRecord) {
    showHistoryRecord(record);
    pushStoryUrl(record.storyId);
  }

  function handlePreviewBack() {
    if (historyPreviewOpenRef.current && readStoryIdFromUrl()) {
      window.history.back();
      return;
    }

    historyPreviewOpenRef.current = false;
    setStep("form");
    setResult(null);
    setProgress(0);
  }

  function handleHistoryDelete(storyId: string) {
    void deleteHistory(storyId).then(setHistoryRecords);
  }

  function handleResultUpdate(nextResult: GenerateResponse) {
    if (latestGeneratedResultRef.current?.storyId === nextResult.storyId) {
      latestGeneratedResultRef.current = nextResult;
    }
    setResult((current) =>
      current?.storyId === nextResult.storyId ? nextResult : current
    );
    void upsertHistory(nextResult).then(setHistoryRecords);
  }

  function getHistoryStatusLabel(record: StoryHistoryRecord) {
    if (record.status === "complete") {
      return text.historyComplete;
    }

    if (record.status === "failed") {
      return text.historyFailed;
    }

    return text.historyGenerating;
  }

  const generationStepIndex = getGenerationStepIndex(elapsedSeconds, progress);
  const activeGenerationStep = generationSteps[generationStepIndex];
  const remainingFreeGenerations = Math.max(
    0,
    FREE_GENERATION_DAILY_LIMIT - localFreeUsage
  );
  const libraryEntryCard = (
    <Link href="/library" className="library-entry-card">
      <span className="library-entry-copy">
        <h3>
          {locale === "zh"
            ? "绘本馆 · 双语故事书架"
            : "Story Library · Bilingual series"}
        </h3>
        <p>
          {locale === "zh"
            ? "浏览成语故事等系列双语绘本与即将上线书目。"
            : "Browse bilingual picture-book series and upcoming titles."}
        </p>
      </span>
      <span className="library-entry-arrow">
        {locale === "zh" ? "查看绘本馆 →" : "Browse →"}
      </span>
    </Link>
  );
  const historyPanel = historyRecords.length > 0 ? (
    <section
      className={`history-panel ${entryMode === "minimal" ? "minimal-history-panel" : ""}`}
      aria-label={text.historyTitle}
    >
      <div className="history-header">
        <div>
          <h2>{text.historyTitle}</h2>
          <p>{text.historyHint}</p>
        </div>
      </div>
      <div className="history-list">
        {historyRecords.map((record) => (
          <article
            className="history-item"
            data-status={record.status}
            key={record.storyId}
          >
            <div>
              <div className="history-title-row">
                <h3>{record.result.coverTitle}</h3>
                <span>{getHistoryStatusLabel(record)}</span>
              </div>
              <p>
                {record.result.input.childName} · {record.imageProgress.complete}/
                {record.imageProgress.total} · {formatHistoryTime(record.updatedAt)}
              </p>
            </div>
            <div className="history-actions">
              <button
                type="button"
                className="history-open-btn"
                onClick={() => handleHistoryContinue(record)}
              >
                {text.historyContinue}
              </button>
              <button
                type="button"
                className="text-danger-btn"
                onClick={() => handleHistoryDelete(record.storyId)}
              >
                {text.historyDelete}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <main
      className={
        step === "form" && entryMode === "minimal" ? "minimal-page-shell" : "page-shell"
      }
    >
      {step === "form" && entryMode === "minimal" ? (
        <div className="minimal-top-controls">
          <div className="entry-mode-toggle" aria-label="首页模式">
            <button type="button" className="active" onClick={() => changeEntryMode("minimal") }>
              {locale === "zh" ? "极简" : "Simple"}
            </button>
            <button type="button" onClick={() => changeEntryMode("full") }>
              {locale === "zh" ? "完整" : "Full"}
            </button>
          </div>
          <button
            type="button"
            className="minimal-locale-toggle"
            aria-label={text.localeLabel}
            onClick={() => changeLocale(locale === "zh" ? "en" : "zh")}
          >
            {locale === "zh" ? "EN" : "中"}
          </button>
        </div>
      ) : null}

      {entryMode === "full" ? (
        <section className="hero-shell">
          <header className="hero-nav">
            <div className="brand">
              <div className="brand-topline">
                <span className="brand-mark">StoryBloom</span>
                <button
                  type="button"
                  className="locale-toggle"
                  aria-label={text.localeLabel}
                  onClick={() => changeLocale(locale === "zh" ? "en" : "zh")}
                >
                  {locale === "zh" ? "EN" : "中"}
                </button>
                {step === "form" ? (
                  <div className="entry-mode-toggle entry-mode-toggle-full" aria-label="首页模式">
                    <button type="button" onClick={() => changeEntryMode("minimal") }>
                      {locale === "zh" ? "极简" : "Simple"}
                    </button>
                    <button type="button" className="active" onClick={() => changeEntryMode("full") }>
                      {locale === "zh" ? "完整" : "Full"}
                    </button>
                  </div>
                ) : null}
              </div>
              <span className="brand-sub">{text.brandSub}</span>
            </div>
            <div className="hero-meta">{text.meta}</div>
          </header>

          <div className="hero-grid">
            <div className="hero-copy">
              <div className="hero-intro">
                <span className="hero-badge">{text.badge(FREE_GENERATION_DAILY_LIMIT)}</span>
                <p className="eyebrow">{text.eyebrow}</p>
              </div>
              <h1>
                {text.headlinePrefix}
                <span className="hero-emphasis hero-typewriter" aria-label={text.headlineEmphasis}>
                  <span className="hero-typewriter-text" aria-hidden="true">
                    {text.headlineEmphasis}
                  </span>
                  <span className="hero-typewriter-ghost" aria-hidden="true">
                    {text.headlineEmphasis}
                  </span>
                </span>
              </h1>
              <p className="hero-lead">{text.lead}</p>
              <p className="hero-description">{text.description}</p>
              <p className="hero-timing-note">{text.timing}</p>
              <ul className="hero-points">
                {text.points.map((point, index) => (
                  <li key={index}>{point(FREE_GENERATION_DAILY_LIMIT)}</li>
                ))}
              </ul>
            </div>

            <aside className="hero-panel">
              {text.metrics.map((metric) => (
                <div className="metric-card" key={metric.label}>
                  <strong>{metric.value(FREE_GENERATION_DAILY_LIMIT)}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </aside>
          </div>
        </section>
      ) : null}

      <section
        className={
          step === "form" && entryMode === "minimal"
            ? "minimal-content-shell"
            : "content-shell"
        }
      >
        {error ? <div className="error-banner">{error}</div> : null}

        {step === "form" ? (
          entryMode === "minimal" ? (
            <>
              <MinimalStoryEntry
                locale={locale}
                freeGenerationLimit={FREE_GENERATION_DAILY_LIMIT}
                remainingFreeGenerations={remainingFreeGenerations}
                onSubmit={handleGenerate}
              />
              {libraryEntryCard}
              {historyPanel}
            </>
          ) : (
            <>
              <StoryForm
                locale={locale}
                freeGenerationLimit={FREE_GENERATION_DAILY_LIMIT}
                remainingFreeGenerations={remainingFreeGenerations}
                onSubmit={handleGenerate}
              />
              {libraryEntryCard}
              {historyPanel}
            </>
          )
        ) : null}

        {step === "generating" ? (
          <div className="generating-card">
            <div className="generation-visual" aria-hidden="true">
              <div className="spinner-orb" />
              <div className="mini-book">
                {Array.from({ length: 8 }).map((_, index) => (
                  <span key={index} style={{ animationDelay: `${index * 0.12}s` }} />
                ))}
              </div>
            </div>
            <h2>{text.generatingTitle}</h2>
            <p>
              {activeGenerationStep.detail}，{text.generatingKeepOpen}
            </p>
            <p className="generation-save-note">{text.generatingSavedHint}</p>
            <div className="generation-status-row">
              <span>
                {text.elapsed} {formatElapsedTime(elapsedSeconds)}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="generation-steps" aria-label={text.progressLabel}>
              {generationSteps.map((item, index) => (
                <div
                  key={item.label}
                  className={`generation-step ${
                    index <= generationStepIndex ? "generation-step-active" : ""
                  }`}
                >
                  <span>{index + 1}</span>
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
            <div className="generation-tip">{waitingTips[waitingTipIndex]}</div>
            <section className="sample-shelf" aria-label={text.sampleShelfTitle}>
              <div className="sample-shelf-header">
                <h3>{text.sampleShelfTitle}</h3>
                <p>{text.sampleShelfHint}</p>
              </div>
              <div className="sample-book-grid">
                {SAMPLE_BOOKS.map((sample) => (
                  <button
                    key={sample.storyId}
                    type="button"
                    className="sample-book-card"
                    onClick={() => openSampleBook(sample, "generating")}
                  >
                    <SampleStoryImage
                      className="sample-book-image-frame"
                      placeholderSrc={sample.pages[0]?.sampleImage?.placeholder}
                      realSrc={sample.pages[0]?.sampleImage?.variants["gpt-image-2"]}
                      alt=""
                    />
                    <span className="sample-book-title">{sample.coverTitle}</span>
                    <span className="sample-book-meta">
                      {sample.sampleMeta.themeLabel} · {sample.sampleMeta.ageLabel}
                    </span>
                    <span className="sample-book-open">{text.sampleOpen}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {step === "preview" && result ? (
          <BookPreview
            result={result}
            variant="own"
            onResultUpdate={handleResultUpdate}
            sampleBooks={SAMPLE_BOOKS}
            onOpenSample={(sample) => openSampleBook(sample, "preview")}
            onBack={handlePreviewBack}
          />
        ) : null}

      </section>

      {sampleResult ? (
        <div
          className="sample-modal-backdrop"
          role="presentation"
          onClick={handleSampleBack}
        >
          <div
            className="sample-modal"
            role="dialog"
            aria-modal="true"
            aria-label={sampleResult.coverTitle}
            onClick={(event) => event.stopPropagation()}
          >
            {ownReadyNotice && result ? (
              <div className="own-ready-banner" role="status">
                <strong>{text.ownReadyTitle}</strong>
                <button type="button" className="cta-btn" onClick={showOwnResult}>
                  {text.ownReadyAction}
                </button>
              </div>
            ) : null}
            <BookPreview
              result={sampleResult}
              variant="sample"
              backLabel={
                sampleReturnMode === "preview"
                  ? text.backToOwnPreview
                  : text.backToGenerating
              }
              onBack={handleSampleBack}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
