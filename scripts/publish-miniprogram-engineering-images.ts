/** Publish only the curated engineering library illustrations, never user images. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { getSupabaseAdmin } from "../src/lib/email/supabase-admin";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
async function main() {
  const images: Array<{ source: string; destination: string }> = JSON.parse(await readFile("miniprogram/assets-manifest.json", "utf8"));
  const books = require(path.resolve("miniprogram/dist/reader/data/books.js")).default;
  const ids = Object.keys(books).filter(id => id.startsWith("qiche/") && books[id].pages.length >= 16);
  const selected = images.filter(image => ids.some(id => image.destination.startsWith(`library/${id}/`)));
  const manifestFile = "miniprogram/public-image-manifest.json";
  const manifest: Record<string, string> = {};
  const bucket = "library-images-public";
  if (!process.argv.includes("--upload")) { console.log(JSON.stringify({ books: ids.length, images: selected.length, bucket, uploaded: false })); return; }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.getBucket(bucket);
  if (error) {
    if (!/not found/i.test(error.message)) throw new Error("Cannot inspect image bucket");
    const result = await admin.storage.createBucket(bucket, { public: true, allowedMimeTypes: ["image/webp"], fileSizeLimit: 10485760 });
    if (result.error) throw new Error("Cannot create image bucket");
  } else if (!data.public) throw new Error("Refusing to change private bucket permissions");
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < selected.length) {
      const image = selected[cursor++];
      if (!image.source.startsWith("public/library/qiche/") || image.source.includes("..") || !image.source.endsWith(".webp")) throw new Error("Unexpected image source");
      const bytes = await readFile(image.source);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const object = `v1/${hash}.webp`;
      const result = await admin.storage.from(bucket).upload(object, bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (result.error && !/already exists|duplicate/i.test(result.error.message)) throw new Error("Image upload failed");
      const url = admin.storage.from(bucket).getPublicUrl(object).data.publicUrl;
      const check = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
      if (!check.ok || !check.headers.get("content-type")?.startsWith("image/") || Number(check.headers.get("content-length")) !== bytes.length) throw new Error("Public image verification failed");
      manifest[image.destination] = url;
    }
  }));
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ books: ids.length, images: Object.keys(manifest).length, uploaded: true, verified: true }));
}
main().catch(() => { console.error("Image publication failed; credentials omitted. Safe to retry immutable assets."); process.exitCode = 1; });
