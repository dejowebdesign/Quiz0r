import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/settings/export - Return raw secret values for encrypted export.
//
// This is the only endpoint that returns raw secrets, and it is admin-only.
// The regular GET /api/settings returns masked values. The client-side
// export feature encrypts these values with a user-supplied password before
// writing them to disk, so they never leave the browser unencrypted.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const keys = [
      "ngrok_token",
      "shortio_api_key",
      "shortio_domain",
      "openai_api_key",
      "unsplash_api_key",
    ];
    const rows = await prisma.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.value) map[row.key] = row.value;
    }
    return NextResponse.json(map);
  } catch (error) {
    console.error("Failed to export settings:", error);
    return NextResponse.json(
      { error: "Failed to export settings" },
      { status: 500 }
    );
  }
}
