import { NextRequest, NextResponse } from "next/server";
import { getLibraryPersonalizationContext } from "@/lib/library/personalization";

export async function GET(request: NextRequest) {
  const contentId = request.nextUrl.searchParams.get("book")?.trim() || "";
  const context = getLibraryPersonalizationContext(contentId);

  if (!context) {
    return NextResponse.json(
      { error: "这本绘本暂不支持家庭专属改编。" },
      { status: 404 },
    );
  }

  return NextResponse.json(context, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
