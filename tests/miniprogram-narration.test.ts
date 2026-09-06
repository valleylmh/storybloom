import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NarrationController, type AudioPort, type NarrationState } from "../miniprogram/src/core/narration";
import type { BookPage } from "../miniprogram/src/core/types";

class Audio implements AudioPort {
  src = ""; autoplay = false;
  play = vi.fn(); pause = vi.fn(); stop = vi.fn(); destroy = vi.fn();
  playing = () => {}; waiting = () => {}; ended = () => {}; error = () => {};
  timeUpdated = () => {};
  onPlay(callback: () => void) { this.playing = callback; }
  onWaiting(callback: () => void) { this.waiting = callback; }
  onEnded(callback: () => void) { this.ended = callback; }
  onError(callback: () => void) { this.error = callback; }
  onTimeUpdate(callback: () => void) { this.timeUpdated = callback; }
}
function setup(length = 3, missing = false) {
  const pages: BookPage[] = Array.from({ length }, (_, index) => ({ zh: "中文", en: "English", image: "", audio: { zh: `https://media.example.com/${index}.zh.mp3`, en: missing ? "" : `https://media.example.com/${index}.en.mp3` } }));
  const tracks: Audio[] = [], states: NarrationState[] = [];
  const controller = new NarrationController(pages, () => { const audio = new Audio(); tracks.push(audio); return audio; }, state => states.push(state));
  return { controller, tracks, states };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("mini narration lifecycle", () => {
  it("opens silently; plays Chinese and highlights only when playback starts", () => {
    const { controller, tracks } = setup();
    expect(tracks).toHaveLength(0);
    controller.play();
    expect(tracks[0].src).toContain("0.zh.mp3");
    expect(controller.state.status).toBe("loading");
    expect(controller.state.language).toBeNull();
    tracks[0].playing();
    expect(controller.state.language).toBe("zh");
    controller.destroy();
  });
  it("reads Chinese then English before advancing in bilingual mode", () => {
    const { controller, tracks } = setup();
    controller.setMode("both"); controller.play(); tracks[0].ended();
    expect(controller.state.pageIndex).toBe(0);
    expect(tracks[1].src).toContain("0.en.mp3");
    tracks[1].ended();
    expect(controller.state.pageIndex).toBe(1);
    expect(tracks[2].src).toContain("1.zh.mp3");
    controller.destroy();
  });
  it.each([8, 9, 12, 14])("stops after the final page of a %i-page book without wrapping", length => {
    const { controller, tracks } = setup(length);
    controller.setMode("en"); controller.play();
    for (let index = 0; index < length; index++) tracks[index].ended();
    expect(controller.state).toMatchObject({ pageIndex: length - 1, active: false, status: "ended", language: null });
    expect(tracks).toHaveLength(length);
    controller.selectPage(length);
    expect(controller.state.pageIndex).toBe(length - 1);
    controller.destroy();
  });
  it("manual navigation cancels old track callbacks and keeps playing on the selected page", () => {
    const { controller, tracks } = setup();
    controller.play(); controller.selectPage(2);
    tracks[0].ended(); tracks[0].error(); tracks[0].playing();
    expect(controller.state.pageIndex).toBe(2);
    expect(controller.state.active).toBe(true);
    expect(tracks[1].src).toContain("2.zh.mp3");
    expect(tracks[0].destroy).toHaveBeenCalledTimes(1);
    expect(tracks).toHaveLength(2);
    controller.destroy();
  });
  it("resumes the paused segment; navigation while paused stays silent", () => {
    const { controller, tracks } = setup();
    controller.play(); tracks[0].playing(); controller.pause();
    expect(controller.state.language).toBeNull();
    controller.play(); expect(tracks).toHaveLength(1);
    expect(tracks[0].play).toHaveBeenCalledTimes(2);
    controller.pause(); controller.selectPage(1);
    expect(controller.state.active).toBe(false);
    expect(tracks).toHaveLength(1);
    controller.play(); expect(tracks[1].src).toContain("1.zh.mp3");
    controller.destroy();
  });
  it("changes language from the start of current page, preserving paused state", () => {
    const { controller, tracks } = setup();
    controller.play(); controller.setMode("en");
    expect(tracks[1].src).toContain("0.en.mp3");
    controller.pause(); controller.setMode("both");
    expect(tracks).toHaveLength(2);
    controller.play(); expect(tracks[2].src).toContain("0.zh.mp3");
    controller.destroy();
  });
  it("pausing during load suppresses late playback and page advance", () => {
    const { controller, tracks } = setup();
    controller.play(); controller.pause();
    tracks[0].playing(); tracks[0].ended();
    vi.advanceTimersByTime(30000);
    expect(controller.state).toMatchObject({ active: false, status: "paused", pageIndex: 0 });
    expect(tracks[0].pause).toHaveBeenCalledTimes(2);
    controller.destroy();
  });
  it("missing English track stops bilingual narration but allows manual reading", () => {
    const { controller, tracks } = setup(3, true);
    controller.setMode("both"); controller.play(); tracks[0].ended();
    expect(controller.state).toMatchObject({ active: false, status: "error", pageIndex: 0 });
    expect(controller.state.error).toContain("暂无");
    controller.selectPage(1);
    expect(controller.state).toMatchObject({ pageIndex: 1, active: false, error: "" });
    controller.destroy();
  });
  it("network error can be retried without losing reading position", () => {
    const { controller, tracks } = setup();
    controller.selectPage(1); controller.play(); tracks[0].error();
    expect(controller.state.status).toBe("error");
    controller.play();
    expect(tracks[1].src).toContain("1.zh.mp3");
    controller.destroy();
  });
  it("times out stalled loading and clears timeouts after actual playback starts", () => {
    const { controller, tracks } = setup();
    controller.play(); vi.advanceTimersByTime(20001);
    expect(controller.state.error).toContain("超时");
    controller.play(); tracks[1].playing(); vi.advanceTimersByTime(60000);
    expect(controller.state.status).toBe("playing");
    controller.destroy();
  });
  it("unloading destroys audio and suppresses all subsequent events", () => {
    const { controller, tracks, states } = setup();
    controller.play(); controller.destroy();
    const count = states.length;
    tracks[0].ended(); tracks[0].error(); tracks[0].playing();
    controller.play(); vi.advanceTimersByTime(30000);
    expect(states).toHaveLength(count);
    expect(tracks[0].destroy).toHaveBeenCalledOnce();
  });
  it("recovers from buffering when progress resumes without a second play event", () => {
    const { controller, tracks } = setup();
    controller.play(); tracks[0].playing(); tracks[0].waiting();
    expect(controller.state.status).toBe("loading");
    tracks[0].timeUpdated(); vi.advanceTimersByTime(30000);
    expect(controller.state).toMatchObject({ status: "playing", language: "zh" });
    controller.destroy();
  });
});
