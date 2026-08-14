import { NextRequest, NextResponse } from "next/server";
import {
  readTemporaryStoryAsset,
  type TemporaryStoryAssetPrincipal,
} from "@/lib/temporary-story-asset-store";
import {
  StoryAssetPrincipalConfigurationError,
  createUserStoryAssetPrincipal,
  resolveStoryAssetRequestPrincipal,
} from "@/lib/story-asset-principal";
import { getAuthenticatedUser } from "@/lib/supabase/server-auth";
import {
  classifyGenerationError,
  logGenerationEvent,
} from "@/lib/generation-observability";

export const runtime = "nodejs";

const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function notFoundResponse() {
  return new NextResponse(null, {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function resolveReadPrincipals(request: NextRequest) {
  const resolved = await resolveStoryAssetRequestPrincipal(request);
  const principals: TemporaryStoryAssetPrincipal[] = [
    resolved.anonymousPrincipal,
  ];

  // Image elements cannot attach a Bearer token, so the same-device anonymous
  // principal is always checked first. Explicit authenticated fetches may also
  // read a user-owned/granted asset without putting credentials in the URL.
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (user) principals.push(createUserStoryAssetPrincipal(user.id));
  return principals;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) {
  const assetId = (await context.params).assetId;
  if (!ASSET_ID_PATTERN.test(assetId)) return notFoundResponse();

  try {
    const principals = await resolveReadPrincipals(request);
    let asset = null;
    for (const principal of principals) {
      asset = await readTemporaryStoryAsset({ assetId, principal });
      if (asset) break;
    }
    if (!asset) return notFoundResponse();

    if (request.headers.get("if-none-match") === asset.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: asset.etag,
          "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new NextResponse(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.byteSize),
        ETag: asset.etag,
        "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (!(error instanceof StoryAssetPrincipalConfigurationError)) {
      logGenerationEvent(
        {
          operation: "storage.temp_asset_read",
          status: "failed",
          errorClass: classifyGenerationError(error),
        },
        "error",
      );
    }
    // Configuration, storage, authorization and absence deliberately share the
    // same public response so the route cannot be used as an asset oracle.
    return notFoundResponse();
  }
}
