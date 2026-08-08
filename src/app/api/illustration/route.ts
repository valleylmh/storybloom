import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getImageToImageProviderForPage,
  getProviderForPage,
  regeneratePage,
} from "@/lib/image-generator";
import { isRecentPendingIllustration } from "@/lib/illustration-request-policy";
import { hasFamilyCharacterReference } from "@/lib/family-story-characters";
import { allowIpRequest } from "@/lib/request-rate-limit";
import { cacheStory, getCachedStory } from "@/lib/storage";
import type { GeneratedStory } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const manualRegenerationProviderOrder = ["pollinations"] as const;
const DEFAULT_ILLUSTRATION_RATE_LIMIT_PER_STORY = 64;

function getIllustrationRateLimitPerStory() {
  const configured = Number.parseInt(
    process.env.ILLUSTRATION_RATE_LIMIT_PER_STORY || "",
    10,
  );
  return Number.isFinite(configured) && configured >= 8
    ? configured
    : DEFAULT_ILLUSTRATION_RATE_LIMIT_PER_STORY;
}

const illustrationSchema = z.object({
  storyId: z.string().min(1),
  page: z.number().int().min(1).max(8),
  regenerationMode: z.enum(["free-fallback"]).optional(),
});

const illustrationQuerySchema = z.object({
  storyId: z.string().min(1),
  page: z.coerce.number().int().min(1).max(8),
});

function getPagePayload(story: GeneratedStory, pageNumber: number) {
  const page = story.pages.find((item) => item.page === pageNumber);
  if (!page) {
    return null;
  }

  return {
    page,
    allComplete: story.pages.every((item) => item.imageStatus === "complete"),
  };
}

function isSameGenerationAttempt(
  latestStory: GeneratedStory,
  targetPage: GeneratedStory["pages"][number]
) {
  const latestPage = latestStory.pages.find((page) => page.page === targetPage.page);
  return Boolean(
    latestPage &&
      latestPage.imageStatus === "pending" &&
      latestPage.imageStartedAt === targetPage.imageStartedAt
  );
}

function pageUsesFamilyPhoto(
  story: GeneratedStory,
  page: GeneratedStory["pages"][number],
) {
  const castIds = new Set(page.castIds || []);
  return Boolean(
    story.input.familyCharacters?.some(
      (character) =>
        castIds.has(character.id) && hasFamilyCharacterReference(character),
    ),
  );
}

async function markPagePending(story: GeneratedStory, pageNumber: number) {
  const startedAt = new Date().toISOString();
  const targetPage = story.pages.find((page) => page.page === pageNumber);
  const plannedProvider = targetPage && pageUsesFamilyPhoto(story, targetPage)
    ? "cpa"
    : story.input.customCharacterReferenceToken
      ? getImageToImageProviderForPage(pageNumber, story.pages.length)
      : getProviderForPage(pageNumber, story.pages.length);
  const pages = story.pages.map((page) =>
    page.page === pageNumber
      ? {
          ...page,
          imageStatus: "pending" as const,
          imageError: undefined,
          imagePlannedProvider: plannedProvider,
          imageProvider: undefined,
          imageStartedAt: startedAt,
          imageCompletedAt: undefined,
          imageDurationMs: undefined,
          imageAttempts: [],
        }
      : page
  );

  const nextStory: GeneratedStory = {
    ...story,
    pages,
    status: "generating_images",
    generationMode: "live",
  };

  await cacheStory(story.id, nextStory);
  return nextStory;
}

