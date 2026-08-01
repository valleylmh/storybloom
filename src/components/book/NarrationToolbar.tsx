"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBrowserNarrationSegments,
  pickBrowserVoice,
  type BrowserNarrationMode,
} from "@/lib/browser-narration";
import type { StoryPage } from "@/types";

const NARRATION_OPTIONS: Array<{
  mode: BrowserNarrationMode;
  label: string;
  generatingLabel: string;
  playingLabel: string;
}> = [
  {
    mode: "zh",
    label: "中文",
    generatingLabel: "正在准备",
    playingLabel: "停止",
  },
  {
    mode: "en",
    label: "English",
    generatingLabel: "Preparing",
    playingLabel: "Stop",
  },
  {
    mode: "zh-en",
    label: "中英文",
    generatingLabel: "正在准备",
    playingLabel: "停止",
  },
];

export default function NarrationToolbar({
  pages,
  storyKey,
  staticChineseAudioUrl,
}: {
  pages: StoryPage[];
  storyKey: string;
  staticChineseAudioUrl?: string;
}) {
  const [activeNarration, setActiveNarration] =
    useState<BrowserNarrationMode | null>(null);
  const [audioStatus, setAudioStatus] = useState<
    "idle" | "generating" | "playing"
  >("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<string | null>(null);
  const [playbackKind, setPlaybackKind] = useState<
    "browser" | "audio" | null
  >(null);
  const runRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const browserCancelRef = useRef<(() => void) | null>(null);
  const staticAudioAvailabilityRef = useRef(
    new Map<string, Promise<boolean>>(),
  );

  function stopPlayback() {
    browserCancelRef.current?.();
    browserCancelRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.onended = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onerror = null;
    audio.removeAttribute("src");
    audio.load();
  }

  function hasStaticAudio(url: string) {
    const existing = staticAudioAvailabilityRef.current.get(url);
    if (existing) return existing;

    const request = fetch(url, { method: "HEAD", cache: "no-store" })
      .then((response) => response.ok)
      .catch(() => false);
    staticAudioAvailabilityRef.current.set(url, request);
    return request;
  }

  function speakSegment(
    segment: ReturnType<typeof getBrowserNarrationSegments>[number],
  ) {
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
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        if (browserCancelRef.current === finish) {
          browserCancelRef.current = null;
        }
        reject(new Error(message));
      };

      browserCancelRef.current = finish;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") {
          finish();
          return;
        }
        fail("本机语音朗读失败，请检查浏览器语音设置。");
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  useEffect(() => {
    runRef.current += 1;
    stopPlayback();
    setActiveNarration(null);
    setAudioStatus("idle");
    setAudioError(null);
    setAudioMeta(null);
    setPlaybackKind(null);
  }, [storyKey]);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      stopPlayback();
    };
  }, []);

  async function handleNarration(mode: BrowserNarrationMode) {
    const segments = getBrowserNarrationSegments(pages, mode);
    if (!segments.length) {
      setAudioError("当前语言模式没有可朗读文本。");
      return;
    }

    runRef.current += 1;
    const runId = runRef.current;
    const shouldStop =
      activeNarration === mode &&
      (audioStatus === "generating" || audioStatus === "playing");
    stopPlayback();
    if (shouldStop) {
      setActiveNarration(null);
      setAudioStatus("idle");
      setAudioMeta(null);
      return;
    }

    setAudioError(null);
    setAudioMeta(null);
    setActiveNarration(mode);
    setAudioStatus("generating");

    try {
      const staticUrl = mode === "zh" ? staticChineseAudioUrl : undefined;
      const staticAudioReady =
        Boolean(staticUrl) && (await hasStaticAudio(staticUrl || ""));

      if (runRef.current !== runId) return;

      if (staticAudioReady && staticUrl) {
        const audio = audioRef.current;
        if (!audio) throw new Error("浏览器音频播放器未准备好。");

        setPlaybackKind("audio");
        setAudioMeta("精选绘本预生成音频 · 本次不产生 TTS 费用");
        audio.src = staticUrl;
        audio.load();
        audio.onplay = () => {
          if (runRef.current === runId) {
            setActiveNarration(mode);
            setAudioStatus("playing");
          }
        };
        audio.onpause = () => {
          if (runRef.current === runId && !audio.ended) {
            setActiveNarration(null);
            setAudioStatus("idle");
          }
        };
        audio.onended = () => {
          if (runRef.current === runId) {
            setActiveNarration(null);
            setAudioStatus("idle");
          }
        };
        audio.onerror = () => {
          if (runRef.current === runId) {
            setAudioError("音频加载失败，请重试。");
            setActiveNarration(null);
            setAudioStatus("idle");
          }
        };

        try {
          await audio.play();
        } catch {
          setActiveNarration(null);
          setAudioStatus("idle");
          setAudioMeta("精选音频已准备好，请点击播放器开始");
        }
        return;
      }

      if (!("speechSynthesis" in window)) {
        throw new Error("当前浏览器不支持本机语音朗读。");
      }

      setPlaybackKind("browser");
      setAudioMeta("本机系统语音 · 不调用付费 TTS");
      setAudioStatus("playing");
      for (const segment of segments) {
        if (runRef.current !== runId) return;
        await speakSegment(segment);
      }

      if (runRef.current === runId) {
        setActiveNarration(null);
        setAudioStatus("idle");
      }
    } catch (error) {
      if (runRef.current !== runId) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAudioError(error instanceof Error ? error.message : "音频生成失败。");
      setActiveNarration(null);
      setAudioStatus("idle");
    }
  }

  return (
    <div className="tool-panel">
      <div>
        <h3>朗读</h3>
        <p>
          使用当前设备的系统语音朗读，不调用付费 TTS。
          {staticChineseAudioUrl ? "精选绘本中文会复用已有音频。" : ""}
        </p>
      </div>
      <div className="segmented-buttons">
        {NARRATION_OPTIONS.map((item) => (
          <button
            key={item.mode}
            type="button"
            className={`secondary-btn ${activeNarration === item.mode ? "secondary-btn-active" : ""}`}
            onClick={() => handleNarration(item.mode)}
            disabled={audioStatus === "generating"}
          >
            {activeNarration === item.mode
              ? audioStatus === "generating"
                ? item.generatingLabel
                : item.playingLabel
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
      {audioMeta ? <p className="tool-meta">{audioMeta}</p> : null}
      {audioError ? <div className="tool-error">{audioError}</div> : null}
    </div>
  );
}
