import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  STORY_VIDEO_AUDIO_LEAD_IN_SECONDS,
  type StoryVideoNarrationMode,
  type StoryVideoSubtitlePair,
} from "@/lib/story-video";

export type StoryVideoRenderScene = {
  page: number;
  subtitlePairs: StoryVideoSubtitlePair[];
  imageSrc: string;
  grayscaleImageSrc: string;
  audioSrc?: string;
  audioDurationSeconds: number;
  durationInFrames: number;
  startFrame: number;
};

export type StoryVideoCompositionProps = Record<string, unknown> & {
  title: string;
  fps: number;
  narrationMode: StoryVideoNarrationMode;
  scenes: StoryVideoRenderScene[];
};

function clampInterpolate(
  frame: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function revealCharacters(text: string, progress: number) {
  if (!text) {
    return "";
  }

  const characters = Array.from(text);
  return characters.slice(0, Math.ceil(characters.length * progress)).join("");
}

function revealWords(text: string, progress: number) {
  if (!text) {
    return "";
  }

  const words = text.trim().split(/\s+/);
  return words.slice(0, Math.ceil(words.length * progress)).join(" ");
}

function getPairProgress(progress: number, index: number, total: number) {
  const segmentLength = 1 / Math.max(1, total);
  const segmentStart = index * segmentLength;
  return Math.min(
    1,
    Math.max(0, (progress - segmentStart) / (segmentLength * 1.08)),
  );
}

function StoryVideoScene({
  title,
  scene,
  fps,
  narrationMode,
}: {
  title: string;
  scene: StoryVideoRenderScene;
  fps: number;
  narrationMode: StoryVideoNarrationMode;
}) {
  const frame = useCurrentFrame();
  const blankFrames = Math.round(0.2 * fps);
  const grayscaleEnd = blankFrames + Math.round(1.45 * fps);
  const colorEnd = grayscaleEnd + Math.round(1.2 * fps);
  const grayReveal = clampInterpolate(
    frame,
    [blankFrames, grayscaleEnd],
    [0, 100],
  );
  const colorReveal = clampInterpolate(
    frame,
    [grayscaleEnd, colorEnd],
    [0, 100],
  );
  const zoom = clampInterpolate(
    frame,
    [0, Math.max(1, scene.durationInFrames - 1)],
    [1, 1.022],
  );
  const copyProgress = clampInterpolate(
    frame,
    [Math.round(0.35 * fps), Math.max(colorEnd, scene.durationInFrames * 0.72)],
    [0, 1],
  );
  const copyOpacity = clampInterpolate(
    frame,
    [Math.round(0.2 * fps), Math.round(0.7 * fps)],
    [0, 1],
  );
  const audioStartFrame = Math.round(STORY_VIDEO_AUDIO_LEAD_IN_SECONDS * fps);
  const titleLength = Array.from(title.trim()).length;
  const titleFontSize =
    titleLength > 28 ? 29 : titleLength > 18 ? 34 : titleLength > 12 ? 38 : 42;
  const subtitleLength = scene.subtitlePairs.reduce(
    (total, pair) => total + pair.zh.length + pair.en.length,
    0,
  );
  const denseSubtitles =
    scene.subtitlePairs.length >= 4 || subtitleLength > 320;
  const compactSubtitles =
    denseSubtitles || scene.subtitlePairs.length >= 3 || subtitleLength > 210;
  const zhFontSize = denseSubtitles ? 24 : compactSubtitles ? 27 : 30;
  const enFontSize = denseSubtitles ? 18 : compactSubtitles ? 20 : 22;
  const pairGap = denseSubtitles ? 12 : compactSubtitles ? 15 : 18;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: "linear-gradient(180deg, #fff9f2 0%, #f6ecdf 100%)",
        color: "#2f241d",
        fontFamily:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 42,
          left: 48,
          right: 48,
          height: 94,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 15,
        }}
      >
        <div
          style={{
            width: 4,
            height: 56,
            flex: "0 0 auto",
            borderRadius: 999,
            backgroundColor: "#d96b45",
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              marginBottom: 5,
              color: "#aa806d",
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2.7,
              lineHeight: 1,
            }}
          >
            STORYBLOOM · PAGE {String(scene.page).padStart(2, "0")}
          </div>
          <div
            style={{
              color: "#91442f",
              fontFamily: 'Georgia, "Songti SC", "STSong", serif',
              fontSize: titleFontSize,
              fontWeight: 600,
              letterSpacing: -0.35,
              lineHeight: 1.12,
            }}
          >
            {title}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 154,
          left: 48,
          width: 624,
          height: 468,
          overflow: "hidden",
          border: "1px solid rgba(102, 73, 54, 0.18)",
          borderRadius: 28,
          backgroundColor: "#fffaf5",
          boxShadow: "0 22px 50px rgba(111, 74, 46, 0.14)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            clipPath: `inset(0 ${100 - grayReveal}% 0 0)`,
          }}
        >
          <Img
            src={scene.grayscaleImageSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            clipPath: `inset(0 ${100 - colorReveal}% 0 0)`,
          }}
        >
          <Img
            src={scene.imageSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 660,
          left: 48,
          right: 48,
          bottom: 82,
          overflow: "hidden",
          opacity: copyOpacity,
          padding: "18px 20px 18px 22px",
          borderLeft: "3px solid rgba(217, 107, 69, 0.72)",
          borderRadius: "0 18px 18px 0",
          backgroundColor: "rgba(255, 250, 245, 0.58)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: pairGap,
          }}
        >
          {scene.subtitlePairs.map((pair, index) => {
            const pairProgress = getPairProgress(
              copyProgress,
              index,
              scene.subtitlePairs.length,
            );
            const pairOpacity = clampInterpolate(
              pairProgress,
              [0, 0.16],
              [0, 1],
            );
            const pairOffset = clampInterpolate(
              pairProgress,
              [0, 0.22],
              [8, 0],
            );

            return (
              <div
                key={`${scene.page}-${index}`}
                style={{
                  display: "grid",
                  rowGap: denseSubtitles ? 5 : 7,
                  opacity: pairOpacity,
                  transform: `translateY(${pairOffset}px)`,
                }}
              >
                {pair.zh ? (
                  <div
                    style={{
                      color: "#35271f",
                      fontSize: zhFontSize,
                      fontWeight: 650,
                      lineHeight: 1.42,
                      letterSpacing: 0.15,
                    }}
                  >
                    {revealCharacters(pair.zh, pairProgress)}
                  </div>
                ) : null}
                {pair.en ? (
                  <div
                    style={{
                      color: "#796457",
                      fontFamily:
                        'Georgia, "PingFang SC", "Microsoft YaHei", serif',
                      fontSize: enFontSize,
                      fontWeight: 500,
                      lineHeight: 1.42,
                      letterSpacing: 0.05,
                    }}
                  >
                    {revealWords(pair.en, pairProgress)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 48,
          bottom: 42,
          color: "#9a8476",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1.2,
        }}
      >
        StoryBloom
      </div>

      {scene.audioSrc && narrationMode !== "none" ? (
        <Sequence
          from={audioStartFrame}
          durationInFrames={Math.max(
            1,
            scene.durationInFrames - audioStartFrame,
          )}
        >
          <Audio src={scene.audioSrc} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

export function StoryVideoComposition({
  title,
  fps,
  narrationMode,
  scenes,
}: StoryVideoCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f7efe6" }}>
      {scenes.map((scene) => (
        <Sequence
          key={scene.page}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
          name={`Page ${scene.page}`}
        >
          <StoryVideoScene
            title={title}
            scene={scene}
            fps={fps}
            narrationMode={narrationMode}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
