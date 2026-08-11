import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  buildClearCookie,
  invalidateSession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/logout - Invalidate session and clear cookie
export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${ADMIN_COOKIE_NAME}=`));
  if (token) {
    const value = token.split("=").slice(1).join("=");
    await invalidateSession(decodeURIComponent(value), request);
  }
  return NextResponse.json(
    { success: true },
    { headers: { "Set-Cookie": buildClearCookie(request) } }
  );
}
