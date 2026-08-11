import { NextRequest, NextResponse } from "next/server";
import { CertificateService } from "@/lib/certificate-service";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameCode: string }> }
) {
  // Regenerating certificates is an admin/host maintenance action. The
  // /api/games/ prefix is public for join + player certificate download, so
  // enforce the admin session here.
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { gameCode } = await params;
  try {
    const body = await request.json();
    const { certificateIds } = body;

    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return NextResponse.json(
        { error: "certificateIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Start regeneration in background (don't await)
    CertificateService.regenerateCertificates(certificateIds).catch(
      (error) => {
        console.error("Certificate regeneration failed:", error);
      }
    );

    return NextResponse.json({
      message: "Regeneration started",
      count: certificateIds.length,
    });
  } catch (error) {
    console.error("Certificate regeneration error:", error);
    return NextResponse.json(
      {
        error: "Failed to start regeneration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
