import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

type GeneratedDraft = {
  book: {
    id: string;
    seriesId: string;
    order: number;
    pages: Array<{ page: number }>;
  };
};

const ROOT = path.resolve(process.cwd());
const TILE_SIZE = 300;
const COLUMNS = 4;

function parseArgs(argv: string[]) {
  let from = 1;
  let to = Number.MAX_SAFE_INTEGER;
  let series = "haoqi";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--from") from = Number(argv[++index]);
    else if (arg === "--to") to = Number(argv[++index]);
    else if (arg === "--series") series = argv[++index]?.trim() || "";
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (![from, to].every(Number.isFinite) || !series) {
    throw new Error("--from, --to and --series must be valid");
  }

  return { from, to, series };
}

async function loadDrafts(series: string, from: number, to: number) {
  const draftDir = path.join(ROOT, "content-drafts", series);
  const fileNames = await fs.readdir(draftDir);
  const drafts: GeneratedDraft[] = [];

  for (const fileName of fileNames.filter((name) => name.endsWith(".json"))) {
    const raw = await fs.readFile(path.join(draftDir, fileName), "utf8");
    const draft = JSON.parse(raw) as Partial<GeneratedDraft>;
    if (!draft.book || draft.book.seriesId !== series) continue;
    if (draft.book.order < from || draft.book.order > to) continue;
    drafts.push(draft as GeneratedDraft);
  }

  return drafts.sort((left, right) => left.book.order - right.book.order);
}

async function createContactSheet(draft: GeneratedDraft) {
  const pages = [...draft.book.pages].sort((left, right) => left.page - right.page);
  if (pages.length === 0 || pages.some((page, index) => page.page !== index + 1)) {
    throw new Error(`${draft.book.id} must have a continuous page sequence starting at 1`);
  }
  const rows = Math.ceil(pages.length / COLUMNS);

  const tiles = await Promise.all(
    pages.map(async (page, index) => {
      const imagePath = path.join(
        ROOT,
        "public",
        "library",
        draft.book.seriesId,
        draft.book.id,
        `${page.page}.webp`,
      );
      const input = await fs.readFile(imagePath);
      const resized = await sharp(input)
        .resize(TILE_SIZE, TILE_SIZE, { fit: "cover" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

      return {
        input: resized,
        left: (index % COLUMNS) * TILE_SIZE,
        top: Math.floor(index / COLUMNS) * TILE_SIZE,
      };
    }),
  );

  const outputDir = path.join(
    ROOT,
    "content-drafts",
    draft.book.seriesId,
    draft.book.id,
  );
  const outputPath = path.join(outputDir, "contact-sheet.jpg");
  await fs.mkdir(outputDir, { recursive: true });
  await sharp({
    create: {
      width: COLUMNS * TILE_SIZE,
      height: rows * TILE_SIZE,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite(tiles)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outputPath);

  console.log(`[contact-sheet] ${draft.book.order}: ${outputPath}`);
}

async function main() {
  const { from, to, series } = parseArgs(process.argv.slice(2));
  const drafts = await loadDrafts(series, from, to);
  await Promise.all(drafts.map(createContactSheet));
  console.log(`[contact-sheet] complete: ${drafts.length} books`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
