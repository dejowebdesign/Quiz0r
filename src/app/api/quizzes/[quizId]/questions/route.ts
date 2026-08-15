import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  validateCategoriseData,
  validateMatchingData,
  type CategoriseData,
  type MatchingData,
} from "@/lib/question-types";

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

// GET /api/quizzes/[quizId]/questions - List questions (admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;

    const questions = await prisma.question.findMany({
      where: { quizId },
      include: {
        answers: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

// POST /api/quizzes/[quizId]/questions - Create question with answers (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;
    const body = await request.json();
    const {
      questionText,
      imageUrl,
      hostNotes,
      questionType = "SINGLE_SELECT",
      timeLimit = 30,
      points = 100,
      answers = [],
      hint,
      categoriseData,
      matchingData,
      easterEggEnabled = false,
      easterEggButtonText,
      easterEggUrl,
      easterEggDisablesScoring = false,
    } = body;

    if (!questionText || typeof questionText !== "string") {
      return NextResponse.json(
        { error: "Question text is required" },
        { status: 400 }
      );
    }

    // Easter egg validation
    if (easterEggEnabled) {
      if (!easterEggButtonText || typeof easterEggButtonText !== "string") {
        return NextResponse.json(
          { error: "Easter egg button text is required when enabled" },
          { status: 400 }
        );
      }
      if (!easterEggUrl || typeof easterEggUrl !== "string") {
        return NextResponse.json(
          { error: "Easter egg URL is required when enabled" },
          { status: 400 }
        );
      }
      if (!easterEggUrl.match(/^https?:\/\/.+/)) {
        return NextResponse.json(
          { error: "Easter egg URL must be a valid HTTP/HTTPS URL" },
          { status: 400 }
        );
      }
    }

    // Type-specific validation
    const isSection = questionType === "SECTION";
    const isCategorise = questionType === "CATEGORISE";
    const isMatching = questionType === "MATCHING";
    const isTrueFalse = questionType === "TRUE_FALSE";

    // CATEGORISE / MATCHING use structured JSON content instead of answers.
    let categoriseDataJson: string | null = null;
    let matchingDataJson: string | null = null;

    if (isCategorise) {
      if (!categoriseData || typeof categoriseData !== "object") {
        return NextResponse.json(
          { error: "Categorise questions require categoriseData" },
          { status: 400 }
        );
      }
      const result = validateCategoriseData(categoriseData as CategoriseData);
      if (!result.valid) {
        return NextResponse.json(
          { error: result.error || "Invalid categorise data" },
          { status: 400 }
        );
      }
      categoriseDataJson = JSON.stringify(categoriseData);
    } else if (isMatching) {
      if (!matchingData || typeof matchingData !== "object") {
        return NextResponse.json(
          { error: "Matching questions require matchingData" },
          { status: 400 }
        );
      }
      const result = validateMatchingData(matchingData as MatchingData);
      if (!result.valid) {
        return NextResponse.json(
          { error: result.error || "Invalid matching data" },
          { status: 400 }
        );
      }
      matchingDataJson = JSON.stringify(matchingData);
    } else if (!isSection) {
      // SINGLE_SELECT / MULTI_SELECT / TRUE_FALSE require answer options.
      if (!Array.isArray(answers) || answers.length < 2) {
        return NextResponse.json(
          { error: "At least 2 answers are required" },
          { status: 400 }
        );
      }
      if (isTrueFalse) {
        // Exactly one correct answer out of exactly two.
        const correctCount = answers.filter((a: { isCorrect?: boolean }) => a.isCorrect).length;
        if (answers.length !== 2 || correctCount !== 1) {
          return NextResponse.json(
            { error: "True/False questions must have exactly 2 answers with one correct" },
            { status: 400 }
          );
        }
      }
    }

    // Get the next order index
    const lastQuestion = await prisma.question.findFirst({
      where: { quizId },
      orderBy: { orderIndex: "desc" },
    });
    const nextOrderIndex = (lastQuestion?.orderIndex ?? -1) + 1;

    // Create question with answers in a transaction
    const question = await prisma.question.create({
      data: {
        quizId,
        questionText: questionText.trim(),
        imageUrl: imageUrl?.trim() || null,
        hostNotes: hostNotes?.trim() || null,
        questionType,
        timeLimit,
        points,
        orderIndex: nextOrderIndex,
        hint: hint?.trim() || null,
        categoriseData: categoriseDataJson,
        matchingData: matchingDataJson,
        easterEggEnabled,
        easterEggButtonText: easterEggEnabled ? easterEggButtonText.trim() : null,
        easterEggUrl: easterEggEnabled ? easterEggUrl.trim() : null,
        easterEggDisablesScoring: easterEggEnabled ? easterEggDisablesScoring : false,
        answers: {
          create: isSection || isCategorise || isMatching
            ? []
            : answers.map(
                (
                  answer: {
                    answerText: string;
                    imageUrl?: string;
                    isCorrect?: boolean;
                  },
                  index: number
                ) => ({
                  answerText: answer.answerText.trim(),
                  imageUrl: answer.imageUrl?.trim() || null,
                  isCorrect: answer.isCorrect ?? false,
                  orderIndex: index,
                })
            ),
        },
      },
      include: {
        answers: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}
