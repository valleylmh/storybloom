import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createDemoPages, getImageToImageProviderForPage } from "@/lib/image-generator";
import { getClientIp } from "@/lib/request-rate-limit";
import {
  cacheStory,
  getCachedCharacterReference,
  getDailyFreeGenerationLimit,
  rateLimiter,
} from "@/lib/storage";
import { generateStoryText } from "@/lib/story-generator";
import { normalizeCharacterName } from "@/lib/story-input";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { AuthenticationError, requireAuthenticatedUser } from "@/lib/supabase/server-auth";
import type {
  FamilyCharacterInput,
  GenerateErrorResponse,
  GenerateResponse,
  GeneratedStory,
  StoryInput,
  StoryPage,
} from "@/types";

const generateSchema = z.object({
  childName: z.string().min(1).max(20),
  narrativePerspective: z.enum(["third-person", "first-person"]).optional(),
  protagonistFamilyCharacterId: z.string().uuid().optional(),
  ageGroup: z.enum(["2-3", "4-5", "6-8"]),
  favoriteToy: z.string().trim().max(80).optional(),
  favoriteFood: z.string().trim().max(80).optional(),
  bestFriend: z.string().trim().max(80).optional(),
  otherDetails: z.string().trim().max(200).optional(),
  theme: z.enum(["courage", "friendship", "nature", "family", "fear", "creativity", "custom"]),
  customTheme: z.string().max(100).optional(),
  style: z.enum(["watercolor", "cartoon", "fairytale"]),
  language: z.enum(["zh-en", "en-zh", "zh", "en"]),
  characterReferenceId: z.string().max(80).optional(),
  characterReferenceLabel: z.string().max(80).optional(),
  characterReferencePrompt: z.string().max(800).optional(),
  customCharacterReferenceToken: z.string().regex(/^[A-Za-z0-9_-]{32,96}$/).optional(),
  characterDescription: z.string().max(1200).optional(),
  dedication: z.string().max(100).optional(),
  familyCharacterIds: z.array(z.string().uuid()).max(8).optional(),
  browserFingerprint: z.string().min(8).max(256).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

type FamilyCharacterRow = {
  id: string;
  display_name: string;
  relationship: string;
  description: string | null;
  canonical_photo_path: string | null;
  source_photo_path: string | null;
};

async function getSelectedFamilyCharacters(
  req: NextRequest,
  familyCharacterIds: string[] | undefined,
  protagonistFamilyCharacterId?: string,
): Promise<FamilyCharacterInput[]> {
  const uniqueIds = [...new Set(familyCharacterIds ?? [])];
  if (uniqueIds.length === 0) {
    return [];
  }

  const user = await requireAuthenticatedUser(req);
  const { data, error } = await getSupabaseAdmin()
    .from("family_characters")
    .select(
      "id, display_name, relationship, description, canonical_photo_path, source_photo_path"
    )
    .eq("user_id", user.id)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Unable to load family characters: ${error.message}`);
  }

  const rows = (data ?? []) as FamilyCharacterRow[];
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  if (rows.length !== uniqueIds.length || uniqueIds.some((id) => !rowsById.has(id))) {
    throw new AuthenticationError("One or more family characters are unavailable");
  }

  const orderedIds = protagonistFamilyCharacterId
    ? [protagonistFamilyCharacterId, ...uniqueIds.filter((id) => id !== protagonistFamilyCharacterId)]
    : uniqueIds;

  return orderedIds.map((id) => {
    const row = rowsById.get(id)!;
    const referenceAssetPath = row.canonical_photo_path;
    return {
      id: row.id,
      name: row.display_name,
      relation: row.relationship,
      appearance: row.description?.trim() || `${row.relationship} ${row.display_name}`,
      referenceAssetPath: referenceAssetPath || undefined,
      isProtagonist: row.id === protagonistFamilyCharacterId,
    };
  });
}

function createPublicStoryInput(input: StoryInput): StoryInput {
  const {
    customCharacterReferenceToken: _customCharacterReferenceToken,
    ...publicInput
  } = input;
  return {
    ...publicInput,
    familyCharacters: input.familyCharacters?.map(
      ({ referenceAssetPath: _referenceAssetPath, ...character }) => character
    ),
  };
}

function createRateLimitIdentifier(ip: string, browserFingerprint?: string) {
  const identifierSource = `ip:${ip}|browser:${browserFingerprint?.trim() || "none"}`;

  return crypto.createHash("sha256").update(identifierSource).digest("hex");
}

function pageUsesFamilyPhoto(
  page: StoryPage,
  familyCharacters: FamilyCharacterInput[],
) {
  const castIds = new Set(page.castIds || []);
  return familyCharacters.some(
    (character) => character.referenceAssetPath && castIds.has(character.id),
  );
}

type TurnstileVerificationResult = {
  ok: boolean;
  configurationError?: boolean;
};

async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string
): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const required = process.env.NODE_ENV === "production" || Boolean(secret);

  if (!required) {
    return { ok: true };
  }

  if (!secret) {
    return { ok: false, configurationError: true };
  }

  if (!token) {
    return { ok: false };
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteIp && remoteIp !== "anonymous") {
    formData.append("remoteip", remoteIp);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    return { ok: false };
  }

  const result = (await response.json()) as { success?: boolean };
  return { ok: result.success === true };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "表单参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const {
    browserFingerprint,
    turnstileToken,
    familyCharacterIds,
    protagonistFamilyCharacterId,
    ...baseInput
  } = parsed.data;
  if (
    protagonistFamilyCharacterId &&
    !(familyCharacterIds || []).includes(protagonistFamilyCharacterId)
  ) {
    return NextResponse.json(
      { error: "确认的主角不在已选择的家庭角色中。" },
      { status: 400 },
    );
  }
  let familyCharacters: FamilyCharacterInput[];
  try {
    familyCharacters = await getSelectedFamilyCharacters(
      req,
      familyCharacterIds,
      protagonistFamilyCharacterId,
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[generate] family characters", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "家庭角色读取失败，请稍后重试。" },
      { status: 400 }
    );
  }
  const input: StoryInput = {
    ...baseInput,
    protagonistFamilyCharacterId,
    customCharacterReferenceToken:
      baseInput.characterReferenceId === "custom-upload"
        ? baseInput.customCharacterReferenceToken
        : undefined,
    familyCharacters: familyCharacters.length > 0 ? familyCharacters : undefined,
  };
  const protagonistCharacter = protagonistFamilyCharacterId
    ? familyCharacters.find((character) => character.id === protagonistFamilyCharacterId)
    : undefined;
  if (
    protagonistCharacter &&
    normalizeCharacterName(protagonistCharacter.name) !== normalizeCharacterName(input.childName)
  ) {
    return NextResponse.json(
      { error: "确认的主角姓名与家庭角色不一致，请重新确认。" },
      { status: 400 },
    );
  }
  if (input.characterReferenceId === "custom-upload") {
    if (!input.customCharacterReferenceToken) {
      return NextResponse.json(
        { error: "自定义人物参考图已失效，请重新上传。" },
        { status: 400 }
      );
    }
    if (familyCharacters.length > 0) {
      return NextResponse.json(
        { error: "自定义主角照片不能与家庭角色同时使用。" },
        { status: 400 }
      );
    }
    const customReference = await getCachedCharacterReference(
      input.customCharacterReferenceToken
    );
    if (!customReference) {
      return NextResponse.json(
        { error: "自定义人物参考图已过期，请重新上传。" },
        { status: 410 }
      );
    }
  }
  const turnstile = await verifyTurnstile(turnstileToken, ip);

  if (!turnstile.ok) {
    return NextResponse.json(
      {
        error: turnstile.configurationError
          ? "人机验证未配置，请联系站点管理员。"
          : "人机验证失败，请刷新后重试。",
      },
      { status: turnstile.configurationError ? 500 : 403 }
    );
  }

  const dailyLimit = getDailyFreeGenerationLimit();
  const rateLimitIdentifier = createRateLimitIdentifier(ip, browserFingerprint);
  const rateLimitReservation = await rateLimiter.reserve(rateLimitIdentifier);
  const { success, remaining } = rateLimitReservation;

  if (!success) {
    return NextResponse.json(
      { error: `今日 ${dailyLimit} 次免费生成机会已用完，请明天再试。` },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(dailyLimit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const storyId = nanoid(12);

  try {
    const { pages, coverTitle } = await generateStoryText(input);
    const previewPages = createDemoPages(pages, input.style).map((page) =>
      pageUsesFamilyPhoto(page, familyCharacters)
        ? { ...page, imagePlannedProvider: "cpa" as const }
        : input.customCharacterReferenceToken
          ? {
              ...page,
              imagePlannedProvider: getImageToImageProviderForPage(
                page.page,
                pages.length
              ),
            }
          : page
    );

    const story: GeneratedStory = {
      id: storyId,
      input,
      pages: previewPages,
      coverTitle,
      createdAt: new Date().toISOString(),
      status: "generating_images",
      generationMode: "live",
    };

    await cacheStory(storyId, story);

    const response: GenerateResponse = {
      storyId,
      input: createPublicStoryInput(input),
      coverTitle,
      pages: previewPages,
      totalPages: previewPages.length,
      generationMode: "live",
      freeChanceLabel: `今日免费生成 ${dailyLimit} 次`,
      imagesPending: true,
    };

    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Limit": String(dailyLimit),
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  } catch (error) {
    console.error("[generate]", error);
    await rateLimitReservation.release().catch((releaseError) => {
      console.error("[generate] failed to release rate limit reservation", releaseError);
    });

    const payload: GenerateErrorResponse = {
      error: "故事生成失败，请稍后再试。",
      stage: "generating_text",
      retryable: true,
    };

    return NextResponse.json(payload, { status: 500 });
  }
}
