import crypto from "node:crypto";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { customError, customJson, smallJson } from "@/lib/custom-book/http";
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { code } = z
      .object({ code: z.string().min(1).max(100) })
      .parse(await smallJson(request, 2000));
    const normalized = code.toUpperCase().replace(/[\s-]/g, "");
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    const { data, error } = await getSupabaseAdmin().rpc("custom_book_redeem", {
      p_user: user.id,
      p_hash: hash,
    });
    if (error) throw error;
    if (data.error)
      return customJson(
        {
          error:
            data.error === "RATE_LIMITED"
              ? "兑换尝试过于频繁，请一小时后再试。"
              : "兑换码无效、已使用或已过期。",
        },
        data.error === "RATE_LIMITED" ? 429 : 400,
      );
    return customJson(data);
  } catch (e) {
    return customError(e);
  }
}
