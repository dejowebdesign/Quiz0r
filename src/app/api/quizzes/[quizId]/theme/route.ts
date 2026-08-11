import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateThemeJson } from "@/lib/theme";
import { requireAdmin } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ quizId: string }>;
}

// GET - Fetch quiz theme (admin only)
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await context.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, title: true, theme: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({
      quizId: quiz.id,
      title: quiz.title,
      theme: quiz.theme,
    });
  } catch (error) {
    console.error("Failed to fetch theme:", error);
    return NextResponse.json(
      { error: "Failed to fetch theme" },
      { status: 500 }
    );
  }
}

// PUT - Update quiz theme (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await context.params;
    const body = await request.json();
    const { theme } = body;

    // Validate theme JSON if provided
    if (theme) {
      const validationError = validateThemeJson(theme);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
    }

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: { theme: theme || null },
      select: { id: true, title: true, theme: true },
    });

    return NextResponse.json({
      quizId: quiz.id,
      title: quiz.title,
      theme: quiz.theme,
    });
  } catch (error) {
    console.error("Failed to update theme:", error);
    return NextResponse.json(
      { error: "Failed to update theme" },
      { status: 500 }
    );
  }
}

// DELETE - Remove quiz theme (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await context.params;

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: { theme: null },
      select: { id: true, title: true },
    });

    return NextResponse.json({
      quizId: quiz.id,
      title: quiz.title,
      theme: null,
    });
  } catch (error) {
    console.error("Failed to delete theme:", error);
    return NextResponse.json(
      { error: "Failed to delete theme" },
      { status: 500 }
    );
  }
}
