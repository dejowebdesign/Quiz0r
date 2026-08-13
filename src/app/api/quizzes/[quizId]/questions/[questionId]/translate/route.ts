import { NextResponse } from "next/server";
import { translateQuestion, translateSection } from "@/lib/openai-translate";
import { SupportedLanguages, type LanguageCode } from "@/types";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { resolveSourceLanguage } from "@/lib/source-language";

export const dynamic = "force-dynamic";

// POST /api/quizzes/[quizId]/questions/[questionId]/translate - Translate single question or section (admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { questionId } = await params;
  try {
    const body = await request.json();
    const { targetLanguage } = body;

    // Validate target language
    if (!targetLanguage || !(targetLanguage in SupportedLanguages)) {
      return NextResponse.json(
        { error: "Invalid or missing target language" },
        { status: 400 }
      );
    }

    // The target language must differ from the quiz's source (base) language.
    const quiz = await prisma.quiz.findUnique({
      where: { id: (await params).quizId },
      select: { sourceLanguage: true },
    });
    const sourceLanguage = resolveSourceLanguage(quiz?.sourceLanguage);

    if (targetLanguage === sourceLanguage) {
      return NextResponse.json(
        { error: `Cannot translate to the quiz's source language (${SupportedLanguages[sourceLanguage].name})` },
        { status: 400 }
      );
    }

    // Check if this is a section or a question
    const item = await prisma.question.findUnique({
      where: { id: questionId },
      select: { questionType: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Call appropriate translation function
    const result = item.questionType === "SECTION"
      ? await translateSection(questionId, targetLanguage as LanguageCode)
      : await translateQuestion(questionId, targetLanguage as LanguageCode);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Translation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: item.questionType === "SECTION"
        ? "Section translated successfully"
        : "Question translated successfully",
    });
  } catch (error) {
    console.error("Failed to translate:", error);
    return NextResponse.json(
      { error: "Failed to translate" },
      { status: 500 }
    );
  }
}
