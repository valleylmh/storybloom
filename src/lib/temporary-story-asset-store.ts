import "server-only";

import crypto from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { logGenerationEvent } from "@/lib/generation-observability";
import { resolveTemporaryStoryAssetBackendConfiguration } from "@/lib/temporary-story-asset-config";

const TEMPORARY_ASSET_VERSION = 1 as const;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CONFIGURABLE_IMAGE_BYTES = 16 * 1024 * 1024;
const DEFAULT_ORPHAN_CLEANUP_GRACE_SECONDS = 60 * 60;
const MAX_ORPHAN_CLEANUP_GRACE_SECONDS = 24 * 60 * 60;
const DEFAULT_SHARED_SWEEP_LIMIT = 100;
const MAX_SHARED_SWEEP_LIMIT = 500;
const ORPHAN_GRACE_MS = 5 * 60 * 1000;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const STORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_STATIC_PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const DEMO_SVG_MARKER = "StoryBloom%20Demo";

export const TEMPORARY_STORY_ASSET_URL_PREFIX = "/api/story-assets/";

export type TemporaryStoryAssetContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type TemporaryStoryAssetPrincipal = {
  type: "user" | "anonymous";
  id: string;
};

export type TemporaryStoryAssetState = "pending" | "committed";

type TemporaryStoryAssetMetadataState =
  | "uploading"
  | TemporaryStoryAssetState
  | "cleanup";

type TemporaryStoryAssetExtension = "jpg" | "png" | "webp";

type TemporaryStoryAssetMetadata = {
  version: typeof TEMPORARY_ASSET_VERSION;
  revision: number;
  assetId: string;
  storyId: string;
  page: number;
  attemptId?: string;
  principalHash: string;
  leaseHash: string;
  grantedPrincipalHashes: string[];
  state: TemporaryStoryAssetMetadataState;
  contentType: TemporaryStoryAssetContentType;
  extension: TemporaryStoryAssetExtension;
  byteSize: number;
  sha256: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  cleanupAt?: number;
};

type RedisTemporaryStoryAssetMetadata = Omit<
  TemporaryStoryAssetMetadata,
  "extension"
>;

export type TemporaryStoryAssetCapabilities = {
  bytesBackend: "local-file" | "supabase-private";
  metadataBackend: "local-file" | "local-file+redis" | "redis";
  localFile: boolean;
  redisMetadataConfigured: boolean;
  shared: boolean;
  /** Configuration is sufficient to attempt shared private asset operations. */
  configurationReady: boolean;
  /** Offline checks cannot verify the deployed bucket/privacy/role contract. */
  productionVerified: false;
  /** @deprecated Alias for configurationReady; it is not a production probe. */
  productionReady: boolean;
  reason:
    | null
    | "shared_bytes_backend_unavailable"
    | "redis_configuration_incomplete"
    | "temporary_asset_configuration_invalid";
};

export type StoredTemporaryStoryAsset = {
  kind: "stored";
  assetId: string;
  lease: string;
  imageUrl: string;
  storyId: string;
  page: number;
  state: "pending";
  contentType: TemporaryStoryAssetContentType;
  byteSize: number;
  sha256: string;
  createdAt: number;
  expiresAt: number;
};

export type PassthroughTemporaryStoryAsset = {
  kind: "passthrough";
  imageUrl: string;
  reason: "demo-svg" | "static-path";
};

export type PutTemporaryStoryAssetResult =
  | StoredTemporaryStoryAsset
  | PassthroughTemporaryStoryAsset;

export type ReadTemporaryStoryAssetResult = {
  assetId: string;
  storyId: string;
  page: number;
  attemptId?: string;
  state: TemporaryStoryAssetState;
  contentType: TemporaryStoryAssetContentType;
  byteSize: number;
  sha256: string;
  etag: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  bytes: Buffer;
};

export type TemporaryStoryAssetSweepResult = {
  deletedExpiredAssets: number;
  deletedOrphans: number;
  deletedTemporaryFiles: number;
  retainedForCleanupGrace?: number;
  cleanupFailures: number;
};

export type TemporaryStoryAssetErrorCode =
  | "TEMP_ASSET_INVALID_SOURCE"
  | "TEMP_ASSET_INVALID_INPUT"
  | "TEMP_ASSET_STORAGE_UNAVAILABLE"
  | "TEMP_ASSET_STORAGE_NOT_DURABLE";

export class TemporaryStoryAssetError extends Error {
  readonly code: TemporaryStoryAssetErrorCode;

  constructor(code: TemporaryStoryAssetErrorCode, message: string) {
    super(message);
    this.name = "TemporaryStoryAssetError";
    this.code = code;
  }
}

type RedisConfiguration =
  | { status: "ready"; url: string; token: string }
  | { status: "missing" }
  | { status: "invalid" };

const assetMutationQueues = new Map<string, Promise<unknown>>();
let redisMetadataClient: Redis | null | undefined;

function readConfiguredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function resolveRedisConfiguration(): RedisConfiguration {
  const upstashUrl = readConfiguredValue(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = readConfiguredValue(
    process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  const kvUrl = readConfiguredValue(process.env.KV_REST_API_URL);
  const kvToken = readConfiguredValue(process.env.KV_REST_API_TOKEN);

  const upstashPartial = Boolean(upstashUrl) !== Boolean(upstashToken);
  const kvPartial = Boolean(kvUrl) !== Boolean(kvToken);
  const bothFamiliesConfigured = Boolean(
    upstashUrl && upstashToken && kvUrl && kvToken,
  );
  if (upstashPartial || kvPartial || bothFamiliesConfigured) {
    return { status: "invalid" };
  }
  if (upstashUrl && upstashToken) {
    return { status: "ready", url: upstashUrl, token: upstashToken };
  }
  if (kvUrl && kvToken) {
    return { status: "ready", url: kvUrl, token: kvToken };
  }
  return { status: "missing" };
}

function getRedisMetadataClient() {
  if (redisMetadataClient !== undefined) return redisMetadataClient;
  const configuration = resolveRedisConfiguration();
  redisMetadataClient =
    configuration.status === "ready"
      ? new Redis({ url: configuration.url, token: configuration.token })
      : null;
  return redisMetadataClient;
}

export function getTemporaryStoryAssetCapabilities(): TemporaryStoryAssetCapabilities {
  const redis = resolveRedisConfiguration();
  const backend = resolveTemporaryStoryAssetBackendConfiguration();
  if (backend.status === "ready" && backend.shared) {
    const ready = redis.status === "ready";
    return {
      bytesBackend: "supabase-private",
      metadataBackend: "redis",
      localFile: false,
      redisMetadataConfigured: ready,
      shared: ready,
      configurationReady: ready,
      productionVerified: false,
      productionReady: ready,
      reason: ready ? null : "redis_configuration_incomplete",
    };
  }
  return {
    bytesBackend: "local-file",
    metadataBackend:
      redis.status === "ready" ? "local-file+redis" : "local-file",
    localFile: true,
    redisMetadataConfigured: redis.status === "ready",
    shared: false,
    configurationReady: false,
    productionVerified: false,
    productionReady: false,
    reason:
      backend.status === "invalid"
        ? "temporary_asset_configuration_invalid"
        : redis.status === "invalid"
        ? "redis_configuration_incomplete"
        : "shared_bytes_backend_unavailable",
  };
}

export function requireDurableTemporaryStoryAssetStorage() {
  if (getTemporaryStoryAssetCapabilities().configurationReady) return;
  const error = new TemporaryStoryAssetError(
    "TEMP_ASSET_STORAGE_NOT_DURABLE",
    "Shared temporary story asset storage is not configured. Production requires private shared bytes storage and shared Redis metadata.",
  );
  throw error;
}

/**
 * The first implementation intentionally has no shared bytes backend. Real
 * image ingestion therefore fails closed in production (and whenever
 * `requireDurable` is requested). A future route must not bypass this guard;
 * it may enable production ingestion only after capabilities.shared becomes
 * true for a shared private bytes backend.
 */

function getPositiveIntegerEnvironmentValue(
  name: string,
  fallback: number,
  maximum: number,
) {
  const configured = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, maximum)
    : fallback;
}

export function getTemporaryStoryAssetLimits() {
  return {
    ttlSeconds: getPositiveIntegerEnvironmentValue(
      "STORYBLOOM_TEMP_ASSET_TTL_SECONDS",
      DEFAULT_TTL_SECONDS,
      MAX_TTL_SECONDS,
    ),
    maxImageBytes: getPositiveIntegerEnvironmentValue(
      "STORYBLOOM_TEMP_ASSET_MAX_BYTES",
      DEFAULT_MAX_IMAGE_BYTES,
      MAX_CONFIGURABLE_IMAGE_BYTES,
    ),
    orphanCleanupGraceSeconds: getPositiveIntegerEnvironmentValue(
      "STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS",
      DEFAULT_ORPHAN_CLEANUP_GRACE_SECONDS,
      MAX_ORPHAN_CLEANUP_GRACE_SECONDS,
    ),
    sharedSweepLimit: getPositiveIntegerEnvironmentValue(
      "STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT",
      DEFAULT_SHARED_SWEEP_LIMIT,
      MAX_SHARED_SWEEP_LIMIT,
    ),
  };
}

function getTemporaryStoryAssetDirectory() {
  const configured = process.env.STORYBLOOM_TEMP_ASSET_DIR?.trim();
  if (configured) return path.resolve(configured);

  const cacheRoot =
    process.env.STORYBLOOM_CACHE_DIR?.trim() ||
    path.join(
      process.env.VERCEL ? os.tmpdir() : process.cwd(),
      ".storybloom-cache",
    );
  return path.join(cacheRoot, "story-assets");
}

function validateAssetId(assetId: string) {
  const normalized = assetId.trim();
  return ASSET_ID_PATTERN.test(normalized) ? normalized : null;
}

function validateStoryId(storyId: string) {
  const normalized = storyId.trim();
  if (!STORY_ID_PATTERN.test(normalized)) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset story id is invalid.",
    );
  }
  return normalized;
}

function validatePage(page: number) {
  if (!Number.isInteger(page) || page < 1 || page > 16) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset page is invalid.",
    );
  }
  return page;
}

function validateAttemptId(attemptId: string | undefined) {
  if (attemptId === undefined) return undefined;
  const normalized = attemptId.trim();
  if (!ATTEMPT_ID_PATTERN.test(normalized)) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset attempt id is invalid.",
    );
  }
  return normalized;
}

function normalizePrincipal(principal: TemporaryStoryAssetPrincipal) {
  if (
    !principal ||
    (principal.type !== "user" && principal.type !== "anonymous") ||
    typeof principal.id !== "string"
  ) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset principal is invalid.",
    );
  }
  const id = principal.id.trim();
  if (!id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id)) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset principal is invalid.",
    );
  }
  return { type: principal.type, id };
}

function hashPrincipal(principal: TemporaryStoryAssetPrincipal) {
  const normalized = normalizePrincipal(principal);
  return crypto
    .createHash("sha256")
    .update(`${normalized.type}:${normalized.id}`)
    .digest("hex");
}

function hashLease(lease: string) {
  return crypto.createHash("sha256").update(lease).digest("hex");
}

function safeHashEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function normalizeNow(now?: number) {
  const value = now ?? Date.now();
  if (!Number.isFinite(value) || value < 0) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset timestamp is invalid.",
    );
  }
  return Math.floor(value);
}

function normalizeTtlSeconds(ttlSeconds?: number) {
  const configured = ttlSeconds ?? getTemporaryStoryAssetLimits().ttlSeconds;
  if (!Number.isFinite(configured) || configured <= 0) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset TTL is invalid.",
    );
  }
  return Math.min(Math.floor(configured), MAX_TTL_SECONDS);
}

function extensionForContentType(
  contentType: TemporaryStoryAssetContentType,
): TemporaryStoryAssetExtension {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

function isPng(bytes: Buffer) {
  return (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ) &&
    bytes.subarray(12, 16).toString("ascii") === "IHDR"
  );
}

function isJpeg(bytes: Buffer) {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}

function isWebp(bytes: Buffer) {
  if (
    bytes.length < 16 ||
    bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
    bytes.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return false;
  }
  const chunkType = bytes.subarray(12, 16).toString("ascii");
  return (
    bytes.readUInt32LE(4) + 8 === bytes.length &&
    (chunkType === "VP8 " || chunkType === "VP8L" || chunkType === "VP8X")
  );
}

function detectContentType(bytes: Buffer): TemporaryStoryAssetContentType | null {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  return null;
}

function decodeStrictBase64(value: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 === 1) {
    return null;
  }
  const unpadded = value.replace(/=+$/, "");
  const padded = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, "=");
  const bytes = Buffer.from(padded, "base64");
  return bytes.toString("base64").replace(/=+$/, "") === unpadded
    ? bytes
    : null;
}

/**
 * Performs strict base64, byte-size, MIME and container-signature validation.
 * It does not decode image pixels or enforce width/height limits. Before a
 * browser route accepts arbitrary client images, add bounded image decoding
 * (for example through sharp) to reject decompression/dimension bombs.
 */
