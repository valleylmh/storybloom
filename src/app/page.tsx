"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpenText,
  CalendarDots,
  GithubLogo,
  Plant,
} from "@phosphor-icons/react";
import BookPreview from "@/components/book/BookPreview";
import MinimalStoryEntry from "@/components/book/MinimalStoryEntry";
import StoryForm from "@/components/book/StoryForm";
import {
  shouldMountBookPreview,
  type ReliableGenerationStage,
} from "@/components/book/story-outline-controller";
import AccountEntryButton from "@/components/auth/AccountEntryButton";
import LocalStoryLibrary from "@/components/account/LocalStoryLibrary";
import type { StoryHistoryRecord } from "@/lib/client-history";
import {
  isGrowthRecordDraft,
  type GrowthRecordDraft,
} from "@/lib/growth-records";
import { createGrowthRecordInput } from "@/lib/repositories/growth-repository";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import {
  clearGrowthVersionCreationIntent,
  createGrowthVersionCreationPreset,
  GROWTH_VERSION_QUERY_KEY,
  isGrowthVersionCreationRequested,
  readGrowthVersionCreationIntent,
  type GrowthVersionCreationPreset,
} from "@/lib/growth-version-creation";
import { appendGeneratedStorybookVersion } from "@/lib/growth-version-result";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import SampleStoryImage from "@/components/book/SampleStoryImage";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import { HOME_FEATURED_LIBRARY_BOOKS } from "@/lib/library/home-featured";
import {
  clearActiveGenerationTask,
  getGenerationTaskIdFromSearch,
  readActiveGenerationTask,
  resolveGenerationTaskRecovery,
  writeActiveGenerationTask,
  TASK_QUERY_KEY,
  type GenerationTaskRecoveryCandidate,
} from "@/lib/client-generation-task";
import {
  confirmStoryOutline,
  prepareStoryGenerationRequest,
  requestStoryGeneration,
  requestStoryGenerationTask,
} from "@/lib/client-story-generation";
import { summarizeIllustrationProgress } from "@/lib/illustration-request-policy";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGrowthStorageErrorCode } from "@/lib/growth-storage-capacity";
import {
  markPersonalizationDraftCompleted,
  markPersonalizationDraftGeneration,
} from "@/lib/personalization-drafts";
import type { ClientTextGenerationTaskResponse } from "@/lib/text-generation-task";
import type {
  GenerateErrorResponse,
  GenerateResponse,
  StoryPage,
} from "@/types";

type AppLocale = "zh" | "en";
type AppStep = "form" | ReliableGenerationStage;
type SampleReturnMode = "generating" | "preview";
type EntryMode = "capture" | "minimal" | "full";

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
    brandSub: "家庭成长记忆绘本",
    meta: "默认本机保存 · 主动开启云端 · 随时导出删除",
    badge: (limit: number) => `今日可免费生成 ${limit} 次`,
    eyebrow: "KEEP THE LITTLE MOMENTS",
    headlinePrefix: "把今天发生的一件小事，",
    headlineEmphasis: "留成以后还能翻开的绘本",
    lead: "写下一句话，记录一个真实时刻，也可以从纯想象开始创作。",
    description:
      "成长模式由家长确认事实和允许的想象；普通创作继续提供完整年龄、主题与风格设置。故事和记录默认留在当前设备。",
    timing: "故事生成后会先展示，8 页插图随后逐页完成；通常需要 1–3 分钟。",
    points: [
      (limit: number) => `每天 ${limit} 次免费生成机会`,
      () => "真实事实由家长确认",
      () => "成长照片不会进入故事生成请求",
      () => "本机与私有云端分开管理",
    ],
    metrics: [
      { value: (limit: number) => `${limit} 次`, label: "今日免费生成机会" },
      { value: () => "PNG", label: "可生成分享长图" },
      { value: () => "Audio", label: "本机语音朗读" },
    ],
    submittingTitle: "正在创建可恢复的生成任务",
    textGeneratingTitle: "正在生成 8 页故事文本",
    taskSubmittingDetail: "正在提交已确认的故事信息。",
    taskGeneratingDetail: "服务端正在写完整故事；当前界面只显示真实任务状态。",
    taskRecoveryHint: "任务标识已保存在此浏览器；刷新后会重新向服务端确认能否恢复。",
    taskStatusLabel: "当前状态",
    taskIdLabel: "任务标识",
    taskStatusSubmitting: "正在提交",
    taskStatusWriting: "文本生成中",
    taskNextLabel: "下一步",
    taskNextImages: "开始逐页生成插画",
    unavailableTitle: "这个生成任务无法继续恢复",
    unavailableHint: "服务端任务可能已过期、中断或不在当前实例中。你可以返回重新生成；本机已有作品不会被删除。",
    failedTitle: "故事文本生成失败",
    failedHint: "任务已明确返回失败，没有开始自动重试。你可以检查故事信息后重新生成。",
    unavailableAction: "返回重新生成",
    localLimitError: (limit: number) => `今日 ${limit} 次免费生成机会已用完，请明天再试。`,
    failedPages: (pages: string) => `失败页码：${pages}。`,
    genericFailure: "生成失败，请稍后再试。",
    localeLabel: "语言",
    zh: "中文",
    en: "English",
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
    brandSub: "Family memory storybooks",
    meta: "Device first · Cloud by choice · Export or delete anytime",
    badge: (limit: number) => `${limit} free generations today`,
    eyebrow: "KEEP THE LITTLE MOMENTS",
    headlinePrefix: "Turn one little moment from today",
    headlineEmphasis: "into a storybook your family can reopen",
    lead: "Write one sentence to preserve a real moment, or begin with pure imagination.",
    description:
      "Parents confirm facts and allowed imagination for growth stories. The full creator remains available for age, theme, and style control. Records stay on this device by default.",
    timing: "The story appears first, followed by 8 page illustrations. Generation usually takes 1–3 minutes.",
    points: [
      (limit: number) => `${limit} free generations per day`,
      () => "Facts are confirmed by a parent",
      () => "Moment photos are not sent with story generation",
      () => "Device and private-cloud copies stay separate",
    ],
    metrics: [
      { value: (limit: number) => `${limit}`, label: "free generations today" },
      { value: () => "PNG", label: "share image export" },
      { value: () => "Audio", label: "Browser speech narration" },
    ],
    submittingTitle: "Creating a recoverable generation task",
    textGeneratingTitle: "Writing the complete 8-page story",
    taskSubmittingDetail: "Submitting the story details you confirmed.",
    taskGeneratingDetail: "The server is writing the story. This screen shows only the real task state.",
    taskRecoveryHint: "The task identifier is saved in this browser. After refresh, StoryBloom asks the server whether it can still be recovered.",
    taskStatusLabel: "Current status",
    taskIdLabel: "Task ID",
    taskStatusSubmitting: "Submitting",
    taskStatusWriting: "Writing story text",
    taskNextLabel: "Next",
    taskNextImages: "Generate illustrations page by page",
    unavailableTitle: "This generation task cannot be recovered",
    unavailableHint: "The server task may have expired, stopped, or be unavailable on this instance. You can start again; books already saved on this device are not deleted.",
    failedTitle: "Story text generation failed",
    failedHint: "The task returned a failure and was not retried automatically. Review the story details and start again when ready.",
    unavailableAction: "Back to create again",
    localLimitError: (limit: number) => `You have used all ${limit} free generations today. Please try again tomorrow.`,
    failedPages: (pages: string) => `Failed pages: ${pages}.`,
    genericFailure: "Generation failed. Please try again later.",
    localeLabel: "Language",
    zh: "中文",
    en: "English",
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

