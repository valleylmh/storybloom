import "server-only";

import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  DurableStorageUnavailableError,
  getStorageCapabilities,
} from "@/lib/storage";
import type { TemporaryStoryAssetPrincipal } from "@/lib/temporary-story-asset-store";
import type {
  FamilyCharacterInput,
  PersonalizationAnchorConfirmation,
  StoryCharacterVisualLock,
  StoryInput,
  StoryVisualBible,
} from "@/types";

const PAYLOAD_TTL_SECONDS = 24 * 60 * 60;
const PAYLOAD_REF_PATTERN = /^payload_[A-Za-z0-9_-]{32}$/;
const PAYLOAD_KEY_PREFIX = "storybloom:generation-job-payload:v1:";
const PAYLOAD_VERSION = 1 as const;
const MAX_PAYLOAD_DEPTH = 12;
const MAX_PAYLOAD_NODES = 512;
const MAX_PAYLOAD_BYTES = 128 * 1024;
const OPAQUE_PRINCIPAL_PATTERN = /^v1_[a-f0-9]{64}$/;
const QUOTA_RESERVATION_PATTERN = /^quota_[A-Za-z0-9_-]{12,80}$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
const REFERENCE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,96}$/;
const LIBRARY_CONTENT_ID_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AGE_GROUPS = new Set(["2-3", "4-5", "6-8"]);
const STORY_THEMES = new Set([
  "courage",
  "friendship",
  "nature",
  "family",
  "fear",
  "creativity",
  "custom",
]);
const ILLUSTRATION_STYLES = new Set(["watercolor", "cartoon", "fairytale"]);
const LANGUAGES = new Set(["zh-en", "en-zh", "zh", "en"]);
const NARRATIVE_PERSPECTIVES = new Set(["third-person", "first-person"]);
const STORY_TREATMENTS = new Set([
  "documentary",
  "warm-imagination",
  "fairytale",
]);
const PERSONALIZATION_REFERENCE_TYPES = new Set([
  "canonical",
  "source",
  "text",
]);

const CREDENTIAL_KEYS = new Set([
  "authorization",
  "apikey",
  "accesskey",
  "accesstoken",
  "refreshtoken",
  "clientsecret",
  "secretkey",
  "password",
  "credential",
  "credentials",
  "cookie",
  "setcookie",
  "privatekey",
]);
const ALLOWED_OPAQUE_TOKEN_KEYS = new Set([
  "customcharacterreferencetoken",
  "storyreferencetoken",
]);

export type TextGenerationJobPayload = {
  version: 1;
  kind: "text";
  storyInput: StoryInput;
  protagonistCharacter?: FamilyCharacterInput;
  familyCharacters: FamilyCharacterInput[];
  dailyLimit: number;
  reviewBeforeIllustrations: boolean;
  quotaReservationId: string;
  generationPrincipalIds: string[];
};

export type IllustrationGenerationJobPayload = {
  version: 1;
  kind: "illustration";
  assetPrincipals: {
    ownerPrincipal: TemporaryStoryAssetPrincipal;
    grantedPrincipal?: TemporaryStoryAssetPrincipal;
  };
  fallbackMode?: "free-fallback";
};

export type GenerationJobPayload =
  | TextGenerationJobPayload
  | IllustrationGenerationJobPayload;

type LegacyTextGenerationJobPayload = Omit<
  TextGenerationJobPayload,
  "version" | "kind"
> & { version?: never; kind?: never };

type LegacyIllustrationGenerationJobPayload = Omit<
  IllustrationGenerationJobPayload,
  "version"
> & { version?: 1 };

export type GenerationJobPayloadInput =
  | GenerationJobPayload
  | LegacyTextGenerationJobPayload
  | LegacyIllustrationGenerationJobPayload;

type PayloadBackend = { kind: "redis"; redis: Redis } | { kind: "local" };
type UnknownRecord = Record<string, unknown>;

const localPayloads = new Map<string, GenerationJobPayload>();
let redisClient: Redis | null | undefined;

export class GenerationJobPayloadValidationError extends Error {
  readonly errorClass = "invalid_response" as const;

  constructor(message = "Invalid generation job payload.") {
    super(message);
    this.name = "GenerationJobPayloadValidationError";
  }
}

function invalidPayload(detail?: string): never {
  throw new GenerationJobPayloadValidationError(
    detail ? `Invalid generation job payload: ${detail}.` : undefined,
  );
}

function configuredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function getRedis() {
  if (redisClient !== undefined) return redisClient;
  if (!getStorageCapabilities().shared) {
    redisClient = null;
    return redisClient;
  }

  const upstashUrl = configuredValue(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = configuredValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  const kvUrl = configuredValue(process.env.KV_REST_API_URL);
  const kvToken = configuredValue(process.env.KV_REST_API_TOKEN);
  const configuration = upstashUrl && upstashToken
    ? { url: upstashUrl, token: upstashToken }
    : kvUrl && kvToken
      ? { url: kvUrl, token: kvToken }
      : null;

  redisClient = configuration ? new Redis(configuration) : null;
  return redisClient;
}

function getBackend(): PayloadBackend {
  const redis = getRedis();
  if (redis) return { kind: "redis", redis };
  if (process.env.NODE_ENV === "production") {
    throw new DurableStorageUnavailableError(
      getStorageCapabilities().reason,
    );
  }
  return { kind: "local" };
}

function validatePayloadRef(payloadRef: string) {
  const normalized = payloadRef.trim();
  if (!PAYLOAD_REF_PATTERN.test(normalized)) {
    throw new Error("Invalid generation job payload reference.");
  }
  return normalized;
}

function payloadKey(payloadRef: string) {
  return `${PAYLOAD_KEY_PREFIX}${validatePayloadRef(payloadRef)}`;
}

function normalizedKeyName(key: string) {
  return key.replace(/[-_]/g, "").toLowerCase();
}

function rejectsSensitiveString(value: string) {
  return (
    /(?:^|[\s"'])data:[a-z][a-z0-9.+-]*\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(
      value,
    ) ||
    /(?:^|[\s"'])blob:/i.test(value) ||
    /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i.test(value) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value) ||
    /\b(?:sk|rk|pk)-(?:live|test)?-?[A-Za-z0-9_-]{20,}\b/i.test(value) ||
    /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/i.test(value) ||
    /\bAKIA[A-Z0-9]{16}\b/.test(value) ||
    /\bAIza[0-9A-Za-z_-]{30,}\b/.test(value) ||
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*[^\s,;]{8,}/i.test(
      value,
    ) ||
    /[?&](?:api[_-]?key|access[_-]?token|token|signature|x-amz-signature)=[^&#\s]+/i.test(
      value,
    ) ||
    /(?:^|[^A-Za-z0-9+/])[A-Za-z0-9+/]{2048,}={0,2}(?:$|[^A-Za-z0-9+/])/i.test(
      value,
    )
  );
}

function inspectPayloadValue(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
  budget: { nodes: number },
) {
  budget.nodes += 1;
  if (budget.nodes > MAX_PAYLOAD_NODES) {
    invalidPayload("too many values");
  }
  if (depth > MAX_PAYLOAD_DEPTH) {
    invalidPayload("maximum depth exceeded");
  }

  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (rejectsSensitiveString(value)) {
      throw new GenerationJobPayloadValidationError(
        "Generation job payload contains embedded private data or credentials.",
      );
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalidPayload("non-finite number");
    return;
  }
  if (typeof value === "boolean") return;
  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    invalidPayload("non-JSON value");
  }
  if (typeof value !== "object") invalidPayload("unsupported value");

  const objectValue = value as object;
  if (ancestors.has(objectValue)) invalidPayload("cyclic value");
  const prototype = Object.getPrototypeOf(objectValue);
  if (
    !Array.isArray(objectValue) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    invalidPayload("non-plain object");
  }

  ancestors.add(objectValue);
  const ownKeys = Reflect.ownKeys(objectValue);
  if (ownKeys.some((key) => typeof key !== "string")) {
    invalidPayload("symbol property");
  }
  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (!descriptor) invalidPayload("property descriptor");
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
      invalidPayload("accessor property");
    }
    const normalizedKey = normalizedKeyName(key);
    if (
      CREDENTIAL_KEYS.has(normalizedKey) &&
      !ALLOWED_OPAQUE_TOKEN_KEYS.has(normalizedKey)
    ) {
      throw new GenerationJobPayloadValidationError(
        "Generation job payload contains embedded private data or credentials.",
      );
    }
    inspectPayloadValue(descriptor.value, depth + 1, ancestors, budget);
  }
  ancestors.delete(objectValue);
}

