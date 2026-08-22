import "server-only";

import sharp from "sharp";
import { GenerationProviderError } from "@/lib/generation-error";
import type {
  IllustrationQualityReport,
  IllustrationQualityWarning,
} from "@/types";

const MIN_IMAGE_DIMENSION = 512;
const PREFERRED_IMAGE_DIMENSION = 768;
const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MIN_ASPECT_RATIO = 0.55;
const MAX_ASPECT_RATIO = 1.8;
const MIN_ENTROPY = 0.15;
const MIN_SHARPNESS = 0.02;

function invalidIllustration(): never {
  throw new GenerationProviderError(
    "invalid_response",
    "Illustration quality validation failed.",
  );
}

function parseImageDataUrl(source: string) {
  if (source.startsWith("data:image/svg+xml")) invalidIllustration();

  const match = source.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) invalidIllustration();

  const mimeType = match[1].toLowerCase();
  if (
    !new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/avif",
    ]).has(mimeType)
  ) {
    invalidIllustration();
  }

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    invalidIllustration();
  }
  return bytes;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

export function createDemoIllustrationQualityReport(): IllustrationQualityReport {
  return {
    version: 1,
    status: "demo",
    width: 1024,
    height: 1024,
    format: "svg",
    bytes: 0,
  };
}

export async function inspectIllustrationQuality(
  source: string,
): Promise<IllustrationQualityReport> {
  const bytes = parseImageDataUrl(source);
  let metadata: sharp.Metadata;
  let stats: sharp.Stats;

  try {
    const image = sharp(bytes, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
    });
    [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  } catch {
    invalidIllustration();
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const aspectRatio = height > 0 ? width / height : 0;
  const entropy = stats.entropy;
  const sharpness = stats.sharpness;
  const alphaChannel = metadata.hasAlpha
    ? stats.channels[stats.channels.length - 1]
    : undefined;

  if (
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    aspectRatio < MIN_ASPECT_RATIO ||
    aspectRatio > MAX_ASPECT_RATIO ||
    (metadata.pages || 1) > 1 ||
    entropy < MIN_ENTROPY ||
    sharpness < MIN_SHARPNESS ||
    (alphaChannel?.mean ?? 255) < 5
  ) {
    invalidIllustration();
  }

  const warnings: IllustrationQualityWarning[] = [];
  if (width < PREFERRED_IMAGE_DIMENSION || height < PREFERRED_IMAGE_DIMENSION) {
    warnings.push("low-resolution");
  }
  if (entropy < 2) warnings.push("low-detail");
  if (sharpness < 0.8) warnings.push("low-sharpness");

  return {
    version: 1,
    status: warnings.length > 0 ? "warning" : "passed",
    width,
    height,
    format: metadata.format || "unknown",
    bytes: bytes.length,
    entropy: roundMetric(entropy),
    sharpness: roundMetric(sharpness),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
