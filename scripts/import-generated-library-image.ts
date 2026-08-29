import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const MAX_IMAGE_SIZE_BYTES = 300 * 1024;

type Options = {
  source: string;
  series: string;
  book: string;
  page: number;
  size: number;
};

function parseArgs(argv: string[]): Options {
  let source = "";
  let series = "";
  let book = "";
  let page = 0;
  let size = 1024;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") source = argv[++index] ?? "";
    else if (arg === "--series") series = argv[++index] ?? "";
    else if (arg === "--book") book = argv[++index] ?? "";
    else if (arg === "--page") page = Number(argv[++index]);
    else if (arg === "--size") size = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (
    !source ||
    !series ||
    !book ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(size) ||
    size < 1
  ) {
    throw new Error(
      "--source, --series, --book, a positive --page and a positive --size are required",
    );
  }

  return { source, series, book, page, size };
}

async function encodeWebp(input: Buffer, size: number) {
  for (const quality of [82, 76, 70, 64, 58, 52, 46, 40, 34, 28]) {
    const output = await sharp(input)
      .resize(size, size, { fit: "cover" })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (output.byteLength <= MAX_IMAGE_SIZE_BYTES) return output;
  }

  throw new Error(`Unable to encode a ${size}×${size} WebP below 300KB`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await fs.readFile(path.resolve(options.source));
  const output = await encodeWebp(input, options.size);
  const outputDir = path.join(
    ROOT,
    "public",
    "library",
    options.series,
    options.book,
  );
  const outputPath = path.join(outputDir, `${options.page}.webp`);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, output);
  console.log(`[library-image] ${outputPath} ${output.byteLength} bytes`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
