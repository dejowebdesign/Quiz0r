import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/admin/games/[gameId] - Get game session details (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { gameId } = await params;
  try {
    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true
          }
        },
        players: {
          where: {
            // Include all admitted players - for finished games, players will be inactive
            admissionStatus: "admitted"
          },
          orderBy: { totalScore: "desc" },
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatarEmoji: true,
            totalScore: true,
            isActive: true
          }
        },
        _count: {
          select: {
            players: {
              where: {
                admissionStatus: "admitted"
              }
            }
          }
        }
      }
    });

    if (!game) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }

    return Response.json({
      id: game.id,
      gameCode: game.gameCode,
      status: game.status,
      createdAt: game.createdAt.toISOString(),
      endedAt: game.endedAt?.toISOString() || null,
      quiz: game.quiz,
      playerCount: game._count.players,
      allPlayers: game.players.map((p, idx) => ({
        ...p,
        position: idx + 1
      }))
    });
  } catch (error) {
    console.error("Failed to fetch game details:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await requireAdmin(_request);
  if (!auth.ok) return auth.response;
  const { gameId } = await params;
  try {
    const game = await prisma.gameSession.findUnique({
      where: { id: gameId },
      select: { status: true }
    });

    if (!game) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "FINISHED") {
      return Response.json(
        { error: "Only finished games can be deleted" },
        { status: 400 }
      );
    }

    await prisma.gameSession.delete({
      where: { id: gameId }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete game:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
