import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  generateIllustration,
  getProviderForPage,
} from "../src/lib/image-generator";

type GeneratedDraft = {
  book: {
    id: string;
    seriesId: string;
    order: number;
    pages: Array<{
      page: number;
      illustrationPrompt: string;
    }>;
  };
  imagePromptKit: {
    globalStyle: string;
    characterConsistency: string;
    negative: string;
  };
};

const ROOT = path.resolve(process.cwd());
const MAX_IMAGE_SIZE_BYTES = 300 * 1024;

function parseArgs(argv: string[]) {
  let from = 1;
  let to = Number.MAX_SAFE_INTEGER;
  let concurrency = 4;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--from") from = Number(argv[++index]);
    else if (arg === "--to") to = Number(argv[++index]);
    else if (arg === "--concurrency") concurrency = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (![from, to, concurrency].every(Number.isFinite) || concurrency < 1) {
    throw new Error("--from, --to and --concurrency must be valid numbers");
  }

  return { from, to, concurrency: Math.floor(concurrency) };
}

async function loadDrafts(from: number, to: number) {
  const draftDir = path.join(ROOT, "content-drafts", "haoqi");
  const fileNames = await fs.readdir(draftDir);
  const drafts: GeneratedDraft[] = [];

  for (const fileName of fileNames.filter((name) => name.endsWith(".json"))) {
    const raw = await fs.readFile(path.join(draftDir, fileName), "utf8");
    const draft = JSON.parse(raw) as Partial<GeneratedDraft>;
    if (!draft.book || !draft.imagePromptKit) continue;
    if (draft.book.seriesId !== "haoqi") continue;
    if (draft.book.order < from || draft.book.order > to) continue;
    drafts.push(draft as GeneratedDraft);
  }

  return drafts.sort((left, right) => left.book.order - right.book.order);
}

function buildPrompt(draft: GeneratedDraft, pageIndex: number) {
  const page = draft.book.pages[pageIndex];
  return [
    draft.imagePromptKit.globalStyle,
    draft.imagePromptKit.characterConsistency,
    page.illustrationPrompt,
    `Avoid: ${draft.imagePromptKit.negative}`,
  ].join(" ");
}

async function imageUrlToBuffer(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const commaIndex = imageUrl.indexOf(",");
    if (commaIndex < 0) throw new Error("Invalid image data URL");
    const meta = imageUrl.slice(0, commaIndex);
    const body = imageUrl.slice(commaIndex + 1);
    return meta.includes(";base64")
      ? Buffer.from(body, "base64")
      : Buffer.from(decodeURIComponent(body));
  }

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function encodeWebp(input: Buffer) {
  for (const quality of [82, 76, 70, 64, 58, 52, 46, 40]) {
    const output = await sharp(input)
      .resize(1200, 1200, { fit: "cover" })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (output.byteLength <= MAX_IMAGE_SIZE_BYTES) return output;
  }

  throw new Error("Unable to encode a 1200x1200 WebP below 300KB");
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<void>,
) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

async function main() {
  const { from, to, concurrency } = parseArgs(process.argv.slice(2));
  const drafts = await loadDrafts(from, to);
  const jobs = drafts.flatMap((draft) =>
    draft.book.pages.map((page, pageIndex) => ({ draft, page, pageIndex })),
  );

  console.log(
    `[library-images] ${drafts.length} books, ${jobs.length} pages, concurrency=${concurrency}`,
  );

  let completed = 0;
  const failures: string[] = [];

  await mapWithConcurrency(jobs, concurrency, async ({ draft, page, pageIndex }) => {
    const outputDir = path.join(
      ROOT,
      "public",
      "library",
      draft.book.seriesId,
      draft.book.id,
    );
    const outputPath = path.join(outputDir, `${page.page}.webp`);
    await fs.mkdir(outputDir, { recursive: true });

    try {
      const existing = await fs.stat(outputPath).catch(() => null);
      if (existing?.isFile() && existing.size > 0) {
        completed += 1;
        console.log(
          `[library-images] skip ${draft.book.order}/${page.page} (${completed}/${jobs.length})`,
        );
        return;
      }

      const generated = await generateIllustration(
        buildPrompt(draft, pageIndex),
        11_000_000 + draft.book.order * 1_000 + page.page,
        {
          pageNumber: page.page,
          style: "fairytale",
          preferredProvider: getProviderForPage(
            page.page,
            draft.book.pages.length,
          ),
          storyId: `${draft.book.seriesId}/${draft.book.id}`,
        },
      );
      const input = await imageUrlToBuffer(generated.imageUrl);
      const output = await encodeWebp(input);
      await fs.writeFile(outputPath, output);
      completed += 1;
      console.log(
        `[library-images] done ${draft.book.order}/${page.page} provider=${generated.provider ?? "unknown"} bytes=${output.byteLength} (${completed}/${jobs.length})`,
      );
    } catch (error) {
      const key = `${draft.book.order}/${page.page}`;
      failures.push(key);
      console.error(
        `[library-images] failed ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  if (failures.length > 0) {
    throw new Error(`Failed pages: ${failures.join(", ")}`);
  }

  console.log(`[library-images] complete: ${completed}/${jobs.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
