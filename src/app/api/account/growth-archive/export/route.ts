import { NextResponse } from "next/server";
import {
  createCloudGrowthArchiveExport,
  readCloudGrowthArchiveSnapshot,
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

function getTimeZone(request: Request) {
  const candidate = request.headers.get("x-storybloom-time-zone") || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdmin();
    const snapshot = await readCloudGrowthArchiveSnapshot(supabase, user.id, {
      includeExportData: true,
    });
    const result = await createCloudGrowthArchiveExport(
      supabase,
      snapshot,
      new Date().toISOString(),
      getTimeZone(request),
    );
    return new Response(result.blob, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/zip",
        "Content-Length": String(result.blob.size),
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "X-StoryBloom-Export-Status": result.report.status,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "请先登录后再导出私有云成长档案。" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }
    console.error("[cloud-growth-archive-export] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "私有云成长档案导出失败，请稍后重试。" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
