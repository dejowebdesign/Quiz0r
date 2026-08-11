import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/quizzes - List all quizzes (admin only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { questions: true },
        },
        questions: {
          select: {
            questionType: true,
            translations: {
              select: { languageCode: true },
            },
            answers: {
              select: {
                translations: {
                  select: { languageCode: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate actual question count (excluding sections)
    const quizzesWithQuestionCount = quizzes.map((quiz) => {
      const questionCount = quiz.questions.filter(
        (q) => q.questionType !== "SECTION"
      ).length;

      const translationLanguages = new Set<string>();
      for (const question of quiz.questions) {
        question.translations.forEach((t) => {
          if (t.languageCode !== "en") translationLanguages.add(t.languageCode);
        });
        question.answers.forEach((a) =>
          a.translations.forEach((t) => {
            if (t.languageCode !== "en") translationLanguages.add(t.languageCode);
          })
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { questions, ...rest } = quiz;
      return {
        ...rest,
        questionCount,
        translationLanguages: Array.from(translationLanguages).sort(),
      };
    });

    return NextResponse.json(quizzesWithQuestionCount);
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}

// POST /api/quizzes - Create a new quiz (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(quiz, { status: 201 });
  } catch (error) {
    console.error("Error creating quiz:", error);
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 }
    );
  }
}
