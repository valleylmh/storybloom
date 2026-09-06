import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import sharp from "sharp";
import type { Book, Catalog } from "../miniprogram/src/core/types";

// Both offline artifacts share the same complete books and native reading UI.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.join(root, "miniprogram");
const release = process.argv.includes("--release");
const preview = path.join(project, release ? "release" : "preview");
const output = path.join(preview, "dist");
async function main() {
  const config = JSON.parse(await readFile(path.join(project, release ? "config.local.json" : "config.example.json"), "utf8"));
  if (release && !/^wx[0-9a-f]{16}$/.test(config.appid || "")) throw new Error("发布包需要在 config.local.json 填写真实 AppID");
  const require = createRequire(import.meta.url);
  const catalog: Catalog = require(path.join(project, "dist/data/catalog.js")).default;
  const books: Record<string, Book> = require(path.join(project, "dist/reader/data/books.js")).default;
  const manifest: Array<{ source: string; destination: string }> = JSON.parse(await readFile(path.join(project, "assets-manifest.json"), "utf8"));
  await rm(output, { recursive: true, force: true });
  await cp(path.join(project, "dist"), output, { recursive: true });
  // Empty audio fields keep this offline release in text/image mode.
  await mkdir(path.join(output, "assets"), { recursive: true });
  await mkdir(path.join(output, "reader/assets"), { recursive: true });
  const selected = catalog.series.map(series => catalog.books.find(book => book.seriesId === series.id)!);
  const result: Record<string, Book> = {};
  for (let index = 0; index < selected.length; index++) {
    const summary = selected[index];
    const book = books[summary.id];
    const images = manifest.filter(image => image.destination.startsWith(`library/${summary.id}/`));
    if (images.length !== book.pages.length) throw new Error(`预览图片数不匹配: ${summary.id}`);
    for (let page = 0; page < book.pages.length; page++) {
      const name = `${index}-${page}.jpg`;
      let bytes: Buffer | undefined;
      for (const width of [480, 360]) {
        for (const quality of [55, 40, 28]) {
          bytes = await sharp(path.join(root, images[page].source)).resize({ width, height: width, fit: "inside" }).jpeg({ quality }).toBuffer();
          if (bytes.length <= 24000) break;
        }
        if (bytes!.length <= 24000) break;
      }
      if (!bytes || bytes.length > 24000) throw new Error("本地预览插画压缩后仍超过预算");
      await writeFile(path.join(output, "reader/assets", name), bytes);
      book.pages[page].image = `/reader/assets/${name}`;
      book.pages[page].audio = { zh: "", en: "" };
      if (page === 0) {
        await cp(path.join(output, "reader/assets", name), path.join(output, "assets", name));
        summary.cover = `/assets/${name}`;
      }
    }
    result[summary.id] = book;
  }
  await writeFile(path.join(output, "data/catalog.js"), `module.exports = ${JSON.stringify({ ...catalog, books: selected })};\n`);
  await writeFile(path.join(output, "reader/data/books.js"), `module.exports = ${JSON.stringify(result)};\n`);
  const pageConfig = JSON.parse(await readFile(path.join(output, "pages/catalog/index.json"), "utf8"));
  await writeFile(path.join(output, "pages/catalog/index.json"), JSON.stringify({ ...pageConfig, navigationBarTitleText: release ? "绘本馆" : "绘本馆 · UI预览" }));
  const projectConfig = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
  let localProject = {};
  try { localProject = JSON.parse(await readFile(path.join(preview, "project.config.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await writeFile(path.join(preview, "project.config.json"), JSON.stringify({ ...projectConfig, ...localProject, ...(release ? { appid: config.appid } : {}), miniprogramRoot: "dist/", projectname: release ? "StoryBloom 绘本馆" : "StoryBloom 本地UI预览" }, null, 2));
  const sizes = { mainBytes: 0, readerBytes: 0 };
  async function measure(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await measure(file);
      else sizes[path.relative(output, file).startsWith(`reader${path.sep}`) ? "readerBytes" : "mainBytes"] += (await stat(file)).size;
    }
  }
  await measure(output);
  if (Object.values(sizes).some(bytes => bytes > 2 * 1024 * 1024)) throw new Error("离线包超过 2 MiB 分包上限");
  const report = { version: "0.1.0", books: selected.length, pages: Object.values(result).reduce((sum, book) => sum + book.pages.length, 0), ...sizes, remoteMedia: false, narration: false };
  await writeFile(path.join(preview, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`开发者工具导入：${preview}${release ? "\n已生成真实 AppID 的纯图文发布工程，尚未上传。" : "\n该目录仅供 UI 验收，不用于上传发布。"}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "预览生成失败"); process.exitCode = 1; });
