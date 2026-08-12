import React from "react";
import { NextRequest } from "next/server";
import { ImageResponse } from "@vercel/og";
import { prisma } from "@/lib/db";
import {
  generateHostCertificate,
  generatePlayerCertificate,
} from "@/lib/certificate-generator";
import { generateCongratulatoryMessage } from "@/lib/openai-congratulations";
import { getCertificateFilename } from "@/lib/certificate-utils";
import { CertificateRequest, CertificateGameData } from "@/types/certificate";
import { PlayerScore } from "@/types";
import { QuizTheme, DEFAULT_THEME } from "@/types/theme";

// Note: Using Node.js runtime because Prisma doesn't work in Edge runtime
// ImageResponse from @vercel/og works fine in Node.js runtime

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameCode: string }> }
) {
  try {
    // Parse request
    const body = (await request.json()) as CertificateRequest;
    const { type, playerId } = body;
    const { gameCode } = await params;

    // Fetch game data
    const gameData = await prisma.gameSession.findUnique({
      where: { gameCode: gameCode.toUpperCase() },
      include: {
        quiz: {
          select: {
            title: true,
            theme: true,
          },
        },
        players: {
          where: {
            isActive: true,
            admissionStatus: "admitted",
          },
          orderBy: { totalScore: "desc" },
          include: {
            powerUpUsages: {
              include: {
                question: {
                  select: { orderIndex: true },
                },
              },
            },
          },
        },
      },
    });

    // Validate game exists
    if (!gameData) {
      return new Response("Game not found", { status: 404 });
    }

    // Validate game is finished
    if (gameData.status !== "FINISHED") {
      return new Response("Game not finished yet", { status: 403 });
    }

    // Parse theme
    let theme: QuizTheme;
    try {
      theme = gameData.quiz.theme
        ? JSON.parse(gameData.quiz.theme)
        : DEFAULT_THEME;
    } catch {
      theme = DEFAULT_THEME;
    }

    // Calculate player scores with positions
    const playerScores: PlayerScore[] = gameData.players.map((player, index) => ({
      playerId: player.id,
      name: player.name,
      avatarColor: player.avatarColor || "#666",
      avatarEmoji: player.avatarEmoji,
      languageCode: player.languageCode as any,
      score: player.totalScore,
      position: index + 1,
      change: 0, // Not tracking change for certificates
      powerUpsUsed: player.powerUpUsages.map((usage) => ({
        powerUpType: usage.powerUpType as any,
        questionNumber: usage.question.orderIndex + 1,
      })),
    }));

    // Prepare certificate data
    const certificateData: CertificateGameData = {
      gameCode: gameData.gameCode,
      quizTitle: gameData.quiz.title,
      completedDate: gameData.endedAt || new Date(),
      theme,
      players: playerScores,
    };

    // Generate appropriate certificate
    let certificateJSX: React.ReactElement;
    let playerName: string | null = null;

    if (type === "player") {
      // Validate playerId is provided
      if (!playerId) {
        return new Response("Player ID required for player certificate", {
          status: 400,
        });
      }

      // Validate player exists in game. The leaderboard above is filtered to
      // active+admitted players, but a player who disconnected after FINISHED
      // (isActive=false) may still request their certificate. Fall back to a
      // direct DB lookup so the certificate can still be generated.
      let player = playerScores.find((p) => p.playerId === playerId);
      if (!player) {
        const dbPlayer = await prisma.player.findFirst({
          where: { id: playerId, gameSessionId: gameData.id },
        });
        if (dbPlayer) {
          player = {
            playerId: dbPlayer.id,
            name: dbPlayer.name,
            avatarColor: dbPlayer.avatarColor || "#666",
            avatarEmoji: dbPlayer.avatarEmoji || undefined,
            languageCode: (dbPlayer.languageCode as any) || "en",
            score: dbPlayer.totalScore,
            position:
              playerScores.filter((s) => s.score > dbPlayer.totalScore).length +
              1,
            change: 0,
            powerUpsUsed: [],
          };
          playerScores.push(player);
        }
      }
      if (!player) {
        return new Response("Player not found in game", { status: 403 });
      }

      playerName = player.name;

      // Generate personalized congratulatory message
      const congratsMessage = await generateCongratulatoryMessage(
        player.name,
        player.position,
        playerScores.length,
        player.score,
        gameData.quiz.title
      );

      // Generate player certificate
      certificateJSX = await generatePlayerCertificate(
        certificateData,
        playerId,
        congratsMessage
      );
    } else {
      // Generate host certificate
      certificateJSX = await generateHostCertificate(certificateData);
    }

    // Generate filename
    const filename = getCertificateFilename(
      gameData.quiz.title,
      playerName,
      certificateData.completedDate
    );

    // Return image response
    return new ImageResponse(certificateJSX, {
      width: 1200,
      height: 1600,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "image/jpeg",
      },
    });
  } catch (error) {
    console.error("Certificate generation error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate certificate",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
