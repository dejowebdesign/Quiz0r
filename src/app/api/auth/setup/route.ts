import { NextRequest, NextResponse } from "next/server";
import {
  buildSessionCookie,
  authenticate,
  isAdminConfigured,
  setAdminCredentials,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/setup - Create the admin account on first run only.
// Refuses to run once an admin account exists, so it cannot be used to
// reset credentials on an already-configured deployment.
export async function POST(request: NextRequest) {
  try {
    const alreadyConfigured = await isAdminConfigured();
    if (alreadyConfigured) {
      return NextResponse.json(
        { error: "Admin account already configured" },
        { status: 409 }
      );
    }

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

    try {
      await setAdminCredentials(username, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Log the first admin in immediately so setup is frictionless.
    const token = await authenticate(username.trim(), password, request);
    if (!token) {
      return NextResponse.json(
        { error: "Setup failed; please log in manually" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Set-Cookie": buildSessionCookie(token, request) } }
    );
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
