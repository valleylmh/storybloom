import { NextResponse } from "next/server";
import { z } from "zod";
import { allowIpRequest } from "@/lib/request-rate-limit";
import { cacheCharacterReference } from "@/lib/storage";
import { getStoryTextEndpoint } from "@/lib/story-generator";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_VISION_MODEL = "gemini-3-flash";
const DEFAULT_AGNES_VISION_MODEL = "agnes-2.5-flash";

const recognitionSchema = z.object({
  valid: z.boolean(),
  subjectCount: z.number().int().min(0).max(20),
  summaryZh: z.string().max(180).optional().default(""),
  summaryEn: z.string().max(280).optional().default(""),
  prompt: z.string().max(600).optional().default(""),
  reasonZh: z.string().max(180).optional().default(""),
  reasonEn: z.string().max(280).optional().default(""),
});

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  errors?: Array<{ message?: string }>;
};

function extractJson(value: string) {
  const cleaned = value.replace(/```json\s*|\s*```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("识别服务没有返回有效结果。");
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as unknown;
}

function getErrorMessage(locale: "zh" | "en", zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

export async function POST(request: Request) {
  let locale: "zh" | "en" = "zh";
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    locale = formData.get("locale") === "en" ? "en" : "zh";

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: getErrorMessage(locale, "请选择一张人物照片。", "Choose a character photo.") },
        { status: 400 }
      );
    }
    if (!ACCEPTED_IMAGE_TYPES.has(image.type) || image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: getErrorMessage(
            locale,
            "图片格式不支持或文件过大，请上传 4MB 内的 JPG、PNG 或 WebP。",
            "Use a JPG, PNG, or WebP image under 4MB."
          ),
        },
        { status: 400 }
      );
    }

    if (
      !(await allowIpRequest(request, {
        limit: 5,
        window: "1 h",
        windowMs: 60 * 60 * 1000,
        prefix: "character-recognition",
      }))
    ) {
      return NextResponse.json(
        { error: getErrorMessage(locale, "请求过于频繁，请稍后再试。", "Too many requests. Try again later.") },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const endpoint = getStoryTextEndpoint();
    if (!endpoint) {
      return NextResponse.json(
        {
          error: getErrorMessage(
            locale,
            "人物识别服务尚未配置，请稍后再试。",
            "Character recognition is not configured yet."
          ),
        },
        { status: 503 }
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const imageDataUri = `data:${image.type};base64,${bytes.toString("base64")}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    let response: Response;
    try {
      response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${endpoint.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "StoryBloom Character Recognition",
        },
        body: JSON.stringify({
          model:
            process.env.CHARACTER_VISION_MODEL?.trim() ||
            process.env.STORY_TEXT_MODEL?.trim() ||
            (endpoint.provider === "agnes"
              ? DEFAULT_AGNES_VISION_MODEL
              : DEFAULT_VISION_MODEL),
          temperature: 0.1,
          max_tokens: 700,
          messages: [
            {
              role: "system",
              content:
                "You analyze user-provided photos for a children's storybook character form. Never identify the person, guess a name, infer ethnicity, nationality, health, religion, or other sensitive traits. Describe only clearly visible, non-sensitive appearance cues. Return JSON only.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Inspect this image and decide whether it contains exactly one clear main human subject suitable as a reusable storybook character reference. Ignore people shown only in posters, screens, or printed photos. Reject group photos, collages, no-person images, heavily obscured subjects, and images where the main person is too small to describe reliably.

Return exactly one JSON object with:
- valid: boolean. true only for one clear human subject.
- subjectCount: number of real visible human subjects.
- summaryZh: concise Chinese summary, at most 90 Chinese characters.
- summaryEn: concise English summary, at most 180 characters.
- prompt: English visual character description, at most 520 characters. Include only visible approximate age presentation, gender presentation when clear, face shape, hairstyle and hair color, visible eye cues, glasses or distinctive accessories, outfit type and main colors. End with a consistency instruction to keep the same identity and outfit colors across all pages. Do not describe pose, photo background, ethnicity, nationality, identity, personality, or attractiveness.
- reasonZh and reasonEn: short rejection reason when valid is false; otherwise empty strings.

Do not invent details that are not clearly visible.`,
                },
                { type: "image_url", image_url: { url: imageDataUri } },
              ],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await response.text();
    const payload = rawText ? (JSON.parse(rawText) as ChatCompletionResponse) : {};
    if (!response.ok) {
      throw new Error(
        payload.errors?.[0]?.message ||
          payload.error?.message ||
          `Character recognition HTTP ${response.status}`
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("识别服务没有返回人物描述。");
    }

    const result = recognitionSchema.parse(extractJson(content));
    if (!result.valid || result.subjectCount !== 1 || !result.prompt.trim()) {
      return NextResponse.json(
        {
          error:
            (locale === "zh" ? result.reasonZh : result.reasonEn) ||
            getErrorMessage(
              locale,
              "请上传一张主体清晰、只包含一个人的照片。",
              "Upload a clear image with exactly one main person."
            ),
        },
        { status: 422 }
      );
    }

    const summary = (locale === "zh" ? result.summaryZh : result.summaryEn).trim();
    const referenceToken = await cacheCharacterReference({
      bytes,
      contentType: image.type,
    });
    return NextResponse.json({
      summary:
        summary ||
        getErrorMessage(locale, "已提取人物外观特征", "Visible character features extracted"),
      prompt: result.prompt.trim(),
      referenceToken,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.error("[character-recognition]", error);
    return NextResponse.json(
      {
        error: isTimeout
          ? getErrorMessage(
              locale,
              "人物识别超时，请换一张更清晰的照片后重试。",
              "Character recognition timed out. Try a clearer photo."
            )
          : getErrorMessage(
              locale,
              "人物识别失败，请稍后重试。",
              "Character recognition failed. Try again later."
            ),
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
