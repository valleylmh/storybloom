/** Offline publishing job: only curated public book text/audio enters the public bucket. */
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { getSupabaseAdmin } from "../src/lib/email/supabase-admin";
import { resolveNarrationRequest } from "../src/lib/narration-audio-server";
import { synthesizeTokenPlanTtsAudio } from "../src/lib/token-plan-tts-server";
import { validBookAudio } from "../miniprogram/src/core/book-audio";
import { bookAudioHash } from "./lib/miniprogram-book-audio";
import { exportMiniContent } from "./lib/miniprogram-content";
import { getAllSeries, getSeriesBooks } from "../src/lib/library";
import type { Book, BookAudio } from "../miniprogram/src/core/types";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
// Existing project environments use this name for the Token Plan credential.
process.env.BAILIAN_TOKEN_KEY ||= process.env.DASHSCOPE_TOKEN_KEY;
process.env.TOKEN_PLAN_TTS_TIMEOUT_MS ||= "60000";
const root = path.resolve("miniprogram/book-audio-cache");
const bucket = "library-audio-public";
const manifestFile = path.join(root, "manifest.json");
const upload = process.argv.includes("--upload");
const concurrency = Math.max(1, Math.min(8, Number(process.argv.find(a => a.startsWith("--workers="))?.split("=")[1] || 4)));
const limit = Number(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || Infinity);
const selectedBooks = process.argv.find(a => a.startsWith("--books="))?.slice("--books=".length).split(",");
const selectedIds = process.argv.find(a => a.startsWith("--qiche-books="))?.slice("--qiche-books=".length).split(",");
async function main() {
  let all: Record<string, Book>;
  if (selectedIds) {
    all = {};
    for (const id of selectedIds) {
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid book ID");
      const { book } = JSON.parse(await readFile(path.resolve("content-drafts/qiche", `${id}.json`), "utf8"));
      if (book.id !== id || !book.pages?.length) throw new Error("Invalid book draft");
      const key = `qiche/${id}`;
      all[key] = { id: key, title: book.title, guide: [], pages: book.pages.map((p: { zhText: string; enText: string }) => {
        if (!p.zhText?.trim()) throw new Error("Missing Chinese text");
        return { zh: p.zhText, en: p.enText, image: "", audio: { zh: "", en: "" } };
      }) };
    }
  } else {
    // Always use current published text, never an older generated mini-program bundle.
    all = exportMiniContent(getAllSeries(), getSeriesBooks, "").books;
    if (selectedBooks) {
      for (const id of selectedBooks) if (!all[id]) throw new Error(`Unknown published book: ${id}`);
      all = Object.fromEntries(selectedBooks.map(id => [id, all[id]]));
    }
  }
  await mkdir(root, { recursive: true });
  const admin = getSupabaseAdmin();
  if (upload) {
    const { data, error } = await admin.storage.getBucket(bucket);
    if (error) {
      if (!/not found/i.test(error.message)) throw new Error("Cannot inspect public library audio bucket");
      const created = await admin.storage.createBucket(bucket, { public: true, allowedMimeTypes: ["audio/mpeg", "application/json"], fileSizeLimit: 52428800 });
      if (created.error) throw new Error("Cannot create dedicated library audio bucket");
    } else if (!data.public) throw new Error("Dedicated library bucket is private; refusing to change existing permissions");
  }
  const publicManifestFile = path.resolve("miniprogram/chinese-audio-manifest.json");
  const publicManifest: Record<string, BookAudio> = JSON.parse(await readFile(publicManifestFile, "utf8"));
  let cachedManifest: Record<string, BookAudio> = {};
  try { cachedManifest = JSON.parse(await readFile(manifestFile, "utf8")); } catch { /* First run. */ }
  const manifest: Record<string, BookAudio> = { ...cachedManifest, ...publicManifest };
  const local: Record<string, BookAudio> = {};
  for (const file of ["content-drafts/chengyu/chengyu-51-60-audio.json", "content-drafts/chengyu/chengyu-61-65-audio.json", "content-drafts/qiche/local-audio.json"]) {
    Object.assign(local, JSON.parse(await readFile(file, "utf8")));
  }
  const verifyRemote = async (asset: BookAudio, bytes?: number) => {
    const check = await fetch(asset.url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
    const size = Number(check.headers.get("content-length"));
    if (!check.ok || !check.headers.get("content-type")?.startsWith("audio/") || size <= 0 || (bytes !== undefined && size !== bytes)) throw new Error("Public audio verification failed");
  };
  // Serialize checkpoint writes so parallel workers cannot overwrite newer progress.
  let checkpoint = Promise.resolve();
  const save = (id: string, asset: BookAudio) => {
    manifest[id] = asset;
    publicManifest[id] = asset;
    checkpoint = checkpoint.then(async () => {
      for (const [file, data] of [[manifestFile, manifest], [publicManifestFile, publicManifest]] as const) {
        await writeFile(`${file}.tmp`, JSON.stringify(data, null, 2) + "\n");
        await rename(`${file}.tmp`, file);
      }
    });
    return checkpoint;
  };
  const books = Object.values(all).slice(0, limit);
  let cursor = 0, completed = 0;
  const failures: string[] = [];
  async function worker() {
    while (cursor < books.length) {
      const book = books[cursor++];
      try {
        const contentHash = bookAudioHash(book);
        if (publicManifest[book.id]?.contentHash === contentHash && validBookAudio(publicManifest[book.id], book.pages.length)) {
          if (upload) await verifyRemote(publicManifest[book.id]);
          completed++;
          console.log(JSON.stringify({ completed, total: books.length, book: book.id, status: "reused-public" }));
          continue;
        }
        let asset: BookAudio, mp3: string;
        const bundled = local[book.id];
        if (bundled?.contentHash === contentHash && bundled.url === `/library/${book.id}/zh-${contentHash.slice(0, 16)}.mp3` &&
            validBookAudio({ ...bundled, url: `https://local.invalid${bundled.url}` }, book.pages.length)) {
          mp3 = path.resolve(`public${bundled.url}`);
          const bytes = await readFile(mp3);
          const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 });
          if (Math.abs(decoded.length / 48000 - bundled.duration) > 0.05) throw new Error("Bundled duration drift");
          const fileHash = createHash("sha256").update(bytes).digest("hex");
          asset = { ...bundled, url: admin.storage.from(bucket).getPublicUrl(`v1/${contentHash}/${fileHash}.mp3`).data.publicUrl };
        } else {
          const chunks: Buffer[] = [], pageStarts: number[] = [];
          let samples = 0;
          for (const page of book.pages) {
            const request = await resolveNarrationRequest({ text: page.zh, mode: "zh", model: "qwen-audio-3.0-tts-plus", voice: "longanlingxin" });
            const pcmFile = path.join(root, `${request.cacheKey}.pcm`);
            let pcm: Buffer;
            try { pcm = await readFile(pcmFile); if (!pcm.length || pcm.length % 2) throw new Error("invalid PCM"); }
            catch {
              // Explicit provider: never silently substitute Edge for this publishing job.
              let generated: Awaited<ReturnType<typeof synthesizeTokenPlanTtsAudio>> | undefined;
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  generated = await synthesizeTokenPlanTtsAudio({ text: request.text, model: request.model, voice: request.voice });
                  break;
                } catch (error) {
                  if (attempt === 2) throw error;
                  await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
                }
              }
              if (!generated) throw new Error("Bailian generation failed");
              const bytes = generated.bytes;
              const source = path.join(root, `${request.cacheKey}.source.mp3`);
              await writeFile(source, bytes);
              execFileSync("ffmpeg", ["-v", "error", "-y", "-i", source, "-ac", "1", "-ar", "24000", "-f", "s16le", pcmFile], { stdio: "pipe" });
              pcm = await readFile(pcmFile);
            }
            pageStarts.push(samples / 24000);
            samples += pcm.length / 2; chunks.push(pcm);
            console.log(JSON.stringify({ book: book.id, page: pageStarts.length, pages: book.pages.length, status: "page-ready", model: request.model }));
          }
          const combined = Buffer.concat(chunks);
          const audioHash = createHash("sha256").update(combined).digest("hex");
          const raw = path.join(root, `${audioHash}.pcm`);
          mp3 = path.join(root, `${audioHash}.mp3`);
          await writeFile(raw, combined);
          execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw, "-c:a", "libmp3lame", "-b:a", "48k", mp3], { stdio: "pipe" });
          const duration = samples / 24000;
          const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 });
          if (Math.abs(decoded.length / 48000 - duration) > 0.05) throw new Error("Encoded duration drift");
          const object = `v1/${contentHash}/${audioHash}.mp3`;
          asset = { url: admin.storage.from(bucket).getPublicUrl(object).data.publicUrl, pageStarts, duration, contentHash };
        }
        const object = new URL(asset.url).pathname.split(`/object/public/${bucket}/`)[1];
        if (!object || !validBookAudio(asset, book.pages.length)) throw new Error("Invalid published asset");
        if (upload) {
          for (const [name, bytes, contentType] of [[object, await readFile(mp3), "audio/mpeg"], [object.replace(/\.mp3$/, ".json"), Buffer.from(JSON.stringify(asset)), "application/json"]] as const) {
            const result = await admin.storage.from(bucket).upload(name, bytes, { contentType, cacheControl: "31536000", upsert: false });
            if (result.error && !/already exists|duplicate/i.test(result.error.message)) throw new Error("Audio upload failed");
          }
          await verifyRemote(asset, (await stat(mp3)).size);
          await save(book.id, asset);
        }
        completed++;
        console.log(JSON.stringify({ completed, total: books.length, book: book.id, seconds: Math.round(asset.duration), uploaded: upload }));
      } catch (error) {
        failures.push(book.id);
        const message = error instanceof Error ? error.message : "";
        const safeCode = message.match(/Token Plan TTS 请求失败：(\w[\w.:-]*|HTTP \d+)/)?.[0];
        console.error(`Failed: ${book.id}; ${safeCode || "generation or verification failed"}; cached pages retained for retry`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await checkpoint;
  console.log(JSON.stringify({ completed, total: books.length, failures }));
  if (failures.length) process.exitCode = 1;
}
main().catch(() => { console.error("Book audio preparation failed; credentials and signed URLs omitted."); process.exitCode = 1; });
