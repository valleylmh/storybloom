import type {
  GenerationMode,
  IllustrationStyle,
  StoryPage,
  ImageAttemptMetric,
  ImageProvider,
  FamilyCharacterInput,
  StoryVisualBible,
  IllustrationQualityReport,
} from "@/types";
import fs from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { getCachedCharacterReferenceDataUri } from "@/lib/storage";
import { formatStoryVisualBible } from "@/lib/story-visual-bible";
import { hasFamilyCharacterReference } from "@/lib/family-story-characters";
import { getFamilyCharacterLifeStage, getFamilyCharacterAgeGuidance } from "@/lib/family-character-identity";
import { logGenerationEvent } from "@/lib/generation-observability";
import {
  GenerationProviderError,
  classifyGenerationError,
  type GenerationErrorClass,
} from "@/lib/generation-error";
import {
  createDemoIllustrationQualityReport,
  inspectIllustrationQuality,
} from "@/lib/illustration-quality";

const MAX_IMAGE_ATTEMPTS = 3;
const DEMO_IMAGE_MARKER = "StoryBloom%20Demo";
const DASHSCOPE_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DEFAULT_DASHSCOPE_IMAGE_MODEL = "qwen-image-2.0-pro";
const DEFAULT_DASHSCOPE_IMAGE_SIZE = "512*512";
const DEFAULT_HUGGINGFACE_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
const HUGGINGFACE_IMAGE_ENDPOINT =
  process.env.HUGGINGFACE_IMAGE_ENDPOINT || "https://router.huggingface.co/hf-inference/models";
const DEFAULT_HUGGINGFACE_IMAGE_REQUEST_DELAY_MS = 1_500;
const DEFAULT_HUGGINGFACE_IMAGE_RETRY_DELAY_MS = 8_000;
const DEFAULT_HUGGINGFACE_IMAGE_MAX_ATTEMPTS = 2;
const DEFAULT_HUGGINGFACE_IMAGE_SIZE = 512;
const AGNES_IMAGE_ENDPOINT =
  process.env.AGNES_IMAGE_ENDPOINT || "https://apihub.agnes-ai.com/v1/images/generations";
const DEFAULT_AGNES_IMAGE_MODEL = "agnes-image-2.1-flash";
const DEFAULT_AGNES_IMAGE_SIZE = "1024x768";
const DEFAULT_AGNES_IMAGE_REQUEST_DELAY_MS = 1_500;
const DEFAULT_AGNES_IMAGE_RETRY_DELAY_MS = 8_000;
const DEFAULT_AGNES_IMAGE_MAX_ATTEMPTS = 2;
const DEFAULT_CPA_IMAGE_MODEL = "gemini-3.1-flash-image";
const DEFAULT_CPA_IMAGE_REQUEST_DELAY_MS = 1_500;
const DEFAULT_CPA_IMAGE_RETRY_DELAY_MS = 8_000;
const DEFAULT_CPA_IMAGE_MAX_ATTEMPTS = 2;
const DEFAULT_CPA_IMAGE_TIMEOUT_MS = 120_000;
const DEFAULT_GPT_IMAGE_MODEL = "gpt-image-2.5-flare";
const DEFAULT_IMAGE_PROVIDER_ORDER =
  "agnes:2,openai:2,orbitix:2,dashscope:2,huggingface:2";
const DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS = 120_000;
const MAX_IMAGE_PROVIDER_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_IMAGE_RETRY_WAIT_MS = 30_000;
const MAX_CPA_REFERENCE_IMAGES = 10;
const DEFAULT_FAMILY_ASSETS_BUCKET = "family-photos";
const DEFAULT_FAMILY_REFERENCE_DOWNLOAD_MAX_ATTEMPTS = 3;
const DEFAULT_FAMILY_REFERENCE_DOWNLOAD_RETRY_DELAY_MS = 500;
const FAMILY_REFERENCE_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_FAMILY_REFERENCE_CACHE_ENTRIES = 64;
const DEFAULT_IMAGE_REQUEST_DELAY_MS = 22_000;
const DEFAULT_RATE_LIMIT_RETRY_MS = 70_000;
const DEFAULT_NEGATIVE_PROMPT =
  "low resolution, low quality, deformed body, deformed fingers, oversaturated, waxy face, low facial detail, overly glossy, obvious AI artifacts, messy composition, blurry text, distorted text, logo, watermark";
const STORY_SCENE_NEGATIVE_PROMPT =
  "repeated front-facing portrait, passport photo, selfie, bust shot, giant head close-up, empty background, identical pose, identical smile, character blocking the whole scene";
const SAFE_ILLUSTRATION_ERROR = "插图生成失败，请稍后重试。";

const CHARACTER_REFERENCE_FILES: Record<string, string> = {
  "boy-sunshine": "boy-sunshine.png",
  "boy-forest": "boy-forest.png",
  "boy-dreamer": "boy-dreamer.png",
  "girl-starlight": "girl-starlight.png",
  "girl-sprout": "girl-sprout.png",
  "girl-moon": "girl-moon.png",
};

type ImageProviderConfigItem = {
  provider: ImageProvider;
  weight: number;
};

type GeneratedIllustrationResult = {
  imageUrl: string;
  quality: IllustrationQualityReport;
  provider?: ImageProvider;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  attempts: ImageAttemptMetric[];
};

type IllustrationOptions = {
  storyId?: string;
  pageNumber?: number;
  style?: IllustrationStyle;
  characterReferenceId?: string;
  customCharacterReferenceToken?: string;
  familyCharacters?: FamilyCharacterInput[];
  castIds?: string[];
  visualBible?: StoryVisualBible;
  referenceCacheKey?: string;
  requestAttempt?: number;
  retry?: boolean;
};

function classifyHttpStatus(status: number): GenerationErrorClass {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 500) return "upstream_5xx";
  if (status >= 400) return "upstream_4xx";
  return "unknown";
}

function getImageProviderModel(provider: ImageProvider) {
  switch (provider) {
    case "dashscope":
      return process.env.DASHSCOPE_IMAGE_MODEL || DEFAULT_DASHSCOPE_IMAGE_MODEL;
    case "huggingface":
      return process.env.HUGGINGFACE_IMAGE_MODEL || DEFAULT_HUGGINGFACE_IMAGE_MODEL;
    case "agnes":
      return process.env.AGNES_IMAGE_MODEL || DEFAULT_AGNES_IMAGE_MODEL;
    case "cpa":
      return process.env.CPA_IMAGE_MODEL || DEFAULT_CPA_IMAGE_MODEL;
    case "openai":
    case "orbitix":
      return getGptImageConfig(provider).model;
  }
}

type CpaReferenceImage = {
  dataUri: string;
  label: string;
};

let dashScopeImageQueue: Promise<unknown> = Promise.resolve();
let nextDashScopeImageRequestAt = 0;
let huggingFaceImageQueue: Promise<unknown> = Promise.resolve();
let nextHuggingFaceImageRequestAt = 0;
const agnesImageQueues = new Map<number, Promise<unknown>>();
const nextAgnesImageRequestAt = new Map<number, number>();
let cpaImageQueue: Promise<unknown> = Promise.resolve();
let nextCpaImageRequestAt = 0;
type GptImageProvider = "cpa" | "openai" | "orbitix";
const gptImageQueues = new Map<GptImageProvider, Promise<unknown>>();
const nextGptImageRequestAt = new Map<GptImageProvider, number>();
const familyReferenceCache = new Map<
  string,
  { dataUri: string; expiresAt: number }
>();
const familyReferenceLoads = new Map<string, Promise<string>>();

export class IllustrationGenerationError extends Error {
  failedPages: number[];
  failedDetails: Array<{ page: number; error: string }>;
  retryable: boolean;

  constructor(
    message: string,
    failedPages: number[],
    retryable = true,
    failedDetails: Array<{ page: number; error: string }> = []
  ) {
    super(message);
    this.name = "IllustrationGenerationError";
    this.failedPages = failedPages;
    this.failedDetails = failedDetails;
    this.retryable = retryable;
  }
}

interface DashScopeGenerationResponse {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          image?: string;
        }>;
      };
    }>;
  };
  request_id?: string;
  requestId?: string;
  code?: string;
  message?: string;
}

function getDashScopeKey() {
  return process.env.DASHSCOPE_API_KEY || null;
}

function getHuggingFaceKey() {
  return (
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HUGGINGFACE_TOKEN ||
    process.env.HF_TOKEN ||
    null
  );
}

export function parseAgnesApiKeys(value = process.env.AGNES_API_KEY || "") {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const candidate of value.split(",")) {
    const key = candidate.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }

  return keys;
}

