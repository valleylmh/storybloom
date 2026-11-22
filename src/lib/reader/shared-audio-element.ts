let sharedAudioElement: HTMLAudioElement | null = null;

/**
 * Returns one persistent <audio> element kept mounted across Next.js route
 * navigations so mobile browsers keep the user-gesture unlock and lock-screen
 * audio session alive when moving from one book to the next.
 */
export function getSharedAudioElement(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (sharedAudioElement && sharedAudioElement.isConnected) {
    return sharedAudioElement;
  }
  const existing = document.querySelector<HTMLAudioElement>(
    'audio[data-storybloom-shared-audio="true"]',
  );
  if (existing) {
    sharedAudioElement = existing;
    return existing;
  }
  const audio = document.createElement("audio");
  audio.preload = "auto";
  audio.hidden = true;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  audio.dataset.storybloomSharedAudio = "true";
  document.body.appendChild(audio);
  sharedAudioElement = audio;
  return audio;
}

export function clearAudioElementHandlers(audio: HTMLAudioElement) {
  audio.onended = null;
  audio.onplay = null;
  audio.onpause = null;
  audio.onerror = null;
  audio.ontimeupdate = null;
  audio.onloadedmetadata = null;
  audio.oncanplay = null;
}

function resolveArtworkUrl(cover: string | undefined): string | undefined {
  if (!cover?.trim()) return undefined;
  if (typeof window === "undefined") return cover;
  try {
    return new URL(cover, window.location.origin).href;
  } catch {
    return cover;
  }
}

export type MediaSessionHandlers = {
  play?: (() => void) | null;
  pause?: (() => void) | null;
  stop?: (() => void) | null;
  previoustrack?: (() => void) | null;
  nexttrack?: (() => void) | null;
};

export function updateMediaSession(input: {
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  playbackState: "playing" | "paused" | "none";
  handlers?: MediaSessionHandlers;
}) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !navigator.mediaSession) {
    return;
  }
  const session = navigator.mediaSession;
  try {
    if (typeof MediaMetadata !== "undefined") {
      const artworkUrl = resolveArtworkUrl(input.cover);
      session.metadata = new MediaMetadata({
        title: input.title,
        artist: input.artist || "StoryBloom 绘本馆",
        album: input.album || "StoryBloom 绘本馆",
        ...(artworkUrl ? { artwork: [{ src: artworkUrl }] } : {}),
      });
    }
  } catch {
    // Metadata updates are best-effort across mobile browsers.
  }

  try {
    session.playbackState = input.playbackState;
  } catch {
    // Ignore unsupported playbackState writes.
  }

  if (input.handlers) {
    const actions: Array<keyof MediaSessionHandlers> = [
      "play",
      "pause",
      "stop",
      "previoustrack",
      "nexttrack",
    ];
    for (const action of actions) {
      if (!(action in input.handlers)) continue;
      try {
        session.setActionHandler(action, input.handlers[action] ?? null);
      } catch {
        // Some browsers do not support every MediaSession action.
      }
    }
  }
}

export function updateMediaSessionPosition(duration: number, position: number) {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator) ||
    !navigator.mediaSession ||
    typeof navigator.mediaSession.setPositionState !== "function"
  ) {
    return;
  }
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) {
    return;
  }
  const clamped = Math.max(0, Math.min(duration, position));
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: clamped,
      playbackRate: 1,
    });
  } catch {
    // Some WebViews throw if position state is updated before audio metadata stabilizes.
  }
}

export function clearMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !navigator.mediaSession) {
    return;
  }
  const session = navigator.mediaSession;
  try {
    session.playbackState = "none";
  } catch {
    // Ignore unsupported writes.
  }
  for (const action of ["play", "pause", "stop", "previoustrack", "nexttrack"] as const) {
    try {
      session.setActionHandler(action, null);
    } catch {
      // Ignore unsupported actions.
    }
  }
}
