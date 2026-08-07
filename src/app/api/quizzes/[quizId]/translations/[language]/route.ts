import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SupportedLanguages, type LanguageCode } from "@/types";

export const dynamic = "force-dynamic";

// DELETE /api/quizzes/[quizId]/translations/[language] - Delete all translations for a language
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ quizId: string; language: string }> }
) {
  const { quizId, language } = await params;
  try {

    // Validate language
    if (!(language in SupportedLanguages)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    // Validate that language is not English
    if (language === "en") {
      return NextResponse.json(
        { error: "Cannot delete English (base language)" },
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
