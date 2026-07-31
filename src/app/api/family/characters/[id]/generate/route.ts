import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";
import { generateCpaReferenceImage } from "@/lib/image-generator";

export const runtime = "nodejs";
export const maxDuration = 300;

const idSchema = z.string().uuid();
const FAMILY_BUCKET = "family-photos";

type FamilyCharacter = {
  id: string;
  user_id: string;
  display_name: string;
  relationship: string;
  kind: "person" | "pet";
  description: string;
  source_photo_path: string | null;
};

async function generateCanonicalCharacter(input: {
  imageDataUri: string;
  displayName: string;
  relationship: string;
  kind: "person" | "pet";
  description: string;
}) {
  const subject =
    input.kind === "pet"
      ? `the family pet called ${input.displayName}`
      : `${input.displayName}, the child's ${input.relationship}`;
  const prompt = [
    `Transform the person or pet in the reference image into one premium children's storybook character design for ${subject}.`,
    "Preserve recognizable face shape, hairstyle, hair color, visual age, skin tone, glasses, and distinctive features from the reference.",
    input.description ? `Additional character notes: ${input.description}.` : null,
    "Show a friendly full-body three-quarter pose on a simple warm neutral studio background.",
    "Premium soft 3D cartoon illustration, rounded clay-like materials, gentle natural expression, polished children's publishing quality.",
    "One subject only. No text, captions, logos, watermark, extra people, duplicate body parts, or photorealistic rendering.",
  ]
    .filter(Boolean)
    .join(" ");

  const imageDataUri = await generateCpaReferenceImage({
    prompt,
    referenceImages: [input.imageDataUri],
  });
  const match = imageDataUri.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("CPA Banana did not return an inline image.");
  }
  return { bytes: Buffer.from(match[2], "base64"), contentType: match[1] };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let characterId = "";
  let userId = "";
  try {
    const user = await requireAuthenticatedUser(request);
    userId = user.id;
    characterId = idSchema.parse((await context.params).id);
    const supabase = getSupabaseAdmin();
    const { data: character, error } = await supabase
      .from("family_characters")
      .select(
        "id,user_id,display_name,relationship,kind,description,source_photo_path"
      )
      .eq("id", characterId)
      .eq("user_id", user.id)
      .maybeSingle<FamilyCharacter>();

    if (error) throw error;
    if (!character) {
      return NextResponse.json({ error: "没有找到这个家庭角色。" }, { status: 404 });
    }
    if (!character.source_photo_path) {
      return NextResponse.json({ error: "请先上传一张参考照片。" }, { status: 400 });
    }
    if (!character.source_photo_path.startsWith(`${user.id}/${character.id}/`)) {
      return NextResponse.json({ error: "参考照片路径无效。" }, { status: 400 });
    }

    await supabase
      .from("family_characters")
      .update({ status: "processing", error_message: null })
      .eq("id", character.id)
      .eq("user_id", user.id);

    const { data: sourceBlob, error: downloadError } = await supabase.storage
      .from(FAMILY_BUCKET)
      .download(character.source_photo_path);
    if (downloadError || !sourceBlob) {
      throw downloadError || new Error("参考照片下载失败。");
    }

    const sourceType = sourceBlob.type || "image/webp";
    const sourceBytes = Buffer.from(await sourceBlob.arrayBuffer());
    const generated = await generateCanonicalCharacter({
      imageDataUri: `data:${sourceType};base64,${sourceBytes.toString("base64")}`,
      displayName: character.display_name,
      relationship: character.relationship,
      kind: character.kind,
      description: character.description,
    });

    const canonicalPath = `${user.id}/${character.id}/canonical.png`;
    const { error: uploadError } = await supabase.storage
      .from(FAMILY_BUCKET)
      .upload(canonicalPath, generated.bytes, {
        contentType: generated.contentType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from("family_characters")
      .update({
        canonical_photo_path: canonicalPath,
        status: "ready",
        error_message: null,
      })
      .eq("id", character.id)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, status: "ready" });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "角色形象生成失败。";
    if (characterId && userId) {
      try {
        await getSupabaseAdmin()
          .from("family_characters")
          .update({ status: "failed", error_message: message })
          .eq("id", characterId)
          .eq("user_id", userId);
      } catch {
        // Preserve the original generation error if status persistence also fails.
      }
    }
    console.error("[family-character-generate]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
