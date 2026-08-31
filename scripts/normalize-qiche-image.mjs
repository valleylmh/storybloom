import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  throw new Error("Usage: node normalize-qiche-image.mjs <source> <target>");
}

const MAX_BYTES = 300 * 1024;
const input = await readFile(source);
let output;
for (const quality of [88, 82, 76, 70, 64, 58, 52, 46, 40]) {
  output = await sharp(input)
    .resize(1200, 1200, { fit: "cover", position: "centre" })
    .webp({ quality, effort: 6 })
    .toBuffer();
  if (output.byteLength <= MAX_BYTES) break;
}
if (!output || output.byteLength > MAX_BYTES) {
  throw new Error(`Unable to encode ${target} below 300KB`);
}
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, output);
console.log(`${target}\t${output.byteLength}`);
