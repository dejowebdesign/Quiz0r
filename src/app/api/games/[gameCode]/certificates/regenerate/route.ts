import { NextRequest, NextResponse } from "next/server";
import { CertificateService } from "@/lib/certificate-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameCode: string }> }
) {
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
