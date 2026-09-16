import crypto from "node:crypto";
import sharp from "sharp";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { boundedBody, customError, customJson } from "@/lib/custom-book/http";
import { CUSTOM_BUCKET } from "@/lib/custom-book/service";
import { allowIpRequest } from "@/lib/request-rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const limit = await allowIpRequest(request, {
      limit: 24,
      window: "1 h",
      windowMs: 3600000,
      prefix: "custom-upload",
      identifier: user.id,
    });
    if (!limit) return customJson({ error: "上传较频繁，请稍后重试。" }, 429);
    if (Number(request.headers.get("content-length") || 0) > 16 * 1024 * 1024)
      return customJson({ error: "图片不能超过 15 MB。" }, 413);
    const form = await new Response(
      await boundedBody(request, 16 * 1024 * 1024),
      {
        headers: { "Content-Type": request.headers.get("content-type") || "" },
      },
    ).formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 15 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      return customJson(
        { error: "请选择 15 MB 以内的 JPG、PNG 或 WebP 图片。" },
        400,
      );
    const bytes = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 30_000_000,
    })
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 95 })
      .toBuffer();
    const path = `${user.id}/inputs/${crypto.randomUUID()}.jpg`;
    const { error } = await getSupabaseAdmin()
      .storage.from(CUSTOM_BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return customJson({ storagePath: path });
  } catch (e) {
    return customError(e);
  }
}
