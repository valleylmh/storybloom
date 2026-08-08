import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";
import { generateCpaReferenceImage } from "@/lib/image-generator";
import {
  MAX_FAMILY_CHARACTER_GENERATIONS,
  getRemainingFamilyCharacterGenerations,
  normalizeFamilyCharacterGenerationCount,
} from "@/lib/family-character-generation";
import { DEFAULT_FAMILY_IMAGE_CROP } from "@/lib/family-image-crop";

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
  cartoonize: boolean;
  canonical_generation_count: number;
  status: string;
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
    throw new Error("CPA Nano Banana 没有返回可保存的图片。");
  }
  return { bytes: Buffer.from(match[2], "base64"), contentType: match[1] };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let characterId = "";
  let userId = "";
  let generationClaimed = false;
  let claimedGenerationCount = 0;
  try {
    const user = await requireAuthenticatedUser(request);
    userId = user.id;
    characterId = idSchema.parse((await context.params).id);
    const supabase = getSupabaseAdmin();
    const { data: character, error } = await supabase
      .from("family_characters")
      .select(
        "id,user_id,display_name,relationship,kind,description,source_photo_path,cartoonize,canonical_generation_count,status"
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
    if (!character.cartoonize) {
      return NextResponse.json(
        { error: "这个角色当前选择保留真实照片，请先开启卡通化。" },
        { status: 400 },
      );
    }
    if (!character.source_photo_path.startsWith(`${user.id}/${character.id}/`)) {
      return NextResponse.json({ error: "参考照片路径无效。" }, { status: 400 });
    }
    if (character.status === "processing") {
      return NextResponse.json(
        { error: "这个角色正在生成卡通形象，请稍候。" },
        { status: 409 },
      );
    }

    const currentGenerationCount = normalizeFamilyCharacterGenerationCount(
      character.canonical_generation_count,
    );
    if (currentGenerationCount >= MAX_FAMILY_CHARACTER_GENERATIONS) {
      return NextResponse.json(
        { error: "这个家庭角色已经用完 5 次卡通形象生成机会。" },
        { status: 429 },
      );
    }

    const { data: claimedCharacter, error: claimError } = await supabase
      .from("family_characters")
      .update({
        status: "processing",
        error_message: null,
        canonical_generation_count: currentGenerationCount + 1,
      })
      .eq("id", character.id)
      .eq("user_id", user.id)
      .eq("canonical_generation_count", currentGenerationCount)
      .neq("status", "processing")
      .lt("canonical_generation_count", MAX_FAMILY_CHARACTER_GENERATIONS)
      .select("canonical_generation_count")
      .maybeSingle<{ canonical_generation_count: number }>();
    if (claimError) throw claimError;
    if (!claimedCharacter) {
      return NextResponse.json(
        { error: "生成状态已经变化，请刷新后再试。" },
        { status: 409 },
      );
    }
    generationClaimed = true;
    claimedGenerationCount = normalizeFamilyCharacterGenerationCount(
      claimedCharacter.canonical_generation_count,
    );

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
        canonical_crop: DEFAULT_FAMILY_IMAGE_CROP,
        status: "ready",
        error_message: null,
      })
      .eq("id", character.id)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      status: "ready",
      generationCount: claimedGenerationCount,
      remainingGenerations: getRemainingFamilyCharacterGenerations(
        claimedGenerationCount,
      ),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "角色形象生成失败。";
    if (generationClaimed && characterId && userId) {
      try {
        await getSupabaseAdmin()
          .from("family_characters")
          .update({
            status: "failed",
            error_message: message,
            canonical_generation_count: Math.max(
              0,
              claimedGenerationCount - 1,
            ),
          })
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
