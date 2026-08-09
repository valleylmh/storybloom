import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAudioRateLimit } from "@/lib/audio-rate-limit";
import {
  FamilyCharacterVoiceError,
  getFamilyCharacterVoiceForNarration,
} from "@/lib/family-character-voice-server";
import {
  ALLOWED_TTS_MODELS,
  ALLOWED_TTS_VOICES,
  NARRATION_FORMATS,
  NARRATION_MODES,
  NarrationAudioError,
  prepareNarrationAudio,
  resolveNarrationRequest,
  type NarrationAudioResult,
  type NarrationProgressStage,
} from "@/lib/narration-audio-server";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const audioSchema = z
  .object({
    storyId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,160}$/)
      .optional(),
    text: z.string().trim().min(1).max(5000).optional(),
    mode: z.enum(NARRATION_MODES).optional(),
    model: z.enum(ALLOWED_TTS_MODELS).optional(),
    voice: z.enum(ALLOWED_TTS_VOICES).optional(),
    format: z.enum(NARRATION_FORMATS).optional(),
    sampleRate: z.literal(24_000).optional(),
    familyCharacterId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (!value.storyId && !value.text) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "storyId 或 text 至少需要提供一项。",
        path: ["storyId"],
      });
    }
  });

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function errorResponse(error: unknown) {
  const status =
    error instanceof NarrationAudioError ||
    error instanceof AuthenticationError ||
    error instanceof FamilyCharacterVoiceError
      ? error.status
      : 500;
  const message = error instanceof Error ? error.message : "音频生成失败。";
  return NextResponse.json({ error: message }, { status });
}

function createAudioStream(
  request: Awaited<ReturnType<typeof resolveNarrationRequest>>,
) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSse(event, data)));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      send("progress", {
        stage: "connected",
        model: request.model,
        voice: request.publicVoice,
      });

      void prepareNarrationAudio(request, {
        onProgress(progress: {
          stage: NarrationProgressStage;
          model: string;
          voice: string;
        }) {
          send("progress", progress);
        },
      })
        .then((result: NarrationAudioResult) => {
          send("final", result);
          close();
        })
        .catch((error: unknown) => {
          console.error("[audio]", error);
          send("error", {
            error: error instanceof Error ? error.message : "音频生成失败。",
          });
          close();
        });
    },
  });
}

export async function POST(req: NextRequest) {
  const clientIdentifier =
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const rateLimit = await checkAudioRateLimit(clientIdentifier);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "音频请求过于频繁，请稍后重试。" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = audioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "音频参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const familyVoice = parsed.data.familyCharacterId
      ? await getFamilyCharacterVoiceForNarration(
          (await requireAuthenticatedUser(req)).id,
          parsed.data.familyCharacterId,
        )
      : undefined;
    const { familyCharacterId: _familyCharacterId, ...narrationInput } = parsed.data;
    // storyId always wins when its server-side story exists. text remains an
    // optional fallback for legacy, sample, and custom-book callers.
    const narrationRequest = await resolveNarrationRequest(narrationInput, {
      familyVoice: familyVoice || undefined,
    });

    if (req.nextUrl.searchParams.get("stream") === "1") {
      return new Response(createAudioStream(narrationRequest), {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const result = await prepareNarrationAudio(narrationRequest);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[audio]", error);
    return errorResponse(error);
  }
}
