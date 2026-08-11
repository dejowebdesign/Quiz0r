import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  buildSessionCookie,
  isAdminConfigured,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/login - Authenticate admin and set session cookie
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const configured = await isAdminConfigured();
    if (!configured) {
      return NextResponse.json(
        { error: "Admin account not configured", setupRequired: true },
        { status: 403 }
      );
    }

    const token = await authenticate(username.trim(), password, request);
    if (!token) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Set-Cookie": buildSessionCookie(token, request) } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

// GET /api/auth/login - Report whether admin setup is required.
export async function GET() {
  const configured = await isAdminConfigured();
  return NextResponse.json({ configured, setupRequired: !configured });
}
