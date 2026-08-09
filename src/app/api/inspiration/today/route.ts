import { NextResponse } from "next/server";
import { getTodayPublicDailyInspiration } from "@/lib/inspiration/public-daily-inspiration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const inspiration = await getTodayPublicDailyInspiration();
    return NextResponse.json(inspiration, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Unable to load today's public inspiration", error);
    return NextResponse.json(
      { error: "Unable to load today's inspiration" },
      { status: 500 },
    );
  }
}
