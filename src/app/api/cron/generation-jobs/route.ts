import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { areProductionGenerationJobsEnabled } from "@/lib/generation-job-config";
import { runGenerationWorker } from "@/lib/generation-worker";

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

export async function POST(request: Request) {
  if (!areProductionGenerationJobsEnabled()) {
    return NextResponse.json({ error: "Generation jobs are disabled" }, { status: 404 });
  }
  const secret = process.env.GENERATION_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Generation worker is not configured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!secretMatches(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runGenerationWorker()) });
  } catch {
    return NextResponse.json({ error: "Generation worker failed" }, { status: 500 });
  }
}
