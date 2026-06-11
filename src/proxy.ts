import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();

  // Add X-Request-Id to all responses
  const reqId = crypto.randomUUID();
  response.headers.set("X-Request-Id", reqId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