export function getAgnesKeyIndexForPage(
  pageNumber: number | undefined,
  keyCount: number,
) {
  if (keyCount <= 0) return null;
  const safePageNumber =
    typeof pageNumber === "number" && Number.isSafeInteger(pageNumber) && pageNumber > 0
      ? pageNumber
      : 1;
  return (safePageNumber - 1) % keyCount;
}

function getAgnesKey(pageNumber?: number) {
  const keys = parseAgnesApiKeys();
  const keyIndex = getAgnesKeyIndexForPage(pageNumber, keys.length);
  if (keyIndex === null) return null;
  return { key: keys[keyIndex], keyIndex };
}

function getCpaImageConfig() {
  const configuredBaseUrl = process.env.CPA_BASE_URL?.trim();
  return {
    baseUrl: configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, "") : null,
    apiKey: process.env.CPA_API_KEY || null,
    model: process.env.CPA_IMAGE_MODEL || DEFAULT_CPA_IMAGE_MODEL,
  };
}

function getGptImageConfig(provider: "openai" | "orbitix") {
  const prefix = provider.toUpperCase();
  const defaultBaseUrl =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://new.orbitix.site/v1";
  return {
    baseUrl: (process.env[`${prefix}_BASE_URL`]?.trim() || defaultBaseUrl).replace(
      /\/+$/, "",
    ),
    apiKey: process.env[`${prefix}_API_KEY`]?.trim() || null,
    model: process.env[`${prefix}_IMAGE_MODEL`]?.trim() || DEFAULT_GPT_IMAGE_MODEL,
    size: process.env[`${prefix}_IMAGE_SIZE`]?.trim() || "1024x1024",
  };
}

function isImageProvider(value: string): value is ImageProvider {
  return (
    value === "dashscope" ||
    value === "huggingface" ||
    value === "agnes" ||
    value === "cpa" ||
    value === "openai" ||
    value === "orbitix"
  );
}

function hasProviderKey(provider: ImageProvider) {
  if (provider === "openai" || provider === "orbitix") {
    return Boolean(getGptImageConfig(provider).apiKey);
  }

  if (provider === "dashscope") {
    return Boolean(getDashScopeKey());
  }

  if (provider === "huggingface") {
    return Boolean(getHuggingFaceKey());
  }

  if (provider === "agnes") {
    return Boolean(getAgnesKey());
  }

  if (provider === "cpa") {
    const config = getCpaImageConfig();
    return Boolean(config.apiKey && config.baseUrl);
  }

  return false;
}

function parseImageProviderConfig(configured: string) {
  const rawProviders = configured
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return rawProviders.flatMap((item): ImageProviderConfigItem[] => {
    const [rawProvider, rawWeight = "1"] = item.split(/[:=]/);
    const provider = rawProvider?.trim().toLowerCase();
    const weight = Number.parseInt(rawWeight.trim(), 10);

    if (!provider || !isImageProvider(provider) || !Number.isFinite(weight) || weight <= 0) {
      return [];
    }

    return [{ provider, weight }];
  });
}

function getImageProviderOrderConfig() {
  return (
    process.env.IMAGE_PROVIDER_ORDER ||
    process.env.IMAGE_PROVIDER ||
    DEFAULT_IMAGE_PROVIDER_ORDER
  );
}

function getImageToImageProviderOrderConfig() {
  return process.env.IMAGE_TO_IMAGE_PROVIDER_ORDER || "agnes:1,cpa:1";
}

function getImageProviderOrder() {
  const configuredProviders = parseImageProviderConfig(getImageProviderOrderConfig()).map(
    (item) => item.provider
  ).filter(
    (provider) => provider !== "cpa" || isCpaGptImageModel(getCpaImageConfig().model),
  );
  const providers =
    configuredProviders.length > 0
      ? configuredProviders
      : parseImageProviderConfig(DEFAULT_IMAGE_PROVIDER_ORDER).map((item) => item.provider);
  const seen = new Set<ImageProvider>();
  const validProviders: ImageProvider[] = [];

  for (const provider of providers) {
    if (isImageProvider(provider) && !seen.has(provider)) {
      seen.add(provider);
      validProviders.push(provider);
    }
  }

  return validProviders;
}

function getWeightedImageToImageProviders() {
  const providers: ImageProvider[] = [];
  for (const { provider, weight } of parseImageProviderConfig(
    getImageToImageProviderOrderConfig()
  )) {
    if (
      !["agnes", "cpa", "openai", "orbitix"].includes(provider) ||
      !hasProviderKey(provider)
    ) {
      continue;
    }
    providers.push(...Array.from({ length: weight }, () => provider));
  }
  return providers;
}

function getConfiguredImageToImageProviders() {
  return uniqueAvailableProviders(getWeightedImageToImageProviders());
}

function getImageToImageFallbackOrder(preferredProvider?: ImageProvider) {
  const configuredProviders = getConfiguredImageToImageProviders();
  if (!preferredProvider || !configuredProviders.includes(preferredProvider)) {
    return configuredProviders;
  }
  return [
    preferredProvider,
    ...configuredProviders.filter((provider) => provider !== preferredProvider),
  ];
}

function getConfiguredImageProviders() {
  return getImageProviderOrder().filter(hasProviderKey);
}

function getWeightedImageProviders() {
  const configured = getImageProviderOrderConfig();
  const providers: ImageProvider[] = [];

  for (const { provider, weight } of parseImageProviderConfig(configured)) {
    if (
      (provider === "cpa" && !isCpaGptImageModel(getCpaImageConfig().model)) ||
      !hasProviderKey(provider)
    ) {
      continue;
    }

    providers.push(...Array.from({ length: weight }, () => provider));
  }

  return providers;
}

function uniqueAvailableProviders(providers: ImageProvider[]) {
  const seen = new Set<ImageProvider>();
  const availableProviders: ImageProvider[] = [];

  for (const provider of providers) {
    if (!seen.has(provider) && hasProviderKey(provider)) {
      seen.add(provider);
      availableProviders.push(provider);
    }
  }

  return availableProviders;
}

function getProviderFallbackOrder(
  preferredProvider?: ImageProvider,
  fallbackProviders?: ImageProvider[]
) {
  if (fallbackProviders?.length) {
    return uniqueAvailableProviders(fallbackProviders);
  }

  const configuredProviders = getConfiguredImageProviders();
  if (!preferredProvider || !hasProviderKey(preferredProvider)) {
    return configuredProviders;
  }

  return [
    preferredProvider,
    ...configuredProviders.filter((provider) => provider !== preferredProvider),
  ];
}

function getProviderPlan(pageCount: number) {
  const weightedProviders = getWeightedImageProviders();
  const providers = weightedProviders.length > 0 ? weightedProviders : getConfiguredImageProviders();

  if (providers.length === 0) {
    return [];
  }

  return Array.from(
    { length: pageCount },
    (_, index) => providers[index % providers.length],
  );
}

export function getProviderForPage(pageNumber: number, pageCount = 8) {
  const plan = getProviderPlan(pageCount);
  if (plan.length === 0) {
    return undefined;
  }

  return plan[Math.max(0, pageNumber - 1) % plan.length];
}

export function getImageToImageProviderForPage(pageNumber: number, pageCount = 8) {
  const providers = getWeightedImageToImageProviders();
  if (providers.length === 0) {
    return undefined;
  }
  const plan = Array.from(
    { length: pageCount },
    (_, index) => providers[index % providers.length]
  );
  return plan[Math.max(0, pageNumber - 1) % plan.length];
}

function hasPhotoFamilyCharacters(options?: IllustrationOptions) {
  return getPageFamilyCharacters(options).some(hasFamilyCharacterReference);
}

function hasCustomCharacterReference(options?: IllustrationOptions) {
  return Boolean(options?.customCharacterReferenceToken);
}

function getPageFamilyCharacters(options?: IllustrationOptions) {
  const castIds = new Set(options?.castIds ?? []);
  return (options?.familyCharacters ?? []).filter((character) => castIds.has(character.id));
}

function validatePrivateAssetPath(assetPath: string) {
  const normalized = assetPath.trim();
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    normalized.split("/").includes("..") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    throw new Error("Invalid family reference asset path.");
  }
  return normalized;
}