function asRecord(value: unknown, label: string): UnknownRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    invalidPayload(label);
  }
  return value as UnknownRecord;
}

function assertAllowedKeys(
  record: UnknownRecord,
  allowedKeys: readonly string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    invalidPayload(`${label} fields`);
  }
}

function requiredString(
  record: UnknownRecord,
  key: string,
  options: { min?: number; max: number; pattern?: RegExp },
) {
  const value = record[key];
  const min = options.min ?? 0;
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > options.max ||
    (options.pattern && !options.pattern.test(value))
  ) {
    invalidPayload(key);
  }
  return value;
}

function optionalString(
  record: UnknownRecord,
  key: string,
  options: { min?: number; max: number; pattern?: RegExp },
) {
  if (record[key] === undefined) return undefined;
  return requiredString(record, key, options);
}

function requiredEnum<T extends string>(
  record: UnknownRecord,
  key: string,
  values: Set<string>,
) {
  const value = record[key];
  if (typeof value !== "string" || !values.has(value)) invalidPayload(key);
  return value as T;
}

function optionalEnum<T extends string>(
  record: UnknownRecord,
  key: string,
  values: Set<string>,
) {
  if (record[key] === undefined) return undefined;
  return requiredEnum<T>(record, key, values);
}

function optionalBoolean(record: UnknownRecord, key: string) {
  if (record[key] === undefined) return undefined;
  if (typeof record[key] !== "boolean") invalidPayload(key);
  return record[key] as boolean;
}

function safePrivateAssetPath(record: UnknownRecord, key: string) {
  const value = optionalString(record, key, { min: 1, max: 500 });
  if (
    value &&
    (value.startsWith("/") ||
      value.includes("\\") ||
      value.split("/").includes("..") ||
      /^[a-z][a-z0-9+.-]*:/i.test(value))
  ) {
    invalidPayload(key);
  }
  return value;
}

function parseFamilyCharacter(value: unknown): FamilyCharacterInput {
  const record = asRecord(value, "family character");
  assertAllowedKeys(
    record,
    [
      "id",
      "name",
      "relation",
      "appearance",
      "referenceAssetPath",
      "sourceReferenceAssetPath",
      "canonicalReferenceAssetPath",
      "storyReferenceToken",
      "isProtagonist",
    ],
    "family character",
  );
  const character: FamilyCharacterInput = {
    id: requiredString(record, "id", {
      min: 1,
      max: 120,
      pattern: SAFE_IDENTIFIER_PATTERN,
    }),
    name: requiredString(record, "name", { min: 1, max: 80 }),
    relation: requiredString(record, "relation", { min: 1, max: 80 }),
    appearance: requiredString(record, "appearance", { min: 1, max: 1_200 }),
  };
  const referenceAssetPath = safePrivateAssetPath(record, "referenceAssetPath");
  const sourceReferenceAssetPath = safePrivateAssetPath(
    record,
    "sourceReferenceAssetPath",
  );
  const canonicalReferenceAssetPath = safePrivateAssetPath(
    record,
    "canonicalReferenceAssetPath",
  );
  const storyReferenceToken = optionalString(record, "storyReferenceToken", {
    max: 96,
    pattern: REFERENCE_TOKEN_PATTERN,
  });
  const isProtagonist = optionalBoolean(record, "isProtagonist");
  if (referenceAssetPath !== undefined) character.referenceAssetPath = referenceAssetPath;
  if (sourceReferenceAssetPath !== undefined) {
    character.sourceReferenceAssetPath = sourceReferenceAssetPath;
  }
  if (canonicalReferenceAssetPath !== undefined) {
    character.canonicalReferenceAssetPath = canonicalReferenceAssetPath;
  }
  if (storyReferenceToken !== undefined) {
    character.storyReferenceToken = storyReferenceToken;
  }
  if (isProtagonist !== undefined) character.isProtagonist = isProtagonist;
  return character;
}

function parseFamilyCharacters(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 8) invalidPayload(label);
  const characters = value.map(parseFamilyCharacter);
  if (new Set(characters.map((character) => character.id)).size !== characters.length) {
    invalidPayload(`${label} duplicate ids`);
  }
  return characters;
}

