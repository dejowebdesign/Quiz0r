import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { startTunnel, stopTunnel, getTunnelUrl, isTunnelRunning } from "@/lib/tunnel";
import { requireAdmin } from "@/lib/auth";

// GET /api/settings/tunnel - Get tunnel status (admin only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    running: isTunnelRunning(),
    url: getTunnelUrl(),
  });
}

// POST /api/settings/tunnel - Start tunnel (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    // Get token from database
    const tokenSetting = await prisma.setting.findUnique({
      where: { key: "ngrok_token" },
    });

    if (!tokenSetting?.value) {
      return NextResponse.json(
        { error: "No ngrok token configured. Please add your token in settings." },
        { status: 400 }
      );
    }

    const url = await startTunnel(tokenSetting.value);
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Failed to start tunnel:", error);
    const message = error instanceof Error ? error.message : "Failed to start tunnel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/settings/tunnel - Stop tunnel (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    await stopTunnel();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to stop tunnel:", error);
    return NextResponse.json(
      { error: "Failed to stop tunnel" },
      { status: 500 }
    );
  }
}