async function getPrivateFamilyReferenceImages(options?: IllustrationOptions) {
  const characters = getPageFamilyCharacters(options);
  const seenPaths = new Set<string>();
  const primaryReferences: Array<{ assetPath: string; label: string }> = [];
  const secondaryReferences: Array<{ assetPath: string; label: string }> = [];

  for (const character of characters) {
    const adult = getFamilyCharacterLifeStage(character.relation) === "adult";
    const sourcePath = character.sourceReferenceAssetPath
      ? validatePrivateAssetPath(character.sourceReferenceAssetPath)
      : null;
    const canonicalPath = character.canonicalReferenceAssetPath
      ? validatePrivateAssetPath(character.canonicalReferenceAssetPath)
      : null;
    const legacyPath = character.referenceAssetPath
      ? validatePrivateAssetPath(character.referenceAssetPath)
      : null;
    const primaryPath = sourcePath || canonicalPath || legacyPath;

    if (primaryPath && !seenPaths.has(primaryPath)) {
      seenPaths.add(primaryPath);
      primaryReferences.push({
        assetPath: primaryPath,
        label: sourcePath === primaryPath
          ? `CHARACTER ${character.id} (${character.name}) — REAL PHOTO IDENTITY REFERENCE. Use this image for the exact face, apparent age, skin tone, and distinctive facial features.${adult ? " Preserve the adult height, build, and body proportions; this overrides any childlike cartoon reference." : ""} Do not copy its clothing when the story outfit lock specifies another outfit.`
          : `CHARACTER ${character.id} (${character.name}) — CANONICAL CARTOON REFERENCE. Use this image for the exact illustrated identity, hairstyle silhouette, ${adult ? "clothing and rendering style; preserve the confirmed adult age and proportions" : "body proportions, and rendering design"}. Obey the story outfit lock for clothing.`,
      });
    }

    if (sourcePath && canonicalPath && !seenPaths.has(canonicalPath)) {
      seenPaths.add(canonicalPath);
      secondaryReferences.push({
        assetPath: canonicalPath,
        label: adult
          ? `CHARACTER ${character.id} (${character.name}) — CANONICAL CARTOON STYLE REFERENCE. Match hairstyle, facial identity, and material style. ${getFamilyCharacterAgeGuidance(character)} The written story outfit lock is authoritative for clothing.`
          : `CHARACTER ${character.id} (${character.name}) — CANONICAL CARTOON BODY AND STYLE REFERENCE. Match this character's hairstyle silhouette, body proportions, facial design translation, and storybook material style. The written story outfit lock is authoritative for clothing.`,
      });
    }
  }

  const references = [...primaryReferences, ...secondaryReferences].slice(
    0,
    MAX_CPA_REFERENCE_IMAGES,
  );
  if (references.length === 0) {
    return [];
  }

  const bucket = process.env.SUPABASE_FAMILY_ASSETS_BUCKET || DEFAULT_FAMILY_ASSETS_BUCKET;
  return Promise.all(
    references.map(async ({ assetPath, label }) => {
      return {
        dataUri: await getPrivateFamilyReferenceDataUri(
          bucket,
          assetPath,
          options?.referenceCacheKey,
        ),
        label,
      };
    })
  );
}

async function downloadPrivateFamilyReferenceDataUri(
  bucket: string,
  assetPath: string,
) {
  const maxAttempts = Math.max(
    1,
    getPositiveIntegerEnv(
      "FAMILY_REFERENCE_DOWNLOAD_MAX_ATTEMPTS",
      DEFAULT_FAMILY_REFERENCE_DOWNLOAD_MAX_ATTEMPTS,
    ),
  );
  const retryDelay = getPositiveIntegerEnv(
    "FAMILY_REFERENCE_DOWNLOAD_RETRY_DELAY_MS",
    DEFAULT_FAMILY_REFERENCE_DOWNLOAD_RETRY_DELAY_MS,
  );
  let lastErrorClass: GenerationErrorClass = "storage_unavailable";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { data, error } = await getSupabaseAdmin().storage
        .from(bucket)
        .download(assetPath);
      if (error || !data) {
        throw new GenerationProviderError("storage_unavailable");
      }

      const contentType = data.type || "image/jpeg";
      if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(contentType)) {
        throw new Error("Family reference image must be JPEG, PNG, or WebP.");
      }
      if (data.size > 8 * 1024 * 1024) {
        throw new Error("Family reference image exceeds 8 MB.");
      }

      const bytes = Buffer.from(await data.arrayBuffer());
      return `data:${contentType};base64,${bytes.toString("base64")}`;
    } catch (error) {
      lastErrorClass = classifyGenerationError(error);
      if (attempt < maxAttempts) {
        await sleep(retryDelay * attempt);
      }
    }
  }

  throw new GenerationProviderError(
    lastErrorClass === "unknown" ? "storage_unavailable" : lastErrorClass,
    "Unable to load family reference image.",
  );
}

function rememberFamilyReference(cacheKey: string, dataUri: string) {
  if (familyReferenceCache.size >= MAX_FAMILY_REFERENCE_CACHE_ENTRIES) {
    const oldestKey = familyReferenceCache.keys().next().value;
    if (oldestKey) familyReferenceCache.delete(oldestKey);
  }
  familyReferenceCache.set(cacheKey, {
    dataUri,
    expiresAt: Date.now() + FAMILY_REFERENCE_CACHE_TTL_MS,
  });
}

async function getPrivateFamilyReferenceDataUri(
  bucket: string,
  assetPath: string,
  referenceCacheKey?: string,
) {
  const cacheKey = `${referenceCacheKey || "request"}:${bucket}:${assetPath}`;
  const cached = referenceCacheKey ? familyReferenceCache.get(cacheKey) : null;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dataUri;
  }
  if (cached) familyReferenceCache.delete(cacheKey);

  const activeLoad = familyReferenceLoads.get(cacheKey);
  if (activeLoad) return activeLoad;

  const load = downloadPrivateFamilyReferenceDataUri(bucket, assetPath)
    .then((dataUri) => {
      if (referenceCacheKey) rememberFamilyReference(cacheKey, dataUri);
      return dataUri;
    })
    .finally(() => {
      familyReferenceLoads.delete(cacheKey);
    });
  familyReferenceLoads.set(cacheKey, load);
  return load;
}

async function getCustomCharacterReferenceImage(options?: IllustrationOptions) {
  const token = options?.customCharacterReferenceToken?.trim();
  if (!token) {
    return null;
  }
  const image = await getCachedCharacterReferenceDataUri(token);
  if (!image) {
    throw new Error("Custom character reference expired. Upload the photo again.");
  }
  return image;
}

async function getImageToImageReferenceImages(options?: IllustrationOptions) {
  const customReference = await getCustomCharacterReferenceImage(options);
  if (customReference) {
    return [
      {
        dataUri: customReference,
        label:
          "MAIN CHARACTER — UPLOADED IDENTITY REFERENCE. Preserve the exact recognizable face, apparent age, hairstyle, skin tone, and distinctive visible features.",
      },
    ];
  }
  const familyCharacters = getPageFamilyCharacters(options);
  const storyAnchorCandidates = await Promise.all(
    familyCharacters.flatMap((character) =>
      character.storyReferenceToken
        ? [
            getCachedCharacterReferenceDataUri(character.storyReferenceToken).then(
              (dataUri): CpaReferenceImage | null => {
                if (!dataUri) {
                  logGenerationEvent(
                    {
                      operation: "illustration.reference",
                      story: options?.storyId,
                      page: options?.pageNumber,
                      status: "expired",
                      errorClass: "not_found",
                    },
                    "warn",
                  );
                  return null;
                }
                return {
                  dataUri,
                  label: getFamilyCharacterLifeStage(character.relation) === "adult"
                    ? `CHARACTER ${character.id} (${character.name}) — FIXED STORY OUTFIT ANCHOR. Preserve the same garment types, colors, piping, patterns, accessories, and footwear. ${getFamilyCharacterAgeGuidance(character)}`
                    : `CHARACTER ${character.id} (${character.name}) — FIXED STORY OUTFIT ANCHOR. This is the highest-priority full-body reference for this entire book. Preserve its exact illustrated face translation, hairstyle silhouette, body proportions, garment types, garment colors, piping, patterns, accessories, and footwear on every page.`,
                };
              },
            ),
          ]
        : [],
    ),
  );
  const storyAnchors = storyAnchorCandidates.filter(
    (reference): reference is CpaReferenceImage => Boolean(reference),
  );
  const familyReferences = await getPrivateFamilyReferenceImages(options);
  return [...storyAnchors, ...familyReferences].slice(
    0,
    MAX_CPA_REFERENCE_IMAGES,
  );
}

