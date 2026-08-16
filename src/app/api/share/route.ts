import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getAuthenticatedUser } from "@/lib/supabase/server-auth";
import {
  createSharedStory,
  listOwnedSharedStories,
  revokeOwnedStoryShares,
  revokeSharedStory,
} from "@/lib/share-store";
import {
  StoryAssetPrincipalConfigurationError,
  createUserStoryAssetPrincipal,
  resolveStoryAssetRequestPrincipal,
} from "@/lib/story-asset-principal";
import type { TemporaryStoryAssetPrincipal } from "@/lib/temporary-story-asset-store";
import {
  classifyGenerationError,
  logGenerationEvent,
} from "@/lib/generation-observability";

export const runtime = "nodejs";

const pageSchema = z.object({
  page: z.number().int().min(1).max(16),
  zhText: z.string().max(500),
  enText: z.string().max(1000),
  imageUrl: z.string().max(4_000_000).optional(),
});

const createSchema = z.object({
  clientStoryId: z.string().trim().min(1).max(200).optional(),
  coverTitle: z.string().trim().min(1).max(120),
  childName: z.string().trim().min(1).max(40),
  language: z.enum(["zh-en", "en-zh", "zh", "en"]),
  pages: z.array(pageSchema).min(1).max(16),
  expiry: z.enum(["7d", "30d", "never"]).default("30d"),
});

const deleteSchema = z.object({
  shareId: z.string().trim().min(10).max(30).optional(),
  deleteToken: z.string().trim().min(10).max(40).optional(),
  clientStoryId: z.string().trim().min(1).max(200).optional(),
}).refine((value) => Boolean(value.shareId || value.clientStoryId), {
  message: "shareId or clientStoryId is required",
});

const localAttempts = new Map<string, { count: number; resetAt: number }>();
let limiter: Ratelimit | null | undefined;

function getLimiter() {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  limiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(10, "1 h"),
          prefix: "storybloom:share",
        })
      : null;
  return limiter;
}

async function allowRequest(identifier: string) {
  const remoteLimiter = getLimiter();
  if (remoteLimiter) {
    return (await remoteLimiter.limit(identifier)).success;
  }

  const now = Date.now();
  const current = localAttempts.get(identifier);
  if (!current || current.resetAt <= now) {
    localAttempts.set(identifier, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= 10;
}

function getIdentifier(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const shares = await listOwnedSharedStories(user.id);
    return NextResponse.json({
      shares: shares.map((share) => ({
        shareId: share.shareId,
        clientStoryId: share.clientStoryId,
        coverTitle: share.story.coverTitle,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        revokedAt: share.revokedAt,
      })),
    });
  } catch (error) {
    logGenerationEvent(
      {
        operation: "share.list",
        status: "failed",
        errorClass: classifyGenerationError(error),
      },
      "error",
    );
    return NextResponse.json({ error: "Unable to list share links" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid share request" }, { status: 400 });
    }

    if (!(await allowRequest(getIdentifier(request)))) {
      return NextResponse.json(
        { error: "Too many share requests" },
        { status: 429 },
      );
    }

    const user = await getAuthenticatedUser(request);
    let assetPrincipals: TemporaryStoryAssetPrincipal[] = [];
    try {
      const resolved = await resolveStoryAssetRequestPrincipal(request);
      assetPrincipals = [resolved.anonymousPrincipal];
      if (user) assetPrincipals.push(createUserStoryAssetPrincipal(user.id));
    } catch (error) {
      if (!(error instanceof StoryAssetPrincipalConfigurationError)) throw error;
      // Backward-compatible while temporary assets are disabled: data URIs and
      // stable site assets still share normally without a principal secret.
    }
    const { shareId, deleteToken, expiresAt } = await createSharedStory({
      ...parsed.data,
      ownerUserId: user?.id,
      assetPrincipals,
    });

    return NextResponse.json({ shareId, deleteToken, expiresAt });
  } catch (error) {
    logGenerationEvent(
      {
        operation: "share.create",
        status: "failed",
        errorClass: classifyGenerationError(error),
      },
      "error",
    );
    return NextResponse.json({ error: "Unable to create share link" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    if (parsed.data.clientStoryId) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const result = await revokeOwnedStoryShares(
        user.id,
        parsed.data.clientStoryId,
      );
      if (result.cleanupPending > 0) {
        return NextResponse.json(
          { error: "Share was revoked but asset cleanup is pending", revoked: true },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: true, revoked: result.total });
    }

    const result = await revokeSharedStory({
      shareId: parsed.data.shareId!,
      deleteToken: parsed.data.deleteToken,
      ownerUserId: user?.id,
    });
    if (result.status === "not-found") {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }
    if (result.status === "cleanup-pending") {
      return NextResponse.json(
        { error: "Share was revoked but asset cleanup is pending", revoked: true },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logGenerationEvent(
      {
        operation: "share.delete",
        status: "failed",
        errorClass: classifyGenerationError(error),
      },
      "error",
    );
    return NextResponse.json({ error: "Unable to delete share link" }, { status: 500 });
  }
}
