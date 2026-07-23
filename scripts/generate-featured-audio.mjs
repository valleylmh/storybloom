#!/usr/bin/env node

import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import edgeTtsServer from "../src/lib/edge-tts-server.ts";

const { synthesizeEdgeTtsAudio } = edgeTtsServer;

const MODEL = "edge-tts";
const VOICE = process.env.EDGE_TTS_VOICE_ZH || "zh-CN-XiaoxiaoNeural";
const FORMAT = "mp3";
const SAMPLE_RATE = 24000;

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATHS = {
  sample: path.join(ROOT_DIR, "src/lib/sample-books.ts"),
};

const BOOKS = [
  {
    id: "brave-cloud",
    textKey: "brave-cloud",
    output: "public/sample-books/audio/brave-cloud/zh.mp3",
  },
  {
    id: "moon-lamp",
    textKey: "moon-lamp",
    output: "public/sample-books/audio/moon-lamp/zh.mp3",
  },
  {
    id: "garden-mail",
    textKey: "garden-mail",
    output: "public/sample-books/audio/garden-mail/zh.mp3",
  },
];

function printHelp() {
  console.log(`Generate narration audio for StoryBloom featured books.

Usage:
  npm run audio:generate-featured
  npm run audio:generate-featured -- --force
  npm run audio:generate-featured -- --dry-run

Options:
  --force    Regenerate audio files that already exist.
  --dry-run  Parse and report every book without calling Edge TTS or writing files.
  --help     Show this help message.

Environment:
  EDGE_TTS_VOICE_ZH  Optional Chinese voice; defaults to zh-CN-XiaoxiaoNeural.`);
}

function parseArgs(args) {
  const supported = new Set(["--force", "--dry-run", "--help"]);
  const unknown = args.filter((arg) => !supported.has(arg));

  if (unknown.length > 0) {
    throw new Error(`Unknown option: ${unknown.join(", ")}`);
  }

  return {
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    help: args.includes("--help"),
  };
}

function extractBalanced(source, startIndex, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error(`Could not find closing ${close} for source block.`);
}

function extractAssignedLiteral(source, constName, open, close) {
  const declarationIndex = source.indexOf(`const ${constName}`);
  if (declarationIndex === -1) {
    throw new Error(`Could not find ${constName} in source.`);
  }

  const assignmentIndex = source.indexOf("=", declarationIndex);
  const literalIndex = source.indexOf(open, assignmentIndex);
  if (assignmentIndex === -1 || literalIndex === -1) {
    throw new Error(`Could not find the ${constName} literal.`);
  }

  return extractBalanced(source, literalIndex, open, close);
}

function parseJsonString(rawString) {
  try {
    return JSON.parse(rawString);
  } catch (error) {
    throw new Error(`Could not parse source string ${rawString}: ${error.message}`);
  }
}

function extractSampleText(source, bookId) {
  const bookTextObject = extractAssignedLiteral(source, "BOOK_TEXT", "{", "}");
  const keyIndex = bookTextObject.indexOf(JSON.stringify(bookId));
  if (keyIndex === -1) {
    throw new Error(`Could not find BOOK_TEXT entry for ${bookId}.`);
  }

  const arrayIndex = bookTextObject.indexOf("[", keyIndex);
  const pagesLiteral = extractBalanced(bookTextObject, arrayIndex, "[", "]");
  const pages = [];
  const zhTextPattern = /\bzh\s*:\s*("(?:\\.|[^"\\])*")/g;

  for (const match of pagesLiteral.matchAll(zhTextPattern)) {
    pages.push(parseJsonString(match[1]));
  }

  if (pages.length === 0) {
    throw new Error(`No Chinese pages were parsed for ${bookId}.`);
  }

  return pages;
}

function narrationText(pages) {
  return pages.map((page) => page.trim()).filter(Boolean).join("\n\n");
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeAtomically(filePath, bytes) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;

  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const sampleSource = await readFile(SOURCE_PATHS.sample, "utf8");

  const jobs = BOOKS.map((book) => {
    const pages = extractSampleText(sampleSource, book.textKey);

    return {
      ...book,
      pages: pages.length,
      text: narrationText(pages),
      outputPath: path.join(ROOT_DIR, book.output),
    };
  });

  console.log(`Narration preset: ${MODEL} / ${VOICE} / ${FORMAT} ${SAMPLE_RATE}Hz`);

  if (options.dryRun) {
    for (const job of jobs) {
      console.log(
        `[dry-run] ${job.id}: ${job.pages} pages, ${job.text.length} characters -> ${job.output}`,
      );
    }
    return;
  }

  const pendingJobs = [];
  for (const job of jobs) {
    if (!options.force && (await fileExists(job.outputPath))) {
      console.log(`[skip] ${job.id}: ${job.output} already exists.`);
    } else {
      pendingJobs.push(job);
    }
  }

  if (pendingJobs.length === 0) {
    console.log("All featured narration files already exist.");
    return;
  }

  for (const job of pendingJobs) {
    console.log(
      `[generate] ${job.id}: ${job.pages} pages, ${job.text.length} characters...`,
    );
    const { bytes: audio } = await synthesizeEdgeTtsAudio({
      text: job.text,
      voice: VOICE,
    });
    if (audio.length === 0) {
      throw new Error(`Edge TTS returned an empty audio file for ${job.id}.`);
    }
    await writeAtomically(job.outputPath, audio);
    console.log(`[done] ${job.id}: ${job.output} (${audio.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