async function getCharacterReferenceImage(referenceId?: string) {
  if (!referenceId) {
    return null;
  }

  const fileName = CHARACTER_REFERENCE_FILES[referenceId];
  if (!fileName) {
    return null;
  }

  const imagePath = path.join(process.cwd(), "public", "characters", fileName);
  const bytes = await fs.readFile(imagePath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function getPalette(style: IllustrationStyle) {
  switch (style) {
    case "cartoon":
      return {
        bgStart: "#ffe08a",
        bgEnd: "#ff9f68",
        frame: "#8b3d1f",
        accent: "#ff5d5d",
      };
    case "fairytale":
      return {
        bgStart: "#cab8ff",
        bgEnd: "#7bc6ff",
        frame: "#3f2b73",
        accent: "#ffd66b",
      };
    default:
      return {
        bgStart: "#f7d9c4",
        bgEnd: "#c8e7d0",
        frame: "#6d4c41",
        accent: "#e97a5b",
      };
  }
}

function canUseDemoImages() {
  return (
    process.env.STORYBLOOM_ALLOW_DEMO_IMAGES === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

function getImageConcurrency() {
  const parsed = Number.parseInt(
    process.env.IMAGE_GENERATION_CONCURRENCY ?? process.env.DASHSCOPE_IMAGE_CONCURRENCY ?? "1",
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getBoundedImageTimeoutMs(
  name: string,
  fallback = DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS,
) {
  return Math.min(
    Math.max(1_000, getPositiveIntegerEnv(name, fallback)),
    MAX_IMAGE_PROVIDER_TIMEOUT_MS,
  );
}

function getOptionalPositiveIntegerEnv(name: string) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(error: unknown) {
  return classifyGenerationError(error) === "rate_limit";
}

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) {
    return null;
  }

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

async function waitForImageProviderRetry(delayMs: number, timeoutMs: number) {
  // Long upstream cooldowns must return control before the Vercel function expires.
  // Do not shorten Retry-After and send a request while the provider is still cooling down.
  if (delayMs > Math.min(timeoutMs, MAX_IMAGE_RETRY_WAIT_MS)) return false;
  await sleep(delayMs);
  return true;
}

async function withDashScopeImageThrottle<T>(task: () => Promise<T>): Promise<T> {
  const requestDelay = getPositiveIntegerEnv(
    "DASHSCOPE_IMAGE_REQUEST_DELAY_MS",
    DEFAULT_IMAGE_REQUEST_DELAY_MS
  );

  const run = dashScopeImageQueue.then(async () => {
    const waitMs = Math.max(0, nextDashScopeImageRequestAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await task();
    } finally {
      nextDashScopeImageRequestAt = Date.now() + requestDelay;
    }
  });

  dashScopeImageQueue = run.catch(() => undefined);
  return run;
}

async function withHuggingFaceImageThrottle<T>(task: () => Promise<T>): Promise<T> {
  const requestDelay = getPositiveIntegerEnv(
    "HUGGINGFACE_IMAGE_REQUEST_DELAY_MS",
    DEFAULT_HUGGINGFACE_IMAGE_REQUEST_DELAY_MS
  );

  const run = huggingFaceImageQueue.then(async () => {
    const waitMs = Math.max(0, nextHuggingFaceImageRequestAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await task();
    } finally {
      nextHuggingFaceImageRequestAt = Date.now() + requestDelay;
    }
  });

  huggingFaceImageQueue = run.catch(() => undefined);
  return run;
}

async function withAgnesImageThrottle<T>(
  keyIndex: number,
  task: () => Promise<T>,
): Promise<T> {
  const requestDelay = getPositiveIntegerEnv(
    "AGNES_IMAGE_REQUEST_DELAY_MS",
    DEFAULT_AGNES_IMAGE_REQUEST_DELAY_MS
  );

  const previousQueue = agnesImageQueues.get(keyIndex) || Promise.resolve();
  const run = previousQueue.then(async () => {
    const waitMs = Math.max(
      0,
      (nextAgnesImageRequestAt.get(keyIndex) || 0) - Date.now(),
    );
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await task();
    } finally {
      nextAgnesImageRequestAt.set(keyIndex, Date.now() + requestDelay);
    }
  });

  agnesImageQueues.set(keyIndex, run.catch(() => undefined));
  return run;
}

async function withCpaImageThrottle<T>(task: () => Promise<T>): Promise<T> {
  const requestDelay = getPositiveIntegerEnv(
    "CPA_IMAGE_REQUEST_DELAY_MS",
    DEFAULT_CPA_IMAGE_REQUEST_DELAY_MS
  );

  const run = cpaImageQueue.then(async () => {
    const waitMs = Math.max(0, nextCpaImageRequestAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await task();
    } finally {
      nextCpaImageRequestAt = Date.now() + requestDelay;
    }
  });

  cpaImageQueue = run.catch(() => undefined);
  return run;
}

async function withGptImageThrottle<T>(
  provider: GptImageProvider,
  task: () => Promise<T>,
): Promise<T> {
  if (provider === "cpa") return withCpaImageThrottle(task);
  const requestDelay = getPositiveIntegerEnv(
    `${provider.toUpperCase()}_IMAGE_REQUEST_DELAY_MS`,
    DEFAULT_CPA_IMAGE_REQUEST_DELAY_MS,
  );
  const run = (gptImageQueues.get(provider) || Promise.resolve()).then(async () => {
    const waitMs = Math.max(0, (nextGptImageRequestAt.get(provider) || 0) - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    try {
      return await task();
    } finally {
      nextGptImageRequestAt.set(provider, Date.now() + requestDelay);
    }
  });
  gptImageQueues.set(provider, run.catch(() => undefined));
  return run;
}

function truncateForDashScope(prompt: string) {
  const maxLength = 1800;
  const characters = Array.from(prompt.replace(/\s+/g, " ").trim());
  if (characters.length <= maxLength) {
    return characters.join("");
  }

  return characters.slice(0, maxLength).join("");
}

function truncateForImagePrompt(prompt: string) {
  const maxLength = 1600;
  const characters = Array.from(prompt.replace(/\s+/g, " ").trim());
  if (characters.length <= maxLength) {
    return characters.join("");
  }

  return characters.slice(0, maxLength).join("");
}

function truncateForCpaPrompt(prompt: string) {
  const maxLength = 6000;
  const characters = Array.from(prompt.replace(/\s+/g, " ").trim());
  if (characters.length <= maxLength) {
    return characters.join("");
  }

  return characters.slice(0, maxLength).join("");
}

export function isDemoImageUrl(imageUrl?: string) {
  return Boolean(imageUrl?.startsWith("data:image/svg+xml") && imageUrl.includes(DEMO_IMAGE_MARKER));
}

export function createDemoImage(prompt: string, pageNumber: number, style: IllustrationStyle) {
  const palette = getPalette(style);
  const title = prompt.slice(0, 72).replace(/[<>&"]/g, " ");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.bgStart}" />
          <stop offset="100%" stop-color="${palette.bgEnd}" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="56" fill="url(#bg)" />
      <circle cx="810" cy="220" r="120" fill="${palette.accent}" opacity="0.25" />
      <circle cx="220" cy="820" r="160" fill="#ffffff" opacity="0.2" />
      <rect x="72" y="72" width="880" height="880" rx="44" fill="rgba(255,255,255,0.18)" stroke="${palette.frame}" stroke-width="10" />
      <text x="512" y="190" text-anchor="middle" font-size="56" font-family="Arial, sans-serif" fill="${palette.frame}" font-weight="700">StoryBloom Demo</text>
      <text x="512" y="315" text-anchor="middle" font-size="200" font-family="Arial, sans-serif" fill="${palette.frame}" font-weight="700">${pageNumber}</text>
      <foreignObject x="124" y="420" width="776" height="320">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: ${palette.frame}; font-size: 34px; line-height: 1.5; text-align: center; padding: 24px;">
          ${title}
        </div>
      </foreignObject>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function createDemoPages(pages: StoryPage[], style: IllustrationStyle) {
  const pageCount = pages.length;
  return pages.map((page) => ({
    ...page,
    imageUrl: createDemoImage(page.illustrationPrompt, page.page, style),
    imageStatus: "demo" as const,
    imagePlannedProvider: page.imagePlannedProvider || getProviderForPage(page.page, pageCount),
    imageAttempts: [],
    imageQuality: createDemoIllustrationQualityReport(),
  }));
}

async function downloadImageAsDataUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(
      getBoundedImageTimeoutMs(
        "IMAGE_DOWNLOAD_TIMEOUT_MS",
        DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS,
      ),
    ),
  });
  if (!response.ok) {
    throw new Error(`Image download failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function extractImageUrl(data: DashScopeGenerationResponse) {
  return data.output?.choices?.[0]?.message?.content?.find((item) => item.image)?.image;
}

interface AgnesImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    base64?: string;
    image?: string;
    url?: string;
  }>;
  b64_json?: string;
  base64?: string;
  image?: string;
  url?: string;
  error?: {
    message?: string;
    code?: string;
  };
  message?: string;
  code?: string;
}

interface CpaImageGenerationResponse {
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<{ image_url?: { url?: string } }>;
    };
  }>;
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
  errors?: Array<{ message?: string }>;
}

function normalizeBase64Image(value: string, fallbackType = "image/png") {
  if (value.startsWith("data:")) {
    return value;
  }

  return `data:${fallbackType};base64,${value}`;
}

function extractAgnesImage(data: AgnesImageGenerationResponse) {
  const firstImage = data.data?.[0];
  const base64Image =
    firstImage?.b64_json ||
    firstImage?.base64 ||
    firstImage?.image ||
    data.b64_json ||
    data.base64 ||
    data.image;

  if (base64Image) {
    return normalizeBase64Image(base64Image);
  }

  return firstImage?.url || data.url || null;
}

async function generateDashScopeIllustration(
  prompt: string,
  seed?: number,
  options?: {
    pageNumber?: number;
    style?: IllustrationStyle;
    characterReferenceId?: string;
  }
): Promise<string> {
  const dashscopeKey = getDashScopeKey();
  if (!dashscopeKey) {
    throw new GenerationProviderError("configuration");
  }

  const referenceImage = await getCharacterReferenceImage(options?.characterReferenceId);
  const promptText = truncateForDashScope(
    [
      "Highest priority: create a story scene, not a character portrait. The image must show the page event through environment, props, action, and emotion. Use varied camera distance and varied pose. The main character should not fill the whole frame; usually show full body or three-quarter body and keep the main character around 25-45% of the image. Avoid repeated front-facing smile, bust shot, selfie, or giant head close-up.",
      prompt,
      referenceImage
        ? "Use the attached reference portrait only as the fixed main-character identity, not as a pose, crop, or composition reference. Preserve face shape, hairstyle, hair color, eye style, outfit colors, visual age, and premium 3D cartoon material style. Change pose, expression, camera angle, and scene to match this page."
        : null,
      "Hard consistency rules: same main-character identity across every page, same haircut, hair color, face shape, outfit colors, age, body proportions, premium 3D cartoon style, rounded clay-like materials, palette, lighting softness, and render quality. Keep the same gender presentation. Do not redesign the main character. Do not reuse the same pose or crop. No text in image.",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const messageContent = [
    ...(referenceImage ? [{ image: referenceImage }] : []),
    { text: promptText },
  ];

  const response = await withDashScopeImageThrottle(() =>
    fetch(DASHSCOPE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dashscopeKey}`,
      },
      body: JSON.stringify({
        model: process.env.DASHSCOPE_IMAGE_MODEL || DEFAULT_DASHSCOPE_IMAGE_MODEL,
        input: {
          messages: [
            {
              role: "user",
              content: messageContent,
            },
          ],
        },
        parameters: {
          n: 1,
          negative_prompt: [
            process.env.DASHSCOPE_NEGATIVE_PROMPT || DEFAULT_NEGATIVE_PROMPT,
            STORY_SCENE_NEGATIVE_PROMPT,
          ].join(", "),
          prompt_extend: true,
          watermark: false,
          size: process.env.DASHSCOPE_IMAGE_SIZE || DEFAULT_DASHSCOPE_IMAGE_SIZE,
          seed,
        },
      }),
      signal: AbortSignal.timeout(
        getBoundedImageTimeoutMs("DASHSCOPE_IMAGE_TIMEOUT_MS"),
      ),
    })
  );

  const data = (await response.json().catch(() => ({}))) as DashScopeGenerationResponse;

  if (!response.ok) {
    throw new GenerationProviderError(classifyHttpStatus(response.status));
  }

  const imageUrl = extractImageUrl(data);
  if (!imageUrl) {
    throw new GenerationProviderError("invalid_response");
  }

  return downloadImageAsDataUrl(imageUrl);
}

async function generateHuggingFaceIllustration(
  prompt: string,
  _seed?: number,
  options?: {
    pageNumber?: number;
    style?: IllustrationStyle;
    characterReferenceId?: string;
  }
): Promise<string> {
  const huggingFaceKey = getHuggingFaceKey();
  if (!huggingFaceKey) {
    throw new GenerationProviderError("configuration");
  }

  const promptText = truncateForImagePrompt(
    [
      "Create one square children's storybook illustration, polished anime-inspired storybook art.",
      "Highest priority: show a complete story scene, not a character portrait. Include environment, props, action, and emotion. Keep the main character around 25-45% of the frame, usually full body or three-quarter body. Vary pose, expression, camera angle, and crop.",
      prompt,
      options?.characterReferenceId
        ? "Keep the same character identity described in the prompt: hairstyle, outfit colors, age, body proportions, and premium 3D cartoon style."
        : null,
      "No text, captions, letters, logos, watermark, scary imagery, violence, distorted hands, extra limbs, or photorealistic rendering.",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const model = process.env.HUGGINGFACE_IMAGE_MODEL || DEFAULT_HUGGINGFACE_IMAGE_MODEL;
  const endpoint = `${HUGGINGFACE_IMAGE_ENDPOINT.replace(/\/$/, "")}/${model}`;
  const imageSize =
    getOptionalPositiveIntegerEnv("HUGGINGFACE_IMAGE_SIZE") ||
    DEFAULT_HUGGINGFACE_IMAGE_SIZE;
  const width = getOptionalPositiveIntegerEnv("HUGGINGFACE_IMAGE_WIDTH") || imageSize;
  const height = getOptionalPositiveIntegerEnv("HUGGINGFACE_IMAGE_HEIGHT") || imageSize;
  const maxAttempts = Math.max(
    1,
    getPositiveIntegerEnv("HUGGINGFACE_IMAGE_MAX_ATTEMPTS", DEFAULT_HUGGINGFACE_IMAGE_MAX_ATTEMPTS)
  );
  const retryDelay = getPositiveIntegerEnv(
    "HUGGINGFACE_IMAGE_RETRY_DELAY_MS",
    DEFAULT_HUGGINGFACE_IMAGE_RETRY_DELAY_MS
  );
  let lastErrorClass: GenerationErrorClass = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await withHuggingFaceImageThrottle(() =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${huggingFaceKey}`,
          "Content-Type": "application/json",
          Accept: "image/jpeg,image/png,image/webp,image/*",
        },
        body: JSON.stringify({
          inputs: promptText,
          parameters: {
            width,
            height,
            num_inference_steps: 4,
          },
        }),
        signal: AbortSignal.timeout(
          getBoundedImageTimeoutMs("HUGGINGFACE_IMAGE_TIMEOUT_MS"),
        ),
      })
    );

    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.startsWith("image/")) {
      const bytes = Buffer.from(await response.arrayBuffer());
      return `data:${contentType};base64,${bytes.toString("base64")}`;
    }

    await response.body?.cancel().catch(() => undefined);
    lastErrorClass = classifyHttpStatus(response.status);

    if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
      await sleep(getRetryAfterMs(response) ?? retryDelay);
      continue;
    }

    break;
  }

  throw new GenerationProviderError(lastErrorClass);
}

function extractCpaImage(data: CpaImageGenerationResponse) {
  const imageApiResult = data.data?.[0];
  if (imageApiResult?.b64_json) {
    return normalizeBase64Image(imageApiResult.b64_json);
  }
  if (imageApiResult?.url) {
    return imageApiResult.url;
  }

  const message = data.choices?.[0]?.message;
  const structuredImage = message?.images?.[0]?.image_url?.url;
  if (structuredImage) {
    return structuredImage;
  }

  if (typeof message?.content !== "string") {
    return null;
  }
  return (
    message.content.match(
      /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i
    )?.[0] || message.content.match(/https?:\/\/[^\s)"']+/)?.[0] || null
  );
}

function isCpaGptImageModel(model: string) {
  return /^gpt-image(?:-|$)/i.test(model.trim());
}

function createCpaImageFile(dataUri: string, index: number) {
  const match = dataUri.match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i,
  );
  if (!match) {
    throw new GenerationProviderError("invalid_response");
  }

  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) {
    throw new GenerationProviderError("invalid_response");
  }
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  return {
    blob: new Blob([bytes], { type: mimeType }),
    filename: `reference-${index + 1}.${extension}`,
  };
}

function createGptImageEditBody(
  model: string,
  promptText: string,
  references: CpaReferenceImage[],
  size: string,
  legacyResponseFormat: boolean,
) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", promptText);
  form.append("size", size);
  form.append("n", "1");
  if (legacyResponseFormat) form.append("response_format", "b64_json");
  else form.append("output_format", "png");
  references.forEach((reference, index) => {
    const image = createCpaImageFile(reference.dataUri, index);
    form.append("image[]", image.blob, image.filename);
  });
  return form;
}

async function requestGptImage(input: {
  provider: GptImageProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  size: string;
  promptText: string;
  references: CpaReferenceImage[];
  maxAttempts: number;
  retryDelay: number;
  timeoutMs: number;
}) {
  let lastErrorClass: GenerationErrorClass = "unknown";
  const promptWithReferenceOrder = truncateForCpaPrompt(
    [
      input.promptText,
      ...(input.references.length > 0
        ? [
            "Reference image order:",
            ...input.references.map(
              (reference, index) => `Image ${index + 1}: ${reference.label}`,
            ),
          ]
        : []),
    ].join(" "),
  );
  const isEdit = input.references.length > 0;
  const useJson = !isEdit || input.provider === "openai";
  const legacyResponseFormat = input.provider === "cpa";

  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await withGptImageThrottle(input.provider, () =>
        fetch(`${input.baseUrl}/images/${isEdit ? "edits" : "generations"}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            ...(useJson ? { "Content-Type": "application/json" } : {}),
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "StoryBloom GPT Image",
          },
          body: useJson
            ? JSON.stringify({
                model: input.model,
                prompt: promptWithReferenceOrder,
                size: input.size,
                n: 1,
                ...(legacyResponseFormat
                  ? { response_format: "b64_json" }
                  : { output_format: "png" }),
                ...(isEdit
                  ? {
                      images: input.references.map((reference) => ({
                        image_url: reference.dataUri,
                      })),
                    }
                  : {}),
              })
            : createGptImageEditBody(
                input.model,
                promptWithReferenceOrder,
                input.references,
                input.size,
                legacyResponseFormat,
              ),
          signal: AbortSignal.timeout(input.timeoutMs),
        }),
      );
    } catch (error) {
      lastErrorClass = classifyGenerationError(error);
      if (
        attempt < input.maxAttempts &&
        await waitForImageProviderRetry(input.retryDelay, input.timeoutMs)
      ) {
        continue;
      }
      throw new GenerationProviderError(lastErrorClass);
    }

    const data = (await response.json().catch(() => ({}))) as CpaImageGenerationResponse;
    if (response.ok) {
      const image = extractCpaImage(data);
      if (image) {
        return image.startsWith("http") ? downloadImageAsDataUrl(image) : image;
      }
      lastErrorClass = "invalid_response";
    } else {
      lastErrorClass = classifyHttpStatus(response.status);
    }

    if (
      attempt < input.maxAttempts &&
      (response.status === 429 || response.status >= 500)
    ) {
      if (await waitForImageProviderRetry(
        getRetryAfterMs(response) ?? input.retryDelay,
        input.timeoutMs,
      )) continue;
    }
    break;
  }

  throw new GenerationProviderError(lastErrorClass);
}

