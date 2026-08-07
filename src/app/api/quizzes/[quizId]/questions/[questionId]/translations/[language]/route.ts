import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SupportedLanguages, type LanguageCode } from "@/types";

export const dynamic = "force-dynamic";

// PUT /api/quizzes/[quizId]/questions/[questionId]/translations/[language] - Update manual translation
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string; language: string }> }
) {
  const { questionId, language } = await params;
  try {
    const body = await request.json();

    // Validate language
    if (!(language in SupportedLanguages)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    // Validate that language is not English
    if (language === "en") {
      return NextResponse.json(
        { error: "Cannot edit English (base language)" },
        { status: 400 }
      );
    }

    const {
      questionText,
      hint,
      hostNotes,
      easterEggButtonText,
      answers, // Array of { id: string, answerText: string }
    } = body;

    // Update or create question translation
    if (questionText !== undefined) {
      await prisma.questionTranslation.upsert({
        where: {
          questionId_languageCode: {
            questionId,
            languageCode: language as LanguageCode,
          },
        },
        update: {
          questionText,
          hint: hint !== undefined ? hint : undefined,
          hostNotes: hostNotes !== undefined ? hostNotes : undefined,
          easterEggButtonText:
            easterEggButtonText !== undefined ? easterEggButtonText : undefined,
          isAutoTranslated: false, // Manual edit
          updatedAt: new Date(),
        },
        create: {
          questionId,
          languageCode: language as LanguageCode,
          questionText,
          hint: hint || null,
          hostNotes: hostNotes || null,
          easterEggButtonText: easterEggButtonText || null,
          isAutoTranslated: false, // Manual edit
        },
      });
    }

    // Update answer translations if provided
    if (answers && Array.isArray(answers)) {
      for (const answer of answers) {
        if (answer.id && answer.answerText !== undefined) {
          await prisma.answerTranslation.upsert({
            where: {
              answerId_languageCode: {
                answerId: answer.id,
                languageCode: language as LanguageCode,
              },
            },
            update: {
              answerText: answer.answerText,
              isAutoTranslated: false, // Manual edit
              updatedAt: new Date(),
            },
            create: {
              answerId: answer.id,
              languageCode: language as LanguageCode,
              answerText: answer.answerText,
              isAutoTranslated: false, // Manual edit
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Translation updated successfully",
    });
  } catch (error) {
    console.error("Failed to update translation:", error);
    return NextResponse.json(
      { error: "Failed to update translation" },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[quizId]/questions/[questionId]/translations/[language] - Delete translation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string; language: string }> }
) {
  const { questionId, language } = await params;
  try {

    // Validate language
    if (!(language in SupportedLanguages)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    // Get question with answers
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { answers: true },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Delete question translation
    await prisma.questionTranslation.deleteMany({
      where: {
        questionId,
        languageCode: language as LanguageCode,
      },
    });

    // Delete answer translations
    await prisma.answerTranslation.deleteMany({
      where: {
        answerId: { in: question.answers.map((a) => a.id) },
        languageCode: language as LanguageCode,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Translation deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete translation:", error);
    return NextResponse.json(
      { error: "Failed to delete translation" },
      { status: 500 }
    );
  }
}
