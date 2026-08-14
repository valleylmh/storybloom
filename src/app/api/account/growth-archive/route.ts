import { NextResponse } from "next/server";
import {
  CloudGrowthArchiveInputError,
  deleteCloudGrowthArchive,
  parseCloudGrowthArchiveDeleteRequest,
  readCloudGrowthArchiveSnapshot,
  summarizeCloudGrowthArchive,
  updateCloudGrowthRetention,
} from "@/lib/account/cloud-growth-archive";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function getTimeZone(request: Request) {
  const candidate = request.headers.get("x-storybloom-time-zone") || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function handleError(error: unknown) {
  if (error instanceof CloudGrowthArchiveInputError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof AuthenticationError) {
    return json({ error: error.message }, error.status);
  }
  console.error("[cloud-growth-archive] failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return json({ error: "私有云成长档案操作失败，请稍后重试。" }, 500);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const snapshot = await readCloudGrowthArchiveSnapshot(
      getSupabaseAdmin(),
      user.id,
    );
    return json({
      summary: summarizeCloudGrowthArchive(
        snapshot,
        new Date(),
        getTimeZone(request),
      ),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdmin();
    await updateCloudGrowthRetention(
      supabase,
      user.id,
      body && typeof body === "object"
        ? (body as { retentionDays?: unknown }).retentionDays
        : undefined,
    );
    const snapshot = await readCloudGrowthArchiveSnapshot(supabase, user.id);
    return json({
      summary: summarizeCloudGrowthArchive(
        snapshot,
        new Date(),
        getTimeZone(request),
      ),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const deletionRequest = parseCloudGrowthArchiveDeleteRequest(body);
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdmin();
    const snapshot = await readCloudGrowthArchiveSnapshot(supabase, user.id);
    const report = await deleteCloudGrowthArchive(
      supabase,
      snapshot,
      deletionRequest,
      new Date(),
      getTimeZone(request),
    );
    const status =
      report.status === "complete"
        ? 200
        : report.status === "partial"
          ? 207
          : 500;
    return json({ ok: report.status === "complete", report }, status);
  } catch (error) {
    return handleError(error);
  }
}
