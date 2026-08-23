/**
 * Library book draft generator (see scripts/README.md and the public roadmap).
 *
 * Usage:
 *   pnpm library:generate <seriesId> <bookId> "<brief>" [--order N] [--dry-run]
 *
 * Example:
 *   pnpm library:generate chengyu shou-zhu-dai-tu \
 *     "守株待兔：宋人耕田，一日兔走触株折颈而死，因释耒守株，冀复得兔，兔不可复得，田荒。出自《韩非子·五蠹》。" \
 *     --order 1
 *
 * Output: content-drafts/<seriesId>/<bookId>.json — a DRAFT for human review.
 * See scripts/README.md for the full review/publish workflow.
 *
 * Note: this intentionally does NOT reuse generateStoryText(). That path
 * silently falls back to a template story on API failure/drift, which is
 * unacceptable for content production (a template would masquerade as a
 * real draft). Drafts must fail loudly instead.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { z } from "zod";
import type { LibraryBook } from "../src/types/library";

// Package scripts run from the project root. Using cwd also keeps this file
// compatible with tsx's CommonJS transform in a package without `type: module`.
const ROOT = path.resolve(process.cwd());
const LIBRARY_FAIRYTALE_STYLE =
  "premium dreamy 3D cartoon fairytale illustration, whimsical lighting, magical atmosphere, rounded clay-like character materials, elegant storybook scene, consistent camera, lighting, material, and color palette across the whole series";
const DEFAULT_STORY_TEXT_MODEL = "gemini-3-flash";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function positiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function requestCpaStory(
  system: string,
  user: string,
  sampling: { temperature: number; topP: number },
) {
  const apiKey = process.env.CPA_API_KEY?.trim();
  const configuredBaseUrl = process.env.CPA_BASE_URL?.trim();
  if (!apiKey || !configuredBaseUrl) return null;

  const endpoint = `${configuredBaseUrl.replace(/\/+$/, "")}/chat/completions`;
  const model = process.env.STORY_TEXT_MODEL?.trim() || DEFAULT_STORY_TEXT_MODEL;
  const timeoutMs = positiveIntegerEnv(
    "STORY_TEXT_TIMEOUT_MS",
    positiveIntegerEnv("CPA_TEXT_TIMEOUT_MS", 120_000),
  );
  const maxTokens = positiveIntegerEnv("STORY_TEXT_MAX_TOKENS", 8192);
  const maxAttempts = positiveIntegerEnv("STORY_TEXT_MAX_ATTEMPTS", 2);
  let lastError: unknown = new Error("Text provider request failed");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "StoryBloom Library Draft Generator",
        },
        body: JSON.stringify({
          model,
          temperature: sampling.temperature,
          top_p: sampling.topP,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
      if (!response.ok) {
        throw new Error(
          data.error?.message || `Text provider returned HTTP ${response.status}`,
        );
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Text provider returned no content");
      return content;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

const bilingualSchema = z.object({
  zh: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const poemSchema = z.object({
  dynasty: z.string().trim().min(1),
  author: z.string().trim().min(1),
  originalLines: z.array(z.string().trim().min(1)).length(4),
  englishLines: z.array(z.string().trim().min(1)).length(4),
  appreciation: bilingualSchema,
});

const draftPageSchema = z.object({
  page: z.number().int().min(1).max(8),
  zhText: z.string().trim().min(1),
  enText: z.string().trim().min(1),
  illustrationPrompt: z.string().trim().min(1),
});

const modelOutputSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1),
  // chengyu/xiyouji 产出 origin；haoqi 产出 question；tangshi 产出 poem
  origin: z.string().trim().min(1).optional(),
  question: z.string().trim().min(1).optional(),
  idiomMeaning: bilingualSchema.optional(),
  poem: poemSchema.optional(),
  moral: bilingualSchema.optional(),
  imagePromptKit: z.object({
    globalStyle: z.string().trim().min(1),
    characterConsistency: z.string().trim().min(1),
    negative: z.string().trim().min(1),
  }),
  pages: z
    .array(draftPageSchema)
    .length(8)
    .refine(
      (pages) => pages.every((page, index) => page.page === index + 1),
      "pages must be numbered 1..8 in order",
    ),
});

// Mirrors LibraryBook (src/types/library.ts). Keep in sync.
const libraryBookSchema = z.object({
  id: z.string().trim().min(1),
  seriesId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1),
  origin: z.string().trim().min(1).optional(),
  question: z.string().trim().min(1).optional(),
  moral: bilingualSchema.optional(),
  idiomMeaning: bilingualSchema.optional(),
  poem: poemSchema.optional(),
  pages: z.array(draftPageSchema).length(8),
  ageLabel: z.string().trim().min(1),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order: z.number().int().min(0),
  episodeNumber: z.number().int().min(1).optional(),
  comingSoon: z.boolean().optional(),
});

type SeriesTemplate = {
  system: string;
  buildUser: (brief: string) => string;
};

const CHENGYU_SYSTEM = `You are an expert bilingual (Chinese/English) children's picture-book author and cultural editor.
Adapt a CLASSIC Chinese idiom (成语) story into a warm 8-page picture book for ages 4-8.

Rules:
- Stay faithful to the classic tale: keep its original characters, era, and setting (e.g. the farmer of Song). Do NOT recast it with a modern child protagonist.
- Follow this exact 8-page beat map:
  1-2. Introduce the protagonist and their everyday world.
  3-6. The classic plot unfolds, one clear visible event per page.
  7. The turning point: the idiom itself appears naturally in the text (成语原文出现并点题).
  8. A gentle moral and an uplifting, forward-looking ending.
- Soften harsh endings for young children: no death, starvation, violence, or despair. The protagonist may fail, realize the lesson, and end hopeful (守株待兔式结局：一无所获后醒悟，重新努力).
- Chinese text: at most 40 characters per page, rhythmic and pleasant to read aloud.
- English text: a natural free translation for ages 4-8, not word-for-word.
- Every illustrationPrompt must describe one concrete storybook scene in English: setting, props, visible action, emotion, camera distance, composition, and end with "no text in image". Keep the same protagonist appearance across all 8 prompts.
- imagePromptKit.globalStyle: one reusable style sentence for the whole series, based on: ${LIBRARY_FAIRYTALE_STYLE}
- imagePromptKit.characterConsistency: one sentence locking the protagonist's appearance (clothing colors, hair, build, era) across all pages.
- imagePromptKit.negative: one sentence of things to avoid (text, watermarks, scary imagery, distorted anatomy, modern objects).

Return only valid JSON:
{
  "title": "the idiom itself, e.g. 守株待兔",
  "subtitle": "a short playful Chinese tagline for children",
  "origin": "source classic, e.g. 《韩非子·五蠹》",
  "idiomMeaning": { "zh": "成语释义", "en": "natural English explanation of the idiom" },
  "moral": { "zh": "一句给孩子的道理", "en": "one-line takeaway" },
  "imagePromptKit": { "globalStyle": "...", "characterConsistency": "...", "negative": "..." },
  "pages": [ { "page": 1, "zhText": "...", "enText": "...", "illustrationPrompt": "..." } ]
}`;

const XIYOUJI_SYSTEM = `You are an expert bilingual (Chinese/English) children's picture-book author adapting 《西游记》 (Journey to the West) for ages 4-8.
Create one 8-page serialized episode based on the given chapter material.

Rules:
- Keep the classic characters, era, and mythical setting. The protagonist is Sun Wukong (and companions where the material includes them).
- Character appearances MUST follow the series character card (docs/library-prompts/xiyouji/characters.md); repeat each character's locked appearance description inside every illustrationPrompt where they appear.
- Child-safe adaptation is mandatory: fights become contests/wit-games/chases; monsters and generals look playful, never scary; no death, injury, weapons pointed at anyone, or punishment pain.
- Follow this 8-page beat map: 1-2 set the episode's scene and goal, 3-6 the adventure unfolds one clear event per page, 7 the episode's climax resolves warmly, 8 a gentle close that teases the next episode.
- Chinese text: at most 40 characters per page, rhythmic for reading aloud.
- English text: natural free translation for ages 4-8.
- Every illustrationPrompt: one concrete scene in English (setting, props, action, emotion, camera distance, composition), ending with "no text in image".
- imagePromptKit.globalStyle: one reusable sentence based on: ${LIBRARY_FAIRYTALE_STYLE}
- imagePromptKit.characterConsistency: lock every recurring character's appearance across pages and across episodes.
- imagePromptKit.negative: things to avoid (text, watermarks, scary imagery, weapons aimed at characters, modern objects).

Return only valid JSON:
{
  "title": "episode title, e.g. 石猴出世",
  "subtitle": "a short playful Chinese tagline",
  "origin": "e.g. 《西游记》第一回（低龄改编）",
  "moral": { "zh": "一句给孩子的道理", "en": "one-line takeaway" },
  "imagePromptKit": { "globalStyle": "...", "characterConsistency": "...", "negative": "..." },
  "pages": [ { "page": 1, "zhText": "...", "enText": "...", "illustrationPrompt": "..." } ]
}`;

const HAOQI_SYSTEM = `You are a children's science writer and bilingual (Chinese/English) picture-book author.
Turn one everyday "why" question from a child into a warm 8-page science story for ages 4-8. Series name: 好奇为什么.

Rules:
- Scientific accuracy is non-negotiable: simplify but NEVER be wrong. No pseudo-science, no fairy-tale causes presented as fact. Personification is allowed as an explanatory device only (e.g. "蓝光个子小、爱蹦跳" for scattering), and the underlying mechanism must stay correct.
- Follow this 8-page beat map: 1-2 a child asks the question in a real everyday moment, 3-6 a story-like explanation unfolds step by step (a parent or the world itself explains), 7 back to the real scene where the child confirms the understanding, 8 the child asks a NEW related question that teases the next book.
- Chinese text: at most 45 characters per page, warm and read-aloud friendly.
- English text: natural free translation for ages 4-8.
- Every illustrationPrompt: one concrete scene in English (setting, props, action, emotion, camera distance, composition), ending with "no text in image". Keep the same child and family member appearance across all pages.
- imagePromptKit.globalStyle: one reusable sentence based on: ${LIBRARY_FAIRYTALE_STYLE}
- imagePromptKit.characterConsistency: lock the child protagonist's appearance across pages.
- imagePromptKit.negative: things to avoid (text, watermarks, scary imagery, incorrect science visuals like a literal face on the sun explaining things as fact).

Return only valid JSON:
{
  "title": "the question without the question mark, e.g. 天空为什么是蓝色的",
  "subtitle": "a short poetic Chinese tagline",
  "question": "the full question with question mark, e.g. 天空为什么是蓝色的？",
  "moral": { "zh": "一句话总结的科学答案", "en": "one-line answer" },
  "imagePromptKit": { "globalStyle": "...", "characterConsistency": "...", "negative": "..." },
  "pages": [ { "page": 1, "zhText": "...", "enText": "...", "illustrationPrompt": "..." } ]
}`;

const TANGSHI_SYSTEM = `You are an expert editor of Tang poetry and a bilingual children's picture-book author.
Turn one four-line Tang poem into an 8-page read-aloud picture book for ages 4-8. Series name: 唐诗入画.

Rules:
- Preserve the supplied Chinese poem exactly. Do not modernize, paraphrase, reorder, or silently substitute textual variants.
- Write an original, natural English poetic translation. Do not copy a published translator.
- Do not invent a child protagonist or fictional adventure. Help the child enter the poem through visible scenery, sound, movement, and emotion.
- Follow this exact page map:
  1. The complete four-line Chinese poem and the complete four-line English translation.
  2-5. One original line per page, followed by a short child-friendly explanation of the visible image or action.
  6. Connect what the poet sees and hears across the whole poem.
  7. Explain the feeling or imagination gently, without forcing a moral lesson.
  8. Repeat the complete poem and invite the child to read it softly once more.
- Chinese explanation text must be concise and natural for ages 4-8. English must be a free, child-friendly equivalent.
- Every illustrationPrompt must describe one concrete square scene in English with Tang-era setting accuracy where people or buildings appear.
- Use a playful contemporary Chinese ink-and-watercolor picture-book style: rice-paper texture, soft ink wash, mineral blue-green and restrained cinnabar, generous breathing room, friendly shapes.
- Images must contain no written poem, calligraphy, captions, seals, logos, watermarks, modern objects, frightening imagery, or photorealism.

Return only valid JSON:
{
  "title": "poem title",
  "subtitle": "a short poetic Chinese tagline for children",
  "poem": {
    "dynasty": "唐",
    "author": "author name",
    "originalLines": ["exact line 1", "exact line 2", "exact line 3", "exact line 4"],
    "englishLines": ["original English line 1", "original English line 2", "original English line 3", "original English line 4"],
    "appreciation": { "zh": "一句温柔诗意", "en": "one gentle appreciation" }
  },
  "imagePromptKit": { "globalStyle": "...", "characterConsistency": "...", "negative": "..." },
  "pages": [ { "page": 1, "zhText": "...", "enText": "...", "illustrationPrompt": "..." } ]
}`;

const SERIES_TEMPLATES: Record<string, SeriesTemplate> = {
  chengyu: {
    system: CHENGYU_SYSTEM,
    buildUser: (brief) =>
      `Create the 8-page picture book for this idiom. Source material: ${brief} Return only the JSON object, no markdown fences.`,
  },
  xiyouji: {
    system: XIYOUJI_SYSTEM,
    buildUser: (brief) =>
      `Create the 8-page episode for this chapter material: ${brief} Return only the JSON object, no markdown fences.`,
  },
  haoqi: {
    system: HAOQI_SYSTEM,
    buildUser: (brief) =>
      `Create the 8-page science story for this question: ${brief} Return only the JSON object, no markdown fences.`,
  },
  tangshi: {
    system: TANGSHI_SYSTEM,
    buildUser: (brief) =>
      `Create the 8-page poetry picture book from this authoritative poem text and editorial brief: ${brief} Return only the JSON object, no markdown fences.`,
  },
};

function extractJson(text: string) {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Model response did not contain JSON");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

async function loadEnvFiles() {
  // Minimal .env loader (Next.js precedence: .env.local wins over .env).
  for (const name of [".env.local", ".env"]) {
    let raw: string;
    try {
      raw = await fs.readFile(path.join(ROOT, name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let order = 0;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--order") {
      order = Number.parseInt(argv[++i] ?? "", 10);
      if (!Number.isInteger(order) || order < 0) {
        fail("--order must be a non-negative integer");
      }
    } else {
      positional.push(arg);
    }
  }

  const [seriesId, bookId, brief] = positional;
  if (!seriesId || !bookId || !brief) {
    fail(
      'Usage: pnpm library:generate <seriesId> <bookId> "<brief>" [--order N] [--dry-run]',
    );
  }

  return { seriesId, bookId, brief, order, dryRun };
}

function fail(message: string): never {
  console.error(`[generate-library-book] ${message}`);
  process.exit(1);
}

async function main() {
  const { seriesId, bookId, brief, order, dryRun } = parseArgs(
    process.argv.slice(2),
  );

  const template = SERIES_TEMPLATES[seriesId];
  if (!template) {
    fail(
      `Unknown series "${seriesId}". Available: ${Object.keys(SERIES_TEMPLATES).join(", ")}`,
    );
  }

  const user = template.buildUser(brief);

  if (dryRun) {
    console.log("--- system prompt ---\n");
    console.log(template.system);
    console.log("\n--- user prompt ---\n");
    console.log(user);
    console.log("\n[generate-library-book] dry run: no API call made.");
    return;
  }

  await loadEnvFiles();

  console.log(`[generate-library-book] generating ${seriesId}/${bookId} ...`);
  const startedAt = Date.now();

  let raw: string | null;
  try {
    // Lower temperature than the personalized flow: fidelity to the classic
    // tale matters more than novelty.
    raw = await requestCpaStory(template.system, user, {
      temperature: 0.6,
      topP: 0.85,
    });
  } catch (error) {
    fail(
      `Text provider request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!raw) {
    fail(
      "No text provider available (CPA_API_KEY missing or request exhausted retries). Configure .env.local and retry — drafts must never fall back to template content.",
    );
  }

  const modelOutput = modelOutputSchema.parse(extractJson(raw));
  if (seriesId === "tangshi" && !modelOutput.poem) {
    fail("Tang poetry drafts must include poem metadata.");
  }
  if (seriesId !== "tangshi" && !modelOutput.moral) {
    fail(`${seriesId} drafts must include a bilingual moral.`);
  }

  for (const page of modelOutput.pages) {
    const targetLength = seriesId === "tangshi" ? 100 : 40;
    if (page.zhText.length > targetLength) {
      console.warn(
        `[generate-library-book] warning: page ${page.page} zhText is ${page.zhText.length} chars (target ≤ ${targetLength}) — trim during review.`,
      );
    }
  }

  const { imagePromptKit, ...bookFields } = modelOutput;

  const book: LibraryBook = libraryBookSchema.parse({
    id: bookId,
    seriesId,
    ...bookFields,
    ageLabel: "4-8 岁",
    publishedAt: new Date().toISOString().slice(0, 10),
    order,
    // 西游记连载：回数与系列内排序一致
    ...(seriesId === "xiyouji" && order > 0 ? { episodeNumber: order } : {}),
    comingSoon: true,
  });

  const draft = {
    _draft:
      "UNREVIEWED DRAFT — review text, generate images, then move into src/lib/library/ (see scripts/README.md)",
    book,
    imagePromptKit,
  };

  const outDir = path.join(ROOT, "content-drafts", seriesId);
  const outPath = path.join(outDir, `${bookId}.json`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

  console.log(
    `[generate-library-book] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s → ${path.relative(ROOT, outPath)}`,
  );
}

main().catch((error) => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
});
