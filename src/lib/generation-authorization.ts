import "server-only";

import crypto from "node:crypto";
import type { StoryAssetRequestPrincipal } from "@/lib/story-asset-principal";

const MAX_PRINCIPALS = 4;
const PRINCIPAL_ID_PATTERN = /^v1_[a-f0-9]{64}$/;

export type GenerationOwnedResource = {
  generationPrincipalIds?: string[];
};

function safeEqual(left: string, right: string) {
  if (!PRINCIPAL_ID_PATTERN.test(left) || !PRINCIPAL_ID_PATTERN.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function getGenerationPrincipalIds(
  resolved: Pick<
    StoryAssetRequestPrincipal,
    "anonymousPrincipal" | "userPrincipal"
  >,
) {
  return Array.from(
    new Set(
      [resolved.anonymousPrincipal.id, resolved.userPrincipal?.id].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ).slice(0, MAX_PRINCIPALS);
}

export function isGenerationResourceOwned(resource: GenerationOwnedResource) {
  return (
    Array.isArray(resource.generationPrincipalIds) &&
    resource.generationPrincipalIds.length > 0
  );
}

export function canAccessGenerationResource(
  resource: GenerationOwnedResource,
  resolved: Pick<
    StoryAssetRequestPrincipal,
    "anonymousPrincipal" | "userPrincipal"
  >,
) {
  if (!isGenerationResourceOwned(resource)) return true;
  const candidates = getGenerationPrincipalIds(resolved);
  return resource.generationPrincipalIds!.some(
    (allowed) => candidates.some((candidate) => safeEqual(allowed, candidate)),
  );
}
