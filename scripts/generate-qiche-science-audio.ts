/** Prepare only the approved city science batch, without uploading assets. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { resolveNarrationRequest } from "../src/lib/narration-audio-server";
import { synthesizeTokenPlanTtsAudio } from "../src/lib/token-plan-tts-server";
import type { BookAudio } from "../miniprogram/src/core/types";

const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(
  process.cwd(), true, { info() {}, error() {} },
);
process.env.BAILIAN_TOKEN_KEY ||= process.env.DASHSCOPE_TOKEN_KEY;
process.env.TOKEN_PLAN_TTS_TIMEOUT_MS ||= "60000";

const ids = [
  "wu-ren-ji-ba-kuai-di-song-shang-tian-le-ma",
  "gao-tie-xiao-fei-long-zen-yang-ping-wen-pao-de-kuai",
  "da-fei-ji-zai-pao-dao-shang-pai-dui-ma",
  "tian-shang-de-wei-xing-zen-me-gei-qi-che-yin-lu",
  "kong-zhong-chu-zu-che-zhen-de-neng-fei-qi-lai-ma",
];
const cache = path.resolve("miniprogram/book-audio-cache");
const manifestFile = "content-drafts/qiche/qiche-43-47-audio.json";
const hash = (data: string) => createHash("sha256").update(data).digest("hex");
const decode = (file: string) => execFileSync("ffmpeg", [
  "-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1",
], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

async function pagePcm(text: string) {
  const request = await resolveNarrationRequest({
    text, mode: "zh", model: "qwen-audio-3.0-tts-plus", voice: "longanlingxin",
  });
  const file = path.join(cache, `${request.cacheKey}.pcm`);
  try {
    const bytes = await readFile(file);
    if (bytes.length > 4800 && bytes.length % 2 === 0) return bytes;
  } catch { /* Reuse unchanged narration when available. */ }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const generated = await synthesizeTokenPlanTtsAudio({
        text: request.text, model: request.model, voice: request.voice,
      });
      const source = path.join(cache, `${request.cacheKey}.source.mp3`);
      await writeFile(source, generated.bytes);
      const pcm = decode(source);
      if (pcm.length <= 4800 || pcm.length % 2) throw new Error("Invalid decoded narration");
      await writeFile(`${file}.tmp`, pcm);
      await rename(`${file}.tmp`, file);
      return pcm;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Narration unavailable");
}

async function main() {
  await mkdir(cache, { recursive: true });
  const manifest: Record<string, BookAudio> = {};
  let checkpoint = Promise.resolve();
  let cursor = 0;
  const failures: string[] = [];
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const { book } = JSON.parse(await readFile(`content-drafts/qiche/${id}.json`, "utf8")) as {
          book: { id: string; order: number; pages: { zhText: string }[] };
        };
        if (book.id !== id || book.order < 43 || book.order > 47) throw new Error("Wrong batch");
        const texts = book.pages.map(p => p.zhText.trim());
        if (texts.some(text => !text)) throw new Error("Missing narration");
        const contentHash = hash(JSON.stringify({ version: 1, texts }));
        const chunks: Buffer[] = [], pageStarts: number[] = [];
        let samples = 0;
        for (const [index, text] of texts.entries()) {
          const pcm = await pagePcm(text);
          pageStarts.push(samples / 24000);
          samples += pcm.length / 2;
          chunks.push(pcm);
          console.log(JSON.stringify({ order: book.order, page: index + 1, status: "decoded" }));
        }
        const raw = path.join(cache, `${contentHash}-science.pcm`);
        await writeFile(raw, Buffer.concat(chunks));
        const url = `/library/qiche/${id}/zh-${contentHash.slice(0, 16)}.mp3`;
        const output = path.resolve(`public${url}`);
        await mkdir(path.dirname(output), { recursive: true });
        execFileSync("ffmpeg", [
          "-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw,
          "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", `${output}.tmp`,
        ], { stdio: "pipe" });
        const duration = samples / 24000;
        if (Math.abs(decode(`${output}.tmp`).length / 48000 - duration) > 0.05) {
          throw new Error("Narration duration drift");
        }
        await rename(`${output}.tmp`, output);
        manifest[`qiche/${id}`] = { url, contentHash, pageStarts, duration };
        checkpoint = checkpoint.then(async () => {
          await writeFile(`${manifestFile}.tmp`, JSON.stringify(manifest, null, 2) + "\n");
          await rename(`${manifestFile}.tmp`, manifestFile);
        });
        await checkpoint;
        console.log(JSON.stringify({ order: book.order, status: "complete-local", duration }));
      } catch {
        failures.push(id);
        console.error(JSON.stringify({ book: id, error: "Bailian generation or audio verification failed; cached pages retained" }));
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  await checkpoint;
  // Merge the latest file only after generation, preserving other batches.
  const localFile = "content-drafts/qiche/local-audio.json";
  const local = JSON.parse(await readFile(localFile, "utf8"));
  Object.assign(local, manifest);
  await writeFile(`${localFile}.science.tmp`, JSON.stringify(local, null, 2) + "\n");
  await rename(`${localFile}.science.tmp`, localFile);
  console.log(JSON.stringify({ completed: Object.keys(manifest).length, failures, uploaded: false }));
  if (failures.length) process.exitCode = 1;
}

main().catch(() => {
  console.error("City science narration preparation failed; credentials omitted.");
  process.exitCode = 1;
});