async function generateAndCachePage(
  story: GeneratedStory,
  pageNumber: number,
  fallbackProviders?: Array<(typeof manualRegenerationProviderOrder)[number]>
) {
  const targetPage = story.pages.find((page) => page.page === pageNumber);
  if (!targetPage) {
    return;
  }

  try {
    const updatedPage = await regeneratePage(
      targetPage,
      Math.floor(Math.random() * 999999),
      story.input.style,
      story.input.characterReferenceId,
      fallbackProviders,
      story.input.familyCharacters,
      story.input.customCharacterReferenceToken,
      story.input.visualBible,
    );

    const latestStory = (await getCachedStory(story.id)) || story;
    if (!isSameGenerationAttempt(latestStory, targetPage)) {
      console.warn("[illustration] stale generation result ignored", {
        storyId: story.id,
        page: pageNumber,
        startedAt: targetPage.imageStartedAt,
      });
      return;
    }

    const pages = latestStory.pages.map((page) =>
      page.page === updatedPage.page ? updatedPage : page
    );
    const allComplete = pages.every((page) => page.imageStatus === "complete");

    await cacheStory(story.id, {
      ...latestStory,
      pages,
      status: allComplete ? "complete" : "generating_images",
      generationMode: "live",
    });
  } catch (error) {
    const latestStory = (await getCachedStory(story.id)) || story;
    if (!isSameGenerationAttempt(latestStory, targetPage)) {
      console.warn("[illustration] stale generation failure ignored", {
        storyId: story.id,
        page: pageNumber,
        startedAt: targetPage.imageStartedAt,
      });
      return;
    }

    const durationMs = targetPage.imageStartedAt
      ? Math.max(0, Date.now() - new Date(targetPage.imageStartedAt).getTime())
      : undefined;
    const failedPage = {
      ...targetPage,
      imageStatus: "failed" as const,
      imageError: error instanceof Error ? error.message : "插图生成失败。",
      imageCompletedAt: new Date().toISOString(),
      imageDurationMs: durationMs,
    };
    const pages = latestStory.pages.map((page) =>
      page.page === failedPage.page ? failedPage : page
    );

    await cacheStory(story.id, {
      ...latestStory,
      pages,
      status: "generating_images",
      generationMode: "live",
    });

    console.error("[illustration]", {
      storyId: story.id,
      page: pageNumber,
      error: failedPage.imageError,
    });
  }
}

export async function GET(req: NextRequest) {
  const parsed = illustrationQuerySchema.safeParse({
    storyId: req.nextUrl.searchParams.get("storyId"),
    page: req.nextUrl.searchParams.get("page"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "插图查询参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const story = await getCachedStory(parsed.data.storyId);
  if (!story) {
    return NextResponse.json({ error: "没有找到对应故事，请重新生成。" }, { status: 404 });
  }

  const payload = getPagePayload(story, parsed.data.page);
  if (!payload) {
    return NextResponse.json({ error: "没有找到对应页面。" }, { status: 404 });
  }

  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = illustrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "插图参数不完整，请检查后重试。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const story = await getCachedStory(parsed.data.storyId);
  if (!story) {
    return NextResponse.json({ error: "没有找到对应故事，请重新生成。" }, { status: 404 });
  }

  const targetPage = story.pages.find((page) => page.page === parsed.data.page);
  if (!targetPage) {
    return NextResponse.json({ error: "没有找到对应页面。" }, { status: 404 });
  }

  if (isRecentPendingIllustration(targetPage)) {
    const payload = getPagePayload(story, parsed.data.page);
    return NextResponse.json(
      {
        status: "accepted",
        page: payload?.page || targetPage,
        allComplete: false,
        reused: true,
      },
      { status: 202 },
    );
  }

  const rateLimit = getIllustrationRateLimitPerStory();
  if (
    !(await allowIpRequest(req, {
      limit: rateLimit,
      window: "1 h",
      windowMs: 60 * 60 * 1000,
      prefix: "illustration",
      identifier: parsed.data.storyId,
    }))
  ) {
    return NextResponse.json(
      { error: "这本绘本的插图重试次数较多，请稍后再试。" },
      {
        status: 429,
        headers: {
          "Retry-After": "3600",
          "X-RateLimit-Limit": String(rateLimit),
        },
      },
    );
  }

  const pendingStory = await markPagePending(story, parsed.data.page);
  const payload = getPagePayload(pendingStory, parsed.data.page);

  after(async () => {
    await generateAndCachePage(
      pendingStory,
      parsed.data.page,
      parsed.data.regenerationMode === "free-fallback"
        ? [...manualRegenerationProviderOrder]
        : undefined
    );
  });

  return NextResponse.json(
    {
      status: "accepted",
      page: payload?.page || { ...targetPage, imageStatus: "pending" },
      allComplete: false,
    },
    { status: 202 }
  );
}
