/** Local asset audit; never calls a generation provider or publishes files. */
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

async function main() {
  const root = process.cwd();
  const drafts = JSON.parse(await readFile(path.join(root, "content-drafts/chengyu/chengyu-51-60.json"), "utf8"));
  const audio = JSON.parse(await readFile(path.join(root, "content-drafts/chengyu/chengyu-51-60-audio.json"), "utf8"));
  const output = path.join(root, "content-drafts/chengyu/proverb-contact-sheets");
  await mkdir(output, { recursive: true });
  const report = [];
  for (const book of drafts) {
    const missing: number[] = [], tiles = [];
    let imageBytes = 0;
    for (let index = 0; index < book.pages.length; index++) {
      const filename = path.join(root, "public/library/chengyu", book.id, `${index + 1}.webp`);
      try {
        const bytes = await readFile(filename);
        const info = await sharp(bytes).metadata();
        if (info.width !== 1024 || info.height !== 1024 || info.format !== "webp" || bytes.length > 307200) throw new Error(`Invalid image: ${book.id}/${index + 1}`);
        imageBytes += bytes.length;
        tiles.push({ input: await sharp(bytes).resize(300, 300).toBuffer(), left: index % 4 * 300, top: Math.floor(index / 4) * 328 });
        const label = Buffer.from(`<svg width="300" height="28"><rect width="300" height="28" fill="white"/><text x="12" y="20" font-size="18" fill="#333">${index + 1}</text></svg>`);
        tiles.push({ input: label, left: index % 4 * 300, top: Math.floor(index / 4) * 328 + 300 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        missing.push(index + 1);
      }
    }
    await sharp({ create: { width: 1200, height: Math.ceil(book.pages.length / 4) * 328, channels: 3, background: "#e7e4de" } }).composite(tiles).jpeg({ quality: 88 }).toFile(path.join(output, `${book.id}.jpg`));
    const asset = audio[`chengyu/${book.id}`];
    const contentHash = createHash("sha256").update(JSON.stringify({ version: 1, texts: book.pages.map((p: { zh: string }) => p.zh.trim()) })).digest("hex");
    if (asset.contentHash !== contentHash || asset.pageStarts.length !== book.pages.length || asset.pageStarts[0] !== 0 || !asset.pageStarts.every((s: number, i: number) => s >= 0 && s < asset.duration && (!i || s > asset.pageStarts[i - 1]))) throw new Error(`Invalid audio timing: ${book.id}`);
    const mp3 = path.join(root, "public", asset.url);
    const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-f", "s16le", "-ar", "24000", "-ac", "1", "pipe:1"], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    if (Math.abs(pcm.length / 48000 - asset.duration) > 0.05) throw new Error(`Audio duration mismatch: ${book.id}`);
    // Detect silent or truncated page segments, not only a valid MP3 header.
    for (let i = 0; i < asset.pageStarts.length; i++) {
      const start = Math.round(asset.pageStarts[i] * 24000);
      const end = Math.round((asset.pageStarts[i + 1] ?? asset.duration) * 24000);
      let peak = 0;
      for (let sample = start; sample < end && sample * 2 + 1 < pcm.length; sample++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(sample * 2)));
      if (end - start < 2400 || peak < 100) throw new Error(`Silent/short page audio: ${book.id}/${i + 1}`);
    }
    report.push({ id: book.id, title: book.title, pages: book.pages.length, images: book.pages.length - missing.length, missing, imageBytes, audioBytes: (await stat(mp3)).size, audioSeconds: asset.duration, audioVerified: true });
  }
  await writeFile(path.join(root, "content-drafts/chengyu/chengyu-51-60-assets-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ books: report.length, images: report.reduce((n, b) => n + b.images, 0), pages: report.reduce((n, b) => n + b.pages, 0), missing: report.filter(b => b.missing.length).map(b => ({ id: b.id, pages: b.missing })), audioSeconds: report.reduce((n, b) => n + b.audioSeconds, 0) }));
  if (report.some(b => b.missing.length)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Asset audit failed"); process.exitCode = 1; });
