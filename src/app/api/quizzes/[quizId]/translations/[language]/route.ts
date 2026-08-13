import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SupportedLanguages, type LanguageCode } from "@/types";
import { requireAdmin } from "@/lib/auth";
import { resolveSourceLanguage } from "@/lib/source-language";

export const dynamic = "force-dynamic";

// DELETE /api/quizzes/[quizId]/translations/[language] - Delete all translations for a language (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ quizId: string; language: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { quizId, language } = await params;
  try {

    // Validate language
    if (!(language in SupportedLanguages)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    // The source (base) language cannot be deleted — it is the original content.
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { sourceLanguage: true },
    });
    const sourceLanguage = resolveSourceLanguage(quiz?.sourceLanguage);

    if (language === sourceLanguage) {
      return NextResponse.json(
        { error: `Cannot delete the quiz's source language (${SupportedLanguages[sourceLanguage as LanguageCode].name})` },
        { status: 400 }
      );
    }

    // Get all questions for this quiz
    const questions = await prisma.question.findMany({
      where: { quizId },
      include: { answers: true },
    });

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No questions found",
      });
    }

    // Delete all question translations for this language
    await prisma.questionTranslation.deleteMany({
      where: {
        questionId: { in: questions.map((q) => q.id) },
        languageCode: language as LanguageCode,
      },
    });

    // Delete all answer translations for this language
    const allAnswerIds = questions.flatMap((q) => q.answers.map((a) => a.id));
    await prisma.answerTranslation.deleteMany({
      where: {
        answerId: { in: allAnswerIds },
        languageCode: language as LanguageCode,
      },
    });

    return NextResponse.json({
      success: true,
      message: `All ${SupportedLanguages[language as LanguageCode].name} translations deleted`,
    });
  } catch (error) {
    console.error("Failed to delete language translations:", error);
    return NextResponse.json(
      { error: "Failed to delete translations" },
      { status: 500 }
    );
  }
}
