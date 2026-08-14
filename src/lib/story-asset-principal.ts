import "server-only";

import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { TemporaryStoryAssetPrincipal } from "@/lib/temporary-story-asset-store";
import { getAuthenticatedUser } from "@/lib/supabase/server-auth";

export const STORY_ASSET_SESSION_COOKIE = "storybloom_asset_session";

const PRINCIPAL_VERSION = "v1";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const PRINCIPAL_ID_PATTERN = /^v1_[a-f0-9]{64}$/;
const MINIMUM_SECRET_LENGTH = 32;
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type StoryAssetRequestPrincipal = {
  principal: TemporaryStoryAssetPrincipal;
  anonymousPrincipal: TemporaryStoryAssetPrincipal;
  userPrincipal?: TemporaryStoryAssetPrincipal;
  createdAnonymousSession: boolean;
  anonymousSessionToken: string;
};

export class StoryAssetPrincipalConfigurationError extends Error {
  readonly code = "STORY_ASSET_PRINCIPAL_NOT_CONFIGURED";

  constructor() {
    super("Story asset principal signing is not configured.");
    this.name = "StoryAssetPrincipalConfigurationError";
  }
}

function configuredPrincipalSecret() {
  const secret = process.env.STORYBLOOM_ASSET_PRINCIPAL_SECRET?.trim();
  return secret && secret.length >= MINIMUM_SECRET_LENGTH ? secret : null;
}

export function isStoryAssetPrincipalConfigured() {
  return Boolean(configuredPrincipalSecret());
}

function requirePrincipalSecret() {
  const secret = configuredPrincipalSecret();
  if (!secret) throw new StoryAssetPrincipalConfigurationError();
  return secret;
}

function derivePrincipalId(type: "anonymous" | "user", sourceId: string) {
  if (!sourceId || sourceId.length > 512) {
    throw new Error("Invalid story asset principal source.");
  }
  return `${PRINCIPAL_VERSION}_${crypto
    .createHmac("sha256", requirePrincipalSecret())
    .update(`${PRINCIPAL_VERSION}:${type}:${sourceId}`)
    .digest("hex")}`;
}

export function createAnonymousStoryAssetPrincipal(sessionToken: string) {
  if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
    throw new Error("Invalid anonymous story asset session.");
  }
  return {
    type: "anonymous" as const,
    id: derivePrincipalId("anonymous", sessionToken),
  } satisfies TemporaryStoryAssetPrincipal;
}

export function createUserStoryAssetPrincipal(userId: string) {
  const normalized = userId.trim();
  if (!normalized || normalized.length > 256) {
    throw new Error("Invalid user story asset principal.");
  }
  return {
    type: "user" as const,
    id: derivePrincipalId("user", normalized),
  } satisfies TemporaryStoryAssetPrincipal;
}

function readAnonymousSessionToken(request: NextRequest) {
  const token = request.cookies.get(STORY_ASSET_SESSION_COOKIE)?.value || "";
  return SESSION_TOKEN_PATTERN.test(token) ? token : null;
}

export async function resolveStoryAssetRequestPrincipal(
  request: NextRequest,
): Promise<StoryAssetRequestPrincipal> {
  let anonymousSessionToken = readAnonymousSessionToken(request);
  const createdAnonymousSession = !anonymousSessionToken;
  if (!anonymousSessionToken) {
    anonymousSessionToken = crypto.randomBytes(24).toString("base64url");
  }

  const anonymousPrincipal = createAnonymousStoryAssetPrincipal(
    anonymousSessionToken,
  );
  const user = await getAuthenticatedUser(request).catch(() => null);
  const userPrincipal = user
    ? createUserStoryAssetPrincipal(user.id)
    : undefined;

  return {
    principal: userPrincipal || anonymousPrincipal,
    anonymousPrincipal,
    ...(userPrincipal ? { userPrincipal } : {}),
    createdAnonymousSession,
    anonymousSessionToken,
  };
}

export function attachStoryAssetSessionCookie(
  response: NextResponse,
  resolved: Pick<
    StoryAssetRequestPrincipal,
    "createdAnonymousSession" | "anonymousSessionToken"
  >,
) {
  if (!resolved.createdAnonymousSession) return response;
  response.cookies.set({
    name: STORY_ASSET_SESSION_COOKIE,
    value: resolved.anonymousSessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function isOpaqueStoryAssetPrincipalId(value: string) {
  return PRINCIPAL_ID_PATTERN.test(value);
}