function parseVisualCharacter(value: unknown): StoryCharacterVisualLock {
  const record = asRecord(value, "visual character");
  assertAllowedKeys(
    record,
    ["id", "name", "identityLock", "outfitLock", "referenceGuidance"],
    "visual character",
  );
  return {
    id: requiredString(record, "id", {
      min: 1,
      max: 120,
      pattern: SAFE_IDENTIFIER_PATTERN,
    }),
    name: requiredString(record, "name", { min: 1, max: 80 }),
    identityLock: requiredString(record, "identityLock", { min: 1, max: 4_000 }),
    outfitLock: requiredString(record, "outfitLock", { min: 1, max: 4_000 }),
    referenceGuidance: requiredString(record, "referenceGuidance", {
      min: 1,
      max: 4_000,
    }),
  };
}

function parseVisualBible(value: unknown): StoryVisualBible {
  const record = asRecord(value, "visual bible");
  assertAllowedKeys(
    record,
    [
      "version",
      "seriesStyleLock",
      "paletteLock",
      "continuityPolicy",
      "characters",
    ],
    "visual bible",
  );
  if (record.version !== 1) invalidPayload("visual bible version");
  if (!Array.isArray(record.characters) || record.characters.length > 8) {
    invalidPayload("visual bible characters");
  }
  const characters = record.characters.map(parseVisualCharacter);
  if (new Set(characters.map((character) => character.id)).size !== characters.length) {
    invalidPayload("visual bible duplicate ids");
  }
  return {
    version: 1,
    seriesStyleLock: requiredString(record, "seriesStyleLock", {
      min: 1,
      max: 4_000,
    }),
    paletteLock: requiredString(record, "paletteLock", { min: 1, max: 4_000 }),
    continuityPolicy: requiredString(record, "continuityPolicy", {
      min: 1,
      max: 4_000,
    }),
    characters,
  };
}

function parsePersonalizationAnchor(
  value: unknown,
): PersonalizationAnchorConfirmation {
  const record = asRecord(value, "personalization anchor");
  assertAllowedKeys(
    record,
    [
      "version",
      "displayName",
      "relationship",
      "appearance",
      "referenceType",
      "characterId",
      "storyReferenceToken",
      "confirmedAt",
    ],
    "personalization anchor",
  );
  if (record.version !== 1) invalidPayload("personalization anchor version");
  const confirmedAt = requiredString(record, "confirmedAt", {
    min: 20,
    max: 40,
  });
  if (!Number.isFinite(Date.parse(confirmedAt))) {
    invalidPayload("personalization anchor confirmedAt");
  }
  const characterId = optionalString(record, "characterId", {
    min: 36,
    max: 36,
    pattern: UUID_PATTERN,
  });
  const storyReferenceToken = optionalString(
    record,
    "storyReferenceToken",
    { min: 32, max: 96, pattern: REFERENCE_TOKEN_PATTERN },
  );
  return {
    version: 1,
    displayName: requiredString(record, "displayName", { min: 1, max: 80 }),
    relationship: requiredString(record, "relationship", { min: 1, max: 80 }),
    appearance: requiredString(record, "appearance", { min: 1, max: 1_200 }),
    referenceType: requiredEnum(
      record,
      "referenceType",
      PERSONALIZATION_REFERENCE_TYPES,
    ),
    ...(characterId ? { characterId } : {}),
    ...(storyReferenceToken ? { storyReferenceToken } : {}),
    confirmedAt,
  };
}

