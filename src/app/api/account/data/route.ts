import { NextResponse } from "next/server";
import {
  AccountDeletionInputError,
  AccountDeletionNotFoundError,
  deleteAccountData,
  parseAccountDeletionRequest,
  type AccountDeletionAdminClient,
} from "@/lib/account/account-deletion";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  AuthenticationError,
  requireAuthenticatedUser,
} from "@/lib/supabase/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const deletionRequest = parseAccountDeletionRequest(body);
    const user = await requireAuthenticatedUser(request);
    const report = await deleteAccountData(
      getSupabaseAdmin() as unknown as AccountDeletionAdminClient,
      user.id,
      deletionRequest,
    );
    const status =
      report.status === "complete"
        ? 200
        : report.status === "partial"
          ? 207
          : 500;

    return json({ ...report, ok: report.status === "complete" }, status);
  } catch (error) {
    if (error instanceof AccountDeletionInputError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof AuthenticationError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof AccountDeletionNotFoundError) {
      return json({ error: error.message }, error.status);
    }

    console.error("[account-data-delete] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "暂时无法删除账户数据，请稍后重试。" }, 500);
  }
}
