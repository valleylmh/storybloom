import {
  selectActiveStorybookVersion,
  type GrowthMomentBundle,
} from "@/lib/growth-moments";
import type { GrowthRecordDraft } from "@/lib/growth-records";
import type { IllustrationStyle } from "@/types";

export const GROWTH_VERSION_QUERY_KEY = "growthVersion";
export const GROWTH_VERSION_QUERY_VALUE = "1";
export const GROWTH_VERSION_INTENT_STORAGE_KEY =
  "storybloom.growth-version.intent.v1";

const GROWTH_VERSION_INTENT_VERSION = 1 as const;
const GROWTH_VERSION_INTENT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_MOMENT_ID_LENGTH = 180;

type GrowthVersionIntentStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export interface GrowthVersionCreationIntent {
  version: typeof GROWTH_VERSION_INTENT_VERSION;
  targetMomentId: string;
  createdAt: string;
}

export interface GrowthVersionCreationPreset {
  targetMomentId: string;
  existingVersionCount: number;
  draft: GrowthRecordDraft;
  illustrationStyle: IllustrationStyle;
}

function normalizeMomentId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_MOMENT_ID_LENGTH ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function getSessionStorage(): GrowthVersionIntentStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage?: GrowthVersionIntentStorage | null) {
  return storage === undefined ? getSessionStorage() : storage;
}

function getSearchParams(input: string | URL | URLSearchParams) {
  if (input instanceof URL) return new URLSearchParams(input.search);
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const questionMark = input.indexOf("?");
  const raw = questionMark >= 0 ? input.slice(questionMark + 1) : input;
  const hashMark = raw.indexOf("#");
  return new URLSearchParams(
    (hashMark >= 0 ? raw.slice(0, hashMark) : raw).replace(/^\?/, ""),
  );
}

export function isGrowthVersionCreationRequested(
  input: string | URL | URLSearchParams,
) {
  const values = getSearchParams(input).getAll(GROWTH_VERSION_QUERY_KEY);
  return values.length === 1 && values[0] === GROWTH_VERSION_QUERY_VALUE;
}

export function getGrowthVersionCreationHref() {
  return `/?${GROWTH_VERSION_QUERY_KEY}=${GROWTH_VERSION_QUERY_VALUE}`;
}

export function writeGrowthVersionCreationIntent(
  targetMomentId: string,
  options: {
    storage?: GrowthVersionIntentStorage | null;
    now?: string;
  } = {},
) {
  const storage = resolveStorage(options.storage);
  const normalizedMomentId = normalizeMomentId(targetMomentId);
  const createdAt = normalizeTimestamp(options.now || new Date().toISOString());
  if (!storage || !normalizedMomentId || !createdAt) return null;
  const intent: GrowthVersionCreationIntent = {
    version: GROWTH_VERSION_INTENT_VERSION,
    targetMomentId: normalizedMomentId,
    createdAt,
  };
  try {
    storage.setItem(GROWTH_VERSION_INTENT_STORAGE_KEY, JSON.stringify(intent));
    return intent;
  } catch {
    return null;
  }
}

export function readGrowthVersionCreationIntent(
  options: {
    storage?: GrowthVersionIntentStorage | null;
    now?: number;
  } = {},
) {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;
  try {
    const raw = storage.getItem(GROWTH_VERSION_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<GrowthVersionCreationIntent>;
    const targetMomentId = normalizeMomentId(candidate.targetMomentId);
    const createdAt = normalizeTimestamp(candidate.createdAt);
    const now = options.now ?? Date.now();
    if (
      candidate.version !== GROWTH_VERSION_INTENT_VERSION ||
      !targetMomentId ||
      !createdAt ||
      now - Date.parse(createdAt) > GROWTH_VERSION_INTENT_TTL_MS ||
      Date.parse(createdAt) - now > 60_000
    ) {
      storage.removeItem(GROWTH_VERSION_INTENT_STORAGE_KEY);
      return null;
    }
    return {
      version: GROWTH_VERSION_INTENT_VERSION,
      targetMomentId,
      createdAt,
    } satisfies GrowthVersionCreationIntent;
  } catch {
    return null;
  }
}

export function clearGrowthVersionCreationIntent(
  options: { storage?: GrowthVersionIntentStorage | null } = {},
) {
  const storage = resolveStorage(options.storage);
  if (!storage) return false;
  try {
    storage.removeItem(GROWTH_VERSION_INTENT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createGrowthVersionCreationPreset(
  bundle: GrowthMomentBundle,
): GrowthVersionCreationPreset {
  const activeVersion = selectActiveStorybookVersion(bundle);
  const storyTreatment = activeVersion?.storyTreatment || "documentary";
  return {
    targetMomentId: bundle.moment.momentId,
    existingVersionCount: bundle.storybookVersions.length,
    illustrationStyle:
      activeVersion?.style ||
      (storyTreatment === "fairytale" ? "fairytale" : "watercolor"),
    draft: {
      version: 1,
      childKey: bundle.moment.childKey,
      childName: bundle.moment.childName,
      ...(activeVersion?.characterReferenceId
        ? { childCharacterId: activeVersion.characterReferenceId }
        : {}),
      ...(bundle.moment.childAvatarDataUrl
        ? { childAvatarDataUrl: bundle.moment.childAvatarDataUrl }
        : {}),
      occurredOn: bundle.moment.occurredOn,
      note: bundle.moment.parentNote,
      idea: bundle.moment.sourceIdea,
      photos: bundle.moment.originalAssets.map((asset) => ({
        id: asset.assetId,
        name: asset.name,
        dataUrl: asset.dataUrl,
      })),
      readingStage: activeVersion?.readingStage || "4-5",
      storyTreatment,
      ...(bundle.moment.parentFacts
        ? { parentFacts: bundle.moment.parentFacts }
        : {}),
      ...(bundle.moment.allowedImaginations
        ? { allowedImaginations: bundle.moment.allowedImaginations }
        : {}),
    },
  };
}