function parseStoryInput(value: unknown): StoryInput {
  const record = asRecord(value, "storyInput");
  assertAllowedKeys(
    record,
    [
      "childName",
      "narrativePerspective",
      "protagonistFamilyCharacterId",
      "ageGroup",
      "favoriteToy",
      "favoriteFood",
      "bestFriend",
      "otherDetails",
      "theme",
      "customTheme",
      "parentFacts",
      "allowedImaginations",
      "storyTreatment",
      "style",
      "language",
      "characterReferenceId",
      "characterReferenceLabel",
      "characterReferencePrompt",
      "customCharacterReferenceToken",
      "characterDescription",
      "dedication",
      "sourceLibraryBookId",
      "personalizationDraftId",
      "personalizationAnchor",
      "familyCharacters",
      "visualBible",
    ],
    "storyInput",
  );
  const input: StoryInput = {
    childName: requiredString(record, "childName", { min: 1, max: 20 }),
    ageGroup: requiredEnum(record, "ageGroup", AGE_GROUPS),
    theme: requiredEnum(record, "theme", STORY_THEMES),
    style: requiredEnum(record, "style", ILLUSTRATION_STYLES),
    language: requiredEnum(record, "language", LANGUAGES),
  };

  const narrativePerspective = optionalEnum<StoryInput["narrativePerspective"] & string>(
    record,
    "narrativePerspective",
    NARRATIVE_PERSPECTIVES,
  );
  const protagonistFamilyCharacterId = optionalString(
    record,
    "protagonistFamilyCharacterId",
    { min: 1, max: 120, pattern: SAFE_IDENTIFIER_PATTERN },
  );
  const favoriteToy = optionalString(record, "favoriteToy", { max: 80 });
  const favoriteFood = optionalString(record, "favoriteFood", { max: 80 });
  const bestFriend = optionalString(record, "bestFriend", { max: 80 });
  const otherDetails = optionalString(record, "otherDetails", { max: 200 });
  const customTheme = optionalString(record, "customTheme", { max: 100 });
  const parentFacts = optionalString(record, "parentFacts", { max: 300 });
  const allowedImaginations = optionalString(record, "allowedImaginations", {
    max: 300,
  });
  const storyTreatment = optionalEnum<StoryInput["storyTreatment"] & string>(
    record,
    "storyTreatment",
    STORY_TREATMENTS,
  );
  const characterReferenceId = optionalString(record, "characterReferenceId", {
    max: 80,
  });
  const characterReferenceLabel = optionalString(
    record,
    "characterReferenceLabel",
    { max: 80 },
  );
  const characterReferencePrompt = optionalString(
    record,
    "characterReferencePrompt",
    { max: 800 },
  );
  const customCharacterReferenceToken = optionalString(
    record,
    "customCharacterReferenceToken",
    { max: 96, pattern: REFERENCE_TOKEN_PATTERN },
  );
  const characterDescription = optionalString(record, "characterDescription", {
    max: 1_200,
  });
  const dedication = optionalString(record, "dedication", { max: 100 });
  const sourceLibraryBookId = optionalString(record, "sourceLibraryBookId", {
    min: 3,
    max: 160,
    pattern: LIBRARY_CONTENT_ID_PATTERN,
  });
  const personalizationDraftId = optionalString(
    record,
    "personalizationDraftId",
    { min: 36, max: 36, pattern: UUID_PATTERN },
  );

  if (narrativePerspective !== undefined) input.narrativePerspective = narrativePerspective;
  if (protagonistFamilyCharacterId !== undefined) {
    input.protagonistFamilyCharacterId = protagonistFamilyCharacterId;
  }
  if (favoriteToy !== undefined) input.favoriteToy = favoriteToy;
  if (favoriteFood !== undefined) input.favoriteFood = favoriteFood;
  if (bestFriend !== undefined) input.bestFriend = bestFriend;
  if (otherDetails !== undefined) input.otherDetails = otherDetails;
  if (customTheme !== undefined) input.customTheme = customTheme;
  if (parentFacts !== undefined) input.parentFacts = parentFacts;
  if (allowedImaginations !== undefined) input.allowedImaginations = allowedImaginations;
  if (storyTreatment !== undefined) input.storyTreatment = storyTreatment;
  if (characterReferenceId !== undefined) input.characterReferenceId = characterReferenceId;
  if (characterReferenceLabel !== undefined) {
    input.characterReferenceLabel = characterReferenceLabel;
  }
  if (characterReferencePrompt !== undefined) {
    input.characterReferencePrompt = characterReferencePrompt;
  }
  if (customCharacterReferenceToken !== undefined) {
    input.customCharacterReferenceToken = customCharacterReferenceToken;
  }
  if (characterDescription !== undefined) input.characterDescription = characterDescription;
  if (dedication !== undefined) input.dedication = dedication;
  if (sourceLibraryBookId !== undefined) {
    input.sourceLibraryBookId = sourceLibraryBookId;
  }
  if (personalizationDraftId !== undefined) {
    input.personalizationDraftId = personalizationDraftId;
  }
  if (record.personalizationAnchor !== undefined) {
    input.personalizationAnchor = parsePersonalizationAnchor(
      record.personalizationAnchor,
    );
  }
  if (record.familyCharacters !== undefined) {
    input.familyCharacters = parseFamilyCharacters(
      record.familyCharacters,
      "storyInput familyCharacters",
    );
  }
  if (record.visualBible !== undefined) {
    input.visualBible = parseVisualBible(record.visualBible);
  }
  return input;
}

