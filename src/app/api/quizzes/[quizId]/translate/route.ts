import { NextResponse } from "next/server";
import { translateEntireQuiz } from "@/lib/openai-translate";
import { SupportedLanguages, type LanguageCode } from "@/types";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveSourceLanguage } from "@/lib/source-language";

export const dynamic = "force-dynamic";

// POST /api/quizzes/[quizId]/translate - Translate entire quiz to target language (admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { quizId } = await params;
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
      where: { id: quizId },
      select: { sourceLanguage: true },
    });
    const sourceLanguage = resolveSourceLanguage(quiz?.sourceLanguage);

    if (targetLanguage === sourceLanguage) {
      return NextResponse.json(
        { error: `Cannot translate to the quiz's source language (${SupportedLanguages[sourceLanguage].name})` },
        { status: 400 }
      );
    }

    // Perform translation
    const result = await translateEntireQuiz(quizId, targetLanguage as LanguageCode);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Translation failed",
          translated: result.translated,
          failed: result.failed,
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      translated: result.translated,
      failed: result.failed,
      message: `Successfully translated ${result.translated} question(s)`,
    });
  } catch (error) {
    console.error("Failed to translate quiz:", error);
    return NextResponse.json(
      { error: "Failed to translate quiz" },
      { status: 500 }
    );
  }
}
