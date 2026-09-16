import { z } from "zod";
import { customDraftSchema } from "@/lib/custom-book/schema";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";
import {
  saveCustomLayout,
  advanceCustomJob,
  cancelCustomJob,
  confirmCustomOutline,
  getCustomJob,
  publicCustomJob,
} from "@/lib/custom-book/service";
import { customError, customJson, smallJson } from "@/lib/custom-book/http";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await requireAuthenticatedUser(request);
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    return customJson(await publicCustomJob(await getCustomJob(user.id, id)));
  } catch (e) {
    return customError(e);
  }
}
const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("layout"),
    title: z.string().min(1).max(100),
    subtitle: z.string().max(200),
    author: z.string().max(100),
    typography: customDraftSchema.innerType().shape.typography,
    pageLayouts: z
      .array(
        z.object({
          layout: z
            .enum(["panorama", "sidebar", "embrace", "minimal"])
            .optional(),
          textTreatment: z.enum(["natural", "soft"]).optional(),
        }),
      )
      .min(4)
      .max(12)
      .optional(),
    texts: z.array(z.string().max(2500)).min(4).max(12),
  }),
  z.object({ action: z.literal("advance"), retry: z.boolean().optional() }),
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("confirm"),
    pages: z
      .array(
        z.object({
          text: z.string().min(1).max(2500),
          scene: z.string().min(1).max(2500),
          artDirection: z.string().max(1800).optional(),
          layout: z
            .enum(["panorama", "sidebar", "embrace", "minimal"])
            .optional(),
          textTreatment: z.enum(["natural", "soft"]).optional(),
          characters: z.array(z.string().max(80)).max(6),
        }),
      )
      .min(4)
      .max(12),
  }),
]);
export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAuthenticatedUser(request);
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const body = action.parse(await smallJson(request));
    const job =
      body.action === "layout"
        ? await saveCustomLayout(user.id, id, body)
        : body.action === "advance"
          ? await advanceCustomJob(user.id, id, body.retry)
          : body.action === "cancel"
            ? await cancelCustomJob(user.id, id)
            : await confirmCustomOutline(user.id, id, body.pages);
    return customJson(await publicCustomJob(job));
  } catch (e) {
    return customError(e);
  }
}
