import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type Draft = {
  book: {
    id: string;
    title: string;
    pages: Array<{ page: number; illustrationPrompt: string }>;
  };
  imagePromptKit: {
    globalStyle: string;
    characterConsistency: string;
    negative: string;
  };
};

function parseArgs(argv: string[]) {
  let bookId = "";
  let pages: number[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--book") bookId = argv[++index] ?? "";
    else if (arg === "--pages") {
      pages = (argv[++index] ?? "")
        .split(",")
        .filter(Boolean)
        .map((value) => Number(value));
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  if (
    !bookId ||
    pages.length !== 4 ||
    pages.some((page) => !Number.isInteger(page) || (page !== 0 && (page < 1 || page > 8)))
  ) {
    throw new Error("Use --book <id> --pages <four page numbers or 0 skips>");
  }
  return { bookId, pages };
}

function sceneBrief(prompt: string, page: number) {
  const marker = `Scene for page ${page}:`;
  const afterMarker = prompt.includes(marker)
    ? prompt.slice(prompt.indexOf(marker) + marker.length)
    : prompt;
  return afterMarker
    .replace(/Warm cinematic light[\s\S]*$/i, "")
    .replace(/no text in image[\s\S]*$/i, "")
    .trim();
}

async function main() {
  const { bookId, pages } = parseArgs(process.argv.slice(2));
  const draftPath = path.join(
    process.cwd(),
    "content-drafts",
    "haoqi",
    `${bookId}.json`,
  );
  const draft = JSON.parse(await readFile(draftPath, "utf8")) as Draft;
  const panels = pages.map((page, index) => {
    const slot = ["top-left", "top-right", "bottom-left", "bottom-right"][index];
    if (page === 0) {
      return `${slot}: a spare clean natural scene in the same setting, with no extra people.`;
    }
    const storyPage = draft.book.pages.find((item) => item.page === page);
    if (!storyPage) throw new Error(`Missing page ${page} in ${bookId}`);
    return `${slot} (page ${page}): ${sceneBrief(storyPage.illustrationPrompt, page)}`;
  });

  const prompt = [
    "Use case: illustration-story",
    "Asset type: 2×2 master source sheet for four cropped square pages of a Chinese-English children's science picture book",
    "Input image: if provided, it is only a character, clothing, location, palette, and 3D clay-animation style reference. Preserve the same protagonist identities.",
    `Primary request: Make exactly four independent, equally sized square story scenes for 《${draft.book.title}》 in a strict 2×2 contact-sheet layout with no gutter. No words, numbers, labels, speech bubbles, logos, watermark, frames, or border lines. Each quadrant must be a complete clean square illustration and no element may cross into a neighbor.`,
    `Character consistency: ${draft.imagePromptKit.characterConsistency}`,
    "Panels:",
    ...panels,
    `Style/medium: ${draft.imagePromptKit.globalStyle}`,
    `Avoid: ${draft.imagePromptKit.negative}`,
    "Every panel must contain only its requested scene, with an anatomically correct child-safe cast, exactly the intended main child and caregiver at most once each, and no duplicate people within a panel.",
  ].join("\n");

  console.log(JSON.stringify({ bookId, pages, prompt }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
