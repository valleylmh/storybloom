import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasTokenPlanTtsConfig, synthesizeTokenPlanTtsAudio } from "../src/lib/token-plan-tts-server";
import { synthesizeEdgeTtsAudio } from "../src/lib/edge-tts-server";
import type { Book } from "../miniprogram/src/core/types";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextRequire = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
nextRequire("@next/env").loadEnvConfig(root, true, { info() {}, error() {} });
const cache = path.join(root, "miniprogram/audio-cache");
const require = createRequire(import.meta.url);
const books: Record<string, Book> = require(path.join(root, "miniprogram/release/dist/reader/data/books.js"));
async function main() {
  await mkdir(cache, { recursive: true });
  const provider = hasTokenPlanTtsConfig() ? "bailian" : "edge";
  const jobs = Object.values(books).flatMap(book => book.pages.flatMap((page, index) => (["zh", "en"] as const).map(language => ({ book: book.id, index, language, text: page[language] }))));
  console.log(JSON.stringify({ provider, segments: jobs.length, characters: jobs.reduce((n, j) => n + j.text.length, 0) }));
  const manifest: Record<string, Array<{ zh?: string; en?: string }>> = {};
  const models: Record<string, string> = {};
  let next = 0, done = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const key = createHash("sha256").update(JSON.stringify({ ...job, provider, version: 1 })).digest("hex").slice(0, 24);
      const name = `${key}.mp3`;
      const file = path.join(cache, name);
      let exists = false;
      try { exists = (await stat(file)).size > 100; } catch { /* generate below */ }
      let used = provider;
      if (!exists) {
        let bytes: Buffer;
        if (provider === "bailian") {
          try { ({ bytes } = await synthesizeTokenPlanTtsAudio({ text: job.text, voice: job.language === "zh" ? "longanlingxin" : "longanlufeng" })); }
          catch { used = "edge-fallback"; ({ bytes } = await synthesizeEdgeTtsAudio({ text: job.text, voice: job.language === "zh" ? "zh-CN-XiaoxiaoNeural" : "en-US-AnaNeural" })); }
        } else ({ bytes } = await synthesizeEdgeTtsAudio({ text: job.text, voice: job.language === "zh" ? "zh-CN-XiaoxiaoNeural" : "en-US-AnaNeural" }));
        const raw = path.join(cache, `${key}.raw.mp3`);
        await writeFile(raw, bytes);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-ac", "1", "-ar", "24000", "-b:a", "32k", file], { stdio: "pipe" });
        await writeFile(path.join(cache, `${key}.json`), JSON.stringify({ provider: used }));
      } else {
        try { used = JSON.parse(await readFile(path.join(cache, `${key}.json`), "utf8")).provider; } catch { used = "cached-unknown"; }
      }
      manifest[job.book] ||= books[job.book].pages.map(() => ({}));
      manifest[job.book][job.index][job.language] = name;
      models[used] = String(Number(models[used] || 0) + 1);
      done++;
      if (done % 8 === 0 || done === jobs.length) console.log(`音频 ${done}/${jobs.length}`);
    }
  }
  await Promise.all([worker(), worker()]);
  await writeFile(path.join(cache, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ complete: done, providers: models }));
}
main().catch(() => { console.error("音频生成未完成；已完成文件已缓存，可重新运行续做。未输出供应商凭证或临时地址。"); process.exitCode = 1; });
