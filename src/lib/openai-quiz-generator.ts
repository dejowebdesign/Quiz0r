/**
 * Quiz Question Generator
 * 
 * This module handles the generation and normalization of quiz questions
 * using AI providers. The provider-specific code is abstracted through
 * the AIProvider interface.
 */

import { prisma } from "@/lib/db";
import { fetchUnsplashImages } from "@/lib/unsplash";
import {
  type QuizGenerationOptions,
  type NormalizedAnswer,
  type NormalizedQuestion,
  type AIAnswer,
  type AIQuestion,
  type AISection,
  type AIQuizResponse,
  getConfiguredProvider,
} from "@/lib/ai-provider";

function normalizeQuestionType(type?: string): NormalizedQuestion["questionType"] {
  const normalized = type?.toUpperCase();
  if (normalized === "MULTI_SELECT") return "MULTI_SELECT";
  if (normalized === "SECTION") return "SECTION";
  return "SINGLE_SELECT";
}

function normalizeAnswers(
  rawAnswers: AIAnswer[] | undefined,
  questionType: NormalizedQuestion["questionType"]
): NormalizedAnswer[] {
  if (questionType === "SECTION") return [];

  const answers: NormalizedAnswer[] = (rawAnswers || [])
    .filter((a) => a.answerText?.trim())
    .map((answer, index) => ({
      answerText: answer.answerText!.trim(),
      imageUrl: answer.imageUrl?.trim?.() || null,
      isCorrect:
        answer.isCorrect !== undefined
          ? Boolean(answer.isCorrect)
          : index === 0, // default first answer to correct if missing
    }))
    .slice(0, 6); // keep things concise

  // Ensure minimum answer set
  while (answers.length < 2) {
    answers.push({
      answerText: answers.length === 0 ? "Check the facts" : "Double-check this option",
      isCorrect: answers.length === 0,
      imageUrl: null,
    });
  }

  // Ensure at least one correct and one incorrect
  const hasCorrect = answers.some((a) => a.isCorrect);
  if (!hasCorrect) {
    answers[0].isCorrect = true;
  }
  const hasIncorrect = answers.some((a) => !a.isCorrect);
  if (!hasIncorrect) {
    answers[answers.length - 1].isCorrect = false;
  }

  // Single select should only have one correct answer
  if (questionType === "SINGLE_SELECT") {
    let madeFirstCorrect = false;
    for (const answer of answers) {
      if (answer.isCorrect && !madeFirstCorrect) {
        madeFirstCorrect = true;
      } else {
        answer.isCorrect = false;
      }
    }
    if (!madeFirstCorrect) {
      answers[0].isCorrect = true;
    }
  }

  // Randomize order to avoid always placing the correct answer first
  for (let i = answers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }

  return answers;
}

function normalizeQuestion(question: AIQuestion): NormalizedQuestion {
  const questionType = normalizeQuestionType(question.questionType);
  const answers = normalizeAnswers(question.answers, questionType);

  return {
    questionText:
      question.questionText?.trim() ||
      "Review this AI generated question before publishing",
    questionType,
    hint: questionType === "SECTION" ? null : question.hint?.trim() || null,
    hostNotes: question.hostNotes?.trim() || null,
    imageUrl: question.imageUrl?.trim?.() || null,
    timeLimit:
      questionType === "SECTION"
        ? 0
        : Math.min(90, Math.max(15, question.timeLimit ?? 30)),
    points: questionType === "SECTION" ? 0 : Math.max(50, question.points ?? 100),
    answers,
  };
}



function collectQuestionsFromSections(
  sections: AISection[] | undefined,
  fallbackQuestions: AIQuestion[],
  desiredQuestionCount: number,
  sectionLimit: number,
  topic: string
): NormalizedQuestion[] {
  const normalized: NormalizedQuestion[] = [];
  const allSections = sections || [];
  const limitedSections =
    sectionLimit === 0
      ? []
      : allSections.slice(0, Math.max(0, sectionLimit));
  const extraSectionQuestions =
    sectionLimit === 0
      ? allSections.flatMap((section) => section.questions || [])
      : [];
  const totalSlots = desiredQuestionCount + Math.max(0, sectionLimit);

  let playableCount = 0;
  let sectionCount = 0;

  for (const section of limitedSections) {
    if (normalized.length >= totalSlots) break;
    const sectionTitle = section.title?.trim() || "Section";
    normalized.push({
      questionText: sectionTitle,
      questionType: "SECTION",
      hint: null,
      hostNotes: section.description?.trim() || null,
      imageUrl: section.imageUrl?.trim?.() || null,
      timeLimit: 0,
      points: 0,
      answers: [],
    });
    sectionCount += 1;

    for (const question of section.questions || []) {
      if (playableCount >= desiredQuestionCount || normalized.length >= totalSlots) {
        break;
      }
      normalized.push(normalizeQuestion(question));
      playableCount += 1;
    }
  }

  // Use any remaining top-level questions to reach the desired count
  const combinedFallback = [...fallbackQuestions, ...extraSectionQuestions];
  for (const question of combinedFallback) {
    if (playableCount >= desiredQuestionCount || normalized.length >= totalSlots) {
      break;
    }
    normalized.push(normalizeQuestion(question));
    playableCount += 1;
  }

  // Add placeholder sections if AI returned fewer than requested
  while (sectionCount < sectionLimit && normalized.length < totalSlots) {
    sectionCount += 1;
    normalized.push({
      questionText: `Section ${sectionCount}: ${topic || "Quiz topic"}`,
      questionType: "SECTION",
      hint: null,
      hostNotes: "Added automatically. Adjust the intro, add image, and ensure questions align.",
      imageUrl: null,
      timeLimit: 0,
      points: 0,
      answers: [],
    });
  }

  // If we still don't have enough questions, pad with simple placeholders
  while (playableCount < desiredQuestionCount && normalized.length < totalSlots) {
    normalized.push(
      normalizeQuestion({
        questionText: `Review this ${topic} question before using live`,
        questionType: "SINGLE_SELECT",
        answers: [
          { answerText: "Likely correct", isCorrect: true },
          { answerText: "Probably incorrect", isCorrect: false },
        ],
        hint: "Confirm correctness before using live",
        hostNotes: "AI could not supply enough unique questions.",
        timeLimit: 30,
        points: 100,
      })
    );
    playableCount += 1;
  }

  return normalized.slice(0, totalSlots);
}

