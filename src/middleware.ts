import { NextRequest, NextResponse } from "next/server";
import { legacyStoryCreationRedirect } from "@/lib/story-creation-url";

export function middleware(request: NextRequest) {
  const destination = legacyStoryCreationRedirect(new URL(request.url));
  return destination
    ? NextResponse.redirect(destination, 308)
    : NextResponse.next();
}

export const config = { matcher: ["/", "/en"] };
