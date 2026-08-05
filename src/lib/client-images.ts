export const PRIVATE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PRIVATE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

interface PreparePrivateImageOptions {
  maxDimension?: number;
  quality?: number;
}

export function isSupportedPrivateImage(file: File) {
  return (
    PRIVATE_IMAGE_TYPES.includes(file.type as (typeof PRIVATE_IMAGE_TYPES)[number]) &&
    file.size <= PRIVATE_IMAGE_MAX_BYTES
  );
}

export async function preparePrivateImage(
  file: File,
  options: PreparePrivateImageOptions = {},
) {
  if (!isSupportedPrivateImage(file)) {
    throw new Error("invalid-private-image");
  }

  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.88;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("private-image-processing-failed");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("private-image-processing-failed")),
      "image/webp",
      quality,
    );
  });
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("private-image-read-failed"));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("private-image-read-failed"));
    reader.readAsDataURL(blob);
  });
}

export async function imageUrlToDataUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return blobToDataUrl(await response.blob());
  } catch {
    return undefined;
  }
}
