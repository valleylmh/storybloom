import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";
import { getLibraryStorySpecByContentId } from "@/lib/library/personalization";
import { buildStoryVisualBible } from "@/lib/story-visual-bible";
import { createStoryCharacterAnchorToken } from "@/lib/story-character-anchor";
import { getCachedCharacterReferenceDataUri } from "@/lib/storage";
import type { FamilyCharacterInput, StoryInput } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  sourceLibraryBookId: z
    .string()
    .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  characterId: z.string().uuid(),
  personalizationDraftId: z.string().uuid().optional(),
  appearance: z.string().trim().min(1).max(1200),
});

type FamilyCharacterRow = {
  id: string;
  user_id: string;
  display_name: string;
  relationship: string;
  description: string | null;
  canonical_photo_path: string | null;
  source_photo_path: string | null;
  cartoonize: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "角色 Anchor 参数不完整。" },
        { status: 400 },
      );
    }

    const storySpec = getLibraryStorySpecByContentId(
      parsed.data.sourceLibraryBookId,
    );
    if (!storySpec) {
      return NextResponse.json(
        { error: "来源绘本不存在或暂不支持家庭专属改编。" },
        { status: 404 },
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from("family_characters")
      .select(
        "id,user_id,display_name,relationship,description,canonical_photo_path,source_photo_path,cartoonize",
      )
      .eq("id", parsed.data.characterId)
      .eq("user_id", user.id)
      .maybeSingle<FamilyCharacterRow>();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "没有找到这个家庭角色。" },
        { status: 404 },
      );
    }

    const referenceAssetPath = data.cartoonize
      ? data.canonical_photo_path || data.source_photo_path
      : data.source_photo_path || data.canonical_photo_path;
    if (!referenceAssetPath) {
      return NextResponse.json(
        { error: "这个角色还没有可用于 Anchor 的参考图。" },
        { status: 400 },
      );
    }
    if (!referenceAssetPath.startsWith(`${user.id}/${data.id}/`)) {
      return NextResponse.json(
        { error: "角色参考图路径无效。" },
        { status: 400 },
      );
    }

    const character: FamilyCharacterInput = {
      id: data.id,
      name: data.display_name,
      relation: data.relationship,
      appearance: parsed.data.appearance,
      referenceAssetPath,
      sourceReferenceAssetPath: data.source_photo_path || undefined,
      canonicalReferenceAssetPath:
        data.cartoonize && data.canonical_photo_path
          ? data.canonical_photo_path
          : undefined,
      isProtagonist: true,
    };
    const storyInput: StoryInput = {
      childName: data.display_name,
      narrativePerspective: "first-person",
      protagonistFamilyCharacterId: data.id,
      ageGroup: storySpec.ageGroup,
      theme: "custom",
      customTheme: `家庭专属版：${storySpec.sourceTitle}`,
      style: "fairytale",
      language: "zh-en",
      sourceLibraryBookId: storySpec.sourceLibraryBookId,
      familyCharacters: [character],
    };
    const visualBible = buildStoryVisualBible(storyInput);
    const storyReferenceToken = await createStoryCharacterAnchorToken({
      character,
      visualBible,
      referenceCacheKey:
        parsed.data.personalizationDraftId ||
        `${storySpec.sourceLibraryBookId}:${data.id}`,
    });
    const imageDataUrl = await getCachedCharacterReferenceDataUri(
      storyReferenceToken,
    );
    if (!imageDataUrl) {
      throw new Error("角色 Anchor 已生成，但预览暂时不可用。");
    }

    return NextResponse.json(
      {
        storyReferenceToken,
        imageDataUrl,
        referenceType: data.canonical_photo_path ? "canonical" : "source",
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }
    console.error("[library-personalization-anchor]", error);
    return NextResponse.json(
      { error: "角色 Anchor 生成失败，请重试。" },
      { status: 503 },
    );
  }
}
