import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameCode: string }> }
) {
  const { gameCode } = await params;
  try {
    const body = await request.json();
    const { type, playerId } = body;

    // Find certificate
    const certificate = await prisma.certificate.findFirst({
      where: {
        gameSession: { gameCode: gameCode.toUpperCase() },
        type,
        playerId: type === "player" ? playerId : null,
      },
      include: {
        player: { select: { name: true } },
        gameSession: {
          select: { quiz: { select: { title: true } } },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    if (certificate.status !== "completed") {
      return NextResponse.json(
        {
          error: `Certificate is ${certificate.status}`,
          status: certificate.status,
        },
        { status: 400 }
      );
    }

    if (!certificate.filePath) {
      return NextResponse.json(
        { error: "Certificate file path not found" },
        { status: 500 }
      );
    }

    // Read file from disk
    const filePath = path.join(process.cwd(), "public", certificate.filePath);
    const fileBuffer = await readFile(filePath);

    // Generate filename
    const quizTitle = certificate.gameSession.quiz.title
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .substring(0, 50);
    const playerName = certificate.player?.name
      ? certificate.player.name
          .replace(/[^a-z0-9]/gi, "-")
          .replace(/-+/g, "-")
          .substring(0, 30)
      : "Leaderboard";
    const date = new Date().toISOString().split("T")[0];
    const filename = `${quizTitle}-${playerName}-${date}.jpg`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Certificate download error:", error);
    return NextResponse.json(
      {
        error: "Failed to download certificate",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