export function parseTemporaryStoryImageDataUri(source: string) {
  if (typeof source !== "string") {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_SOURCE",
      "Temporary story asset source is invalid.",
    );
  }
  const maxBytes = getTemporaryStoryAssetLimits().maxImageBytes;
  if (source.length > Math.ceil((maxBytes * 4) / 3) + 128) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_SOURCE",
      "Temporary story asset image is too large.",
    );
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
    source,
  );
  if (!match) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_SOURCE",
      "Temporary story asset must be a JPEG, PNG, or WebP base64 data URI.",
    );
  }

  const declaredContentType = match[1].toLowerCase() as TemporaryStoryAssetContentType;
  const bytes = decodeStrictBase64(match[2]);
  if (!bytes || bytes.length === 0 || bytes.length > maxBytes) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_SOURCE",
      "Temporary story asset image data is invalid or too large.",
    );
  }
  const detectedContentType = detectContentType(bytes);
  if (!detectedContentType || detectedContentType !== declaredContentType) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_SOURCE",
      "Temporary story asset image type does not match its content.",
    );
  }
  return { contentType: detectedContentType, bytes };
}

function isDemoSvgDataUri(source: string) {
  return (
    source.length <= 256 * 1024 &&
    /^data:image\/svg\+xml(?:;charset=[^,;]+)?,/i.test(source) &&
    source.includes(DEMO_SVG_MARKER)
  );
}

function isSafeStaticPath(source: string) {
  if (
    source.length === 0 ||
    source.length > 2048 ||
    !SAFE_STATIC_PATH_PATTERN.test(source) ||
    source.includes("\\") ||
    source.includes("?") ||
    source.includes("#")
  ) {
    return false;
  }
  try {
    return decodeURIComponent(source)
      .split("/")
      .filter(Boolean)
      .every((segment) => segment !== "." && segment !== "..");
  } catch {
    return false;
  }
}

export function classifyTemporaryStoryAssetSource(
  source: string,
):
  | { kind: "ingest" }
  | { kind: "passthrough"; reason: "demo-svg" | "static-path" } {
  if (isDemoSvgDataUri(source)) {
    return { kind: "passthrough", reason: "demo-svg" };
  }
  if (isSafeStaticPath(source)) {
    return { kind: "passthrough", reason: "static-path" };
  }
  return { kind: "ingest" };
}

export function getTemporaryStoryAssetUrl(assetId: string) {
  const normalized = validateAssetId(assetId);
  if (!normalized) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_INVALID_INPUT",
      "Temporary story asset id is invalid.",
    );
  }
  return `${TEMPORARY_STORY_ASSET_URL_PREFIX}${normalized}`;
}

function getMetadataPath(assetId: string) {
  return path.join(getTemporaryStoryAssetDirectory(), `${assetId}.json`);
}

function getAssetPath(assetId: string, extension: TemporaryStoryAssetExtension) {
  return path.join(getTemporaryStoryAssetDirectory(), `${assetId}.${extension}`);
}

async function ensureAssetDirectory() {
  const directory = getTemporaryStoryAssetDirectory();
  const missingDirectories: string[] = [];
  let currentPath = directory;
  while (true) {
    try {
      const stats = await fs.lstat(currentPath);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new TemporaryStoryAssetError(
          "TEMP_ASSET_STORAGE_UNAVAILABLE",
          "Temporary story asset path must contain only real directories.",
        );
      }
      break;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") throw error;
      missingDirectories.push(currentPath);
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) throw error;
      currentPath = parentPath;
    }
  }
  for (const missingDirectory of missingDirectories.reverse()) {
    await fs.mkdir(missingDirectory, { mode: PRIVATE_DIRECTORY_MODE });
    const stats = await fs.lstat(missingDirectory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset directory is invalid.",
      );
    }
  }
  const stats = await fs.lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset directory is invalid.",
    );
  }
  await fs.chmod(directory, PRIVATE_DIRECTORY_MODE);
  return directory;
}

async function writeAtomically(filePath: string, data: Buffer | string) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto
    .randomBytes(8)
    .toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporaryPath, data, {
      mode: PRIVATE_FILE_MODE,
      flag: "wx",
    });
    await fs.chmod(temporaryPath, PRIVATE_FILE_MODE);
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isMetadata(value: unknown): value is TemporaryStoryAssetMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<TemporaryStoryAssetMetadata>;
  const expectedExtension = metadata.contentType
    ? extensionForContentType(metadata.contentType)
    : null;
  return (
    metadata.version === TEMPORARY_ASSET_VERSION &&
    Number.isInteger(metadata.revision) &&
    metadata.revision! >= 1 &&
    typeof metadata.assetId === "string" &&
    ASSET_ID_PATTERN.test(metadata.assetId) &&
    typeof metadata.storyId === "string" &&
    STORY_ID_PATTERN.test(metadata.storyId) &&
    Number.isInteger(metadata.page) &&
    metadata.page! >= 1 &&
    metadata.page! <= 16 &&
    (metadata.attemptId === undefined ||
      (typeof metadata.attemptId === "string" &&
        ATTEMPT_ID_PATTERN.test(metadata.attemptId))) &&
    typeof metadata.principalHash === "string" &&
    /^[a-f0-9]{64}$/.test(metadata.principalHash) &&
    typeof metadata.leaseHash === "string" &&
    /^[a-f0-9]{64}$/.test(metadata.leaseHash) &&
    Array.isArray(metadata.grantedPrincipalHashes) &&
    metadata.grantedPrincipalHashes.length <= 4 &&
    metadata.grantedPrincipalHashes.every(
      (principalHash) =>
        typeof principalHash === "string" && /^[a-f0-9]{64}$/.test(principalHash),
    ) &&
    new Set(metadata.grantedPrincipalHashes).size ===
      metadata.grantedPrincipalHashes.length &&
    (metadata.state === "uploading" ||
      metadata.state === "pending" ||
      metadata.state === "committed" ||
      metadata.state === "cleanup") &&
    (metadata.contentType === "image/jpeg" ||
      metadata.contentType === "image/png" ||
      metadata.contentType === "image/webp") &&
    metadata.extension === expectedExtension &&
    Number.isInteger(metadata.byteSize) &&
    metadata.byteSize! > 0 &&
    metadata.byteSize! <= getTemporaryStoryAssetLimits().maxImageBytes &&
    typeof metadata.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(metadata.sha256) &&
    Number.isFinite(metadata.createdAt) &&
    Number.isFinite(metadata.updatedAt) &&
    Number.isFinite(metadata.expiresAt) &&
    metadata.createdAt! >= 0 &&
    metadata.updatedAt! >= metadata.createdAt! &&
    metadata.expiresAt! > metadata.createdAt! &&
    (metadata.cleanupAt === undefined ||
      (Number.isFinite(metadata.cleanupAt) && metadata.cleanupAt! >= 0)) &&
    ((metadata.state === "uploading" || metadata.state === "cleanup")
      ? metadata.cleanupAt !== undefined
      : metadata.cleanupAt === undefined)
  );
}

