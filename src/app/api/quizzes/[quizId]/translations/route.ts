import { NextResponse } from "next/server";
import { getQuizTranslationStatus } from "@/lib/openai-translate";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/quizzes/[quizId]/translations - Get translation status for all languages (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { quizId } = await params;
  try {

    const statuses = await getQuizTranslationStatus(quizId);

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("Failed to get translation status:", error);
    return NextResponse.json(
      { error: "Failed to get translation status" },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[quizId]/translations/[language] - Delete all translations for a language
// This is handled in the [language] subfolder route
