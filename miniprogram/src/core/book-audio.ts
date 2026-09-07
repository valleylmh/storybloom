import type { BookAudio } from "./types";

export function validBookAudio(audio: BookAudio | undefined, pageCount: number): audio is BookAudio {
  return Boolean(audio && /^https:\/\//.test(audio.url) && !/[?#]/.test(audio.url) &&
    audio.pageStarts.length === pageCount && audio.pageStarts[0] === 0 &&
    Number.isFinite(audio.duration) && audio.duration > 0 &&
    audio.pageStarts.every((start, index) => Number.isFinite(start) && start >= 0 &&
      start < audio.duration && (index === 0 || start > audio.pageStarts[index - 1])));
}
export function pageAtTime(starts: number[], seconds: number): number {
  let page = 0;
  for (let i = 1; i < starts.length && seconds >= starts[i]; i++) page = i;
  return page;
}