function isOpaquePrincipal(principal: unknown): principal is TemporaryStoryAssetPrincipal {
  if (!principal || typeof principal !== "object" || Array.isArray(principal)) {
    return false;
  }
  const record = principal as UnknownRecord;
  return (
    Object.keys(record).every((key) => key === "type" || key === "id") &&
    (record.type === "anonymous" || record.type === "user") &&
    typeof record.id === "string" &&
    OPAQUE_PRINCIPAL_PATTERN.test(record.id)
  );
}

function parseTextPayload(record: UnknownRecord): TextGenerationJobPayload {
  assertAllowedKeys(
    record,
    [
      "version",
      "kind",
      "storyInput",
      "protagonistCharacter",
      "familyCharacters",
      "dailyLimit",
      "reviewBeforeIllustrations",
      "quotaReservationId",
      "generationPrincipalIds",
    ],
    "text payload",
  );
  const storyInput = parseStoryInput(record.storyInput);
  const familyCharacters = parseFamilyCharacters(
    record.familyCharacters,
    "familyCharacters",
  );
  const protagonistCharacter = record.protagonistCharacter === undefined
    ? undefined
    : parseFamilyCharacter(record.protagonistCharacter);
  if (
    protagonistCharacter &&
    !familyCharacters.some((character) => character.id === protagonistCharacter.id)
  ) {
    invalidPayload("protagonist character binding");
  }
  if (
    storyInput.protagonistFamilyCharacterId &&
    !familyCharacters.some(
      (character) => character.id === storyInput.protagonistFamilyCharacterId,
    )
  ) {
    invalidPayload("story protagonist binding");
  }
  if (
    storyInput.familyCharacters &&
    JSON.stringify(storyInput.familyCharacters) !== JSON.stringify(familyCharacters)
  ) {
    invalidPayload("family character binding");
  }

  const dailyLimit = record.dailyLimit;
  if (
    typeof dailyLimit !== "number" ||
    !Number.isSafeInteger(dailyLimit) ||
    dailyLimit < 1 ||
    dailyLimit > 1_000_000
  ) {
    invalidPayload("dailyLimit");
  }
  if (typeof record.reviewBeforeIllustrations !== "boolean") {
    invalidPayload("reviewBeforeIllustrations");
  }
  const quotaReservationId = requiredString(record, "quotaReservationId", {
    max: 86,
    pattern: QUOTA_RESERVATION_PATTERN,
  });
  if (
    !Array.isArray(record.generationPrincipalIds) ||
    record.generationPrincipalIds.length === 0 ||
    record.generationPrincipalIds.length > 4 ||
    !record.generationPrincipalIds.every(
      (id) => typeof id === "string" && OPAQUE_PRINCIPAL_PATTERN.test(id),
    ) ||
    new Set(record.generationPrincipalIds).size !==
      record.generationPrincipalIds.length
  ) {
    invalidPayload("generationPrincipalIds");
  }

  return {
    version: PAYLOAD_VERSION,
    kind: "text",
    storyInput,
    ...(protagonistCharacter ? { protagonistCharacter } : {}),
    familyCharacters,
    dailyLimit,
    reviewBeforeIllustrations: record.reviewBeforeIllustrations,
    quotaReservationId,
    generationPrincipalIds: [...record.generationPrincipalIds] as string[],
  };
}

function parseIllustrationPayload(
  record: UnknownRecord,
): IllustrationGenerationJobPayload {
  assertAllowedKeys(
    record,
    ["version", "kind", "assetPrincipals", "fallbackMode"],
    "illustration payload",
  );
  const assetPrincipals = asRecord(record.assetPrincipals, "assetPrincipals");
  assertAllowedKeys(
    assetPrincipals,
    ["ownerPrincipal", "grantedPrincipal"],
    "assetPrincipals",
  );
  if (
    !isOpaquePrincipal(assetPrincipals.ownerPrincipal) ||
    (assetPrincipals.grantedPrincipal !== undefined &&
      !isOpaquePrincipal(assetPrincipals.grantedPrincipal)) ||
    (record.fallbackMode !== undefined &&
      record.fallbackMode !== "free-fallback")
  ) {
    invalidPayload("illustration fields");
  }
  return {
    version: PAYLOAD_VERSION,
    kind: "illustration",
    assetPrincipals: {
      ownerPrincipal: { ...assetPrincipals.ownerPrincipal },
      ...(assetPrincipals.grantedPrincipal
        ? { grantedPrincipal: { ...assetPrincipals.grantedPrincipal } }
        : {}),
    },
    ...(record.fallbackMode === "free-fallback"
      ? { fallbackMode: "free-fallback" as const }
      : {}),
  };
}

