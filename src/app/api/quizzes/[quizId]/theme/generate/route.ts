import { NextRequest, NextResponse } from "next/server";
import { generateThemeFromAnswers } from "@/lib/openai-theme";
import { ThemeWizardAnswers } from "@/lib/theme-template";
import { parseTheme } from "@/lib/theme";
import { requireAdmin } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ quizId: string }>;
}

// POST /api/quizzes/[quizId]/theme/generate - Generate theme with AI (admin only)
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await context.params;
    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 });
    }

    const body = (await request.json()) as { answers?: ThemeWizardAnswers };
    const answers = body.answers;

    if (!answers?.topic || !answers?.mood) {
      return NextResponse.json(
        { error: "Topic and mood are required to generate a theme" },
        { status: 400 }
      );
    }

    const themeJson = await generateThemeFromAnswers(answers);
    const parsedTheme = parseTheme(themeJson);

    return NextResponse.json({
      theme: themeJson,
      parsedTheme,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate theme";
    const status = message.includes("OpenAI API key not configured") ? 400 : 500;

    console.error("Failed to generate theme:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