async function generateCompatibleIllustration(
  provider: GptImageProvider,
  prompt: string,
  options?: IllustrationOptions,
): Promise<string> {
  const referenceImages = await getImageToImageReferenceImages(options);
  if (
    provider === "cpa" &&
    referenceImages.length === 0 &&
    !isCpaGptImageModel(getCpaImageConfig().model)
  ) {
    throw new GenerationProviderError("configuration");
  }

  const visualBible = formatStoryVisualBible(
    options?.visualBible,
    options?.castIds,
  );
  const promptText = truncateForCpaPrompt(
    [
      "Create one polished children's storybook illustration from the fixed character references and visual bible below.",
      "Each reference image is preceded by a label that states its role. Match each labeled image only to that character id and name. Never blend, swap, or average identities between family members.",
      visualBible,
      "Identity and wardrobe continuity are binding. Preserve the same recognizable face, apparent age, face shape, facial proportions, hairstyle, hair color, skin tone, body proportions, glasses, distinctive features, and exact locked outfit. Do not recolor, restyle, add, remove, or substitute garments. Only pose, expression, camera angle, action, and background may change to fit the scene.",
      "Show a complete scene rather than a portrait. Include environment, props, action, and emotion. Keep the main character around 25-45% of the frame, usually full body or three-quarter body.",
      "CURRENT PAGE SCENE:",
      prompt,
      "Render as a premium children's storybook character with soft rounded materials and polished animation quality. No text, captions, logos, watermark, duplicate people, distorted hands, or extra limbs.",
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (provider === "cpa") return requestCpaImage(promptText, referenceImages);
  return requestConfiguredGptImage(provider, promptText, referenceImages);
}

async function requestConfiguredGptImage(
  provider: "openai" | "orbitix",
  promptText: string,
  referenceImages: CpaReferenceImage[],
) {
  const config = getGptImageConfig(provider);
  if (!config.apiKey) throw new GenerationProviderError("configuration");
  const prefix = provider.toUpperCase();
  return requestGptImage({
    provider,
    ...config,
    apiKey: config.apiKey,
    promptText,
    references: referenceImages.slice(0, MAX_CPA_REFERENCE_IMAGES),
    maxAttempts: Math.max(
      1,
      getPositiveIntegerEnv(`${prefix}_IMAGE_MAX_ATTEMPTS`, DEFAULT_CPA_IMAGE_MAX_ATTEMPTS),
    ),
    retryDelay: getPositiveIntegerEnv(
      `${prefix}_IMAGE_RETRY_DELAY_MS`,
      DEFAULT_CPA_IMAGE_RETRY_DELAY_MS,
    ),
    timeoutMs: getBoundedImageTimeoutMs(`${prefix}_IMAGE_TIMEOUT_MS`),
  });
}

async function requestCpaImage(
  promptText: string,
  referenceImages: Array<string | CpaReferenceImage>,
) {
  const { baseUrl, apiKey, model } = getCpaImageConfig();
  if (!apiKey || !baseUrl) {
    throw new GenerationProviderError("configuration");
  }
  if (referenceImages.length === 0 && !isCpaGptImageModel(model)) {
    throw new GenerationProviderError("configuration");
  }
  const normalizedReferences = referenceImages
    .slice(0, MAX_CPA_REFERENCE_IMAGES)
    .map((reference, index): CpaReferenceImage =>
      typeof reference === "string"
        ? {
            dataUri: reference,
            label: `REFERENCE IMAGE ${index + 1}. Follow the prompt for how this reference should be used.`,
          }
        : reference,
    );
  const maxAttempts = Math.max(
    1,
    getPositiveIntegerEnv("CPA_IMAGE_MAX_ATTEMPTS", DEFAULT_CPA_IMAGE_MAX_ATTEMPTS)
  );
  const retryDelay = getPositiveIntegerEnv(
    "CPA_IMAGE_RETRY_DELAY_MS",
    DEFAULT_CPA_IMAGE_RETRY_DELAY_MS
  );
  const timeoutMs = getBoundedImageTimeoutMs(
    "CPA_IMAGE_TIMEOUT_MS",
    DEFAULT_CPA_IMAGE_TIMEOUT_MS
  );
  if (isCpaGptImageModel(model)) {
    return requestGptImage({
      provider: "cpa",
      baseUrl,
      apiKey,
      model,
      size: process.env.CPA_IMAGE_SIZE || "1024x1024",
      promptText,
      references: normalizedReferences,
      maxAttempts,
      retryDelay,
      timeoutMs,
    });
  }
  let lastErrorClass: GenerationErrorClass = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await withCpaImageThrottle(() =>
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "StoryBloom Nano Banana 2",
          },
          body: JSON.stringify({
            model,
            modalities: ["text", "image"],
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  ...normalizedReferences.flatMap((reference) => [
                    { type: "text" as const, text: reference.label },
                    {
                      type: "image_url" as const,
                      image_url: { url: reference.dataUri },
                    },
                  ]),
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      );
    } catch (error) {
      lastErrorClass = classifyGenerationError(error);
      if (
        attempt < maxAttempts &&
        await waitForImageProviderRetry(retryDelay, timeoutMs)
      ) {
        continue;
      }
      throw new GenerationProviderError(lastErrorClass);
    }

    const data = (await response.json().catch(() => ({}))) as CpaImageGenerationResponse;
    if (response.ok) {
      const image = extractCpaImage(data);
      if (image) {
        return image.startsWith("http") ? downloadImageAsDataUrl(image) : image;
      }
      lastErrorClass = "invalid_response";
    } else {
      lastErrorClass = classifyHttpStatus(response.status);
    }

    if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
      if (await waitForImageProviderRetry(
        getRetryAfterMs(response) ?? retryDelay,
        timeoutMs,
      )) continue;
    }
    break;
  }

  throw new GenerationProviderError(lastErrorClass);
}

