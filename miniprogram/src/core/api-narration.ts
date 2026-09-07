/// <reference types="miniprogram-api-typings" />
import type { BookPage, Language } from "./types";
import type { NarrationSource } from "./narration";

type Cached = { url: string; expires: number; local: boolean };
const cache = new Map<string, Cached>();
let fileNumber = 0;
const runId = Date.now();
let clearedPreviousRun = false;
function clearPreviousInlineFiles() {
  if (clearedPreviousRun) return;
  clearedPreviousRun = true;
  try {
    const manager = wx.getFileSystemManager();
    for (const name of manager.readdirSync(wx.env.USER_DATA_PATH)) {
      if (/^storybloom-audio-\d+-\d+\.(mp3|wav)$/.test(name) && !name.startsWith(`storybloom-audio-${runId}-`)) {
        manager.unlink({ filePath: `${wx.env.USER_DATA_PATH}/${name}`, fail() {} });
      }
    }
  } catch { /* Cache housekeeping must not prevent reading. */ }
}
function discard(item: Cached) {
  if (item.local) wx.getFileSystemManager().unlink({ filePath: item.url, fail() {} });
}
function remember(key: string, item: Cached) {
  const old = cache.get(key);
  if (old) discard(old);
  cache.delete(key); cache.set(key, item);
  while (cache.size > 24) {
    const first = cache.keys().next().value as string;
    discard(cache.get(first)!); cache.delete(first);
  }
}

/** Calls only the existing public website API. No credentials or provider requests in the client. */
export class ApiNarrationSource implements NarrationSource {
  private pending?: WechatMiniprogram.RequestTask;
  private reject?: (error: Error) => void;
  private epoch = 0;
  constructor(private endpoint: string, private pages: BookPage[], private requestMode?: "zh-en") {}
  cancel() {
    this.epoch++;
    const pending = this.pending;
    this.pending = undefined;
    this.reject?.(new Error("朗读已暂停")); this.reject = undefined;
    pending?.abort();
  }
  resolve(pageIndex: number, language: Language): Promise<string> {
    this.cancel();
    if (!/^https:\/\/[^\s?#@]+\/api\/audio$/.test(this.endpoint)) return Promise.reject(new Error("朗读接口地址无效"));
    const text = this.pages[pageIndex]?.[language];
    if (!text?.trim()) return Promise.reject(new Error("本页没有可朗读文字"));
    const key = JSON.stringify([this.endpoint, this.requestMode || language, text]);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      cache.delete(key); cache.set(key, cached);
      return Promise.resolve(cached.url);
    }
    if (cached) { discard(cached); cache.delete(key); }
    const token = this.epoch;
    return new Promise<string>((resolve, reject) => {
      this.reject = reject;
      this.pending = wx.request({
        url: this.endpoint, method: "POST", timeout: 60000,
        header: { "content-type": "application/json" },
        data: { text, mode: this.requestMode || language, sampleRate: 24000 },
        success: response => {
          if (token !== this.epoch) return;
          this.pending = undefined;
          if (response.statusCode !== 200) {
            reject(new Error(response.statusCode === 429 ? "朗读请求较多，请稍后重试" : "音频生成失败，请点击播放重试")); return;
          }
          const result = response.data as { audioUrl?: string };
          const url = result?.audioUrl;
          if (typeof url !== "string") { reject(new Error("接口未返回音频")); return; }
          if (/^https:\/\//.test(url)) {
            // Signed URLs stay in memory only; short TTL avoids replaying expired links.
            remember(key, { url, expires: Date.now() + 60000, local: false });
            resolve(url); return;
          }
          const inline = /^data:audio\/(mpeg|mp3|wav);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(url);
          if (!inline || inline[2].length > 8 * 1024 * 1024) { reject(new Error("接口返回的音频格式不支持")); return; }
          clearPreviousInlineFiles();
          const filePath = `${wx.env.USER_DATA_PATH}/storybloom-audio-${runId}-${++fileNumber}.${inline[1] === "wav" ? "wav" : "mp3"}`;
          wx.getFileSystemManager().writeFile({ filePath, data: inline[2], encoding: "base64",
            success: () => {
              if (token !== this.epoch) { discard({ url: filePath, local: true, expires: 0 }); return; }
              remember(key, { url: filePath, expires: Date.now() + 3600000, local: true }); resolve(filePath);
            }, fail: () => reject(new Error("音频保存失败，请检查手机存储空间")),
          });
        },
        fail: () => {
          if (token !== this.epoch) return;
          this.pending = undefined; this.reject = undefined;
          reject(new Error("朗读请求失败，请检查网络或小程序请求域名配置"));
        },
      });
    });
  }
}
