/** Prepare the approved 51–60 batch locally; does not upload or publish. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { synthesizeTokenPlanTtsAudio } from "../src/lib/token-plan-tts-server";
import type { BookAudio } from "../miniprogram/src/core/types";

const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
process.env.BAILIAN_TOKEN_KEY ||= process.env.DASHSCOPE_TOKEN_KEY;
process.env.TOKEN_PLAN_TTS_TIMEOUT_MS = "8000";
const model = "qwen-audio-3.0-tts-plus", voice = "longanlingxin";
const root = path.resolve(".storybloom-cache/proverb-audio");
const manifestPath = path.resolve("content-drafts/chengyu/chengyu-51-60-audio.json");
const probe = process.argv.includes("--probe");
type Draft = { id: string; pages: { zh: string }[] };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const decode = (file: string) => execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

async function pagePcm(text: string): Promise<Buffer> {
  const key = hash(JSON.stringify({ model, voice, text: text.trim(), version: 1 }));
  const pcmFile = path.join(root, `${key}.pcm`);
  try {
    const pcm = await readFile(pcmFile);
    if (pcm.length > 4800 && pcm.length % 2 === 0) return pcm;
  } catch { /* Resume at the first missing page. */ }
  const source = path.join(root, `${key}.mp3`);
  let pcm: Buffer;
  try { pcm = decode(source); }
  catch {
    const generated = await synthesizeTokenPlanTtsAudio({ text: text.trim(), model, voice });
    await writeFile(`${source}.tmp`, generated.bytes);
    await rename(`${source}.tmp`, source);
    pcm = decode(source);
  }
  if (pcm.length < 4800 || pcm.length % 2) throw new Error("Invalid decoded audio");
  await writeFile(`${pcmFile}.tmp`, pcm);
  await rename(`${pcmFile}.tmp`, pcmFile);
  return pcm;
}

async function main() {
  await mkdir(root, { recursive: true });
  const books: Draft[] = JSON.parse(await readFile(path.resolve("content-drafts/chengyu/chengyu-51-60.json"), "utf8"));
  let manifest: Record<string, BookAudio> = {};
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch { /* New batch. */ }
  if (probe) {
    const pcm = await pagePcm(books[0].pages[0].zh);
    console.log(JSON.stringify({ probe: "decoded", provider: model, seconds: pcm.length / 48000 }));
    return;
  }
  let cursor = 0;
  const failures: string[] = [];
  async function worker() {
    while (cursor < books.length) {
      const book = books[cursor++];
      if (!/^[a-z0-9-]+$/.test(book.id) || !book.pages.length || book.pages.some(p => !p.zh.trim())) throw new Error("Invalid draft");
      try {
        const contentHash = hash(JSON.stringify({ version: 1, texts: book.pages.map(p => p.zh.trim()) }));
        const chunks: Buffer[] = [], pageStarts: number[] = [];
        let samples = 0;
        for (const [index, page] of book.pages.entries()) {
          const pcm = await pagePcm(page.zh);
          pageStarts.push(samples / 24000);
          chunks.push(pcm); samples += pcm.length / 2;
          // A short pause lets the listener settle on the next illustration.
          if (index < book.pages.length - 1) { chunks.push(Buffer.alloc(14400)); samples += 7200; }
          console.log(JSON.stringify({ book: book.id, page: index + 1, total: book.pages.length, status: "decoded" }));
        }
        const pcm = Buffer.concat(chunks);
        const raw = path.join(root, `${contentHash}.pcm`);
        await writeFile(raw, pcm);
        const dir = path.resolve("public/library/chengyu", book.id);
        await mkdir(dir, { recursive: true });
        const filename = `zh-${contentHash.slice(0, 16)}.mp3`;
        const output = path.join(dir, filename);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw, "-c:a", "libmp3lame", "-b:a", "64k", "-f", "mp3", `${output}.tmp`], { stdio: "pipe" });
        const duration = samples / 24000;
        if (Math.abs(decode(`${output}.tmp`).length / 48000 - duration) > 0.05) throw new Error("Encoded duration drift");
        await rename(`${output}.tmp`, output);
        manifest[`chengyu/${book.id}`] = { url: `/library/chengyu/${book.id}/${filename}`, contentHash, pageStarts, duration };
        console.log(JSON.stringify({ book: book.id, status: "complete-local", pages: pageStarts.length, seconds: duration }));
      } catch (error) {
        failures.push(book.id);
        const message = error instanceof Error ? error.message : "";
        const code = message.match(/Token Plan TTS 请求失败：(\w[\w.:-]*|HTTP \d+)/)?.[0];
        console.error(JSON.stringify({ book: book.id, error: code || "generation or decoding failed; cached pages retained" }));
      }
    }
  }
  await Promise.all([worker(), worker()]);
  await writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2) + "\n");
  await rename(`${manifestPath}.tmp`, manifestPath);
  console.log(JSON.stringify({ complete: Object.keys(manifest).length, failures, uploaded: false }));
  if (failures.length) process.exitCode = 1;
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : "";
  console.error(message.startsWith("Token Plan TTS ") ? message : "Audio preparation failed; credentials and provider URLs omitted.");
  process.exitCode = 1;
});
