export const GROWTH_ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type GrowthAssetMimeType = (typeof GROWTH_ASSET_MIME_TYPES)[number];

export interface GrowthAssetMetadata {
  mimeType: GrowthAssetMimeType;
  byteSize: number;
  checksumSha256: string;
}

export interface GrowthAssetWithDataUrl {
  dataUrl: string;
  mimeType?: GrowthAssetMimeType;
  byteSize?: number;
  checksumSha256?: string;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isGrowthAssetMimeType(value: string): value is GrowthAssetMimeType {
  return GROWTH_ASSET_MIME_TYPES.includes(value as GrowthAssetMimeType);
}

export function isValidGrowthAssetMetadata(
  value: Partial<GrowthAssetMetadata>,
) {
  return (
    isGrowthAssetMimeType(value.mimeType || "") &&
    typeof value.byteSize === "number" &&
    Number.isInteger(value.byteSize) &&
    value.byteSize >= 0 &&
    typeof value.checksumSha256 === "string" &&
    SHA256_PATTERN.test(value.checksumSha256)
  );
}

export function hasValidOptionalGrowthAssetMetadata(
  value: Partial<GrowthAssetMetadata>,
) {
  return (
    (value.mimeType === undefined || isGrowthAssetMimeType(value.mimeType)) &&
    (value.byteSize === undefined ||
      (Number.isInteger(value.byteSize) && (value.byteSize || 0) >= 0)) &&
    (value.checksumSha256 === undefined ||
      SHA256_PATTERN.test(value.checksumSha256))
  );
}

function parseImageDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) throw new Error("growth-asset-data-url-invalid");
  const mimeType = match[1].trim().toLowerCase();
  if (!isGrowthAssetMimeType(mimeType)) {
    throw new Error("growth-asset-mime-type-invalid");
  }
  return {
    mimeType,
    base64: Boolean(match[2]),
    payload: match[3],
  };
}

export function growthAssetDataUrlToBytes(dataUrl: string) {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed.base64) {
    return new TextEncoder().encode(decodeURIComponent(parsed.payload));
  }
  if (typeof atob !== "function") {
    throw new Error("growth-asset-base64-unavailable");
  }
  const decoded = atob(parsed.payload.replace(/\s/g, ""));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

async function checksumSha256(bytes: BufferSource) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("growth-asset-fingerprint-unavailable");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getGrowthAssetMetadataFromBlob(
  blob: Blob,
): Promise<GrowthAssetMetadata> {
  const mimeType = blob.type.toLowerCase();
  if (!isGrowthAssetMimeType(mimeType)) {
    throw new Error("growth-asset-mime-type-invalid");
  }
  const bytes = await blob.arrayBuffer();
  return {
    mimeType,
    byteSize: blob.size,
    checksumSha256: await checksumSha256(bytes),
  };
}

export async function getGrowthAssetMetadataFromDataUrl(
  dataUrl: string,
): Promise<GrowthAssetMetadata> {
  const parsed = parseImageDataUrl(dataUrl);
  const bytes = growthAssetDataUrlToBytes(dataUrl);
  return {
    mimeType: parsed.mimeType,
    byteSize: bytes.byteLength,
    checksumSha256: await checksumSha256(bytes),
  };
}

export function estimateGrowthAssetByteSize(asset: GrowthAssetWithDataUrl) {
  if (
    typeof asset.byteSize === "number" &&
    Number.isInteger(asset.byteSize) &&
    asset.byteSize >= 0
  ) {
    return asset.byteSize;
  }
  try {
    return growthAssetDataUrlToBytes(asset.dataUrl).byteLength;
  } catch {
    return new TextEncoder().encode(asset.dataUrl).byteLength;
  }
}

export function sumGrowthAssetBytes(
  assets: readonly GrowthAssetWithDataUrl[],
) {
  return assets.reduce(
    (total, asset) => total + estimateGrowthAssetByteSize(asset),
    0,
  );
}

export function sumGrowthAssetDataUrlBytes(
  assets: readonly GrowthAssetWithDataUrl[],
) {
  return assets.reduce(
    (total, asset) =>
      total + new TextEncoder().encode(asset.dataUrl).byteLength,
    0,
  );
}

export async function normalizeGrowthAssetMetadata<
  T extends GrowthAssetWithDataUrl,
>(asset: T, options: { verifyExisting?: boolean } = {}): Promise<T> {
  if (!options.verifyExisting && isValidGrowthAssetMetadata(asset)) {
    return asset;
  }
  const metadata = await getGrowthAssetMetadataFromDataUrl(asset.dataUrl);
  if (
    asset.mimeType === metadata.mimeType &&
    asset.byteSize === metadata.byteSize &&
    asset.checksumSha256 === metadata.checksumSha256
  ) {
    return asset;
  }
  return { ...asset, ...metadata };
}

export async function normalizeAndDedupeGrowthAssets<
  T extends GrowthAssetWithDataUrl,
>(
  assets: readonly T[],
  options: { verifyExisting?: boolean; strict?: boolean } = {},
) {
  const normalized: T[] = [];
  const seen = new Set<string>();
  let changed = false;

  for (const asset of assets) {
    let next = asset;
    try {
      next = await normalizeGrowthAssetMetadata(asset, options);
    } catch (error) {
      if (options.strict) throw error;
    }
    const key = next.checksumSha256
      ? `sha256:${next.checksumSha256}`
      : `data-url:${next.dataUrl}`;
    if (seen.has(key)) {
      changed = true;
      continue;
    }
    seen.add(key);
    normalized.push(next);
    if (next !== asset) changed = true;
  }

  return { assets: normalized, changed };
}
