import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const MAX_IMAGE_SIZE_BYTES = 300 * 1024;
const OUTPUT_SIZE = 1200;

type Options = {
  source: string;
  bookId: string;
  pages: number[];
  columns: number;
  rows: number;
  replace: boolean;
};

function parseArgs(argv: string[]): Options {
  let source = "";
  let bookId = "";
  let pages: number[] = [];
  let columns = 2;
  let rows = 2;
  let replace = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") source = argv[++index] ?? "";
    else if (arg === "--book") bookId = argv[++index] ?? "";
    else if (arg === "--pages") {
      pages = (argv[++index] ?? "")
        .split(",")
        .filter(Boolean)
        .map((value) => Number(value));
    } else if (arg === "--columns") columns = Number(argv[++index]);
    else if (arg === "--rows") rows = Number(argv[++index]);
    else if (arg === "--replace") replace = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!source || !bookId || pages.length === 0) {
    throw new Error("--source, --book and --pages are required");
  }
  if (
    ![columns, rows].every(Number.isInteger) ||
    columns < 1 ||
    rows < 1 ||
    pages.length !== columns * rows ||
    pages.some((page) => !Number.isInteger(page) || page < 0)
  ) {
    throw new Error(
      "--pages must match the --columns × --rows grid using positive page numbers (or 0 to discard a tile)",
    );
  }

  return { source, bookId, pages, columns, rows, replace };
}

async function encodeWebp(input: Buffer) {
  for (const quality of [86, 82, 76, 70, 64, 58, 52, 46, 40, 34, 28, 22, 18, 14]) {
    const output = await sharp(input)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (output.byteLength <= MAX_IMAGE_SIZE_BYTES) return output;
  }
  throw new Error("Unable to encode a 1200×1200 WebP below 300KB");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const metadata = await sharp(options.source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width % options.columns !== 0 || height % options.rows !== 0) {
    throw new Error(
      `Source ${width}×${height} cannot be divided into ${options.columns}×${options.rows} equal tiles`,
    );
  }

  const tileWidth = width / options.columns;
  const tileHeight = height / options.rows;
  if (tileWidth !== tileHeight) {
    throw new Error(
      `Grid tiles must be square; received ${tileWidth}×${tileHeight}`,
    );
  }

  const outputDir = path.join(ROOT, "public", "library", "haoqi", options.bookId);
  await fs.mkdir(outputDir, { recursive: true });
  const source = await fs.readFile(options.source);

  const imports = await Promise.all(
    options.pages.map(async (page, index) => {
      if (page === 0) return null;
      const tile = await sharp(source)
        .extract({
          left: (index % options.columns) * tileWidth,
          top: Math.floor(index / options.columns) * tileHeight,
          width: tileWidth,
          height: tileHeight,
        })
        .png()
        .toBuffer();
      return { page, output: await encodeWebp(tile) };
    }),
  );

  for (const item of imports) {
    if (!item) continue;
    const { page, output } = item;
    const outputPath = path.join(outputDir, `${page}.webp`);
    if (!options.replace) {
      const existing = await fs.stat(outputPath).catch(() => null);
      if (existing?.isFile()) {
        throw new Error(`${outputPath} already exists; use --replace after review`);
      }
    }
    await fs.writeFile(outputPath, output);
    console.log(`[library-grid] ${options.bookId}/${page}.webp ${output.byteLength} bytes`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