async function readLocalMetadata(assetId: string) {
  try {
    const metadataPath = getMetadataPath(assetId);
    const file = await fs.open(
      metadataPath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    let raw: string;
    try {
      const stats = await file.stat();
      if (!stats.isFile()) return null;
      raw = await file.readFile("utf8");
    } finally {
      await file.close();
    }
    const parsed = JSON.parse(raw) as unknown;
    const normalized =
      parsed &&
      typeof parsed === "object" &&
      !("revision" in parsed)
        ? { ...parsed, revision: 1 }
        : parsed;
    return isMetadata(normalized) && normalized.assetId === assetId
      ? normalized
      : null;
  } catch {
    return null;
  }
}

async function readVerifiedLocalAssetBytes(metadata: TemporaryStoryAssetMetadata) {
  try {
    const filePath = getAssetPath(metadata.assetId, metadata.extension);
    const file = await fs.open(
      filePath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    let bytes: Buffer;
    try {
      const fileStats = await file.stat();
      if (!fileStats.isFile()) return null;
      bytes = await file.readFile();
    } finally {
      await file.close();
    }
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    return bytes.length === metadata.byteSize &&
      safeHashEqual(sha256, metadata.sha256) &&
      detectContentType(bytes) === metadata.contentType
      ? bytes
      : null;
  } catch {
    return null;
  }
}

function getSharedAssetPath(metadata: TemporaryStoryAssetMetadata) {
  return `v1/${metadata.assetId}.${metadata.extension}`;
}

function getSharedAssetBucket() {
  const configuration = resolveTemporaryStoryAssetBackendConfiguration();
  if (
    configuration.status !== "ready" ||
    configuration.backend !== "supabase"
  ) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_NOT_DURABLE",
      "Private shared temporary story asset storage is not configured.",
    );
  }
  return getSupabaseAdmin().storage.from(configuration.bucket);
}

function parseRedisMetadata(
  value: unknown,
  assetId: string,
): TemporaryStoryAssetMetadata | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const redisMetadata = parsed as Partial<RedisTemporaryStoryAssetMetadata>;
  if (
    redisMetadata.contentType !== "image/jpeg" &&
    redisMetadata.contentType !== "image/png" &&
    redisMetadata.contentType !== "image/webp"
  ) {
    return null;
  }
  const metadata = {
    ...redisMetadata,
    revision: redisMetadata.revision ?? 1,
    extension: extensionForContentType(redisMetadata.contentType),
  };
  return isMetadata(metadata) && metadata.assetId === assetId ? metadata : null;
}

async function readRedisMetadata(assetId: string) {
  const redis = getRedisMetadataClient();
  if (!redis) return null;
  try {
    return parseRedisMetadata(
      await redis.get<unknown>(getRedisMetadataKey(assetId)),
      assetId,
    );
  } catch {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset metadata is unavailable.",
    );
  }
}

async function readMetadata(assetId: string) {
  return getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private"
    ? readRedisMetadata(assetId)
    : readLocalMetadata(assetId);
}

async function readVerifiedSharedAssetBytes(metadata: TemporaryStoryAssetMetadata) {
  try {
    const { data, error } = await getSharedAssetBucket().download(
      getSharedAssetPath(metadata),
      {},
      { cache: "no-store" },
    );
    if (error || !data) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset bytes are unavailable.",
      );
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    return bytes.length === metadata.byteSize &&
      safeHashEqual(sha256, metadata.sha256) &&
      detectContentType(bytes) === metadata.contentType
      ? bytes
      : null;
  } catch (error) {
    if (error instanceof TemporaryStoryAssetError) throw error;
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset bytes are unavailable.",
    );
  }
}

async function readVerifiedAssetBytes(metadata: TemporaryStoryAssetMetadata) {
  return getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private"
    ? readVerifiedSharedAssetBytes(metadata)
    : readVerifiedLocalAssetBytes(metadata);
}

function getRedisMetadataKey(assetId: string) {
  return `storybloom:temporary-story-asset:v1:${assetId}`;
}

function getRedisExpiryIndexKey() {
  return "storybloom:temporary-story-assets:v1:expiry";
}

function getRedisCleanupIndexKey() {
  return "storybloom:temporary-story-assets:v1:cleanup";
}

type SharedMetadataWriteMode = "create" | "cas" | "upsert";

function getSharedMetadataTtlSeconds(
  metadata: TemporaryStoryAssetMetadata,
  referenceNow = Date.now(),
) {
  const retainedUntil = Math.max(
    metadata.expiresAt +
      getTemporaryStoryAssetLimits().orphanCleanupGraceSeconds * 1_000,
    metadata.cleanupAt ?? 0,
  );
  return Math.max(1, Math.ceil((retainedUntil - referenceNow) / 1000));
}

function toRedisMetadata(
  metadata: TemporaryStoryAssetMetadata,
): RedisTemporaryStoryAssetMetadata {
  const { extension: _extension, ...redisMetadata } = metadata;
  return redisMetadata;
}

async function mirrorRedisMetadata(
  metadata: TemporaryStoryAssetMetadata,
  referenceNow = Date.now(),
  options: {
    required?: boolean;
    mode?: SharedMetadataWriteMode;
    expectedRevision?: number;
  } = {},
) {
  const redis = getRedisMetadataClient();
  if (!redis) {
    if (options.required) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_NOT_DURABLE",
        "Shared temporary story asset metadata requires Redis.",
      );
    }
    return;
  }
  const ttlSeconds = getSharedMetadataTtlSeconds(metadata, referenceNow);
  const index =
    metadata.state === "pending" || metadata.state === "committed"
      ? "expiry"
      : "cleanup";
  const indexScore =
    index === "expiry"
      ? metadata.expiresAt
      : metadata.cleanupAt ?? referenceNow;
  try {
    const result = await redis.eval(
      `
        local current = redis.call('GET', KEYS[1])
        if ARGV[6] == 'create' then
          if current then return 0 end
        elseif ARGV[6] == 'cas' then
          if not current then return 0 end
          local ok, decoded = pcall(cjson.decode, current)
          if not ok or tonumber(decoded.revision or 1) ~= tonumber(ARGV[7]) then
            return 0
          end
        end
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        if ARGV[5] == 'expiry' then
          redis.call('ZADD', KEYS[2], ARGV[3], ARGV[4])
          redis.call('ZREM', KEYS[3], ARGV[4])
        else
          redis.call('ZREM', KEYS[2], ARGV[4])
          redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4])
        end
        return 1
      `,
      [
        getRedisMetadataKey(metadata.assetId),
        getRedisExpiryIndexKey(),
        getRedisCleanupIndexKey(),
      ],
      [
        JSON.stringify(toRedisMetadata(metadata)),
        ttlSeconds,
        indexScore,
        metadata.assetId,
        index,
        options.mode ?? "cas",
        options.expectedRevision ?? Math.max(0, metadata.revision - 1),
      ],
    );
    return result === 1;
  } catch {
    // Local sidecar metadata remains authoritative only for the local backend.
    // In shared mode Redis is authoritative, so a failed write must abort and
    // let the caller roll back the already-uploaded private object.
    logGenerationEvent(
      {
        operation: "storage.temp_asset_metadata",
        story: metadata.storyId,
        page: metadata.page,
        status: "redis_mirror_failed",
        errorClass: "storage_unavailable",
      },
      "warn",
    );
    if (options.required) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset metadata is unavailable.",
      );
    }
    return false;
  }
}

