import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const [id, pageArg, source] = process.argv.slice(2);
const page = Number(pageArg);
const plan = JSON.parse(await fs.readFile('content-drafts/haoqi/batch-31-48/plan.json', 'utf8'));
const book = plan.find(row => row[0] === id);
if (!book || !Number.isInteger(page) || page < 1 || page > book[2]) throw new Error('Invalid book/page');
if (!source?.startsWith('/Users/valleylmh/.codex/generated_images/')) throw new Error('Expected built-in generated image');
const target = `public/library/haoqi/${id}/${page}.webp`;
const backup = `.storybloom-cache/haoqi-before-builtin/${id}/${page}.webp`;
await fs.mkdir(path.dirname(backup), { recursive: true });
try { await fs.copyFile(target, backup, 1); } catch (e) { if (e.code !== 'EEXIST') throw e; }
let output;
for (const quality of [86, 80, 74, 68, 60, 50, 40]) {
  output = await sharp(source).resize(1200, 1200, { fit: 'cover' }).webp({ quality }).toBuffer();
  if (output.length <= 300 * 1024) break;
}
if (output.length > 300 * 1024) throw new Error('Image too large');
await fs.writeFile(`${target}.pending`, output);
await fs.rename(`${target}.pending`, target);
const dir = `content-drafts/haoqi/batch-31-48/builtin-provenance/${id}`;
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(`${dir}/${page}.json`, JSON.stringify({ provider: 'built-in image_gen', source, target, page, sha256: crypto.createHash('sha256').update(output).digest('hex'), importedAt: new Date().toISOString() }, null, 2) + '\n');
console.log(JSON.stringify({ id, page, bytes: output.length }));