function parseGenerationJobPayload(
  value: unknown,
  options: { allowLegacy: boolean },
): GenerationJobPayload {
  inspectPayloadValue(value, 0, new Set(), { nodes: 0 });
  const record = asRecord(value, "root");
  if (record.version !== undefined && record.version !== PAYLOAD_VERSION) {
    invalidPayload("version");
  }
  if (!options.allowLegacy && record.version !== PAYLOAD_VERSION) {
    invalidPayload("version");
  }

  let payload: GenerationJobPayload;
  if (record.kind === "illustration") {
    payload = parseIllustrationPayload(record);
  } else if (
    record.kind === "text" ||
    (options.allowLegacy &&
      record.kind === undefined &&
      record.version === undefined)
  ) {
    payload = parseTextPayload(record);
  } else {
    invalidPayload("kind");
  }

  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength > MAX_PAYLOAD_BYTES) {
    invalidPayload("maximum size exceeded");
  }
  return payload;
}

function clonePayload<T extends GenerationJobPayload>(payload: T): T {
  return structuredClone(payload);
}

export function isIllustrationGenerationJobPayload(
  payload: unknown,
): payload is IllustrationGenerationJobPayload {
  try {
    return (
      parseGenerationJobPayload(payload, { allowLegacy: false }).kind ===
      "illustration"
    );
  } catch {
    return false;
  }
}

export function isTextGenerationJobPayload(
  payload: unknown,
): payload is TextGenerationJobPayload {
  try {
    return parseGenerationJobPayload(payload, { allowLegacy: false }).kind === "text";
  } catch {
    return false;
  }
}

export function getGenerationJobPayloadCapabilities() {
  return {
    shared: Boolean(getRedis()),
    productionReady: Boolean(getRedis()),
    adapter: getRedis() ? ("redis" as const) : ("local" as const),
  };
}

export function createGenerationJobPayloadRef() {
  return `payload_${crypto.randomBytes(24).toString("base64url")}`;
}

export async function putGenerationJobPayload(
  payload: GenerationJobPayloadInput,
  payloadRef = createGenerationJobPayloadRef(),
) {
  const normalizedRef = validatePayloadRef(payloadRef);
  const normalizedPayload = parseGenerationJobPayload(payload, {
    allowLegacy: true,
  });
  const backend = getBackend();
  if (backend.kind === "redis") {
    await backend.redis.set(
      payloadKey(normalizedRef),
      clonePayload(normalizedPayload),
      { ex: PAYLOAD_TTL_SECONDS },
    );
  } else {
    localPayloads.set(normalizedRef, clonePayload(normalizedPayload));
  }
  return normalizedRef;
}

export async function getGenerationJobPayload(payloadRef: string) {
  const normalizedRef = validatePayloadRef(payloadRef);
  const backend = getBackend();
  if (backend.kind === "redis") {
    const value = await backend.redis.get<unknown>(payloadKey(normalizedRef));
    return value === null || value === undefined
      ? null
      : clonePayload(
          parseGenerationJobPayload(value, {
            allowLegacy: true,
          }),
        );
  }
  const value = localPayloads.get(normalizedRef);
  return value
    ? clonePayload(
        parseGenerationJobPayload(value, {
          allowLegacy: true,
        }),
      )
    : null;
}

export async function deleteGenerationJobPayload(payloadRef: string) {
  const normalizedRef = validatePayloadRef(payloadRef);
  const backend = getBackend();
  if (backend.kind === "redis") {
    return (await backend.redis.del(payloadKey(normalizedRef))) > 0;
  }
  return localPayloads.delete(normalizedRef);
}

export const GENERATION_JOB_PAYLOAD_TTL_SECONDS = PAYLOAD_TTL_SECONDS;
export const GENERATION_JOB_PAYLOAD_VERSION = PAYLOAD_VERSION;
