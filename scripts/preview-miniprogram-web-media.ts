import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeMediaBase, publicMediaPath } from "./lib/miniprogram-content";
import type { Book, Catalog } from "../miniprogram/src/core/types";

// Independent test artifact: the uploaded offline release is not modified.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.join(root, "miniprogram");
const withApi = process.argv.includes("--api-audio");
const withAudio = process.argv.includes("--audio");
const allBooks = process.argv.includes("--all");
const output = path.join(project, allBooks ? "full-library" : withApi ? "api-audio-preview" : withAudio ? "audio-preview" : "web-media-preview");
async function main() {
  if (allBooks && (!withApi || withAudio)) throw new Error("全量书目目前使用 --api-audio 在线朗读模式");
  const base = normalizeMediaBase(process.argv.slice(2).find(arg => !arg.startsWith("--")) || "https://storybloom.valleylmh.vip");
  const require = createRequire(import.meta.url);
  const catalog: Catalog = allBooks ? require(path.join(project, "dist/data/catalog.js")).default : require(path.join(project, "release/dist/data/catalog.js"));
  const books: Record<string, Book> = allBooks ? require(path.join(project, "dist/reader/data/books.js")).default : require(path.join(project, "release/dist/reader/data/books.js"));
  const manifest: Array<{ source: string; destination: string }> = JSON.parse(await readFile(path.join(project, "assets-manifest.json"), "utf8"));
  const urls: string[] = [];
  for (const summary of catalog.books) {
    const book = books[summary.id];
    if (withApi) book.narrationEndpoint = `${base}/api/audio`;
    const images = manifest.filter(image => image.destination.startsWith(`library/${summary.id}/`));
    if (images.length !== book.pages.length) throw new Error(`图片页数不一致: ${summary.id}`);
    book.pages.forEach((page, index) => {
      page.image = `${base}/${publicMediaPath(images[index].destination)}`;
      page.audio = { zh: "", en: "" };
      urls.push(page.image);
    });
    summary.cover = book.pages[0].image;
  }
  await mkdir(output, { recursive: true });
  await rm(path.join(output, "dist"), { recursive: true, force: true });
  await cp(path.join(project, "dist"), path.join(output, "dist"), { recursive: true });
  await rm(path.join(output, "dist/assets"), { recursive: true, force: true });
  await rm(path.join(output, "dist/reader/assets"), { recursive: true, force: true });
  let segments = 0;
  if (withAudio) {
    const audioCache = path.join(project, "audio-cache");
    const audio: Record<string, Array<{ zh: string; en: string }>> = JSON.parse(await readFile(path.join(audioCache, "manifest.json"), "utf8"));
    const appFile = path.join(output, "dist/app.json");
    const app = JSON.parse(await readFile(appFile, "utf8"));
    app.subPackages = [];
    for (const [index, summary] of catalog.books.entries()) {
      const book = books[summary.id];
      const tracks = audio[summary.id];
      if (tracks?.length !== book.pages.length) throw new Error(`音频页数不匹配: ${summary.id}`);
      const packageRoot = `reader-${index}`;
      const packageDirectory = path.join(output, "dist", packageRoot);
      await cp(path.join(project, "dist/reader"), packageDirectory, { recursive: true });
      await mkdir(path.join(packageDirectory, "audio"), { recursive: true });
      for (const [pageIndex, page] of book.pages.entries()) {
        for (const language of ["zh", "en"] as const) {
          const filename = tracks[pageIndex][language];
          if (!/^[a-f0-9]{24}\.mp3$/.test(filename || "")) throw new Error("无效的本地音频缓存文件名");
          const target = `${pageIndex}-${language}.mp3`;
          await cp(path.join(audioCache, filename), path.join(packageDirectory, "audio", target));
          page.audio[language] = `/${packageRoot}/audio/${target}`;
          segments++;
        }
      }
      summary.readerPath = `/${packageRoot}/index`;
      await writeFile(path.join(packageDirectory, "data/books.js"), `module.exports = ${JSON.stringify({ [book.id]: book })};\n`);
      app.subPackages.push({ root: packageRoot, pages: ["index"] });
    }
    await writeFile(appFile, JSON.stringify(app));
    await rm(path.join(output, "dist/reader"), { recursive: true, force: true });
  }
  await writeFile(path.join(output, "dist/data/catalog.js"), `module.exports = ${JSON.stringify(catalog)};\n`);
  if (!withAudio) await writeFile(path.join(output, "dist/reader/data/books.js"), `module.exports = ${JSON.stringify(books)};\n`);
  const config = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
  const local = JSON.parse(await readFile(path.join(project, "config.local.json"), "utf8"));
  if (!/^wx[0-9a-f]{16}$/.test(local.appid || "")) throw new Error("请配置真实 AppID");
  config.appid = local.appid;
  const title = allBooks ? "绘本馆" : withApi ? "绘本馆 · 在线朗读测试" : withAudio ? "绘本馆 · 朗读测试" : "绘本馆 · 网站图片测试";
  await writeFile(path.join(output, "project.config.json"), JSON.stringify({ ...config, projectname: title, setting: { ...config.setting, urlCheck: true } }, null, 2));
  const page = path.join(output, "dist/pages/catalog/index.json");
  await writeFile(page, JSON.stringify({ ...JSON.parse(await readFile(page, "utf8")), navigationBarTitleText: title }));
  await writeFile(path.join(output, "media-urls.json"), JSON.stringify(urls, null, 2));
  const sizes: Record<string, number> = {};
  async function measure(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await measure(file);
      else {
        const relative = path.relative(path.join(output, "dist"), file);
        const packageName = /^reader(?:-\d+)?\//.test(relative) ? relative.split("/")[0] : "main";
        sizes[packageName] = (sizes[packageName] || 0) + (await stat(file)).size;
      }
    }
  }
  await measure(path.join(output, "dist"));
  if (Object.values(sizes).some(size => size > 2 * 1024 * 1024)) throw new Error("分包超过 2 MiB");
  const report = { project: output, base, books: catalog.books.length, series: catalog.series.length, images: urls.length, localImages: 0, urlCheck: true, audioMode: withApi ? "api" : withAudio ? "packaged" : "none", segments, sizes };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "网站图片测试包生成失败"); process.exitCode = 1; });
