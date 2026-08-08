import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SOURCE_IMAGE_BYTES = 16 * 1024 * 1024;

async function sourceToBlob(source: string) {
  const response = await fetch(source);
  if (!response.ok) throw new Error("private-image-download-failed");
  const blob = await response.blob();
  if (blob.size === 0 || blob.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("private-image-size-invalid");
  }
  if (!blob.type.startsWith("image/")) {
    throw new Error("private-image-type-invalid");
  }
  return blob;
}

export async function imageSourceToWebp(
  source: string,
  options: { maxDimension?: number; quality?: number } = {},
) {
  const blob = await sourceToBlob(source);
  if (blob.type === "image/webp") return blob;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    throw new Error("private-image-browser-required");
  }

  const maxDimension = options.maxDimension ?? 2000;
  const quality = options.quality ?? 0.88;
  const bitmap = await createImageBitmap(blob);
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
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("private-image-processing-failed")),
      "image/webp",
      quality,
    );
  });
}

export async function uploadPrivateWebp(
  supabase: SupabaseClient,
  bucket: "story-archive" | "growth-record-photos",
  storagePath: string,
  blob: Blob,
) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, blob, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) throw error;
  return storagePath;
}

export async function createPrivateSignedUrls(
  supabase: SupabaseClient,
  bucket: "story-archive" | "growth-record-photos",
  paths: string[],
  expiresIn = 3600,
) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, expiresIn);
  if (error) throw error;
  return new Map(
    (data || []).flatMap((item, index) => {
      const path = item.path || uniquePaths[index];
      return item.signedUrl && path ? [[path, item.signedUrl] as const] : [];
    }),
  );
}
