import { NextRequest, NextResponse } from "next/server";
import { legacyEnglishLibraryPath } from "@/lib/library/paths";
import { legacyStoryCreationRedirect } from "@/lib/story-creation-url";

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const englishPath = legacyEnglishLibraryPath(url.pathname);
  if (englishPath) {
    url.pathname = englishPath;
    return NextResponse.redirect(url, 308);
  }

  const destination = legacyStoryCreationRedirect(url);
  return destination
    ? NextResponse.redirect(destination, 308)
    : NextResponse.next();
}

export const config = { matcher: ["/", "/en", "/en/library/:path*"] };
