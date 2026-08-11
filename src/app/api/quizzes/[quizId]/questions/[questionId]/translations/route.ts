import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/quizzes/[quizId]/questions/[questionId]/translations - Get all translations for a question (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { questionId } = await params;
  try {

    // Fetch question with translations
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        translations: true,
        answers: {
          include: {
            translations: true,
          },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Transform to a more usable format
    const questionTranslations: Record<string, any> = {};
    question.translations.forEach((t) => {
      questionTranslations[t.languageCode] = {
        questionText: t.questionText,
        hostNotes: t.hostNotes,
        hint: t.hint,
        easterEggButtonText: t.easterEggButtonText,
        isAutoTranslated: t.isAutoTranslated,
      };
    });

    const answerTranslations: Record<string, Record<string, string>> = {};
    question.answers.forEach((answer) => {
      answerTranslations[answer.id] = {};
      answer.translations.forEach((t) => {
        answerTranslations[answer.id][t.languageCode] = t.answerText;
      });
    });

    return NextResponse.json({
      translations: {
        questionTranslations,
        answerTranslations,
      },
    });
  } catch (error) {
    console.error("Failed to get translations:", error);
    return NextResponse.json(
      { error: "Failed to get translations" },
      { status: 500 }
    );
  }
}
