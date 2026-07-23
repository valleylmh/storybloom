import { NextResponse } from "next/server";
import { unsubscribeNewsletter } from "@/lib/email/newsletter";
import { decodeActionToken } from "@/lib/email/tokens";

export const runtime = "nodejs";

async function handle(request: Request) {
  const action = decodeActionToken(new URL(request.url).searchParams.get("token"));
  if (!action) return new NextResponse("退订链接无效。", { status: 400 });
  try {
    const subscription = await unsubscribeNewsletter(action.id, action.token);
    if (!subscription) return new NextResponse("退订链接无效或已失效。", { status: 400 });
    return new NextResponse(
      "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>已取消订阅</title><body style=\"font-family:system-ui;text-align:center;padding:12vh 20px;background:#f7f4ed;color:#302d28\"><h1>已取消订阅</h1><p>我们不会再向这个邮箱发送 Newsletter。</p><a href=\"/\">返回首页</a></body></html>",
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    console.error("Newsletter unsubscribe failed", error);
    return new NextResponse("暂时无法取消订阅，请稍后重试。", { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
