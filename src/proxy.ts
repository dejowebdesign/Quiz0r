import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that should be accessible via ngrok/external access
const PUBLIC_ROUTES = [
  "/play",           // Game code entry page
  "/api/games/",     // Game join API (specifically for /api/games/[code]/join)
];

// Routes that should ONLY be accessible from localhost
const LOCALHOST_ONLY_PATTERNS = [
  "/admin",
  "/host",
  "/api/quizzes",
  "/api/settings",
  "/api/tunnel",
];

function isExternalRequest(request: NextRequest): boolean {
  // Check for ngrok-specific indicators
  const host = request.headers.get("host") || "";
  const xForwardedHost = request.headers.get("x-forwarded-host") || "";
  const xOriginalHost = request.headers.get("x-original-host") || "";

  // Check if the request is coming through ngrok
  // ngrok adds specific headers and the host will contain ngrok domain
  const isNgrokHost = host.includes("ngrok") ||
                      host.includes("ngrok-free.app") ||
                      host.includes("ngrok.io") ||
                      host.includes("ngrok-free.dev");

  const hasNgrokForwardedHost = xForwardedHost.includes("ngrok") ||
                                 xOriginalHost.includes("ngrok");

  // ngrok-skip-browser-warning header bypasses ngrok's browser warning for API requests
  // NOTE: This only works for fetch/XHR requests, NOT for initial browser navigation
  // Users will see the ngrok warning once when first visiting, then ngrok sets a cookie
  // We add this header to all client-side fetch requests to avoid warnings on API calls
  // See: src/app/play/[gameCode]/page.tsx and src/app/api/quizzes/[quizId]/export/route.ts
  const hasNgrokSkipHeader = request.headers.get("ngrok-skip-browser-warning") !== null;

  // Check if x-forwarded-host contains ngrok (most reliable indicator)
  // When ngrok proxies, it sets x-forwarded-host to the ngrok URL
  return isNgrokHost || hasNgrokForwardedHost || hasNgrokSkipHeader;
}

function isPublicRoute(pathname: string): boolean {
  // Check if the path starts with any of the public route patterns
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function isLocalhostOnlyRoute(pathname: string): boolean {
  // Check if the path matches localhost-only patterns
  return LOCALHOST_ONLY_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Home page should be accessible locally but not via ngrok
  // (players should go directly to /play via the QR code)
  if (pathname === "/") {
    if (isExternalRequest(request)) {
      // Redirect external users to /play
      const url = request.nextUrl.clone();
      url.pathname = "/play";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Public routes are always accessible
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Localhost-only routes should be blocked from external access
  if (isLocalhostOnlyRoute(pathname)) {
    if (isExternalRequest(request)) {
      // Return 403 Forbidden for external access to admin/host routes
      return new NextResponse(
        JSON.stringify({
          error: "Access denied",
          message: "This page is only accessible from the local network"
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