function createClientGenerationTaskId() {
  const randomPart =
    window.crypto?.randomUUID?.().replaceAll("-", "") ||
    `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `task_${randomPart}`;
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

function readEntryModeFromUrl(): EntryMode | null {
  const mode = new URL(window.location.href).searchParams.get(ENTRY_MODE_QUERY_KEY);
  return mode === "capture" || mode === "minimal" || mode === "full"
    ? mode
    : null;
}

function getEntryModeUrl(mode: EntryMode) {
  const url = new URL(window.location.href);

  if (mode === "capture") url.searchParams.delete(ENTRY_MODE_QUERY_KEY);
  else url.searchParams.set(ENTRY_MODE_QUERY_KEY, mode);

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

function readTaskIdFromUrl() {
  return getGenerationTaskIdFromSearch(window.location.search);
}

function getStoryDocumentTitle(pages: StoryPage[]) {
  const illustrationStatus = summarizeIllustrationProgress(pages).status;
  return illustrationStatus === "ready"
    ? "绘本好了 · StoryBloom"
    : illustrationStatus === "partially_failed"
      ? "绘本需修复 · StoryBloom"
      : "故事已完成 · 插图生成中 · StoryBloom";
}

function formatGenerationElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 1) return "不到 1 秒";
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分钟`;
}

function pushGeneratingUrl(taskId: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(STORY_QUERY_KEY);
  url.searchParams.set(VIEW_QUERY_KEY, GENERATING_VIEW);
  url.searchParams.set(TASK_QUERY_KEY, taskId);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState(window.history.state, "", nextUrl);
  }
}

function replaceStoryUrl(storyId: string, taskId?: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(VIEW_QUERY_KEY);
  url.searchParams.delete(GROWTH_VERSION_QUERY_KEY);
  if (taskId) url.searchParams.set(TASK_QUERY_KEY, taskId);
  else url.searchParams.delete(TASK_QUERY_KEY);
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
  url.searchParams.delete(TASK_QUERY_KEY);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function pushStoryUrl(storyId: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(VIEW_QUERY_KEY);
  url.searchParams.delete(TASK_QUERY_KEY);
  url.searchParams.delete(GROWTH_VERSION_QUERY_KEY);
  url.searchParams.set(STORY_QUERY_KEY, storyId);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState(window.history.state, "", nextUrl);
  }
}

