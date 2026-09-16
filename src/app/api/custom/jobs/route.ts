import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";
import { customDraftSchema } from "@/lib/custom-book/schema";
import {
  customQuota,
  publicCustomJob,
  reserveCustomJob,
} from "@/lib/custom-book/service";
import { customError, customJson, smallJson } from "@/lib/custom-book/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    return customJson(await customQuota(user.id));
  } catch (e) {
    return customError(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = z
      .object({ id: z.string().uuid(), draft: customDraftSchema })
      .parse(await smallJson(request));
    return customJson(
      await publicCustomJob(
        await reserveCustomJob(user.id, body.id, body.draft),
      ),
    );
  } catch (e) {
    return customError(e);
  }
}
