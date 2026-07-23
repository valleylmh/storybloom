import { NextResponse } from "next/server";
import { confirmNewsletterSubscription } from "@/lib/email/newsletter";
import { decodeActionToken } from "@/lib/email/tokens";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const action = decodeActionToken(new URL(request.url).searchParams.get("token"));
  if (!action) return new NextResponse("确认链接无效。", { status: 400 });
  try {
    const subscription = await confirmNewsletterSubscription(action.id, action.token);
    if (!subscription) return new NextResponse("确认链接无效或已失效。", { status: 400 });
    return new NextResponse(
      "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>订阅成功</title><body style=\"font-family:system-ui;text-align:center;padding:12vh 20px;background:#f7f4ed;color:#302d28\"><h1>订阅已确认</h1><p>下一步，为孩子和家人建立可复用的绘本形象。</p><a href=\"/family\" style=\"display:inline-block;padding:12px 22px;border-radius:999px;background:#be5530;color:white;text-decoration:none\">创建家庭角色</a><p><a href=\"/\">返回首页</a></p></body></html>",
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    console.error("Newsletter confirmation failed", error);
    return new NextResponse("暂时无法确认订阅，请稍后重试。", { status: 500 });
  }
}