export default function Home() {
  const [locale, setLocale] = useState<AppLocale>("zh");
  const [entryMode, setEntryMode] = useState<EntryMode>("capture");
  const [personalizationEntry, setPersonalizationEntry] = useState(false);
  const [step, setStep] = useState<AppStep>("form");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [generationStartedAtMs, setGenerationStartedAtMs] = useState<number | null>(
    null,
  );
  const [generationNowMs, setGenerationNowMs] = useState(() => Date.now());
  const [activeGrowthDraft, setActiveGrowthDraft] =
    useState<GrowthRecordDraft | null>(null);
  const [activeTargetMomentId, setActiveTargetMomentId] =
    useState<string | null>(null);
  const [growthVersionPreset, setGrowthVersionPreset] =
    useState<GrowthVersionCreationPreset | null>(null);
  const [growthVersionIntentLoading, setGrowthVersionIntentLoading] =
    useState(false);
  const [growthVersionIntentError, setGrowthVersionIntentError] =
    useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [sampleResult, setSampleResult] = useState<GenerateResponse | null>(null);
  const [sampleReturnMode, setSampleReturnMode] =
    useState<SampleReturnMode>("generating");
  const [ownReadyNotice, setOwnReadyNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFreeUsage, setLocalFreeUsage] = useState(0);
  const [historyRecords, setHistoryRecords] = useState<StoryHistoryRecord[]>([]);
  const [growthSavedChild, setGrowthSavedChild] = useState<{
    childKey: string;
    childName: string;
    versionAdded?: boolean;
    versionCount?: number;
  } | null>(null);
  const [growthSaveError, setGrowthSaveError] = useState<string | null>(null);
  const sampleModalOpenRef = useRef(false);
  const historyPreviewOpenRef = useRef(false);
  const generationViewActiveRef = useRef(false);
  const latestGeneratedResultRef = useRef<GenerateResponse | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);

  const text = COPY[locale];

  function setCurrentTaskId(taskId: string | null) {
    activeTaskIdRef.current = taskId;
    setActiveTaskId(taskId);
  }

  function showTaskRecoveryFailure(
    message?: string,
    stage: Extract<ReliableGenerationStage, "failed" | "unrecoverable"> =
      "unrecoverable",
  ) {
    if (activeTaskIdRef.current) {
      clearActiveGenerationTask({ taskId: activeTaskIdRef.current });
    }
    generationViewActiveRef.current = false;
    setResult(null);
    setSampleResult(null);
    setCurrentTaskId(null);
    setActiveGrowthDraft(null);
    setActiveTargetMomentId(null);
    setError(message || null);
    setStep(stage);
  }

  async function saveGeneratedResult(
    generatedResult: GenerateResponse,
    growthRecordDraft?: GrowthRecordDraft,
    targetMomentId?: string,
  ) {
    latestGeneratedResultRef.current = generatedResult;
    setResult(generatedResult);

    try {
      const existingStory = await localStoryRepository.get(
        generatedResult.storyId,
      );
      await localStoryRepository.save({ result: generatedResult });
      if (generatedResult.input.personalizationDraftId) {
        markPersonalizationDraftCompleted(
          generatedResult.input.personalizationDraftId,
          generatedResult.storyId,
        );
      }
      setHistoryRecords(await localStoryRepository.list());
      if (!existingStory) {
        setLocalFreeUsage(
          writeLocalFreeUsage(readLocalFreeUsage() + 1),
        );
      }
    } catch (historyError) {
      console.warn("[story-history] failed to save generated story", historyError);
    }

    if (targetMomentId && !growthRecordDraft) {
      setGrowthSaveError(
        locale === "zh"
          ? "绘本已经生成，但缺少本机版本归属信息，未修改原成长时刻。"
          : "The storybook was created, but its local Moment destination was unavailable. The original Moment was not changed.",
      );
      return;
    }

    if (growthRecordDraft) {
      try {
        if (targetMomentId) {
          const momentRepository = localGrowthRepository.moments;
          if (!momentRepository) {
            throw new Error("growth-version-repository-unavailable");
          }
          const updatedBundle = await appendGeneratedStorybookVersion({
            repository: momentRepository,
            targetMomentId,
            growthRecordDraft,
            result: generatedResult,
          });
          clearGrowthVersionCreationIntent();
          setGrowthSavedChild({
            childKey: updatedBundle.moment.childKey,
            childName: updatedBundle.moment.childName,
            versionAdded: true,
            versionCount: updatedBundle.storybookVersions.length,
          });
        } else {
          const growthRecord = await localGrowthRepository.save(
            createGrowthRecordInput(generatedResult, growthRecordDraft),
          );
          setGrowthSavedChild({
            childKey: growthRecord.childKey,
            childName: growthRecord.childName,
          });
        }
      } catch (growthError) {
        const storageCode = getGrowthStorageErrorCode(growthError);
        console.warn("[growth-record] local save failed", { code: storageCode });
        if (storageCode === "growth-storage-quota-exceeded") {
          setGrowthSaveError(
            locale === "zh"
              ? "绘本已经生成，但本站本机空间不足，成长记录未能写入。请先从成长时间轴删除不再需要的现场照片或时刻。"
              : "The storybook was created, but this site does not have enough local storage for the growth record. Remove unneeded Moment photos or Moments first.",
          );
        } else if (storageCode === "growth-storage-unavailable") {
          setGrowthSaveError(
            locale === "zh"
              ? "绘本已经生成，但浏览器的本机成长资料库当前不可用。请退出受限隐私模式或允许本站存储后重试。"
              : "The storybook was created, but the browser's local growth archive is unavailable. Leave restricted private mode or allow site storage, then try again.",
          );
        } else {
          setGrowthSaveError(
            targetMomentId
              ? locale === "zh"
                ? "绘本已经生成，但新版本未能加入原成长时刻；原记录没有被覆盖。"
                : "The storybook was created, but the new version could not be added to the original Moment. The original record was not overwritten."
              : locale === "zh"
                ? "绘本已经生成，但成长记录写入失败；现有本机记录没有被覆盖。"
                : "The storybook was created, but the growth record write failed. Existing local records were not overwritten.",
          );
        }
      }
    }
  }

  async function applyTaskResponse(
    task: ClientTextGenerationTaskResponse,
    recovery: Pick<
      GenerationTaskRecoveryCandidate,
      | "taskId"
      | "reviewBeforeIllustrations"
      | "growthRecordDraft"
      | "targetMomentId"
    >,
  ) {
    if (activeTaskIdRef.current !== recovery.taskId) return;

    setActiveGrowthDraft(recovery.growthRecordDraft || null);
    setActiveTargetMomentId(recovery.targetMomentId || null);

    if (task.status === "generating_text") {
      setResult(null);
      setStep("generating_text");
      return;
    }

    if (task.status === "unrecoverable" || task.status === "failed") {
      clearActiveGenerationTask({ taskId: recovery.taskId });
      showTaskRecoveryFailure(
        task.error,
        task.status === "failed" ? "failed" : "unrecoverable",
      );
      return;
    }

    if (!task.result) {
      showTaskRecoveryFailure(
        locale === "zh"
          ? "服务端返回了任务状态，但没有可恢复的故事内容。"
          : "The server returned a task state without recoverable story content.",
      );
      return;
    }

    if (task.status === "reviewing_outline") {
      // Older in-flight tasks may still be marked for the retired outline
      // review. Confirm their unchanged pages once and continue directly to
      // illustration generation instead of stopping at an eight-page form.
      const response = await confirmStoryOutline({
        taskId: recovery.taskId,
        storyId: task.result.storyId,
        pages: task.result.pages,
      });
      const confirmedTask = (await response.json()) as ClientTextGenerationTaskResponse;
      if (!response.ok || !confirmedTask.result) {
        showTaskRecoveryFailure(
          confirmedTask.error ||
            (locale === "zh"
              ? "故事文本已完成，但暂时无法开始生成插图。请刷新后重试。"
              : "The story text is ready, but illustrations could not start. Refresh and try again."),
          "failed",
        );
        return;
      }
      await applyTaskResponse(confirmedTask, {
        ...recovery,
        reviewBeforeIllustrations: false,
      });
      return;
    }

    await saveGeneratedResult(
      task.result,
      recovery.growthRecordDraft,
      recovery.targetMomentId,
    );
    generationViewActiveRef.current = false;
    historyPreviewOpenRef.current = true;
    const illustrationSummary = summarizeIllustrationProgress(
      task.result.pages,
    );
    const nextStage =
      task.status === "ready"
        ? "ready"
        : task.status === "partially_failed"
          ? "partially_failed"
          : "generating_images";
    replaceStoryUrl(
      task.result.storyId,
      illustrationSummary.pending > 0 ? recovery.taskId : undefined,
    );
    if (illustrationSummary.pending === 0) {
      clearActiveGenerationTask({ taskId: recovery.taskId });
      setCurrentTaskId(null);
      setActiveGrowthDraft(null);
      setActiveTargetMomentId(null);
    }
    if (sampleModalOpenRef.current) setOwnReadyNotice(true);
    setGenerationStartedAtMs(null);
    setStep(nextStage);
  }

  function recoverGenerationTask(
    recovery: GenerationTaskRecoveryCandidate,
  ) {
    setCurrentTaskId(recovery.taskId);
    setActiveGrowthDraft(recovery.growthRecordDraft || null);
    setActiveTargetMomentId(recovery.targetMomentId || null);
    generationViewActiveRef.current = true;
    historyPreviewOpenRef.current = false;
    setSampleResult(null);
    setError(null);
    setGenerationStartedAtMs(Date.now());
    setStep("generating_text");
  }

  useEffect(() => {
    if (
      generationStartedAtMs === null ||
      (step !== "submitting" && step !== "generating_text")
    ) {
      return;
    }

    setGenerationNowMs(Date.now());
    const interval = window.setInterval(() => {
      setGenerationNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [generationStartedAtMs, step]);

  useEffect(() => {
    let mounted = true;
    const detectedLocale = detectInitialLocale();
    setLocale(detectedLocale);
    const urlEntryMode = readEntryModeFromUrl();
    const initialEntryMode = urlEntryMode || "capture";
    setEntryMode(initialEntryMode);
    setPersonalizationEntry(
      Boolean(
        new URL(window.location.href).searchParams.get("personalize")?.trim(),
      ),
    );
    window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, initialEntryMode);
    replaceEntryModeUrl(initialEntryMode);
    const growthVersionRequested = isGrowthVersionCreationRequested(
      window.location.search,
    );
    if (growthVersionRequested) {
      setGrowthVersionIntentLoading(true);
      const intent = readGrowthVersionCreationIntent();
      if (!intent) {
        setGrowthVersionIntentError(
          detectedLocale === "zh"
            ? "这个版本创作入口已失效，请返回本机成长时间轴重新发起。"
            : "This version-creation entry expired. Return to the local growth timeline and start again.",
        );
        setGrowthVersionIntentLoading(false);
      } else {
        void localGrowthRepository.moments
          ?.get(intent.targetMomentId)
          .then((bundle) => {
            if (!mounted) return;
            if (!bundle) {
              setGrowthVersionIntentError(
                detectedLocale === "zh"
                  ? "没有找到对应的本机成长时刻，它可能已经被删除。"
                  : "The local Moment was not found. It may have been deleted.",
              );
              return;
            }
            setGrowthVersionPreset(createGrowthVersionCreationPreset(bundle));
          })
          .catch(() => {
            if (!mounted) return;
            setGrowthVersionIntentError(
              detectedLocale === "zh"
                ? "暂时无法读取这个本机成长时刻，请返回时间轴后重试。"
                : "This local Moment could not be read. Return to the timeline and try again.",
            );
          })
          .finally(() => {
            if (mounted) setGrowthVersionIntentLoading(false);
          });
      }
    } else {
      setGrowthVersionIntentLoading(false);
    }
    setLocalFreeUsage(readLocalFreeUsage());
    document.documentElement.lang = detectedLocale === "zh" ? "zh-CN" : "en";

    const explicitTaskId = readTaskIdFromUrl();
    const recovery =
      explicitTaskId || !readStoryIdFromUrl()
        ? resolveGenerationTaskRecovery(
            window.location.search,
            readActiveGenerationTask(),
          )
        : null;
    if (recovery) recoverGenerationTask(recovery);
    else if (readViewFromUrl() === GENERATING_VIEW && !readStoryIdFromUrl()) {
      replaceFormUrl();
    }

    void localStoryRepository.list().then((records) => {
      setHistoryRecords(records);
      const storyId = readStoryIdFromUrl();
      const record = !recovery && storyId
        ? records.find((item) => item.storyId === storyId)
        : null;

      if (record) {
        showHistoryRecord(record);
      }
    });

    const handlePopState = () => {
      // A clean homepage URL is the canonical address for the growth-first entry.
      // This makes Back/Forward deterministic instead of reapplying the last saved preference.
      const nextMode = readEntryModeFromUrl() || "capture";
      setEntryMode(nextMode);
      window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, nextMode);

      const storyId = readStoryIdFromUrl();
      if (storyId) {
        generationViewActiveRef.current = false;
        const taskRecovery = readTaskIdFromUrl()
          ? resolveGenerationTaskRecovery(
              window.location.search,
              readActiveGenerationTask(),
            )
          : null;
        if (taskRecovery) {
          recoverGenerationTask(taskRecovery);
          return;
        }
        const generatedResult = latestGeneratedResultRef.current;
        if (generatedResult?.storyId === storyId) {
          setCurrentTaskId(readTaskIdFromUrl());
          historyPreviewOpenRef.current = true;
          setResult(generatedResult);
          setSampleResult(null);
          setError(null);
          const illustrationStatus = summarizeIllustrationProgress(
            generatedResult.pages,
          ).status;
          setStep(illustrationStatus);
          return;
        }

        void localStoryRepository.list().then((records) => {
          if (readStoryIdFromUrl() !== storyId) {
            return;
          }

          setHistoryRecords(records);
          const record = records.find((item) => item.storyId === storyId);
          if (record) {
            setCurrentTaskId(readTaskIdFromUrl());
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

        const taskId = readTaskIdFromUrl();
        const taskRecord = readActiveGenerationTask();
        const taskRecovery = resolveGenerationTaskRecovery(
          window.location.search,
          taskRecord,
        );
        if (taskId && taskRecovery) {
          recoverGenerationTask(taskRecovery);
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
    return () => {
      mounted = false;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (step !== "generating_text" || !activeTaskId) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    const recovery = resolveGenerationTaskRecovery(
      window.location.search,
      readActiveGenerationTask(),
      false,
    ) || {
      taskId: activeTaskId,
      source: "active-record" as const,
      reviewBeforeIllustrations: false,
      ...(activeGrowthDraft
        ? { growthRecordDraft: activeGrowthDraft }
        : {}),
      ...(activeTargetMomentId
        ? { targetMomentId: activeTargetMomentId }
        : {}),
      requiresServerVerification: true as const,
    };

    async function poll() {
      try {
        const response = await requestStoryGenerationTask({
          taskId: recovery.taskId,
        });
        const task = (await response.json()) as ClientTextGenerationTaskResponse;
        if (cancelled) return;

        if (task.status === "unrecoverable") {
          await applyTaskResponse(task, recovery);
          return;
        }
        if (!response.ok) {
          throw new Error(task.error || text.genericFailure);
        }

        setError(null);
        await applyTaskResponse(task, recovery);
        if (!cancelled && task.status === "generating_text") {
          timeoutId = window.setTimeout(poll, task.pollAfterMs || 1200);
        }
      } catch (pollError) {
        if (cancelled) return;
        setError(
          pollError instanceof Error ? pollError.message : text.genericFailure,
        );
        timeoutId = window.setTimeout(poll, 2200);
      }
    }

    timeoutId = window.setTimeout(poll, 100);
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [
    activeGrowthDraft,
    activeTargetMomentId,
    activeTaskId,
    step,
  ]);

  useEffect(() => {
    sampleModalOpenRef.current = Boolean(sampleResult);
  }, [sampleResult]);

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

  useLayoutEffect(() => {
    if (step === "submitting" || step === "generating_text") {
      document.title = "绘本生成中 · StoryBloom";
      return;
    }

    if (result && shouldMountBookPreview(step, true)) {
      document.title = getStoryDocumentTitle(result.pages);
      return;
    }

    document.title = "StoryBloom | 把成长时刻留成家庭绘本";
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

    const taskId = createClientGenerationTaskId();
    setGenerationStartedAtMs(Date.now());
    generationViewActiveRef.current = true;
    latestGeneratedResultRef.current = null;
    historyPreviewOpenRef.current = false;
    setSampleResult(null);
    setOwnReadyNotice(false);
    setResult(null);
    setError(null);
    setGrowthSavedChild(null);
    setGrowthSaveError(null);

    const {
      payload: generationData,
      accessToken: supabaseAccessToken,
      growthRecordDraft,
      targetMomentId,
    } = prepareStoryGenerationRequest(formData);
    const normalizedGrowthDraft = isGrowthRecordDraft(growthRecordDraft)
      ? growthRecordDraft
      : undefined;
    // A one-sentence creation should flow directly from story text to
    // illustration. A growth record must not introduce a separate review
    // gate; older in-flight review tasks are confirmed automatically below.
    const shouldReviewOutline = false;
    const normalizedTargetMomentId =
      normalizedGrowthDraft &&
      typeof targetMomentId === "string" &&
      targetMomentId.trim().length > 0 &&
      targetMomentId.length <= 180
        ? targetMomentId.trim()
        : undefined;
    if (
      typeof generationData.personalizationDraftId === "string" &&
      generationData.personalizationDraftId.length > 0
    ) {
      markPersonalizationDraftGeneration(
        generationData.personalizationDraftId,
        taskId,
      );
    }
    setCurrentTaskId(taskId);
    setActiveGrowthDraft(normalizedGrowthDraft || null);
    setActiveTargetMomentId(normalizedTargetMomentId || null);
    writeActiveGenerationTask({
      taskId,
      reviewBeforeIllustrations: shouldReviewOutline,
      ...(normalizedGrowthDraft
        ? { growthRecordDraft: normalizedGrowthDraft }
        : {}),
      ...(normalizedTargetMomentId
        ? { targetMomentId: normalizedTargetMomentId }
        : {}),
    });
    pushGeneratingUrl(taskId);
    setStep("submitting");

    try {
      const browserFingerprint = await getBrowserFingerprint();

      const response = await requestStoryGeneration({
        payload: {
          ...generationData,
          browserFingerprint,
          generationRequestMode: "async",
          generationTaskId: taskId,
          reviewBeforeIllustrations: shouldReviewOutline,
        },
        accessToken: supabaseAccessToken,
        refreshAccessToken: async () => {
          const { data, error: refreshError } =
            await getSupabaseBrowserClient().auth.refreshSession();
          if (refreshError) return null;
          return data.session?.access_token || null;
        },
      });

      const data = (await response.json()) as
        | ClientTextGenerationTaskResponse
        | GenerateErrorResponse;

      if (!response.ok) {
        const failedPages =
          "failedPages" in data && data.failedPages?.length
            ? text.failedPages(data.failedPages.join(", "))
            : "";
        const message = "error" in data ? `${data.error}${failedPages}` : text.genericFailure;
        clearActiveGenerationTask({ taskId });
        showTaskRecoveryFailure(message ?? text.genericFailure, "failed");
        return;
      }
      await applyTaskResponse(data as ClientTextGenerationTaskResponse, {
        taskId,
        reviewBeforeIllustrations: shouldReviewOutline,
        growthRecordDraft: normalizedGrowthDraft,
        targetMomentId: normalizedTargetMomentId,
      });
    } catch (requestError) {
      latestGeneratedResultRef.current = null;
      setError(
        requestError instanceof Error
          ? requestError.message
          : text.genericFailure,
      );
      setStep("generating_text");
    }
  }

  function handleAbandonGeneration() {
    if (activeTaskIdRef.current) {
      clearActiveGenerationTask({ taskId: activeTaskIdRef.current });
    }
    setCurrentTaskId(null);
    setActiveGrowthDraft(null);
    setActiveTargetMomentId(null);
    latestGeneratedResultRef.current = null;
    generationViewActiveRef.current = false;
    historyPreviewOpenRef.current = false;
    setResult(null);
    setSampleResult(null);
    setError(null);
    setGenerationStartedAtMs(null);
    replaceFormUrl();
    setStep("form");
  }

  function openSampleBook(
    sample: GenerateResponse,
    returnMode: SampleReturnMode = shouldMountBookPreview(step, Boolean(result))
      ? "preview"
      : "generating"
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
    const illustrationStatus = summarizeIllustrationProgress(result.pages).status;
    setStep(illustrationStatus);
  }

  function handleSampleBack() {
    setSampleResult(null);
  }

  function showHistoryRecord(record: StoryHistoryRecord) {
    setCurrentTaskId(null);
    historyPreviewOpenRef.current = true;
    setResult(record.result);
    setSampleResult(null);
    setOwnReadyNotice(false);
    setError(null);
    setGenerationStartedAtMs(null);
    setStep(summarizeIllustrationProgress(record.result.pages).status);
    document.title = getStoryDocumentTitle(record.result.pages);
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
    setCurrentTaskId(null);
    setActiveGrowthDraft(null);
    setActiveTargetMomentId(null);
    setGrowthVersionPreset(null);
    setGrowthVersionIntentError(null);
  }

  function handleResultUpdate(nextResult: GenerateResponse) {
    if (latestGeneratedResultRef.current?.storyId === nextResult.storyId) {
      latestGeneratedResultRef.current = nextResult;
    }
    setResult((current) =>
      current?.storyId === nextResult.storyId ? nextResult : current
    );
    const illustrationStatus = summarizeIllustrationProgress(
      nextResult.pages,
    ).status;
    setStep(illustrationStatus);
    setGenerationStartedAtMs(null);
    document.title = getStoryDocumentTitle(nextResult.pages);
    const illustrationSummary = summarizeIllustrationProgress(nextResult.pages);
    if (illustrationSummary.pending === 0) {
      if (activeTaskIdRef.current) {
        clearActiveGenerationTask({ taskId: activeTaskIdRef.current });
      }
      setCurrentTaskId(null);
      setActiveGrowthDraft(null);
      setActiveTargetMomentId(null);
      replaceStoryUrl(nextResult.storyId);
    }
    void localStoryRepository
      .save({ result: nextResult })
      .then(() => localStoryRepository.list())
      .then(setHistoryRecords);
    void localGrowthRepository
      .list()
      .then((records) => {
        if (!records.some((record) => record.storyId === nextResult.storyId)) {
          return undefined;
        }
        return localGrowthRepository.update(nextResult.storyId, {
          story: nextResult,
        });
      })
      .catch(() => undefined);
  }

  const remainingFreeGenerations = Math.max(
    0,
    FREE_GENERATION_DAILY_LIMIT - localFreeUsage
  );
  const historyPanel = (
    <LocalStoryLibrary
      locale={locale}
      records={historyRecords}
      minimal={entryMode !== "full"}
      onOpen={handleHistoryContinue}
      onRecordsChange={setHistoryRecords}
    />
  );

  return (
    <main
      className={
        step === "form" && entryMode !== "full"
          ? `minimal-page-shell${
              !personalizationEntry && !growthVersionPreset
                ? " home-page-shell"
                : ""
            }`
          : step === "form" && entryMode === "full"
            ? "page-shell full-creator-page-shell"
            : "page-shell"
      }
    >
      {step === "form" ? (
        <header className="home-topbar">
          <div className="home-topbar-inner">
            <div className="home-brand-cluster">
              <Link
                href="/"
                className="home-wordmark"
                aria-label={locale === "zh" ? "StoryBloom 首页" : "StoryBloom home"}
              >
                StoryBloom
              </Link>
              <div className="home-brand-utilities">
                <button
                  type="button"
                  className="home-language-toggle"
                  aria-label={text.localeLabel}
                  onClick={() => changeLocale(locale === "zh" ? "en" : "zh")}
                >
                  {locale === "zh" ? "EN" : "中"}
                </button>
                <Link
                  href="https://github.com/valleylmh/storybloom"
                  className="home-github-link"
                  aria-label={locale === "zh" ? "打开 StoryBloom GitHub 开源仓库" : "Open the StoryBloom GitHub repository"}
                  title={locale === "zh" ? "GitHub 开源仓库" : "GitHub repository"}
                  target="_blank"
                  rel="noreferrer"
                >
                  <GithubLogo aria-hidden="true" weight="fill" />
                </Link>
              </div>
            </div>
            <div className="home-header-mode-toggle" aria-label="创作模式">
              <button
                type="button"
                className={entryMode !== "full" ? "active" : ""}
                aria-pressed={entryMode !== "full"}
                onClick={() => changeEntryMode("capture")}
              >
                {locale === "zh" ? "快速" : "Quick"}
              </button>
              <button
                type="button"
                className={entryMode === "full" ? "active" : ""}
                aria-pressed={entryMode === "full"}
                onClick={() => changeEntryMode("full")}
              >
                {locale === "zh" ? "完整" : "Full"}
              </button>
            </div>
            <nav className="home-primary-nav" aria-label="家庭故事平台">
              <Link href="/library">
                <BookOpenText aria-hidden="true" />
                <span>{locale === "zh" ? "绘本馆" : "Library"}</span>
              </Link>
              <Link href="/growth">
                <CalendarDots aria-hidden="true" />
                <span>{locale === "zh" ? "成长记录" : "Moments"}</span>
              </Link>
              <AccountEntryButton locale={locale} />
            </nav>
          </div>
        </header>
      ) : null}

      {entryMode === "full" ? (
        <section className="hero-shell">
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
        id="story-creation"
        className={
          step === "form" && entryMode !== "full"
            ? "minimal-content-shell"
            : "content-shell"
        }
      >
        {step === "form" && error ? (
          <div className="error-banner">{error}</div>
        ) : null}

        {step === "form" ? (
          entryMode !== "full" ? (
            <>
              {growthVersionIntentLoading ? (
                <div className="growth-version-entry-loading" role="status">
                  {locale === "zh"
                    ? "正在读取这个本机成长时刻…"
                    : "Loading this local Moment…"}
                </div>
              ) : (
                !personalizationEntry && !growthVersionPreset ? (
                  <section className="home-landing-grid" aria-label="StoryBloom 首页创作与阅读">
                    <div className="home-creator-pane">
                      <MinimalStoryEntry
                        key={`${entryMode}:home`}
                        locale={locale}
                        freeGenerationLimit={FREE_GENERATION_DAILY_LIMIT}
                        remainingFreeGenerations={remainingFreeGenerations}
                        initialGrowthEnabled={entryMode === "capture"}
                        homeHero
                        onSubmit={handleGenerate}
                      />
                    </div>

                    <aside className="home-library-spotlight" aria-labelledby="home-library-title">
                      <p className="home-library-kicker">
                        <Plant aria-hidden="true" weight="fill" />
                        <span>{locale === "zh" ? "今晚读一本" : "Read tonight"}</span>
                        <Plant
                          aria-hidden="true"
                          className="home-library-kicker-leaf-reverse"
                          weight="fill"
                        />
                      </p>
                      <h2 id="home-library-title">
                        {locale === "zh"
                          ? "打开绘本馆，选一本就能听"
                          : "Choose a book and start listening"}
                      </h2>
                      <p className="home-library-summary">
                        {locale === "zh"
                          ? "绘本馆三大系列 · 有声阅读 · 无需登录"
                          : "Three library series · Narration · No sign-in"}
                      </p>
                      <div className="home-library-covers" aria-label={locale === "zh" ? "绘本馆系列推荐" : "Library series books"}>
                        {HOME_FEATURED_LIBRARY_BOOKS.map((book, index) => (
                          <Link
                            key={`${book.seriesId}/${book.id}`}
                            href={book.href}
                            className={`home-library-cover home-library-cover-${index + 1}`}
                            aria-label={locale === "zh" ? `打开《${book.title}》` : `Open ${book.title}`}
                          >
                            <Image
                              className="home-library-cover-image"
                              src={book.coverImage}
                              alt={`${book.seriesTitle}《${book.title}》封面`}
                              fill
                              loading="eager"
                              sizes="(max-width: 680px) 38vw, 220px"
                              unoptimized
                            />
                            <span>
                              <small style={{ color: book.accent }}>{book.seriesTitle}</small>
                              <strong>{book.title}</strong>
                            </span>
                          </Link>
                        ))}
                      </div>
                      <Link href="/library" className="home-library-link">
                        {locale === "zh" ? "去绘本馆" : "Open library"}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </aside>
                  </section>
                ) : (
                  <MinimalStoryEntry
                    key={`${entryMode}:${growthVersionPreset?.targetMomentId || "new"}`}
                    locale={locale}
                    freeGenerationLimit={FREE_GENERATION_DAILY_LIMIT}
                    remainingFreeGenerations={remainingFreeGenerations}
                    initialGrowthEnabled={Boolean(growthVersionPreset) || entryMode === "capture"}
                    initialGrowthVersion={growthVersionPreset || undefined}
                    onSubmit={handleGenerate}
                  />
                )
              )}
              {growthVersionIntentError ? (
                <div className="error-banner" role="alert">
                  {growthVersionIntentError} <Link href="/growth">返回成长书架</Link>
                </div>
              ) : null}
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
              {historyPanel}
            </>
          )
        ) : null}

        {step === "submitting" || step === "generating_text" ? (
          <div className="generating-card">
            <div className="generation-visual" aria-hidden="true">
              <div className="spinner-orb" />
              <div className="mini-book">
                {Array.from({ length: 8 }).map((_, index) => (
                  <span key={index} style={{ animationDelay: `${index * 0.12}s` }} />
                ))}
              </div>
            </div>
            <h2>
              {step === "submitting"
                ? text.submittingTitle
                : text.textGeneratingTitle}
            </h2>
            <p>
              {step === "submitting"
                ? text.taskSubmittingDetail
                : text.taskGeneratingDetail}
            </p>
            <p className="generation-save-note">{text.taskRecoveryHint}</p>
            {generationStartedAtMs !== null ? (
              <p className="generation-elapsed" role="status">
                {locale === "zh"
                  ? `已等待 ${formatGenerationElapsed(
                      generationNowMs - generationStartedAtMs,
                    )}`
                  : `Elapsed ${formatGenerationElapsed(
                      generationNowMs - generationStartedAtMs,
                    )}`}
              </p>
            ) : null}
            <dl className="generation-facts" aria-live="polite">
              <div>
                <dt>{text.taskStatusLabel}</dt>
                <dd>
                  {step === "submitting"
                    ? text.taskStatusSubmitting
                    : text.taskStatusWriting}
                </dd>
              </div>
              <div>
                <dt>{text.taskNextLabel}</dt>
                <dd>{text.taskNextImages}</dd>
              </div>
              {activeTaskId ? (
                <div>
                  <dt>{text.taskIdLabel}</dt>
                  <dd className="generation-task-id">{activeTaskId}</dd>
                </div>
              ) : null}
            </dl>
            {error ? (
              <div className="generation-retry-note" role="status">
                {error}
              </div>
            ) : null}
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

        {step === "failed" || step === "unrecoverable" ? (
          <div className="generation-unavailable" role="alert">
            <span aria-hidden="true">↺</span>
            <h2>
              {step === "failed" ? text.failedTitle : text.unavailableTitle}
            </h2>
            <p>
              {error ||
                (step === "failed" ? text.failedHint : text.unavailableHint)}
            </p>
            <button type="button" className="cta-btn" onClick={handleAbandonGeneration}>
              {text.unavailableAction}
            </button>
          </div>
        ) : null}

        {shouldMountBookPreview(step, Boolean(result)) && result ? (
          <>
            {growthSavedChild ? (
              <div className="growth-save-banner" role="status">
                <div>
                  <strong>
                    {growthSavedChild.versionAdded
                      ? locale === "zh"
                        ? `已加入${growthSavedChild.childName}的同一成长时刻`
                        : `Added to ${growthSavedChild.childName}'s existing Moment`
                      : locale === "zh"
                        ? `已加入${growthSavedChild.childName}的成长记录`
                        : `Saved to ${growthSavedChild.childName}'s growth record`}
                  </strong>
                  <span>
                    {growthSavedChild.versionAdded
                      ? locale === "zh"
                        ? `这是第 ${growthSavedChild.versionCount || 1} 个绘本版本；真实事实、备注和现场照片没有被覆盖。`
                        : `This is storybook version ${growthSavedChild.versionCount || 1}; the real facts, note, and photos were not overwritten.`
                      : locale === "zh"
                        ? "插图完成后会继续自动更新这条记录。"
                        : "This record will keep updating as the illustrations finish."}
                  </span>
                </div>
                <Link
                  href={`/growth/${encodeURIComponent(growthSavedChild.childKey)}`}
                >
                  {locale === "zh" ? "查看时间轴" : "Open timeline"}
                </Link>
              </div>
            ) : null}
            {growthSaveError ? (
              <div className="growth-save-banner growth-save-banner-error" role="alert">
                <span>{growthSaveError}</span>
              </div>
            ) : null}
            <BookPreview
              result={result}
              variant="own"
              onResultUpdate={handleResultUpdate}
              sampleBooks={SAMPLE_BOOKS}
              onOpenSample={(sample) => openSampleBook(sample, "preview")}
              onBack={handlePreviewBack}
            />
          </>
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
