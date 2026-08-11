import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

// PUT /api/quizzes/[quizId]/questions/reorder - Reorder questions (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;
    const { questionIds } = await request.json();

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: "questionIds array is required" },
        { status: 400 }
      );
    }

    // Update all orderIndex values in a transaction
    await prisma.$transaction(
      questionIds.map((id: string, index: number) =>
        prisma.question.update({
          where: { id, quizId },
          data: { orderIndex: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering questions:", error);
    return NextResponse.json(
      { error: "Failed to reorder questions" },
      { status: 500 }
    );
  }
}
