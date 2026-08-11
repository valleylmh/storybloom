import "server-only";

import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { parseFamilyVoiceReadySnapshot } from "@/lib/family-character-voice-private-server";
import { isFamilyVoiceCloningEnabled } from "@/lib/family-voice";
import type { TrustedFamilyVoice } from "@/lib/narration-audio-server";

type FamilyCharacterVoiceRow = {
  voice_id: string | null;
  status: "processing" | "ready" | "failed" | "deleting";
  updated_at: string | null;
  previous_ready_voice: unknown;
};

type FamilyCharacterKindRow = {
  kind: "person" | "pet";
};

export class FamilyCharacterVoiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "FamilyCharacterVoiceError";
    this.status = status;
  }
}

function isMissingVoiceRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
  const message = [candidate.message, candidate.details]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /family_character_voices.*(?:does not exist|schema cache)/i.test(message)
  );
}

export async function getFamilyCharacterVoiceForNarration(
  userId: string,
  familyCharacterId: string,
): Promise<TrustedFamilyVoice | null> {
  if (!isFamilyVoiceCloningEnabled()) {
    throw new FamilyCharacterVoiceError(
      "家庭真人声音功能暂未开放。",
      404,
    );
  }
  const { data, error } = await getSupabaseAdmin()
    .from("family_character_voices")
    .select("voice_id,status,updated_at,previous_ready_voice")
    .eq("user_id", userId)
    .eq("family_character_id", familyCharacterId)
    .maybeSingle<FamilyCharacterVoiceRow>();

  if (error) {
    if (isMissingVoiceRelation(error)) {
      throw new FamilyCharacterVoiceError(
        "家庭声音功能尚未完成数据库部署，请稍后重试。",
        503,
        { cause: error },
      );
    }
    throw new FamilyCharacterVoiceError(
      "家庭声音暂时无法读取，请稍后重试。",
      502,
      { cause: error },
    );
  }
  if (!data) return null;
  let trustedVoiceId: string;
  if (data.status === "processing") {
    const previousReadyVoice = parseFamilyVoiceReadySnapshot(
      data.previous_ready_voice,
      userId,
      familyCharacterId,
    );
    if (!previousReadyVoice) {
      throw new FamilyCharacterVoiceError(
        "这个家庭角色的声音正在创建，请稍后再试。",
        409,
      );
    }
    trustedVoiceId = previousReadyVoice.voice_id;
  } else if (data.status === "ready" && data.voice_id?.trim()) {
    trustedVoiceId = data.voice_id.trim();
  } else {
    throw new FamilyCharacterVoiceError(
      "这个家庭角色的声音尚未就绪，请重新录制。",
      409,
    );
  }

  const { data: character, error: characterError } = await getSupabaseAdmin()
    .from("family_characters")
    .select("kind")
    .eq("id", familyCharacterId)
    .eq("user_id", userId)
    .maybeSingle<FamilyCharacterKindRow>();
  if (characterError) {
    throw new FamilyCharacterVoiceError(
      "家庭角色暂时无法读取，请稍后重试。",
      502,
      { cause: characterError },
    );
  }
  if (!character || character.kind !== "person") {
    throw new FamilyCharacterVoiceError(
      "只有家庭人物角色可以使用真人声音。",
      409,
    );
  }

  return {
    familyCharacterId,
    voiceId: trustedVoiceId,
    revision: data.updated_at || undefined,
  };
}