export async function generateCpaReferenceImage(input: {
  prompt: string;
  referenceImages: string[];
}) {
  return requestCpaImage(truncateForCpaPrompt(input.prompt), input.referenceImages);
}

async function requestConfiguredReferenceImage(
  prompt: string,
  references: CpaReferenceImage[],
) {
  const providers = getConfiguredImageToImageProviders();
  if (providers.length === 0) throw new GenerationProviderError("configuration");
  let lastErrorClass: GenerationErrorClass = "unknown";
  for (const provider of providers) {
    const startedAt = Date.now();
    try {
      let image: string;
      if (provider === "cpa") {
        image = await requestCpaImage(prompt, references);
      } else if (provider === "agnes") {
        image = await requestAgnesImage(prompt, references);
      } else if (provider === "openai" || provider === "orbitix") {
        image = await requestConfiguredGptImage(provider, prompt, references);
      } else continue;
      logGenerationEvent({
        operation: "illustration.reference_attempt",
        provider,
        model: getImageProviderModel(provider),
        status: "success",
        duration: Date.now() - startedAt,
      });
      return image;
    } catch (error) {
      lastErrorClass = classifyGenerationError(error);
      logGenerationEvent(
        {
          operation: "illustration.reference_attempt",
          provider,
          model: getImageProviderModel(provider),
          status: "failed",
          duration: Date.now() - startedAt,
          errorClass: lastErrorClass,
        },
        "warn",
      );
    }
  }
  throw new GenerationProviderError(lastErrorClass);
}

