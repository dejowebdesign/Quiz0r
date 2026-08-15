import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isValidLanguageCode } from "@/lib/source-language";

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

// GET /api/quizzes/[quizId] - Get quiz details (admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            answers: {
              include: {
                translations: true,
              },
              orderBy: { orderIndex: "asc" },
            },
            translations: true,
            contentTranslations: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}

// PUT /api/quizzes/[quizId] - Update quiz (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;
    const body = await request.json();
    const { title, description, sourceLanguage } = body;

    if (sourceLanguage !== undefined && !isValidLanguageCode(sourceLanguage)) {
      return NextResponse.json(
        { error: "Invalid source language" },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(sourceLanguage !== undefined && { sourceLanguage }),
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}

// PATCH /api/quizzes/[quizId] - Partially update quiz (e.g., autoAdmit, power-ups)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;
    const body = await request.json();
    const { autoAdmit, hintCount, copyAnswerCount, doublePointsCount } = body;

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(autoAdmit !== undefined && { autoAdmit }),
        ...(hintCount !== undefined && { hintCount }),
        ...(copyAnswerCount !== undefined && { copyAnswerCount }),
        ...(doublePointsCount !== undefined && { doublePointsCount }),
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[quizId] - Soft delete quiz (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;

    await prisma.quiz.update({
      where: { id: quizId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}
