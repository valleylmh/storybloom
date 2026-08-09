"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Microphone, SpinnerGap, X } from "@phosphor-icons/react";
import {
  FAMILY_VOICE_CAPTURE_SAMPLE_RATE_HZ,
  FAMILY_VOICE_MAX_SAMPLE_SECONDS,
  FAMILY_VOICE_MIN_SAMPLE_RATE_HZ,
  FAMILY_VOICE_MIN_SAMPLE_SECONDS,
  encodeFamilyVoicePcm16Wav,
  isValidFamilyVoiceSampleSize,
} from "@/lib/family-voice";

export type FamilyVoiceRecording = {
  blob: Blob;
  durationSeconds: number;
  contentType: "audio/wav";
};

type AudioContextConstructor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext ||
    null
  );
}

function createCaptureAudioContext(
  AudioContextClass: AudioContextConstructor,
) {
  try {
    return new AudioContextClass({
      latencyHint: "interactive",
      sampleRate: FAMILY_VOICE_CAPTURE_SAMPLE_RATE_HZ,
    });
  } catch {
    return new AudioContextClass({ latencyHint: "interactive" });
  }
}

function formatSeconds(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

export default function FamilyVoiceDialog({
  characterName,
  busy,
  hasExistingVoice,
  onClose,
  onCreate,
}: {
  characterName: string;
  busy: boolean;
  hasExistingVoice: boolean;
  onClose: () => void;
  onCreate: (recording: FamilyVoiceRecording) => Promise<void>;
}) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "recording" | "recorded"
  >("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recording, setRecording] = useState<FamilyVoiceRecording | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const muteNodeRef = useRef<GainNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const capturedSamplesRef = useRef(0);
  const sampleRateRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function releaseCaptureResources() {
    const processor = processorNodeRef.current;
    processorNodeRef.current = null;
    if (processor) {
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
      } catch {
        // The graph may already be disconnected during browser teardown.
      }
    }

    const source = sourceNodeRef.current;
    sourceNodeRef.current = null;
    if (source) {
      try {
        source.disconnect();
      } catch {
        // The graph may already be disconnected during browser teardown.
      }
    }

    const mute = muteNodeRef.current;
    muteNodeRef.current = null;
    if (mute) {
      try {
        mute.disconnect();
      } catch {
        // The graph may already be disconnected during browser teardown.
      }
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
    stopTracks();
  }

  function finishRecording(discard: boolean) {
    if (stoppingRef.current) return;
    if (!audioContextRef.current && !streamRef.current) return;
    stoppingRef.current = true;
    clearTimer();
    const chunks = pcmChunksRef.current;
    const capturedSamples = capturedSamplesRef.current;
    const sampleRate = sampleRateRef.current;
    pcmChunksRef.current = [];
    capturedSamplesRef.current = 0;
    sampleRateRef.current = 0;
    releaseCaptureResources();

    if (discard || !mountedRef.current) {
      return;
    }

    const durationSeconds =
      sampleRate > 0 ? capturedSamples / sampleRate : 0;
    if (durationSeconds < FAMILY_VOICE_MIN_SAMPLE_SECONDS) {
      setStatus("idle");
      setElapsedSeconds(0);
      setError(`请至少录制 ${FAMILY_VOICE_MIN_SAMPLE_SECONDS} 秒。`);
      return;
    }
    if (durationSeconds > FAMILY_VOICE_MAX_SAMPLE_SECONDS) {
      setStatus("idle");
      setElapsedSeconds(0);
      setError(`录音超过 ${FAMILY_VOICE_MAX_SAMPLE_SECONDS} 秒，请重新录制。`);
      return;
    }

    try {
      const blob = encodeFamilyVoicePcm16Wav(chunks, sampleRate);
      if (!isValidFamilyVoiceSampleSize(blob.size)) {
        setStatus("idle");
        setElapsedSeconds(0);
        setError("录音文件超过 10MB，请缩短录音后重试。");
        return;
      }
      setElapsedSeconds(durationSeconds);
      setRecording({ blob, durationSeconds, contentType: "audio/wav" });
      setStatus("recorded");
    } catch {
      setStatus("idle");
      setElapsedSeconds(0);
      setError("录音编码失败，请重新录制。");
    }
  }

  function stopRecording() {
    finishRecording(false);
  }

  function discardRecording() {
    finishRecording(true);
    setRecording(null);
    setStatus("idle");
    setElapsedSeconds(0);
    setConsentConfirmed(false);
  }

  useEffect(() => {
    if (!recording) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(recording.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startingRef.current = false;
      clearTimer();
      finishRecording(true);
    };
  }, []);

  async function startRecording() {
    if (startingRef.current) return;
    startingRef.current = true;
    setError("");
    setConsentConfirmed(false);
    setRecording(null);
    setElapsedSeconds(0);
    stoppingRef.current = false;
    setStatus("requesting");

    const AudioContextClass = getAudioContextConstructor();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !AudioContextClass
    ) {
      startingRef.current = false;
      setStatus("idle");
      setError("当前浏览器不支持麦克风录音，请使用最新版 Chrome、Edge 或 Safari。");
      return;
    }

    try {
      const audioContext = createCaptureAudioContext(AudioContextClass);
      audioContextRef.current = audioContext;
      if (audioContext.sampleRate < FAMILY_VOICE_MIN_SAMPLE_RATE_HZ) {
        throw new Error("family-voice-capture-sample-rate-too-low");
      }
      await audioContext.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: FAMILY_VOICE_CAPTURE_SAMPLE_RATE_HZ },
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4_096, 1, 1);
      const mute = audioContext.createGain();
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      muteNodeRef.current = mute;
      mute.gain.value = 0;
      pcmChunksRef.current = [];
      capturedSamplesRef.current = 0;
      sampleRateRef.current = audioContext.sampleRate;
      const maxSamples = Math.floor(
        audioContext.sampleRate * FAMILY_VOICE_MAX_SAMPLE_SECONDS,
      );

      processor.onaudioprocess = (event) => {
        const remainingSamples =
          maxSamples - capturedSamplesRef.current;
        if (remainingSamples <= 0) return;
        const input = event.inputBuffer.getChannelData(0);
        const chunkLength = Math.min(input.length, remainingSamples);
        const chunk = new Float32Array(chunkLength);
        chunk.set(input.subarray(0, chunkLength));
        pcmChunksRef.current.push(chunk);
        capturedSamplesRef.current += chunkLength;
      };

      source.connect(processor);
      processor.connect(mute);
      mute.connect(audioContext.destination);
      startingRef.current = false;
      setStatus("recording");
      autoStopTimerRef.current = window.setTimeout(
        stopRecording,
        (FAMILY_VOICE_MAX_SAMPLE_SECONDS + 2) * 1_000,
      );
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.min(
          FAMILY_VOICE_MAX_SAMPLE_SECONDS,
          sampleRateRef.current > 0
            ? capturedSamplesRef.current / sampleRateRef.current
            : 0,
        );
        setElapsedSeconds(elapsed);
        if (elapsed >= FAMILY_VOICE_MAX_SAMPLE_SECONDS) stopRecording();
      }, 200);
    } catch (cause) {
      startingRef.current = false;
      clearTimer();
      releaseCaptureResources();
      pcmChunksRef.current = [];
      capturedSamplesRef.current = 0;
      sampleRateRef.current = 0;
      if (!mountedRef.current) return;
      setStatus("idle");
      const permissionDenied =
        cause instanceof DOMException &&
        (cause.name === "NotAllowedError" || cause.name === "SecurityError");
      setError(
        permissionDenied
          ? "麦克风权限未开启，请允许访问后重新录制。"
          : cause instanceof Error &&
              cause.message === "family-voice-capture-sample-rate-too-low"
            ? "当前设备录音采样率低于 16kHz，请更换设备后重试。"
          : "无法启动麦克风，请检查设备后重试。",
      );
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!recording) {
      setError("请先完成一段 10–60 秒的录音。");
      return;
    }
    if (!consentConfirmed) {
      setError("请先确认本人或监护人已明确同意声音复刻。");
      return;
    }
    try {
      await onCreate(recording);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "声音创建失败，请稍后重试。");
    }
  }

  const canStop = elapsedSeconds >= FAMILY_VOICE_MIN_SAMPLE_SECONDS;

  return (
    <div
      className="family-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && status !== "recording") {
          onClose();
        }
      }}
    >
      <form
        className="family-dialog family-voice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
      >
        <button
          type="button"
          className="family-close"
          disabled={busy}
          onClick={() => {
            discardRecording();
            onClose();
          }}
        >
          <X />
        </button>
        <p className="family-kicker">PRIVATE FAMILY VOICE</p>
        <h2 id={titleId}>{hasExistingVoice ? `重新录制「${characterName}」的声音` : `为「${characterName}」创建声音`}</h2>
        <p className="family-voice-intro">
          在安静环境中录制 10–60 秒自然说话。录音会保存到家庭私有空间，并通过服务端发送给阿里云百炼完成声音复刻。
        </p>

        <div className={`family-voice-recorder ${status}`}>
          <span className="family-voice-mic"><Microphone size={30} /></span>
          <strong aria-live="polite">
            {status === "recording"
              ? "正在录音"
              : status === "requesting"
                ? "正在请求麦克风权限"
              : status === "recorded"
                ? "录音已完成"
                : "准备录音"}
          </strong>
          <span className="family-voice-timer">
            {formatSeconds(elapsedSeconds)} / 1:00
          </span>
          {status === "idle" ? (
            <button type="button" className="family-primary" onClick={() => void startRecording()}>
              开始录音
            </button>
          ) : status === "requesting" ? (
            <button type="button" className="family-voice-stop" disabled>
              <SpinnerGap className="spin" />正在打开麦克风
            </button>
          ) : status === "recording" ? (
            <button
              type="button"
              className="family-voice-stop"
              disabled={!canStop}
              onClick={stopRecording}
            >
              {canStop
                ? "停止录音"
                : `再录 ${Math.ceil(FAMILY_VOICE_MIN_SAMPLE_SECONDS - elapsedSeconds)} 秒`}
            </button>
          ) : (
            <button type="button" className="family-voice-rerecord" onClick={discardRecording}>
              重新录制
            </button>
          )}
        </div>

        <div className="family-voice-script">
          <strong>建议朗读</strong>
          <p>你好，很高兴和你一起读故事。今天的阳光很温暖，我们慢慢出发，去发现一个充满惊喜的新世界。</p>
        </div>

        {previewUrl ? (
          <audio className="family-voice-preview" src={previewUrl} controls preload="metadata" />
        ) : null}

        <label className="family-consent-check family-voice-consent">
          <input
            type="checkbox"
            checked={consentConfirmed}
            disabled={!recording || busy}
            onChange={(event) => setConsentConfirmed(event.target.checked)}
          />
          <span>
            我确认这是本人声音，或已获得声音本人／其监护人的明确授权；我同意将录音发送至阿里云百炼，仅用于家庭私有绘本的声音复刻与旁白生成。
          </span>
        </label>

        {error ? <p className="family-dialog-error" role="alert">{error}</p> : null}
        <button
          className="family-primary submit"
          disabled={busy || !recording || !consentConfirmed || status === "recording"}
        >
          {busy ? (
            <><SpinnerGap className="spin" />正在创建声音</>
          ) : hasExistingVoice ? (
            "保存新的真人声音"
          ) : (
            "创建真人声音"
          )}
        </button>
        <p className="family-consent">不会创建公开声音页，也不会把录音加入公开分享内容。</p>
      </form>
    </div>
  );
}