async function removeRedisMetadata(assetId: string, expectedRevision?: number) {
  const redis = getRedisMetadataClient();
  if (!redis) return false;
  try {
    const result = await redis.eval(
      `
        local current = redis.call('GET', KEYS[1])
        if ARGV[2] ~= '' then
          if not current then return 0 end
          local ok, decoded = pcall(cjson.decode, current)
          if not ok or tonumber(decoded.revision or 1) ~= tonumber(ARGV[2]) then
            return 0
          end
        end
        redis.call('DEL', KEYS[1])
        redis.call('ZREM', KEYS[2], ARGV[1])
        redis.call('ZREM', KEYS[3], ARGV[1])
        return 1
      `,
      [
        getRedisMetadataKey(assetId),
        getRedisExpiryIndexKey(),
        getRedisCleanupIndexKey(),
      ],
      [assetId, expectedRevision === undefined ? "" : expectedRevision],
    );
    return result === 1;
  } catch {
    return false;
  }
}

async function writeMetadata(
  metadata: TemporaryStoryAssetMetadata,
  referenceNow?: number,
  options: { create?: boolean; expectedRevision?: number } = {},
) {
  if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
    const redis = getRedisMetadataClient();
    if (!redis) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_NOT_DURABLE",
        "Shared temporary story asset metadata requires Redis.",
      );
    }
    return mirrorRedisMetadata(metadata, referenceNow, {
      required: true,
      mode: options.create ? "create" : "cas",
      expectedRevision: options.expectedRevision,
    });
  }
  await writeAtomically(getMetadataPath(metadata.assetId), JSON.stringify(metadata));
  await mirrorRedisMetadata(metadata, referenceNow, { mode: "upsert" });
  return true;
}

async function removeLocalAssetFiles(
  assetId: string,
  extension?: TemporaryStoryAssetExtension,
) {
  const extensions: TemporaryStoryAssetExtension[] = extension
    ? [extension]
    : ["jpg", "png", "webp"];
  await Promise.all([
    fs.rm(getMetadataPath(assetId), { force: true }).catch(() => undefined),
    ...extensions.map((item) =>
      fs.rm(getAssetPath(assetId, item), { force: true }).catch(() => undefined),
    ),
    removeRedisMetadata(assetId),
  ]);
}

async function removeSharedAsset(
  assetId: string,
  extension?: TemporaryStoryAssetExtension,
) {
  const extensions: TemporaryStoryAssetExtension[] = extension
    ? [extension]
    : ["jpg", "png", "webp"];
  const paths = extensions.map((item) => `v1/${assetId}.${item}`);
  const { error } = await getSharedAssetBucket().remove(paths);
  if (error) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset bytes could not be removed.",
    );
  }
}

async function removeAssetFiles(
  assetId: string,
  extension?: TemporaryStoryAssetExtension,
) {
  if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
    const metadata = await readRedisMetadata(assetId);
    if (!metadata) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset cleanup metadata is unavailable.",
      );
    }
    await cleanupSharedAssetFromMetadata(metadata);
    return;
  }
  await removeLocalAssetFiles(assetId, extension);
}

async function scheduleSharedAssetCleanup(
  metadata: TemporaryStoryAssetMetadata,
  cleanupAt =
    metadata.expiresAt +
    getTemporaryStoryAssetLimits().orphanCleanupGraceSeconds * 1_000,
) {
  if (metadata.state === "cleanup" && metadata.cleanupAt === cleanupAt) {
    return true;
  }
  return writeMetadata(
    {
      ...metadata,
      revision: metadata.revision + 1,
      state: "cleanup",
      cleanupAt,
      updatedAt: Math.max(metadata.updatedAt, Math.min(cleanupAt, Date.now())),
    },
    Date.now(),
    { expectedRevision: metadata.revision },
  );
}

async function beginSharedAssetCleanup(
  metadata: TemporaryStoryAssetMetadata,
  cleanupAt = Date.now(),
) {
  if (metadata.state === "cleanup") return metadata;
  const tombstone: TemporaryStoryAssetMetadata = {
    ...metadata,
    revision: metadata.revision + 1,
    state: "cleanup",
    cleanupAt,
    updatedAt: Math.max(metadata.updatedAt, cleanupAt),
  };
  const stored = await writeMetadata(tombstone, cleanupAt, {
    expectedRevision: metadata.revision,
  });
  return stored ? tombstone : null;
}

async function finishSharedAssetCleanup(metadata: TemporaryStoryAssetMetadata) {
  await removeSharedAsset(metadata.assetId);
  const removed = await removeRedisMetadata(metadata.assetId, metadata.revision);
  if (!removed) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset cleanup metadata could not be finalized.",
    );
  }
}

async function cleanupSharedAssetFromMetadata(
  metadata: TemporaryStoryAssetMetadata,
  cleanupAt = Date.now(),
) {
  const tombstone = await beginSharedAssetCleanup(metadata, cleanupAt);
  if (!tombstone) return false;
  await finishSharedAssetCleanup(tombstone);
  return true;
}

async function withAssetMutationLock<T>(
  assetId: string,
  operation: () => Promise<T>,
) {
  const previous = assetMutationQueues.get(assetId) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  assetMutationQueues.set(assetId, current);
  try {
    return await current;
  } finally {
    if (assetMutationQueues.get(assetId) === current) {
      assetMutationQueues.delete(assetId);
    }
  }
}

function metadataBelongsToPrincipal(
  metadata: TemporaryStoryAssetMetadata,
  principal: TemporaryStoryAssetPrincipal,
) {
  return safeHashEqual(metadata.principalHash, hashPrincipal(principal));
}

