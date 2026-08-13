import { NextRequest, NextResponse } from "next/server";
import { generateQuizWithAI } from "@/lib/openai-quiz-generator";
import { requireAdmin } from "@/lib/auth";
import { resolveSourceLanguage } from "@/lib/source-language";

// POST /api/quizzes/ai-generate - Generate a quiz with AI (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const {
      topic,
      difficulty = "medium",
      questionCount = 10,
      sectionCount = 2,
      additionalNotes,
      sourceLanguage,
    } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Topic is required to generate a quiz" },
        { status: 400 }
      );
    }

    const parsedQuestionCount = Number(questionCount);
    const parsedSectionCount = Number(sectionCount);

    const result = await generateQuizWithAI({
      topic,
      difficulty,
      questionCount: Number.isFinite(parsedQuestionCount)
        ? parsedQuestionCount
        : 10,
      sectionCount: Number.isFinite(parsedSectionCount)
        ? parsedSectionCount
        : 2,
      additionalNotes,
      sourceLanguage: typeof sourceLanguage === "string" ? sourceLanguage : undefined,
    });

    return NextResponse.json(
      {
        ...result,
        message:
          "Quiz created by AI. Review every question and answer carefully before hosting.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Failed to generate quiz with AI:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate quiz with AI";

    // Check for provider configuration errors
    const isConfigError =
      message.includes("not configured") ||
      message.includes("API key") ||
      message.includes("is not configured");

    return NextResponse.json(
      { error: message },
      { status: isConfigError ? 400 : 500 }
    );
  }
}
