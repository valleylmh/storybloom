/** Offline acceptance of an approved batch; never generates, uploads or publishes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const flag = process.argv.indexOf("--batch");
const batch = flag < 0 ? "" : process.argv[flag + 1];
assert.match(batch ?? "", /^batch-\d+-\d+$/, "Provide --batch batch-N-N");
const root = path.resolve("content-drafts/richang");
const directory = path.join(root, batch);
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const plan = await json(path.join(directory, "plan.json"));
assert.equal(plan.approved, true, "Only approved batches may be audited");
const manifest = await json(path.join(root, "local-audio.json"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const report = { batch, checkedAt: new Date().toISOString(), passed: false, books: [], errors: [] };
const imageHashes = new Set();

for (const expected of plan.books) {
  try {
    assert.match(expected.id, /^[a-z0-9-]+$/);
    const { book } = await json(path.join(root, `${expected.id}.json`));
    assert.equal(book.id, expected.id);
    assert.equal(book.order, expected.order);
    assert.equal(book.pages.length, expected.pages);
    const images = [];
    for (const [index, page] of book.pages.entries()) {
      assert.equal(page.page, index + 1);
      assert.ok(page.zhText.trim() && page.enText.trim(), "Both languages are required");
      assert.equal(page.imageStatus, "complete");
      assert.equal(page.generatedWith, "builtin-imagegen");
      assert.ok(page.generationPrompt?.trim() && page.generatedSource?.endsWith(".png"));
      const url = `/library/richang/${book.id}/${page.page}.webp`;
      const bytes = await readFile(path.resolve(`public${url}`));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 1200);
      assert.equal(metadata.height, 1200);
      assert.ok(bytes.length > 1000 && bytes.length <= 300 * 1024);
      const sha256 = hash(bytes);
      assert.ok(!imageHashes.has(sha256), "Duplicate image in batch");
      imageHashes.add(sha256);
      images.push({ page: page.page, url, bytes: bytes.length, sha256 });
    }
    const audio = manifest[`richang/${book.id}`];
    assert.ok(audio, "Missing bundled narration");
    const contentHash = hash(JSON.stringify({ version: 1, texts: book.pages.map((p) => p.zhText.trim()) }));
    assert.equal(audio.contentHash, contentHash, "Narration is stale");
    assert.equal(audio.url, `/library/richang/${book.id}/zh-${contentHash.slice(0, 16)}.mp3`);
    assert.equal(audio.pageStarts.length, book.pages.length);
    assert.equal(audio.pageStarts[0], 0);
    assert.ok(audio.pageStarts.every((v, i, a) => Number.isFinite(v) && (i === 0 || v > a[i - 1])));
    assert.ok(audio.duration > audio.pageStarts.at(-1));
    const file = path.resolve(`public${audio.url}`);
    const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 });
    assert.ok(Math.abs(pcm.length / 48000 - audio.duration) < 0.05, "Decoded duration drift");
    const pageRms = audio.pageStarts.map((start, index) => {
      const end = audio.pageStarts[index + 1] ?? audio.duration;
      const from = Math.floor(start * 24000) * 2;
      const to = Math.min(pcm.length, Math.floor(end * 24000) * 2);
      let squared = 0, samples = 0;
      for (let offset = from; offset + 1 < to; offset += 2) {
        squared += (pcm.readInt16LE(offset) / 32768) ** 2;
        samples++;
      }
      const rms = Math.sqrt(squared / samples);
      assert.ok(Number.isFinite(rms) && rms > 0.001, `Silent page ${index + 1}`);
      return Number(rms.toFixed(6));
    });
    const audioBytes = await readFile(file);
    report.books.push({
      id: book.id, title: book.title, order: book.order, pages: book.pages.length, images,
      audio: { ...audio, bytes: audioBytes.length, sha256: hash(audioBytes), decodedSeconds: pcm.length / 48000, pageRms },
    });
  } catch (error) {
    report.errors.push({ id: expected.id, message: error instanceof Error ? error.message : String(error) });
  }
}
report.totals = {
  expectedBooks: plan.books.length, checkedBooks: report.books.length,
  expectedPages: plan.totalPages, images: imageHashes.size,
  audioFiles: report.books.length, narrationSeconds: report.books.reduce((sum, b) => sum + b.audio.duration, 0),
};
report.passed = report.errors.length === 0 && imageHashes.size === plan.totalPages;
const output = path.join(directory, "asset-audit.json");
await writeFile(`${output}.tmp`, JSON.stringify(report, null, 2) + "\n");
await rename(`${output}.tmp`, output);
console.log(JSON.stringify({ passed: report.passed, ...report.totals, errors: report.errors, output }));
if (!report.passed) process.exitCode = 1;
