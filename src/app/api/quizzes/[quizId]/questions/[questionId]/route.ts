import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ quizId: string; questionId: string }>;
}

// PUT /api/quizzes/[quizId]/questions/[questionId] - Update question (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { questionId } = await params;
    const body = await request.json();
    const {
      questionText,
      imageUrl,
      hostNotes,
      questionType,
      timeLimit,
      points,
      orderIndex,
      answers,
      hint,
      easterEggEnabled,
      easterEggButtonText,
      easterEggUrl,
      easterEggDisablesScoring,
    } = body;

    // Update question
    const updateData: Record<string, unknown> = {};
    if (questionText !== undefined)
      updateData.questionText = questionText.trim();
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
    if (hostNotes !== undefined) updateData.hostNotes = hostNotes?.trim() || null;
    if (questionType !== undefined) updateData.questionType = questionType;
    if (timeLimit !== undefined) updateData.timeLimit = timeLimit;
    if (points !== undefined) updateData.points = points;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (hint !== undefined) updateData.hint = hint?.trim() || null;

    // Easter egg fields
    if (easterEggEnabled !== undefined) {
      updateData.easterEggEnabled = easterEggEnabled;
      updateData.easterEggButtonText = easterEggEnabled ?
        easterEggButtonText?.trim() || null : null;
      updateData.easterEggUrl = easterEggEnabled ?
        easterEggUrl?.trim() || null : null;
      updateData.easterEggDisablesScoring = easterEggEnabled ?
        (easterEggDisablesScoring ?? false) : false;
    }

    // If answers are provided, update them
    if (answers && Array.isArray(answers)) {
      // Delete existing answers and create new ones
      await prisma.answer.deleteMany({
        where: { questionId },
      });

      await prisma.answer.createMany({
        data: answers.map(
          (
            answer: {
              answerText: string;
              imageUrl?: string;
              isCorrect?: boolean;
            },
            index: number
          ) => ({
            questionId,
            answerText: answer.answerText.trim(),
            imageUrl: answer.imageUrl?.trim() || null,
            isCorrect: answer.isCorrect ?? false,
            orderIndex: index,
          })
        ),
      });
    }

    const question = await prisma.question.update({
      where: { id: questionId },
      data: updateData,
      include: {
        answers: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[quizId]/questions/[questionId] - Delete question (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId, questionId } = await params;

    // Get the question to be deleted
    const questionToDelete = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!questionToDelete) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Delete the question (cascade will delete answers)
    await prisma.question.delete({
      where: { id: questionId },
    });

    // Reorder remaining questions
    await prisma.question.updateMany({
      where: {
        quizId,
        orderIndex: { gt: questionToDelete.orderIndex },
      },
      data: {
        orderIndex: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}