async function addImagesToContent(
  questions: NormalizedQuestion[],
  topic: string,
  unsplashAccessKey: string | null
): Promise<NormalizedQuestion[]> {
  const enriched: NormalizedQuestion[] = questions.map((q) => ({ ...q }));
  const unsplashImages =
    unsplashAccessKey && questions.length > 0
      ? await fetchUnsplashImages(topic, Math.max(questions.length, 8), unsplashAccessKey)
      : [];
  // Fixed direct Unsplash URLs (no redirects) for reliability
  const sectionImages = [
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1600&q=80",
  ];
  const questionImages = [
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1471357674240-e1a485acb3e1?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1600&q=80",
  ];

  const makeSectionImage = (index: number) =>
    unsplashImages.shift() ||
    sectionImages[(index - 1) % sectionImages.length];
  const makeQuestionImage = () =>
    unsplashImages.shift() ||
    questionImages[(Math.floor(Math.random() * questionImages.length))];

  // Ensure all sections have an image
  let sectionIndex = 0;
  for (const question of enriched) {
    if (question.questionType === "SECTION" && !question.imageUrl) {
      sectionIndex += 1;
      question.imageUrl = makeSectionImage(sectionIndex);
    }
  }

  const playable = enriched.filter((q) => q.questionType !== "SECTION");
  const missingImage = playable.filter((q) => !q.imageUrl);
  // Aim to cover all playable questions with an image when available
  const targetWithImages = playable.length;

  let added = 0;
  for (const question of missingImage) {
    if (added >= targetWithImages) break;
    added += 1;
    question.imageUrl = makeQuestionImage();
  }

  return enriched;
}

export async function generateQuizWithAI(options: QuizGenerationOptions) {
  // Get the configured AI provider (OpenAI for now)
  const provider = await getConfiguredProvider();
  
  // Check if the provider is available
  if (!(await provider.isAvailable())) {
    throw new Error(`${provider.name} is not configured`);
  }

  const questionCount = Math.min(Math.max(options.questionCount, 3), 25);
  const sectionCount = Math.min(Math.max(options.sectionCount, 0), questionCount);
  const topic = options.topic.trim() || "General Knowledge";
  const difficulty = options.difficulty || "medium";

  // Load Unsplash access key if configured
  const unsplashSetting = await prisma.setting.findUnique({
    where: { key: "unsplash_api_key" },
  });
  const unsplashAccessKey = unsplashSetting?.value || null;

  // Generate quiz content using the provider
  const aiResponse = await provider.generateQuiz(options);

  // Normalize and enrich the AI response
  const normalizedQuestions = await addImagesToContent(
    collectQuestionsFromSections(
      aiResponse.sections,
      aiResponse.questions || [],
      questionCount,
      sectionCount,
      topic
    ),
    topic,
    unsplashAccessKey
  );

  const playableQuestions = normalizedQuestions.filter(
    (q) => q.questionType !== "SECTION"
  );

  const quizTitle =
    aiResponse.title?.trim() ||
    `${topic || "AI"} Quiz (${difficulty})`;

  const quizDescription =
    aiResponse.description?.trim() ||
    "Draft created with AI. Review carefully before hosting.";

  // Persist quiz with questions
  const quiz = await prisma.quiz.create({
    data: {
      title: quizTitle,
      description: quizDescription,
      aiGenerated: true,
      questions: {
        create: normalizedQuestions.map((question, index) => ({
          questionText: question.questionText,
          imageUrl: question.imageUrl,
          hostNotes: question.hostNotes,
          questionType: question.questionType,
          timeLimit: question.timeLimit,
          points: question.points,
          orderIndex: index,
          hint: question.hint,
          answers:
            question.questionType === "SECTION"
              ? undefined
              : {
                  create: question.answers.map((answer, answerIndex) => ({
                    answerText: answer.answerText,
                    imageUrl: answer.imageUrl,
                    isCorrect: answer.isCorrect,
                    orderIndex: answerIndex,
                  })),
                },
        })),
      },
    },
  });

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    questionCount: playableQuestions.length,
  };
}
