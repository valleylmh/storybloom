import { NextResponse } from "next/server";
import { createAccountExport } from "@/lib/account/account-export";
import { readAccountData } from "@/lib/account/account-data";
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

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const supabase = getSupabaseAdmin();
    const snapshot = await readAccountData(supabase, user);
    const result = await createAccountExport(supabase, snapshot);

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
        { error: "请先登录后再导出账户数据。" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    console.error("[account-export] failed", error);
    return NextResponse.json(
      { error: "账户数据导出失败，请稍后重试。" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

