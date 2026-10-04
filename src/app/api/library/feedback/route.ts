import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getBook } from "@/lib/library";
import { getLibraryFeedbackConfig } from "@/lib/email/library-feedback";
import { getResend } from "@/lib/email/resend";
import { allowIpRequest } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  contentId: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/).max(160),
  page: z.number().int().positive().nullable(),
  type: z.enum(["文字", "插图", "朗读", "其他建议"]),
  message: z.string().trim().min(1).max(1000),
  requestId: z.string().uuid(),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "请从绘本页面提交反馈。" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "反馈格式不正确。" }, { status: 415 });
  }

  // Bound the actual body, including callers that omit Content-Length.
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > 8192) {
    return NextResponse.json({ error: "反馈内容太长，请精简后再试。" }, { status: 413 });
  }
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "反馈格式不正确。" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "请检查反馈内容和所选页面。" }, { status: 400 });
  }

  const [seriesId, bookId] = parsed.data.contentId.split("/");
  const book = getBook(seriesId, bookId);
  if (!book || (parsed.data.page !== null && !book.pages.some((page) => page.page === parsed.data.page))) {
    return NextResponse.json({ error: "找不到这本绘本或所选页面。" }, { status: 400 });
  }
  const config = getLibraryFeedbackConfig();
  if (!config) {
    return NextResponse.json({ error: "反馈发送暂不可用，你可以先复制反馈内容。" }, { status: 503 });
  }

  try {
    if (!(await allowIpRequest(request, { limit: 5, window: "1 h", windowMs: 3600000, prefix: "library-feedback" }))) {
      return NextResponse.json({ error: "反馈提交较频繁，请稍后再试。" }, { status: 429 });
    }
    const readingUrl = new URL(`/library/${book.seriesId}/${book.id}`, request.url).toString();
    const text = [
      "StoryBloom 绘本反馈",
      `绘本：${book.title}`,
      `页面：${parsed.data.page === null ? "整本绘本" : `第 ${parsed.data.page} 页`}`,
      `类型：${parsed.data.type}`,
      `链接：${readingUrl}`,
      "",
      parsed.data.message,
    ].join("\n");
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const result = await getResend().emails.send({
      from: config.from,
      to: config.to,
      subject: `绘本反馈 · ${book.title} · ${parsed.data.type}`,
      text,
    }, { idempotencyKey: `library-feedback/${fingerprint}` });
    if (result.error || !result.data?.id) {
      return NextResponse.json({ error: "暂时无法确认发送，请稍后重试或复制反馈内容。" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "暂时无法确认发送，请稍后重试或复制反馈内容。" }, { status: 502 });
  }
}