function metadataIsReadableByPrincipal(
  metadata: TemporaryStoryAssetMetadata,
  principal: TemporaryStoryAssetPrincipal,
) {
  const principalHash = hashPrincipal(principal);
  return (
    safeHashEqual(metadata.principalHash, principalHash) ||
    metadata.grantedPrincipalHashes.some((grantedHash) =>
      safeHashEqual(grantedHash, principalHash),
    )
  );
}

async function listMetadataAssetIds() {
  if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
    const redis = getRedisMetadataClient();
    if (!redis) return [];
    try {
      const [active, cleanup] = await Promise.all([
        redis.zrange<string[]>(getRedisExpiryIndexKey(), 0, -1),
        redis.zrange<string[]>(getRedisCleanupIndexKey(), 0, -1),
      ]);
      return Array.from(new Set([...active, ...cleanup]));
    } catch {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset metadata index is unavailable.",
      );
    }
  }
  try {
    return (await fs.readdir(getTemporaryStoryAssetDirectory()))
      .map((fileName) => /^([A-Za-z0-9_-]{32})\.json$/.exec(fileName)?.[1])
      .filter((assetId): assetId is string => Boolean(assetId));
  } catch {
    return [];
  }
}

export async function putTemporaryStoryAsset(
  input: {
    source: string;
    storyId: string;
    page: number;
    attemptId?: string;
    principal: TemporaryStoryAssetPrincipal;
    ttlSeconds?: number;
    now?: number;
  },
  options: { requireDurable?: boolean } = {},
): Promise<PutTemporaryStoryAssetResult> {
  const storyId = validateStoryId(input.storyId);
  const page = validatePage(input.page);
  const attemptId = validateAttemptId(input.attemptId);
  const principalHash = hashPrincipal(input.principal);
  const sourceClassification = classifyTemporaryStoryAssetSource(input.source);
  if (sourceClassification.kind === "passthrough") {
    return {
      kind: "passthrough",
      imageUrl: input.source,
      reason: sourceClassification.reason,
    };
  }
  if (options.requireDurable || process.env.NODE_ENV === "production") {
    requireDurableTemporaryStoryAssetStorage();
  }

  const now = normalizeNow(input.now);
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds);
  const { contentType, bytes } = parseTemporaryStoryImageDataUri(input.source);
  const assetId = crypto.randomBytes(24).toString("base64url");
  const lease = crypto.randomBytes(24).toString("base64url");
  const extension = extensionForContentType(contentType);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const metadata: TemporaryStoryAssetMetadata = {
    version: TEMPORARY_ASSET_VERSION,
    revision: 1,
    assetId,
    storyId,
    page,
    attemptId,
    principalHash,
    leaseHash: hashLease(lease),
    grantedPrincipalHashes: [],
    state: "pending",
    contentType,
    extension,
    byteSize: bytes.length,
    sha256,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };

  try {
    await sweepExpiredTemporaryStoryAssets(now).catch(() => undefined);
    if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
      const cleanupAt =
        now + getTemporaryStoryAssetLimits().orphanCleanupGraceSeconds * 1_000;
      const uploadIntent: TemporaryStoryAssetMetadata = {
        ...metadata,
        state: "uploading",
        cleanupAt,
      };
      const intentStored = await writeMetadata(uploadIntent, now, {
        create: true,
      });
      if (!intentStored) {
        throw new TemporaryStoryAssetError(
          "TEMP_ASSET_STORAGE_UNAVAILABLE",
          "Temporary story asset upload intent could not be stored.",
        );
      }
      const { error } = await getSharedAssetBucket().upload(
        getSharedAssetPath(metadata),
        bytes,
        {
          contentType,
          cacheControl: "0",
          upsert: false,
        },
      );
      if (error) throw error;
      const pendingStored = await writeMetadata(
        {
          ...metadata,
          revision: uploadIntent.revision + 1,
        },
        now,
        { expectedRevision: uploadIntent.revision },
      );
      if (!pendingStored) {
        const { error: rollbackError } = await getSharedAssetBucket().remove([
          getSharedAssetPath(metadata),
        ]);
        if (!rollbackError) {
          await removeRedisMetadata(assetId, uploadIntent.revision);
        }
        throw new TemporaryStoryAssetError(
          "TEMP_ASSET_STORAGE_UNAVAILABLE",
          "Temporary story asset metadata changed during upload.",
        );
      }
    } else {
      await ensureAssetDirectory();
      await writeAtomically(getAssetPath(assetId, extension), bytes);
      await writeMetadata(metadata, now);
    }
  } catch {
    if (getTemporaryStoryAssetCapabilities().bytesBackend === "local-file") {
      await removeLocalAssetFiles(assetId, extension);
    }
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset could not be stored.",
    );
  }

  return {
    kind: "stored",
    assetId,
    lease,
    imageUrl: getTemporaryStoryAssetUrl(assetId),
    storyId,
    page,
    state: "pending",
    contentType,
    byteSize: bytes.length,
    sha256,
    createdAt: now,
    expiresAt: metadata.expiresAt,
  };
}

export async function readTemporaryStoryAsset(input: {
  assetId: string;
  principal: TemporaryStoryAssetPrincipal;
  now?: number;
}): Promise<ReadTemporaryStoryAssetResult | null> {
  const assetId = validateAssetId(input.assetId);
  if (!assetId) return null;
  const now = normalizeNow(input.now);

  return withAssetMutationLock(assetId, async () => {
    const metadata = await readMetadata(assetId);
    if (!metadata) return null;
    if (metadata.expiresAt <= now) {
      if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
        await scheduleSharedAssetCleanup(metadata).catch(() => undefined);
      } else {
        await removeAssetFiles(assetId);
      }
      return null;
    }
    // Pending bytes are an internal lease artifact. They must not be exposed
    // through a future browser-facing asset route until the Story CAS wins.
    if (metadata.state !== "committed") return null;
    if (!metadataIsReadableByPrincipal(metadata, input.principal)) return null;

    const bytes = await readVerifiedAssetBytes(metadata);
    if (!bytes) {
      if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
        await cleanupSharedAssetFromMetadata(metadata, now);
      } else {
        await removeAssetFiles(assetId);
      }
      return null;
    }
    return {
      assetId,
      storyId: metadata.storyId,
      page: metadata.page,
      attemptId: metadata.attemptId,
      state: metadata.state,
      contentType: metadata.contentType,
      byteSize: metadata.byteSize,
      sha256: metadata.sha256,
      etag: `"${metadata.sha256}"`,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      expiresAt: metadata.expiresAt,
      bytes,
    };
  });
}

