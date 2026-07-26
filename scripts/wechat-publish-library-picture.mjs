#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import libraryModule from "../src/lib/library/index.ts";

const {
  getAllSeries,
  getBook,
  getPublishedBooks,
} = libraryModule;

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_ROOT = path.join(
  process.env.TMPDIR || "/tmp",
  "storybloom-wechat",
);
const DEFAULT_BLOG_ENV = path.resolve(ROOT_DIR, "../../blog/.env");
const WIDTH = 1080;
const HEIGHT = 1440;
const TEXT_X = 72;
const TEXT_MAX_WIDTH = WIDTH - TEXT_X * 2;

function printHelp() {
  console.log(`把 StoryBloom 绘本馆的逐页双语分享图发布到微信公众号图片消息草稿。

用法：
  pnpm wechat:library-picture -- <seriesId> <bookId> [选项]
  pnpm wechat:library-picture -- --list

示例：
  pnpm wechat:library-picture -- chengyu dui-niu-tan-qin --dry-run
  pnpm wechat:library-picture -- chengyu dui-niu-tan-qin
  pnpm wechat:library-picture -- xiyouji shi-hou-chu-shi --publish

选项：
  --dry-run               只生成本地预览图，不访问微信接口
  --publish               创建草稿后继续提交发布；默认只进入草稿箱
  --force-upload          忽略永久素材缓存，重新上传全部图片
  --env-file <path>       微信环境变量文件；默认尝试 ../../blog/.env
  --output-dir <path>     预览图目录；默认写入系统临时目录
  --list                  列出可发布的绘本
  --help                  显示帮助

环境变量：
  WECHAT_APPID
  WECHAT_APPSECRET
  WECHAT_TOKEN_FILE            可选，自定义 access token 缓存文件
  WECHAT_PICTURE_CACHE_FILE    可选，自定义永久图片 media_id 缓存文件`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    publish: false,
    forceUpload: false,
    list: false,
    help: false,
    envFile: null,
    outputDir: null,
    positional: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--publish") {
      options.publish = true;
    } else if (arg === "--force-upload") {
      options.forceUpload = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--env-file" || arg === "--output-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} 后面需要路径。`);
      }
      if (arg === "--env-file") {
        options.envFile = path.resolve(value);
      } else {
        options.outputDir = path.resolve(value);
      }
      index += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`未知选项：${arg}`);
    } else {
      options.positional.push(arg);
    }
  }

  return options;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function listBooks() {
  for (const series of getAllSeries()) {
    console.log(`${series.id}  ${series.title}`);
    for (const book of getPublishedBooks(series.id)) {
      console.log(`  ${book.id}  ${book.title}｜${book.subtitle}`);
    }
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isCjk(character) {
  return /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/u.test(character);
}

function estimateTextWidth(text, fontSize) {
  let width = 0;
  for (const character of Array.from(text)) {
    if (isCjk(character)) {
      width += fontSize;
    } else if (/\s/u.test(character)) {
      width += fontSize * 0.3;
    } else if (/[MW@#%&]/u.test(character)) {
      width += fontSize * 0.82;
    } else if (/[A-Z0-9]/u.test(character)) {
      width += fontSize * 0.62;
    } else if (/[ilI.,'`:;!|]/u.test(character)) {
      width += fontSize * 0.28;
    } else {
      width += fontSize * 0.52;
    }
  }
  return width;
}