export async function generateReferenceImage(input: {
  prompt: string;
  referenceImages: string[];
}) {
  return requestConfiguredReferenceImage(
    truncateForCpaPrompt(input.prompt),
    input.referenceImages.slice(0, MAX_CPA_REFERENCE_IMAGES).map((dataUri, index) => ({
      dataUri,
      label: `REFERENCE IMAGE ${index + 1}. Follow the prompt for how this reference should be used.`,
    })),
  );
}

type StoryCharacterAnchorInput = {
  character: FamilyCharacterInput;
  visualBible: StoryVisualBible;
  referenceCacheKey?: string;
};

async function createStoryCharacterAnchorRequest(input: StoryCharacterAnchorInput) {
  const references = await getPrivateFamilyReferenceImages({
    familyCharacters: [input.character],
    castIds: [input.character.id],
    referenceCacheKey: input.referenceCacheKey,
  });
  if (references.length === 0) {
    throw new GenerationProviderError("configuration");
  }
  const visualBible = formatStoryVisualBible(input.visualBible, [input.character.id]);
  const prompt = truncateForCpaPrompt(
    [
      "Create one fixed full-body character anchor for a children's picture-book series.",
      "Use the labels before the reference images exactly: the real photo controls facial identity; the canonical cartoon reference controls the illustrated identity translation, hairstyle silhouette, body proportions, and material design.",
      visualBible,
      "The written outfit lock is authoritative. Show the exact locked clothes clearly from head to toe, including garment type, colors, piping, patterns, layers, accessories, and footwear. Do not substitute or redesign any garment.",
      "Neutral warm studio background, centered full-body three-quarter standing pose, relaxed natural expression, arms visible, feet visible, even soft lighting, no scene props.",
      "One subject only. No text, captions, labels, logos, watermark, extra people, duplicate body parts, crop, border, or photorealistic rendering.",
    ]
      .filter(Boolean)
      .join(" "),
  );
  return { prompt, references };
}

export async function generateCpaStoryCharacterAnchor(input: StoryCharacterAnchorInput) {
  const { prompt, references } = await createStoryCharacterAnchorRequest(input);
  return requestCpaImage(prompt, references);
}

export async function generateStoryCharacterAnchor(input: StoryCharacterAnchorInput) {
  const { prompt, references } = await createStoryCharacterAnchorRequest(input);
  return requestConfiguredReferenceImage(prompt, references);
}