export async function commitTemporaryStoryAsset(input: {
  assetId: string;
  lease: string;
  principal: TemporaryStoryAssetPrincipal;
  now?: number;
}) {
  const assetId = validateAssetId(input.assetId);
  if (!assetId || !ASSET_ID_PATTERN.test(input.lease)) return false;
  const now = normalizeNow(input.now);

  return withAssetMutationLock(assetId, async () => {
    const metadata = await readMetadata(assetId);
    if (!metadata) return false;
    if (metadata.expiresAt <= now) {
      if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
        await scheduleSharedAssetCleanup(metadata).catch(() => undefined);
      } else {
        await removeAssetFiles(assetId);
      }
      return false;
    }
    if (
      !metadataBelongsToPrincipal(metadata, input.principal) ||
      !safeHashEqual(metadata.leaseHash, hashLease(input.lease))
    ) {
      return false;
    }
    if (metadata.state === "committed") return true;
    if (metadata.state !== "pending") return false;
    if (!(await readVerifiedAssetBytes(metadata))) {
      if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
        await cleanupSharedAssetFromMetadata(metadata, now);
      } else {
        await removeAssetFiles(assetId);
      }
      return false;
    }

    try {
      const stored = await writeMetadata({
        ...metadata,
        revision: metadata.revision + 1,
        state: "committed",
        updatedAt: Math.max(now, metadata.updatedAt),
      }, now, { expectedRevision: metadata.revision });
      return stored;
    } catch {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset could not be committed.",
      );
    }
  });
}

export async function grantTemporaryStoryAssetPrincipal(input: {
  assetId: string;
  lease: string;
  ownerPrincipal: TemporaryStoryAssetPrincipal;
  grantedPrincipal: TemporaryStoryAssetPrincipal;
  now?: number;
}) {
  const assetId = validateAssetId(input.assetId);
  if (!assetId || !ASSET_ID_PATTERN.test(input.lease)) return false;
  const now = normalizeNow(input.now);
  const grantedPrincipalHash = hashPrincipal(input.grantedPrincipal);

  return withAssetMutationLock(assetId, async () => {
    const metadata = await readMetadata(assetId);
    if (!metadata) return false;
    if (metadata.expiresAt <= now) {
      if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
        await scheduleSharedAssetCleanup(metadata).catch(() => undefined);
      } else {
        await removeAssetFiles(assetId);
      }
      return false;
    }
    if (
      metadata.state !== "pending" ||
      !metadataBelongsToPrincipal(metadata, input.ownerPrincipal) ||
      !safeHashEqual(metadata.leaseHash, hashLease(input.lease))
    ) {
      return false;
    }
    if (safeHashEqual(metadata.principalHash, grantedPrincipalHash)) return true;
    if (
      metadata.grantedPrincipalHashes.some((principalHash) =>
        safeHashEqual(principalHash, grantedPrincipalHash),
      )
    ) {
      return true;
    }
    if (metadata.grantedPrincipalHashes.length >= 4) {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_INVALID_INPUT",
        "Temporary story asset has reached its principal grant limit.",
      );
    }
    try {
      const stored = await writeMetadata({
        ...metadata,
        revision: metadata.revision + 1,
        grantedPrincipalHashes: [
          ...metadata.grantedPrincipalHashes,
          grantedPrincipalHash,
        ],
        updatedAt: Math.max(now, metadata.updatedAt),
      }, now, { expectedRevision: metadata.revision });
      return stored;
    } catch {
      throw new TemporaryStoryAssetError(
        "TEMP_ASSET_STORAGE_UNAVAILABLE",
        "Temporary story asset principal grant could not be stored.",
      );
    }
  });
}

export async function discardTemporaryStoryAsset(input: {
  assetId: string;
  lease: string;
  principal: TemporaryStoryAssetPrincipal;
}) {
  const assetId = validateAssetId(input.assetId);
  if (!assetId || !ASSET_ID_PATTERN.test(input.lease)) return false;

  return withAssetMutationLock(assetId, async () => {
    const metadata = await readMetadata(assetId);
    if (!metadata) return false;
    if (
      metadata.state !== "pending" ||
      !metadataBelongsToPrincipal(metadata, input.principal) ||
      !safeHashEqual(metadata.leaseHash, hashLease(input.lease))
    ) {
      return false;
    }
    if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
      return cleanupSharedAssetFromMetadata(metadata);
    } else {
      await removeAssetFiles(assetId);
    }
    return true;
  });
}

export async function deleteTemporaryStoryAsset(input: {
  assetId: string;
  principal: TemporaryStoryAssetPrincipal;
}) {
  const assetId = validateAssetId(input.assetId);
  if (!assetId) return false;
  return withAssetMutationLock(assetId, async () => {
    const metadata = await readMetadata(assetId);
    if (!metadata || !metadataBelongsToPrincipal(metadata, input.principal)) {
      return false;
    }
    if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
      return cleanupSharedAssetFromMetadata(metadata);
    } else {
      await removeAssetFiles(assetId);
    }
    return true;
  });
}

export async function touchTemporaryStoryAssets(input: {
  storyId: string;
  principal: TemporaryStoryAssetPrincipal;
  ttlSeconds?: number;
  now?: number;
}) {
  const storyId = validateStoryId(input.storyId);
  normalizePrincipal(input.principal);
  const now = normalizeNow(input.now);
  const nextExpiresAt = now + normalizeTtlSeconds(input.ttlSeconds) * 1000;
  let touched = 0;

  for (const assetId of await listMetadataAssetIds()) {
    await withAssetMutationLock(assetId, async () => {
      const metadata = await readMetadata(assetId);
      if (
        !metadata ||
        metadata.storyId !== storyId ||
        metadata.state !== "committed" ||
        !metadataBelongsToPrincipal(metadata, input.principal)
      ) {
        return;
      }
      if (metadata.expiresAt <= now) {
        if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
          await scheduleSharedAssetCleanup(metadata).catch(() => undefined);
        } else {
          await removeAssetFiles(assetId);
        }
        return;
      }
      if (nextExpiresAt <= metadata.expiresAt) return;
      try {
        const stored = await writeMetadata({
          ...metadata,
          revision: metadata.revision + 1,
          updatedAt: now,
          expiresAt: nextExpiresAt,
        }, now, { expectedRevision: metadata.revision });
        if (stored) touched += 1;
      } catch {
        throw new TemporaryStoryAssetError(
          "TEMP_ASSET_STORAGE_UNAVAILABLE",
          "Temporary story assets could not be extended.",
        );
      }
    });
  }
  return touched;
}

