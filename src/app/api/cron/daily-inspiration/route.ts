import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyInspirationDelivery } from "@/lib/email/daily-delivery";
import { getShanghaiDateKey } from "@/lib/email/daily-inspiration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function secretMatches(actual: string | null, expected: string) {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Daily inspiration cron is not configured" },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const headerToken = request.headers.get("x-cron-secret");
  if (
    !secretMatches(bearerToken, cronSecret) &&
    !secretMatches(headerToken, cronSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDailyInspirationDelivery(getShanghaiDateKey());
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Daily inspiration cron failed", error);
    return NextResponse.json(
      { error: "Daily inspiration delivery failed" },
      { status: 500 },
    );
  }
}