async function generateAgnesIllustration(
  prompt: string,
  _seed?: number,
  options?: IllustrationOptions
): Promise<string> {
  const promptText = truncateForImagePrompt(
    [
      "Create one polished children's storybook illustration.",
      "Highest priority: show a complete story scene, not a character portrait. Include environment, props, action, and emotion. Keep the main character around 25-45% of the frame, usually full body or three-quarter body. Vary pose, expression, camera angle, and crop.",
      prompt,
      options?.customCharacterReferenceToken
        ? "Use the attached reference image as the authoritative main-character identity. Preserve recognizable face shape, facial proportions, apparent age, hairstyle, hair color, skin tone, glasses, and distinctive features while changing pose and scene."
        : options?.characterReferenceId
          ? "Keep the same character identity described in the prompt: hairstyle, outfit colors, age, body proportions, and premium 3D cartoon style."
        : null,
      "No text, captions, letters, logos, watermark, scary imagery, violence, distorted hands, extra limbs, or photorealistic rendering.",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const referenceImages = await getImageToImageReferenceImages(options);
  return requestAgnesImage(promptText, referenceImages, options?.pageNumber);
}

async function requestAgnesImage(
  promptText: string,
  referenceImages: CpaReferenceImage[],
  pageNumber?: number,
) {
  const agnesKey = getAgnesKey(pageNumber);
  if (!agnesKey) throw new GenerationProviderError("configuration");
  const maxAttempts = Math.max(
    1,
    getPositiveIntegerEnv("AGNES_IMAGE_MAX_ATTEMPTS", DEFAULT_AGNES_IMAGE_MAX_ATTEMPTS)
  );
  const retryDelay = getPositiveIntegerEnv(
    "AGNES_IMAGE_RETRY_DELAY_MS",
    DEFAULT_AGNES_IMAGE_RETRY_DELAY_MS
  );
  let lastErrorClass: GenerationErrorClass = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await withAgnesImageThrottle(agnesKey.keyIndex, () =>
      fetch(AGNES_IMAGE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agnesKey.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AGNES_IMAGE_MODEL || DEFAULT_AGNES_IMAGE_MODEL,
          prompt: referenceImages.length > 0
            ? truncateForCpaPrompt([
                promptText,
                "Reference image order:",
                ...referenceImages.map((reference, index) => `Image ${index + 1}: ${reference.label}`),
              ].join(" "))
            : promptText,
          size: process.env.AGNES_IMAGE_SIZE || DEFAULT_AGNES_IMAGE_SIZE,
          ...(referenceImages.length > 0
            ? {
                return_base64: true,
                extra_body: {
                  image: referenceImages.map((reference) => reference.dataUri),
                  response_format: "b64_json",
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(
          getBoundedImageTimeoutMs("AGNES_IMAGE_TIMEOUT_MS"),
        ),
      })
    );

    const data = (await response.json().catch(() => ({}))) as AgnesImageGenerationResponse;
    if (response.ok) {
      const image = extractAgnesImage(data);
      if (image) {
        return image.startsWith("http") ? downloadImageAsDataUrl(image) : image;
      }

      lastErrorClass = "invalid_response";
    } else {
      lastErrorClass = classifyHttpStatus(response.status);
    }

    if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
      if (await waitForImageProviderRetry(
        getRetryAfterMs(response) ?? retryDelay,
        getBoundedImageTimeoutMs("AGNES_IMAGE_TIMEOUT_MS"),
      )) continue;
    }

    break;
  }

  throw new GenerationProviderError(lastErrorClass);
}

async function generateWithProvider(
  provider: ImageProvider,
  prompt: string,
  seed?: number,
  options?: IllustrationOptions
) {
  switch (provider) {
    case "dashscope":
      return generateDashScopeIllustration(prompt, seed, options);
    case "huggingface":
      return generateHuggingFaceIllustration(prompt, seed, options);
    case "agnes":
      return generateAgnesIllustration(prompt, seed, options);
    case "cpa":
    case "openai":
    case "orbitix":
      return generateCompatibleIllustration(provider, prompt, options);
    default:
      throw new GenerationProviderError("configuration");
  }
}

export async function generateIllustration(
  prompt: string,
  seed?: number,
  options?: IllustrationOptions & {
    preferredProvider?: ImageProvider;
    fallbackProviders?: ImageProvider[];
  }
): Promise<GeneratedIllustrationResult> {
  const usesReferences = hasPhotoFamilyCharacters(options) || hasCustomCharacterReference(options);
  const providers = usesReferences
    ? getImageToImageFallbackOrder(
        options?.preferredProvider || getImageToImageProviderForPage(options?.pageNumber || 1),
      )
    : getProviderFallbackOrder(options?.preferredProvider, options?.fallbackProviders);
  if (usesReferences && providers.length === 0) {
    throw new GenerationProviderError("configuration");
  }
  if (providers.length > 0) {
    const attempts: ImageAttemptMetric[] = [];
    let lastErrorClass: GenerationErrorClass = "unknown";
    for (const provider of providers) {
      const startedAt = new Date().toISOString();
      const startedMs = Date.now();
      const model = getImageProviderModel(provider);

      try {
        const imageUrl = await generateWithProvider(provider, prompt, seed, options);
        let quality: IllustrationQualityReport;
        try {
          quality = await inspectIllustrationQuality(imageUrl);
        } catch (qualityError) {
          logGenerationEvent(
            {
              operation: "illustration.quality_check",
              story: options?.storyId,
              page: options?.pageNumber,
              provider,
              model,
              status: "failed",
              attempt: options?.requestAttempt,
              retry: options?.retry,
              qualityChecked: true,
              errorClass: classifyGenerationError(qualityError),
            },
            "warn",
          );
          throw qualityError;
        }
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - startedMs;
        attempts.push({
          provider,
          model,
          status: "success",
          ...(options?.requestAttempt !== undefined
            ? { requestAttempt: options.requestAttempt }
            : {}),
          ...(options?.retry !== undefined ? { retry: options.retry } : {}),
          qualityStatus: quality.status,
          durationMs,
          startedAt,
          completedAt,
        });
        logGenerationEvent({
          operation: "illustration.provider_attempt",
          story: options?.storyId,
          page: options?.pageNumber,
          provider,
          model,
          status: "success",
          duration: durationMs,
          attempt: options?.requestAttempt,
          retry: options?.retry,
          width: quality.width,
          height: quality.height,
          qualityChecked: true,
          qualityWarnings: quality.warnings?.length || 0,
        });
        logGenerationEvent({
          operation: "illustration.quality_check",
          story: options?.storyId,
          page: options?.pageNumber,
          provider,
          model,
          status: quality.status,
          attempt: options?.requestAttempt,
          retry: options?.retry,
          width: quality.width,
          height: quality.height,
          qualityChecked: true,
          qualityWarnings: quality.warnings?.length || 0,
        });
        return {
          imageUrl,
          quality,
          provider,
          durationMs,
          startedAt,
          completedAt,
          attempts,
        };
      } catch (error) {
        lastErrorClass = classifyGenerationError(error);
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - startedMs;
        attempts.push({
          provider,
          model,
          status: "failed",
          ...(options?.requestAttempt !== undefined
            ? { requestAttempt: options.requestAttempt }
            : {}),
          ...(options?.retry !== undefined ? { retry: options.retry } : {}),
          durationMs,
          startedAt,
          completedAt,
          error: SAFE_ILLUSTRATION_ERROR,
          errorClass: lastErrorClass,
        });
        logGenerationEvent(
          {
            operation: "illustration.provider_attempt",
            story: options?.storyId,
            page: options?.pageNumber,
            provider,
            model,
            status: "failed",
            duration: durationMs,
            attempt: options?.requestAttempt,
            retry: options?.retry,
            errorClass: lastErrorClass,
          },
          "warn",
        );
      }
    }

    throw new GenerationProviderError(
      lastErrorClass,
      "All image providers failed.",
    );
  }

  if (!canUseDemoImages()) {
    throw new IllustrationGenerationError(
      "Real illustration generation is not configured: set a key for an available image provider.",
      [options?.pageNumber ?? 0],
      false
    );
  }

  return {
    imageUrl: createDemoImage(prompt, options?.pageNumber ?? 1, options?.style ?? "watercolor"),
    quality: createDemoIllustrationQualityReport(),
    attempts: [],
  };
}
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export async function generateAllIllustrations(
  pages: StoryPage[],
  characterSeed: number,
  style: IllustrationStyle,
  characterReferenceId?: string,
  familyCharacters?: FamilyCharacterInput[],
  customCharacterReferenceToken?: string,
  visualBible?: StoryVisualBible,
  referenceCacheKey?: string,
  storyId?: string,
): Promise<{ pages: StoryPage[]; mode: GenerationMode }> {
  const ordinaryProviderPlan = getProviderPlan(pages.length);
  const providerPlan = pages.map((page, index): ImageProvider | undefined => {
    const castIds = new Set(page.castIds || []);
    const usesFamilyPhoto = (familyCharacters || []).some(
      (character) =>
        castIds.has(character.id) && hasFamilyCharacterReference(character),
    );
    if (usesFamilyPhoto || customCharacterReferenceToken) {
      return getImageToImageProviderForPage(index + 1, pages.length);
    }
    return ordinaryProviderPlan[index];
  });
  if (!providerPlan.some(Boolean)) {
    if (
      customCharacterReferenceToken ||
      pages.some((page) => hasPhotoFamilyCharacters({ familyCharacters, castIds: page.castIds }))
    ) {
      throw new GenerationProviderError("configuration");
    }
    if (!canUseDemoImages()) {
      throw new IllustrationGenerationError(
        "Production must configure a real illustration provider and cannot use demo placeholder images.",
        pages.map((page) => page.page),
        false
      );
    }

    return pages.map((page) => ({
      ...page,
      imageUrl: createDemoImage(page.illustrationPrompt, page.page, style),
      imageStatus: "demo" as const,
      imageAttempts: [],
    })).reduce(
      (payload, page) => ({
        pages: [...payload.pages, page],
        mode: "demo" as const,
      }),
      { pages: [] as StoryPage[], mode: "demo" as const }
    );
  }

  const results = await mapWithConcurrency(
    pages,
    getImageConcurrency(),
    async (page, index) => {
      const preferredProvider = providerPlan[index];

      for (let attempt = 0; attempt < MAX_IMAGE_ATTEMPTS; attempt += 1) {
        try {
          const generated = await generateIllustration(
            page.illustrationPrompt,
            characterSeed + page.page * 1000 + attempt,
            {
              pageNumber: page.page,
              style,
              characterReferenceId,
              customCharacterReferenceToken,
              preferredProvider,
              familyCharacters,
              castIds: page.castIds,
              visualBible,
              referenceCacheKey,
              storyId,
            }
          );
          return {
            ...page,
            imageUrl: generated.imageUrl,
            imageStatus: "complete" as const,
            imageProvider: generated.provider,
            imagePlannedProvider: preferredProvider,
            imageStartedAt: generated.startedAt,
            imageCompletedAt: generated.completedAt,
            imageDurationMs: generated.durationMs,
            imageAttempts: generated.attempts,
          };
        } catch (error) {
          if (isRateLimitError(error) && attempt < MAX_IMAGE_ATTEMPTS - 1) {
            const retryDelay = getPositiveIntegerEnv(
              "DASHSCOPE_IMAGE_RATE_LIMIT_RETRY_MS",
              DEFAULT_RATE_LIMIT_RETRY_MS
            );
            await sleep(retryDelay);
          }
        }
      }

      return {
        ...page,
        imageStatus: "failed" as const,
        imageError: SAFE_ILLUSTRATION_ERROR,
        imagePlannedProvider: preferredProvider,
        imageAttempts: [],
      };
    }
  );

  const failedResults = results
    .filter((page) => page.imageStatus !== "complete" || !page.imageUrl)
    .map((page) => ({
      page: page.page,
      error: page.imageError || "Illustration generation failed.",
    }));
  const failedPages = failedResults.map((page) => page.page);

  if (failedPages.length > 0) {
    throw new IllustrationGenerationError(
      "Some page illustrations failed. Please retry later.",
      failedPages,
      true,
      failedResults
    );
  }

  return { pages: results, mode: "live" };
}

export async function regeneratePage(
  page: StoryPage,
  newSeed?: number,
  style: IllustrationStyle = "watercolor",
  characterReferenceId?: string,
  fallbackProviders?: ImageProvider[],
  familyCharacters?: FamilyCharacterInput[],
  customCharacterReferenceToken?: string,
  visualBible?: StoryVisualBible,
  referenceCacheKey?: string,
  storyId?: string,
): Promise<StoryPage> {
  const seed = newSeed ?? Math.floor(Math.random() * 999999);
  const castIds = new Set(page.castIds || []);
  const usesFamilyPhoto = (familyCharacters || []).some(
    (character) =>
      castIds.has(character.id) && hasFamilyCharacterReference(character),
  );
  const generated = await generateIllustration(page.illustrationPrompt, seed, {
    pageNumber: page.page,
    style,
    characterReferenceId,
    customCharacterReferenceToken,
    familyCharacters,
    castIds: page.castIds,
    visualBible,
    referenceCacheKey,
    storyId,
    requestAttempt: page.imageRequestCount,
    retry: (page.imageRetryCount || 0) > 0,
    preferredProvider: usesFamilyPhoto || customCharacterReferenceToken
      ? getImageToImageProviderForPage(page.page)
      : fallbackProviders?.length
        ? undefined
        : getProviderForPage(page.page),
    fallbackProviders:
      usesFamilyPhoto || customCharacterReferenceToken
        ? undefined
        : fallbackProviders,
  });
  return {
    ...page,
    imageUrl: generated.imageUrl,
    imageStatus: isDemoImageUrl(generated.imageUrl) ? "demo" : "complete",
    imagePlannedProvider: usesFamilyPhoto || customCharacterReferenceToken
        ? getImageToImageProviderForPage(page.page)
        : page.imagePlannedProvider ||
          (fallbackProviders?.length
            ? undefined
            : getProviderForPage(page.page)),
    imageProvider: generated.provider,
    imageStartedAt: page.imageStartedAt || generated.startedAt,
    imageCompletedAt: generated.completedAt,
    imageDurationMs: generated.durationMs,
    imageAttempts: generated.attempts,
    imageQuality: generated.quality,
    imageError: undefined,
  };
}
