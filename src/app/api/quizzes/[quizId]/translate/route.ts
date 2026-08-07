import { NextResponse } from "next/server";
import { translateEntireQuiz } from "@/lib/openai-translate";
import { SupportedLanguages, type LanguageCode } from "@/types";

export const dynamic = "force-dynamic";

// POST /api/quizzes/[quizId]/translate - Translate entire quiz to target language
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
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

    // Validate that target language is not English
    if (targetLanguage === "en") {
      return NextResponse.json(
        { error: "Cannot translate to English (base language)" },
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
