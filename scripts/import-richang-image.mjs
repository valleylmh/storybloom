/** Record one built-in illustration after normalizing it into the library. */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const [id, number, source, prompt, mode] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(id ?? "") || !/^\d+$/.test(number ?? "") || !source || !prompt) throw new Error("Invalid import arguments");
if (mode && mode !== "--replace") throw new Error("Invalid import mode");
const file = path.resolve("content-drafts/richang", `${id}.json`);
const draft = JSON.parse(await readFile(file, "utf8"));
const page = draft.book.pages.find((page) => page.page === Number(number));
if (!page || (page.imageStatus === "complete" && mode !== "--replace")) throw new Error("Page missing or already imported");
const target = path.resolve("public/library/richang", id, `${number}.webp`);
if (page.imageStatus === "complete") {
  const previous = await readFile(target);
  const version = createHash("sha256").update(previous).digest("hex").slice(0, 12);
  const archive = path.resolve("content-drafts/richang", id, "iterations", `${number}-${version}.webp`);
  await mkdir(path.dirname(archive), { recursive: true });
  await copyFile(target, archive);
  (page.previousIllustrations ??= []).push({ generatedSource: page.generatedSource, generationPrompt: page.generationPrompt, savedImage: archive });
}
execFileSync(process.execPath, ["scripts/normalize-qiche-image.mjs", source, target], { stdio: "pipe" });
page.imageStatus = "complete";
page.generatedWith = "builtin-imagegen";
page.generationPrompt = prompt;
page.generatedSource = source;
await writeFile(file, JSON.stringify(draft, null, 2) + "\n");
console.log(JSON.stringify({ id, page: Number(number), target }));
