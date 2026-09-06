import { access, mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { getAllSeries, getSeriesBooks } from "../src/lib/library";
import { exportMiniContent, type AudioManifest } from "./lib/miniprogram-content";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.join(root, "miniprogram");
const source = path.join(project, "src");
const output = path.join(project, "dist");
async function json(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}
async function dataModule(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `// Generated public reading data. Run npm run mini:prepare to refresh.\nconst data: unknown = ${JSON.stringify(value)};\nexport default data;\n`);
}
async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
async function prepare() {
  let config: { appid?: string; mediaBaseUrl?: string; audioManifest?: string } = {};
  try { config = JSON.parse(await readFile(path.join(project, "config.local.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  for (const key of Object.keys(config)) {
    if (!["appid", "mediaBaseUrl", "audioManifest"].includes(key)) throw new Error(`不支持的配置字段: ${key}。此文件不接受密钥。`);
  }
  for (const value of Object.values(config)) if (typeof value !== "string") throw new Error("本地配置值必须是字符串");
  if (config.appid && config.appid !== "touristappid" && !/^wx[0-9a-f]{16}$/.test(config.appid)) throw new Error("AppID 格式不正确");
  const audio: AudioManifest = config.audioManifest
    ? JSON.parse(await readFile(path.resolve(project, config.audioManifest), "utf8")) : {};
  const exported = exportMiniContent(getAllSeries(), getSeriesBooks, config.mediaBaseUrl || "", audio);
  for (const image of exported.images) await access(path.join(root, image.source));
  await rm(path.join(source, "data"), { recursive: true, force: true });
  await rm(path.join(source, "reader/data"), { recursive: true, force: true });
  await dataModule(path.join(source, "data/catalog.ts"), exported.catalog);
  await dataModule(path.join(source, "reader/data/books.ts"), exported.books);
  await json(path.join(project, "assets-manifest.json"), exported.images);
  await rm(output, { recursive: true, force: true });
  const compiler = path.join(project, "node_modules/typescript/bin/tsc");
  await access(compiler);
  execFileSync(process.execPath, [compiler, "--project", path.join(project, "tsconfig.json")], { cwd: root, stdio: "inherit" });
  for (const file of await walk(source)) {
    if (!/\.(wxml|wxss|json)$/.test(file)) continue;
    const target = path.join(output, path.relative(source, file));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file, target);
  }
  let mainBytes = 0, readerBytes = 0;
  for (const file of await walk(output)) {
    if (!/\.(js|json|wxml|wxss)$/.test(file)) throw new Error("上传包出现非运行时文件");
    const bytes = (await stat(file)).size;
    if (path.relative(output, file).startsWith(`reader${path.sep}`)) readerBytes += bytes;
    else mainBytes += bytes;
  }
  // Conservative uncompressed gate, before DevTools performs its own package verification.
  if (mainBytes > 2 * 1024 * 1024 || readerBytes > 2 * 1024 * 1024) throw new Error("主包或阅读分包超过 2 MiB，请拆分内容后重试");
  const baseProject = JSON.parse(await readFile(path.join(project, "project.config.json"), "utf8"));
  if (config.appid) await json(path.join(project, "project.private.config.json"), {
    ...baseProject, appid: config.appid,
  });
  const report = {
    books: exported.catalog.books.length, series: exported.catalog.series.length,
    pages: Object.values(exported.books).reduce((sum, book) => sum + book.pages.length, 0),
    images: exported.images.length, audioSegments: exported.audioSegments,
    mediaConfigured: Boolean(config.mediaBaseUrl), mainBytes, readerBytes,
  };
  await json(path.join(project, "export-report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.mediaConfigured) console.log("尚未配置 OSS 域名：可检查文字和页面，图片暂显示重试提示。");
  if (!report.audioSegments) console.log("尚未接入预生成音频清单；当前纯图文版不提供朗读入口。");
}
prepare().catch(error => { console.error(error instanceof Error ? error.message : "小程序准备失败"); process.exitCode = 1; });
