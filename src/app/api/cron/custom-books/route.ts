import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import { advanceCustomJob } from "@/lib/custom-book/service";
import { customJson } from "@/lib/custom-book/http";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const secret = process.env.GENERATION_WORKER_SECRET;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(token) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  )
    return customJson({ error: "Unauthorized" }, 401);
  const { data, error } = await getSupabaseAdmin()
    .from("custom_book_jobs")
    .select("id,user_id")
    .in("status", ["outline", "images"])
    .is("lease_id", null)
    .order("updated_at", { ascending: true })
    .limit(1);
  if (error) return customJson({ error: "Worker unavailable" }, 503);
  if (!data?.[0]) return customJson({ processed: 0 });
  try {
    const job = await advanceCustomJob(data[0].user_id, data[0].id);
    return customJson({ processed: 1, id: job.id, status: job.status });
  } catch {
    return customJson({ error: "Worker failed" }, 503);
  }
}
