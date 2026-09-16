import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/supabase/server-auth";
import { ZodError } from "zod";
export function customJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function customError(error: unknown) {
  if (error instanceof AuthenticationError)
    return customJson({ error: error.message }, 401);
  if (error instanceof ZodError)
    return customJson({ error: "请检查标题、人物、页数和文字长度。" }, 400);
  const message = error instanceof Error ? error.message : "";
  if (message.includes("QUOTA_EXHAUSTED"))
    return customJson(
      {
        error: "本周免费机会已用完，请兑换生成机会。",
        code: "QUOTA_EXHAUSTED",
      },
      429,
    );
  if (message.includes("NOT_FOUND"))
    return customJson({ error: "任务不存在。" }, 404);
  if (message.includes("ACTIVE_JOB"))
    return customJson({ error: "请先完成或取消进行中的绘本。" }, 409);
  if (/REQUEST_CONFLICT|STALE_LEASE|INVALID_STATUS/.test(message))
    return customJson({ error: "任务状态已更新，请刷新后重试。" }, 409);
  if (/^(图片不属于|请填写|分镜页数|任务正在|任务状态)/.test(message))
    return customJson({ error: message }, 400);
  return customJson(
    { error: "工作台服务暂不可用，请确认模型配置与数据库迁移已完成。" },
    503,
  );
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new ZodError([]);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > max) {
        await reader.cancel();
        throw new ZodError([]);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export async function smallJson(request: Request, max = 250000) {
  const bytes = await boundedBody(request, max);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ZodError([]);
  }
}