function wrapCharacters(text, maxWidth, fontSize) {
  const lines = [];
  let current = "";

  for (const character of Array.from(text.trim())) {
    const next = current + character;
    if (current && estimateTextWidth(next, fontSize) > maxWidth) {
      lines.push(current.trimEnd());
      current = character.trimStart();
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }
  return lines;
}

function wrapWords(text, maxWidth, fontSize) {
  const lines = [];
  let current = "";

  for (const word of text.trim().split(/\s+/u).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && estimateTextWidth(next, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function fitText(text, language) {
  const config =
    language === "zh"
      ? { startSize: 40, minSize: 32, maxLines: 3, wrap: wrapCharacters }
      : { startSize: 28, minSize: 22, maxLines: 3, wrap: wrapWords };

  for (let fontSize = config.startSize; fontSize >= config.minSize; fontSize -= 2) {
    const lines = config.wrap(text, TEXT_MAX_WIDTH, fontSize);
    if (lines.length <= config.maxLines) {
      return { fontSize, lines };
    }
  }

  return {
    fontSize: config.minSize,
    lines: config.wrap(text, TEXT_MAX_WIDTH, config.minSize),
  };
}

function renderTextLines(lines, x, startY, fontSize, lineHeight, attributes) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${startY + index * lineHeight}" ${attributes} font-size="${fontSize}">${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function createOverlaySvg(page) {
  const zh = fitText(page.zhText || "", "zh");
  const en = fitText(page.enText || "", "en");
  const zhLineHeight = Math.round(zh.fontSize * 1.35);
  const enLineHeight = Math.round(en.fontSize * 1.43);
  const languageGap = zh.lines.length > 0 && en.lines.length > 0 ? 12 : 0;
  const textBlockHeight =
    zh.lines.length * zhLineHeight +
    languageGap +
    en.lines.length * enLineHeight;
  const textTop = HEIGHT - 62 - textBlockHeight;
  const gradientTop = Math.max(620, textTop - 190);
  const enTop = textTop + zh.lines.length * zhLineHeight + languageGap;

  const zhText = renderTextLines(
    zh.lines,
    TEXT_X,
    textTop,
    zh.fontSize,
    zhLineHeight,
    'fill="#fffaf4" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-weight="700" dominant-baseline="hanging"',
  );
  const enText = renderTextLines(
    en.lines,
    TEXT_X,
    enTop,
    en.fontSize,
    enLineHeight,
    'fill="#fffaf4" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-weight="400" dominant-baseline="hanging"',
  );

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="overlay" x1="0" y1="${gradientTop}" x2="0" y2="${HEIGHT}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#19120e" stop-opacity="0" />
          <stop offset="0.52" stop-color="#19120e" stop-opacity="0.28" />
          <stop offset="1" stop-color="#19120e" stop-opacity="0.88" />
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#overlay)" />
      <text x="${TEXT_X}" y="76" fill="#fffaf4" fill-opacity="0.9" font-family="Arial, PingFang SC, sans-serif" font-size="25" font-weight="700">STORYBLOOM  ·  ${String(page.page).padStart(2, "0")}</text>
      ${zhText}
      ${enText}
    </svg>
  `);
}

function resolvePageImage(page) {
  if (!page.imageUrl || !page.imageUrl.startsWith("/")) {
    throw new Error(`第 ${page.page} 页缺少可用的本地 imageUrl。`);
  }
  return path.join(ROOT_DIR, "public", page.imageUrl.slice(1));
}

async function renderShareImage(page, outputPath) {
  const inputPath = resolvePageImage(page);
  if (!(await pathExists(inputPath))) {
    throw new Error(`找不到第 ${page.page} 页插图：${inputPath}`);
  }

  const buffer = await sharp(inputPath)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .composite([{ input: createOverlaySvg(page), top: 0, left: 0 }])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();

  await writeFile(outputPath, buffer);
  return buffer;
}

export function createBilingualContent(book) {
  return [
    `《${book.title}》`,
    book.subtitle,
    "",
    ...book.pages.flatMap((page) => [
      `第 ${page.page} 页`,
      `中文：${page.zhText || ""}`,
      `English: ${page.enText || ""}`,
      "",
    ]),
  ]
    .join("\n")
    .trim();
}

function createWechatTitle(book) {
  const fullTitle = `${book.title}｜${book.subtitle}`;
  return Array.from(fullTitle).slice(0, 32).join("");
}

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadWechatEnvironment(explicitEnvFile) {
  if (process.env.WECHAT_APPID && process.env.WECHAT_APPSECRET) {
    return null;
  }

  const candidates = [
    explicitEnvFile,
    process.env.WECHAT_ENV_FILE
      ? path.resolve(process.env.WECHAT_ENV_FILE)
      : null,
    DEFAULT_BLOG_ENV,
    path.join(ROOT_DIR, ".env.local"),
    path.join(ROOT_DIR, ".env"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }
    process.loadEnvFile(candidate);
    if (process.env.WECHAT_APPID && process.env.WECHAT_APPSECRET) {
      return candidate;
    }
  }

  throw new Error(
    "未找到 WECHAT_APPID/WECHAT_APPSECRET。请使用 --env-file 指定环境变量文件。",
  );
}

function resolveWechatFiles(loadedEnvFile) {
  const fallbackDirectory = loadedEnvFile
    ? path.join(path.dirname(loadedEnvFile), "wechat")
    : path.join(process.env.TMPDIR || "/tmp", "storybloom-wechat");

  return {
    tokenFile: process.env.WECHAT_TOKEN_FILE
      ? path.resolve(process.env.WECHAT_TOKEN_FILE)
      : path.join(fallbackDirectory, ".wechat_token.json"),
    mediaCacheFile: process.env.WECHAT_PICTURE_CACHE_FILE
      ? path.resolve(process.env.WECHAT_PICTURE_CACHE_FILE)
      : path.join(fallbackDirectory, ".wechat_picture_media.json"),
  };
}

async function getAccessToken(tokenFile) {
  const cached = await loadJson(tokenFile, null);
  if (cached?.token && cached.expires_at > Date.now()) {
    return cached.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credential",
    appid: process.env.WECHAT_APPID,
    secret: process.env.WECHAT_APPSECRET,
  });
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?${params.toString()}`,
  );
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    if (result.errcode === 40164) {
      const ip = result.errmsg?.match(/invalid ip\s+([^\s]+)/i)?.[1];
      throw new Error(
        `微信公众号拒绝获取 Access Token：当前出口 IP${ip ? ` ${ip}` : ""} 不在白名单。请在“公众号后台 → 设置与开发 → 基本配置 → IP 白名单”中添加后重试。`,
      );
    }
    throw new Error(`微信 Access Token 获取失败：${JSON.stringify(result)}`);
  }

  await writeJson(tokenFile, {
    token: result.access_token,
    expires_at: Date.now() + (result.expires_in - 200) * 1000,
  });
  return result.access_token;
}

async function wechatPost(endpoint, token, body) {
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/${endpoint}?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json();
  if (!response.ok || (result.errcode && result.errcode !== 0)) {
    throw new Error(`微信接口 ${endpoint} 调用失败：${JSON.stringify(result)}`);
  }
  return result;
}

async function uploadPermanentImage(token, buffer, fileName) {
  const form = new FormData();
  form.append("media", new Blob([buffer], { type: "image/jpeg" }), fileName);
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_material?type=image&access_token=${encodeURIComponent(token)}`,
    { method: "POST", body: form },
  );
  const result = await response.json();
  if (!response.ok || result.errcode || !result.media_id) {
    throw new Error(`微信永久图片素材上传失败：${JSON.stringify(result)}`);
  }
  return result.media_id;
}

async function uploadRenderedImages({
  token,
  renderedPages,
  mediaCacheFile,
  forceUpload,
}) {
  const cache = await loadJson(mediaCacheFile, { version: 1, images: {} });
  cache.images ||= {};
  const imageList = [];

  for (const item of renderedPages) {
    const hash = createHash("sha256").update(item.buffer).digest("hex");
    const cached = cache.images[hash];
    let mediaId = !forceUpload ? cached?.media_id : null;

    if (mediaId) {
      console.log(`♻️  第 ${item.page} 页复用永久素材缓存`);
    } else {
      console.log(`⬆️  正在上传第 ${item.page} 页永久图片素材…`);
      mediaId = await uploadPermanentImage(token, item.buffer, item.fileName);
      cache.images[hash] = {
        media_id: mediaId,
        file_name: item.fileName,
        updated_at: new Date().toISOString(),
      };
      await writeJson(mediaCacheFile, cache);
    }

    imageList.push({ image_media_id: mediaId });
  }

  return imageList;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.list) {
    listBooks();
    return;
  }

  const [seriesId, bookId] = options.positional;
  if (!seriesId || !bookId || options.positional.length > 2) {
    printHelp();
    throw new Error("请提供 seriesId 和 bookId。可先用 --list 查看。");
  }

  const book = getBook(seriesId, bookId);
  if (!book || book.comingSoon) {
    throw new Error(`找不到已发布绘本：${seriesId}/${bookId}`);
  }
  if (book.pages.length === 0 || book.pages.length > 20) {
    throw new Error(`图片消息要求 1–20 页，当前为 ${book.pages.length} 页。`);
  }

  const outputDir =
    options.outputDir || path.join(DEFAULT_OUTPUT_ROOT, `${seriesId}-${bookId}`);
  await mkdir(outputDir, { recursive: true });

  console.log(`📖 ${book.title}｜${book.subtitle}`);
  console.log(`🖼️  正在生成 ${book.pages.length} 张双语贴图：${outputDir}`);
  const renderedPages = [];
  for (const page of book.pages) {
    const fileName = `page-${String(page.page).padStart(2, "0")}.jpg`;
    const outputPath = path.join(outputDir, fileName);
    const buffer = await renderShareImage(page, outputPath);
    renderedPages.push({ page: page.page, fileName, outputPath, buffer });
    console.log(
      `  ✓ 第 ${page.page} 页 ${Math.round(buffer.byteLength / 1024)} KB`,
    );
  }

  const content = createBilingualContent(book);
  const contentPath = path.join(outputDir, "story-bilingual.txt");
  await writeFile(contentPath, `${content}\n`, "utf8");
  const contentBytes = Buffer.byteLength(content, "utf8");
  console.log(`📝 双语正文：${contentBytes} bytes，已写入 ${contentPath}`);

  const manifest = {
    seriesId,
    bookId,
    title: createWechatTitle(book),
    contentBytes,
    images: renderedPages.map(({ page, outputPath, buffer }) => ({
      page,
      outputPath,
      bytes: buffer.byteLength,
    })),
  };
  await writeJson(path.join(outputDir, "manifest.json"), manifest);

  if (options.dryRun) {
    console.log("✅ dry-run 完成：只生成本地预览，没有访问微信公众号接口。");
    return;
  }

  const loadedEnvFile = await loadWechatEnvironment(options.envFile);
  const { tokenFile, mediaCacheFile } = resolveWechatFiles(loadedEnvFile);
  const token = await getAccessToken(tokenFile);
  const imageList = await uploadRenderedImages({
    token,
    renderedPages,
    mediaCacheFile,
    forceUpload: options.forceUpload,
  });

  console.log("🗂️  正在创建微信公众号图片消息草稿…");
  const draft = await wechatPost("draft/add", token, {
    articles: [
      {
        article_type: "newspic",
        title: createWechatTitle(book),
        content,
        need_open_comment: 1,
        only_fans_can_comment: 0,
        image_info: { image_list: imageList },
      },
    ],
  });

  console.log(`✅ 图片消息草稿创建成功：${draft.media_id}`);
  if (!options.publish) {
    console.log("请前往公众号后台草稿箱检查版式；本次没有直接发表。");
    return;
  }

  console.log("🚀 正在提交发布任务…");
  const published = await wechatPost("freepublish/submit", token, {
    media_id: draft.media_id,
  });
  console.log(
    `✅ 发布任务已提交：${published.publish_id || published.msg_data_id || "微信未返回任务 ID"}`,
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
