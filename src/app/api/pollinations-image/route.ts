import { NextRequest, NextResponse } from "next/server";
import { allowIpRequest } from "@/lib/request-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const POLLINATIONS_IMAGE_ENDPOINT =
  process.env.POLLINATIONS_IMAGE_ENDPOINT || "https://image.pollinations.ai/prompt";
const DEFAULT_REQUEST_DELAY_MS = 8_000;
const DEFAULT_RETRY_DELAY_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 4;
const MIN_IMAGE_DIMENSION = 64;
const MAX_IMAGE_DIMENSION = 2048;

let pollinationsQueue: Promise<unknown> = Promise.resolve();
let nextPollinationsRequestAt = 0;

function encodeUrlPathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function createErrorSvg(message: string) {
  const escaped = message.replace(/[<>&"]/g, " ");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" rx="48" fill="#f7efe6"/>
      <rect x="72" y="72" width="880" height="880" rx="40" fill="#fffaf4" stroke="#eadfd5" stroke-width="8"/>
      <text x="512" y="460" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" fill="#8d2e18" font-weight="700">Image unavailable</text>
      <text x="512" y="525" text-anchor="middle" font-size="26" font-family="Arial, sans-serif" fill="#736156">${escaped.slice(0, 64)}</text>
    </svg>
  `;
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) {
    return null;
  }

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

async function withPollinationsThrottle<T>(task: () => Promise<T>) {
  const requestDelay = getPositiveIntegerEnv(
    "POLLINATIONS_IMAGE_REQUEST_DELAY_MS",
    DEFAULT_REQUEST_DELAY_MS
  );

  const run = pollinationsQueue.then(async () => {
    const waitMs = Math.max(0, nextPollinationsRequestAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await task();
    } finally {
      nextPollinationsRequestAt = Date.now() + requestDelay;
    }
  });

  pollinationsQueue = run.catch(() => undefined);
  return run;
}

async function fetchPollinationsImage(upstreamUrl: URL) {
  const maxAttempts = Math.max(
    1,
    getPositiveIntegerEnv("POLLINATIONS_IMAGE_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)
  );
  const retryDelay = getPositiveIntegerEnv("POLLINATIONS_IMAGE_RETRY_DELAY_MS", DEFAULT_RETRY_DELAY_MS);

  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await withPollinationsThrottle(() =>
      fetch(upstreamUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "User-Agent": `StoryBloom/1.0 (+${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"})`,
        },
      })
    );

    if (response.ok) {
      return response;
    }

    lastResponse = response;

    if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
      await sleep(getRetryAfterMs(response) ?? retryDelay);
      continue;
    }

    break;
  }

  return lastResponse;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const prompt = searchParams.get("prompt")?.trim();

  if (!prompt || prompt.length > 2000) {
    return new NextResponse(createErrorSvg("Missing prompt."), {
      status: 400,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (
    !(await allowIpRequest(req, {
      limit: 20,
      window: "1 h",
      windowMs: 60 * 60 * 1000,
      prefix: "pollinations-image",
    }))
  ) {
    return new NextResponse(createErrorSvg("Too many requests."), {
      status: 429,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "3600",
      },
    });
  }

  const widthNumber = Number.parseInt(searchParams.get("width") || "512", 10);
  const heightNumber = Number.parseInt(searchParams.get("height") || "512", 10);
  if (
    !Number.isFinite(widthNumber) ||
    !Number.isFinite(heightNumber) ||
    widthNumber < MIN_IMAGE_DIMENSION ||
    heightNumber < MIN_IMAGE_DIMENSION ||
    widthNumber > MAX_IMAGE_DIMENSION ||
    heightNumber > MAX_IMAGE_DIMENSION
  ) {
    return new NextResponse(createErrorSvg("Invalid image dimensions."), {
      status: 400,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const width = String(widthNumber);
  const height = String(heightNumber);
  const seed = searchParams.get("seed");
  const model = searchParams.get("model");
  const upstreamUrl = new URL(`${POLLINATIONS_IMAGE_ENDPOINT}/${encodeUrlPathSegment(prompt)}`);

  upstreamUrl.searchParams.set("width", width);
  upstreamUrl.searchParams.set("height", height);
  upstreamUrl.searchParams.set("nologo", "true");

  if (seed) {
    upstreamUrl.searchParams.set("seed", seed);
  }

  if (model) {
    upstreamUrl.searchParams.set("model", model);
  }

  try {
    const response = await fetchPollinationsImage(upstreamUrl);

    if (!response || !response.ok) {
      const statusMessage = response
        ? `Pollinations returned HTTP ${response.status}.`
        : "Pollinations did not return a response.";

      return new NextResponse(createErrorSvg(statusMessage), {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = await response.arrayBuffer();

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pollinations request failed.";
    return new NextResponse(createErrorSvg(message), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
