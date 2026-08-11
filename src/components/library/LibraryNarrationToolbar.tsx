"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBrowserNarrationSegments,
  pickBrowserVoice,
  type BrowserNarrationMode,
  type BrowserNarrationSegment,
} from "@/lib/browser-narration";
import type { StoryPage } from "@/types";

const NARRATION_OPTIONS: Array<{
  mode: BrowserNarrationMode;
  label: string;
  generatingLabel: string;
}> = [
  { mode: "zh", label: "中文", generatingLabel: "正在准备" },
  { mode: "en", label: "English", generatingLabel: "Preparing" },
  { mode: "zh-en", label: "中英文", generatingLabel: "正在准备" },
];

type AudioStatus = "idle" | "generating" | "playing" | "ready";

type CloudNarrationResult = {
  audioUrl: string;
  model?: string;
  cached?: boolean;
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function providerLabel(model?: string) {
  if (model === "qwen-audio-3.0-tts-plus") return "百炼 TTS";
  if (model?.startsWith("gemini-")) return "备用 Gemini TTS";
  if (model === "edge-tts") return "备用 Edge TTS";
  return "云端 TTS";
}

export default function LibraryNarrationToolbar({
  pages,
  storyKey,
  currentPageIndex,
  turnModeActive,
  onPageIndexChange,
  onHighlightChange,
  onRequestTurnMode,
}: {
  pages: StoryPage[];
  storyKey: string;
  currentPageIndex: number;
  turnModeActive: boolean;
  onPageIndexChange: (pageIndex: number) => void;
  onHighlightChange: (mode: BrowserNarrationMode | null) => void;
  onRequestTurnMode: () => void;
}) {
  const [activeNarration, setActiveNarration] =
    useState<BrowserNarrationMode | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<string | null>(null);
  const [playbackKind, setPlaybackKind] = useState<
    "browser" | "audio" | null
  >(null);
  const runRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const browserCancelRef = useRef<(() => void) | null>(null);
  const sessionAbortRef = useRef<AbortController | null>(null);
  const cloudAudioCacheRef = useRef(
    new Map<string, Promise<CloudNarrationResult>>(),
  );

  const clearMedia = useCallback(() => {
    browserCancelRef.current?.();
    browserCancelRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
  }, []);

  const stopNarration = useCallback(() => {
    runRef.current += 1;
    sessionAbortRef.current?.abort();
    sessionAbortRef.current = null;
    cloudAudioCacheRef.current.clear();
    clearMedia();
    setActiveNarration(null);
    setAudioStatus("idle");
    setPlaybackKind(null);
    setAudioMeta(null);
    onHighlightChange(null);
  }, [clearMedia, onHighlightChange]);

  const failNarration = useCallback(
    (message: string) => {
      stopNarration();
      setAudioError(message);
    },
    [stopNarration],
  );

  const speakSegment = useCallback((segment: BrowserNarrationSegment) => {
    return new Promise<void>((resolve, reject) => {
      if (
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        reject(new Error("当前浏览器不支持本机语音朗读。"));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      utterance.rate = segment.lang === "zh-CN" ? 0.88 : 0.92;
      utterance.pitch = 1;
      utterance.voice = pickBrowserVoice(
        window.speechSynthesis.getVoices(),
        segment.lang,
      );

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (browserCancelRef.current === finish) {
          browserCancelRef.current = null;
        }
        resolve();
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        if (browserCancelRef.current === finish) {
          browserCancelRef.current = null;
        }
        reject(new Error("本机语音朗读失败，请检查浏览器语音设置。"));
      };

      browserCancelRef.current = finish;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") {
          finish();
          return;
        }
        fail();
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const requestCloudAudio = useCallback(
    (
      pageIndex: number,
      mode: BrowserNarrationMode,
      signal: AbortSignal,
    ) => {
      const page = pages[pageIndex];
      const segments = page ? getBrowserNarrationSegments([page], mode) : [];
      if (!segments.length) {
        return Promise.reject(
          new Error("当前页面在这个语言模式下没有可朗读文本。"),
        );
      }

      const cacheKey = `${storyKey}:${pageIndex}:${mode}`;
      const existing = cloudAudioCacheRef.current.get(cacheKey);
      if (existing) return existing;

      const request = fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: segments.map((segment) => segment.text).join("\n\n"),
          mode,
          sampleRate: 24000,
        }),
        signal,
      }).then(async (response) => {
        const result = (await response.json().catch(() => null)) as {
          audioUrl?: string;
          model?: string;
          cached?: boolean;
          error?: string;
        } | null;
        if (!response.ok || !result?.audioUrl) {
          throw new Error(result?.error || "云端朗读暂时不可用。");
        }
        return {
          audioUrl: result.audioUrl,
          model: result.model,
          cached: result.cached,
        } satisfies CloudNarrationResult;
      });

      cloudAudioCacheRef.current.set(cacheKey, request);
      void request.catch(() => {
        if (cloudAudioCacheRef.current.get(cacheKey) === request) {
          cloudAudioCacheRef.current.delete(cacheKey);
        }
      });
      return request;
    },
    [pages, storyKey],
  );

  useEffect(() => {
    stopNarration();
    setAudioError(null);
  }, [storyKey, stopNarration]);

  useEffect(() => {
    if (!turnModeActive && activeNarration) {
      stopNarration();
    }
  }, [activeNarration, stopNarration, turnModeActive]);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      sessionAbortRef.current?.abort();
      clearMedia();
      onHighlightChange(null);
    };
  }, [clearMedia, onHighlightChange]);

  useEffect(() => {
    if (!activeNarration || !turnModeActive) return;

    const page = pages[currentPageIndex];
    const segments = page
      ? getBrowserNarrationSegments([page], activeNarration)
      : [];
    if (!segments.length) {
      failNarration("当前页面在这个语言模式下没有可朗读文本。");
      return;
    }

    const controller = sessionAbortRef.current;
    if (!controller) return;

    const runId = runRef.current + 1;
    runRef.current = runId;
    clearMedia();
    onHighlightChange(null);
    setAudioError(null);
    setAudioMeta(`正在准备第 ${currentPageIndex + 1} 页…`);
    setAudioStatus("generating");
    setPlaybackKind(null);

    const finishPage = () => {
      if (runRef.current !== runId) return;
      onHighlightChange(null);
      if (currentPageIndex < pages.length - 1) {
        setAudioStatus("generating");
        onPageIndexChange(currentPageIndex + 1);
        return;
      }

      setActiveNarration(null);
      setAudioStatus("idle");
      setPlaybackKind(null);
      setAudioMeta("整本绘本已朗读完毕");
      sessionAbortRef.current = null;
    };

    const playBrowserFallback = async () => {
      setPlaybackKind("browser");
      setAudioMeta("云端朗读暂不可用，已切换本机系统语音");
      setAudioStatus("playing");
      for (const segment of segments) {
        if (runRef.current !== runId) return;
        onHighlightChange(segment.lang === "zh-CN" ? "zh" : "en");
        await speakSegment(segment);
      }
      finishPage();
    };

    void (async () => {
      try {
        const result = await requestCloudAudio(
          currentPageIndex,
          activeNarration,
          controller.signal,
        );
        if (runRef.current !== runId) return;

        const audio = audioRef.current;
        if (!audio) throw new Error("浏览器音频播放器未准备好。");

        const label = providerLabel(result.model);
        setPlaybackKind("audio");
        setAudioMeta(
          `第 ${currentPageIndex + 1} 页 · ${label}${
            result.cached ? " · 已复用音频" : ""
          }`,
        );
        audio.src = result.audioUrl;
        audio.load();
        audio.onplay = () => {
          if (runRef.current === runId) {
            setAudioStatus("playing");
            onHighlightChange(activeNarration);
          }
        };
        audio.onpause = () => {
          if (runRef.current === runId && !audio.ended) {
            setAudioStatus("ready");
            onHighlightChange(null);
          }
        };
        audio.onended = finishPage;
        audio.onerror = () => {
          if (runRef.current === runId) {
            failNarration("云端朗读音频加载失败，请重试。");
          }
        };

        const nextPageIndex = currentPageIndex + 1;
        if (nextPageIndex < pages.length) {
          void requestCloudAudio(
            nextPageIndex,
            activeNarration,
            controller.signal,
          ).catch(() => undefined);
        }

        try {
          await audio.play();
        } catch {
          if (runRef.current !== runId) return;
          setAudioStatus("ready");
          onHighlightChange(null);
          setAudioMeta(`第 ${currentPageIndex + 1} 页 · ${label} 已准备好，请点击播放器开始`);
        }
      } catch (error) {
        if (runRef.current !== runId || isAbortError(error)) return;
        try {
          await playBrowserFallback();
        } catch (fallbackError) {
          if (runRef.current !== runId) return;
          failNarration(
            fallbackError instanceof Error
              ? fallbackError.message
              : "朗读失败，请稍后重试。",
          );
        }
      }
    })();

    return () => {
      if (runRef.current === runId) {
        runRef.current += 1;
      }
      clearMedia();
      onHighlightChange(null);
    };
  }, [
    activeNarration,
    clearMedia,
    currentPageIndex,
    failNarration,
    onHighlightChange,
    onPageIndexChange,
    pages,
    requestCloudAudio,
    speakSegment,
    turnModeActive,
  ]);

  function handleNarration(mode: BrowserNarrationMode) {
    if (activeNarration === mode) {
      stopNarration();
      return;
    }

    sessionAbortRef.current?.abort();
    cloudAudioCacheRef.current.clear();
    sessionAbortRef.current = new AbortController();
    setAudioError(null);
    if (!turnModeActive) {
      onRequestTurnMode();
    }
    setActiveNarration(mode);
  }

  return (
    <div className="tool-panel library-narration-panel">
      <div>
        <h3>朗读</h3>
        <p>
          优先使用百炼 TTS。翻页阅读时会高亮当前文字，并在每页读完后自动翻页。
        </p>
      </div>
      <div className="segmented-buttons">
        {NARRATION_OPTIONS.map((item) => (
          <button
            key={item.mode}
            type="button"
            className={`secondary-btn ${
              activeNarration === item.mode ? "secondary-btn-active" : ""
            }`}
            onClick={() => handleNarration(item.mode)}
            disabled={
              audioStatus === "generating" && activeNarration !== item.mode
            }
          >
            {activeNarration === item.mode
              ? audioStatus === "generating"
                ? item.generatingLabel
                : "停止"
              : item.label}
          </button>
        ))}
      </div>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        className="audio-player"
        hidden={playbackKind !== "audio"}
      />
      {audioMeta ? (
        <p className="tool-meta" aria-live="polite">
          {audioMeta}
        </p>
      ) : null}
      {audioError ? (
        <div className="tool-error" role="alert">
          {audioError}
        </div>
      ) : null}
    </div>
  );
}