export async function deleteTemporaryStoryAssets(input: {
  storyId: string;
  principal: TemporaryStoryAssetPrincipal;
}) {
  const storyId = validateStoryId(input.storyId);
  normalizePrincipal(input.principal);
  let deleted = 0;

  for (const assetId of await listMetadataAssetIds()) {
    await withAssetMutationLock(assetId, async () => {
      const metadata = await readMetadata(assetId);
      if (
        !metadata ||
        metadata.storyId !== storyId ||
        !metadataBelongsToPrincipal(metadata, input.principal)
      ) {
        return;
      }
      if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
        if (await cleanupSharedAssetFromMetadata(metadata)) deleted += 1;
      } else {
        await removeAssetFiles(assetId);
        deleted += 1;
      }
    });
  }
  return deleted;
}

async function removeIfOlderThan(filePath: string, threshold: number) {
  try {
    const stats = await fs.lstat(filePath);
    if (!stats.isSymbolicLink() && stats.mtimeMs > threshold) return false;
    await fs.rm(filePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function sweepExpiredTemporaryStoryAssets(
  now = Date.now(),
): Promise<TemporaryStoryAssetSweepResult> {
  const normalizedNow = normalizeNow(now);
  if (getTemporaryStoryAssetCapabilities().bytesBackend === "supabase-private") {
    return sweepExpiredSharedTemporaryStoryAssets(normalizedNow);
  }
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(getTemporaryStoryAssetDirectory());
  } catch {
    return {
      deletedExpiredAssets: 0,
      deletedOrphans: 0,
      deletedTemporaryFiles: 0,
      cleanupFailures: 0,
    };
  }

  let deletedExpiredAssets = 0;
  let deletedOrphans = 0;
  let deletedTemporaryFiles = 0;
  const activeAssets = new Set<string>();
  const metadataAssetIds = fileNames
    .map((fileName) => /^([A-Za-z0-9_-]{32})\.json$/.exec(fileName)?.[1])
    .filter((assetId): assetId is string => Boolean(assetId));

  for (const assetId of metadataAssetIds) {
    await withAssetMutationLock(assetId, async () => {
      const metadata = await readMetadata(assetId);
      if (!metadata) {
        await removeAssetFiles(assetId);
        deletedOrphans += 1;
        return;
      }
      if (metadata.expiresAt <= normalizedNow) {
        await removeAssetFiles(assetId);
        deletedExpiredAssets += 1;
        return;
      }
      activeAssets.add(assetId);
    });
  }

  const orphanThreshold = normalizedNow - ORPHAN_GRACE_MS;
  for (const fileName of fileNames) {
    const filePath = path.join(getTemporaryStoryAssetDirectory(), fileName);
    if (fileName.endsWith(".tmp")) {
      if (await removeIfOlderThan(filePath, orphanThreshold)) {
        deletedTemporaryFiles += 1;
      }
      continue;
    }
    const assetMatch = /^([A-Za-z0-9_-]{32})\.(?:jpg|png|webp)$/.exec(fileName);
    if (
      assetMatch &&
      !activeAssets.has(assetMatch[1]) &&
      (await removeIfOlderThan(filePath, orphanThreshold))
    ) {
      deletedOrphans += 1;
    }
  }

  return {
    deletedExpiredAssets,
    deletedOrphans,
    deletedTemporaryFiles,
    cleanupFailures: 0,
  };
}

async function sweepExpiredSharedTemporaryStoryAssets(
  normalizedNow: number,
): Promise<TemporaryStoryAssetSweepResult> {
  const redis = getRedisMetadataClient();
  if (!redis) {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_NOT_DURABLE",
      "Shared temporary story asset cleanup requires Redis.",
    );
  }
  const { sharedSweepLimit } = getTemporaryStoryAssetLimits();
  let deletedExpiredAssets = 0;
  let deletedOrphans = 0;
  let retainedForCleanupGrace = 0;
  let cleanupFailures = 0;

  let expiredIds: string[];
  let cleanupIds: string[];
  try {
    expiredIds = await redis.zrange<string[]>(
      getRedisExpiryIndexKey(),
      0,
      normalizedNow,
      { byScore: true, offset: 0, count: sharedSweepLimit },
    );
    cleanupIds = await redis.zrange<string[]>(
      getRedisCleanupIndexKey(),
      0,
      normalizedNow,
      { byScore: true, offset: 0, count: sharedSweepLimit },
    );
  } catch {
    throw new TemporaryStoryAssetError(
      "TEMP_ASSET_STORAGE_UNAVAILABLE",
      "Temporary story asset cleanup index is unavailable.",
    );
  }

  for (const assetId of expiredIds) {
    await withAssetMutationLock(assetId, async () => {
      const metadata = await readRedisMetadata(assetId);
      if (metadata && metadata.expiresAt > normalizedNow) return;
      if (!metadata) {
        // Do not discard the only durable reference to a possibly orphaned
        // Storage object. Cleanup can process the expiry member directly.
        return;
      }
      try {
        const scheduled = await scheduleSharedAssetCleanup(metadata);
        if (scheduled) retainedForCleanupGrace += 1;
      } catch {
        cleanupFailures += 1;
      }
    });
  }

  for (const assetId of Array.from(new Set([...cleanupIds, ...expiredIds]))) {
    await withAssetMutationLock(assetId, async () => {
      const metadata = await readRedisMetadata(assetId);
      if (!cleanupIds.includes(assetId) && metadata) return;
      if (
        metadata &&
        (metadata.state === "pending" || metadata.state === "committed") &&
        metadata.expiresAt > normalizedNow
      ) {
        if (cleanupIds.includes(assetId)) {
          const restored = await mirrorRedisMetadata(metadata, normalizedNow, {
            required: true,
            expectedRevision: metadata.revision,
          });
          if (!restored) cleanupFailures += 1;
        }
        return;
      }
      try {
        if (metadata) {
          const tombstone =
            metadata.state === "cleanup"
              ? metadata
              : await beginSharedAssetCleanup(metadata, normalizedNow);
          if (!tombstone) {
            cleanupFailures += 1;
            return;
          }
          await finishSharedAssetCleanup(tombstone);
          deletedExpiredAssets += 1;
        } else {
          // The cleanup member is the durable orphan record. When metadata has
          // expired or was never finalized, remove every allowed extension.
          await removeSharedAsset(assetId);
          await redis.zrem(getRedisCleanupIndexKey(), assetId);
          await redis.zrem(getRedisExpiryIndexKey(), assetId);
          deletedOrphans += 1;
        }
      } catch {
        // Leave the cleanup member in the sorted set. A later bounded sweep
        // retries object removal; metadata's grace window prevents a Storage
        // object from becoming permanently undiscoverable.
        cleanupFailures += 1;
      }
    });
  }

  return {
    deletedExpiredAssets,
    deletedOrphans,
    deletedTemporaryFiles: 0,
    retainedForCleanupGrace,
    cleanupFailures,
  };
}
