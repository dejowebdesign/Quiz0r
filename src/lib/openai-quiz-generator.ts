/**
 * Quiz Question Generator
 * 
 * This module handles the generation and normalization of quiz questions
 * using AI providers. The provider-specific code is abstracted through
 * the AIProvider interface.
 */

import { prisma } from "@/lib/db";
import { fetchUnsplashImages } from "@/lib/unsplash";
import { resolveSourceLanguage } from "@/lib/source-language";
import {
  type QuizGenerationOptions,
  type NormalizedAnswer,
  type NormalizedQuestion,
  type AIAnswer,
  type AIQuestion,
  type AICategoriseCategory,
  type AICategoriseItem,
  type AIMatchingPair,
  type AISection,
  type AIQuizResponse,
  getConfiguredProvider,
} from "@/lib/ai-provider";
import {
  AiQuestionTypeOption,
  newLocalId,
  validateCategoriseData,
  validateMatchingData,
  type CategoriseData,
  type MatchingData,
  type CategoriseCategory,
  type CategoriseItem,
  type MatchingPair,
} from "@/lib/question-types";

/**
 * Default permitted types when the caller does not restrict them. Keeps the
 * historic behaviour (single + multi) so existing flows are unchanged.
 */
const DEFAULT_ALLOWED_TYPES: AiQuestionTypeOption[] = [
  AiQuestionTypeOption.MULTIPLE_CHOICE,
];

/**
 * Map the legacy UI label "MULTIPLE_CHOICE" to the storage questionType. AI
 * generation lets the user pick "multiple choice" as one bucket; the actual
 * single vs. multi split is decided per-question by the model.
 */
function aiOptionToQuestionType(
  option: AiQuestionTypeOption
): "SINGLE_SELECT" | "MULTI_SELECT" | "TRUE_FALSE" | "CATEGORISE" | "MATCHING" {
  switch (option) {
    case AiQuestionTypeOption.TRUE_FALSE:
      return "TRUE_FALSE";
    case AiQuestionTypeOption.CATEGORISE:
      return "CATEGORISE";
    case AiQuestionTypeOption.MATCHING:
      return "MATCHING";
    case AiQuestionTypeOption.MULTIPLE_CHOICE:
    default:
      return "MULTI_SELECT";
  }
}

function normalizeQuestionType(
  type: string | undefined,
  allowed: AiQuestionTypeOption[]
): NormalizedQuestion["questionType"] {
  const normalized = type?.toUpperCase();
  const permitted = new Set(allowed.map(aiOptionToQuestionType));

  const map = (
    t: string
  ): "SINGLE_SELECT" | "MULTI_SELECT" | "TRUE_FALSE" | "CATEGORISE" | "MATCHING" | "SECTION" | null => {
    if (t === "MULTI_SELECT") return "MULTI_SELECT";
    if (t === "SINGLE_SELECT") return "SINGLE_SELECT";
    if (t === "TRUE_FALSE" || t === "TRUEFALSE" || t === "TRUE/FALSE" || t === "BOOLEAN")
      return "TRUE_FALSE";
    if (t === "CATEGORISE" || t === "CATEGORIZE" || t === "CATEGORIZATION" || t === "SORT")
      return "CATEGORISE";
    if (t === "MATCHING" || t === "MATCH" || t === "MATCH_UP")
      return "MATCHING";
    if (t === "SECTION") return "SECTION";
    return null;
  };

  if (normalized) {
    const mapped = map(normalized);
    if (mapped === "SECTION") return "SECTION";
    if (mapped && permitted.has(mapped)) return mapped;
  }

  // Type not recognized or not permitted: fall back to the first allowed
  // answer-based type. Prefer MULTI_SELECT, else SINGLE_SELECT.
  if (permitted.has("MULTI_SELECT")) return "MULTI_SELECT";
  if (permitted.has("SINGLE_SELECT")) return "SINGLE_SELECT";
  if (permitted.has("TRUE_FALSE")) return "TRUE_FALSE";
  if (permitted.has("CATEGORISE")) return "CATEGORISE";
  if (permitted.has("MATCHING")) return "MATCHING";
  return "MULTI_SELECT";
}

function normalizeAnswers(
  rawAnswers: AIAnswer[] | undefined,
  questionType: NormalizedQuestion["questionType"]
): NormalizedAnswer[] {
  if (
    questionType === "SECTION" ||
    questionType === "CATEGORISE" ||
    questionType === "MATCHING"
  ) {
    return [];
  }

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

  // TRUE/FALSE: force exactly two options (True, False) with one correct.
  if (questionType === "TRUE_FALSE") {
    const hasTrue = answers.some((a) => /true/i.test(a.answerText));
    const hasFalse = answers.some((a) => /false/i.test(a.answerText));
    if (answers.length < 2 || !hasTrue || !hasFalse) {
      // Rebuild a canonical True/False pair if the model did not supply them.
      answers.length = 0;
      answers.push({ answerText: "True", isCorrect: true, imageUrl: null });
      answers.push({ answerText: "False", isCorrect: false, imageUrl: null });
    } else {
      // Collapse to the canonical True/False pair.
      const trueAnswer = answers.find((a) => /true/i.test(a.answerText))!;
      const falseAnswer = answers.find((a) => /false/i.test(a.answerText))!;
      trueAnswer.answerText = "True";
      falseAnswer.answerText = "False";
      answers.length = 0;
      answers.push(trueAnswer, falseAnswer);
    }
    // Ensure exactly one correct.
    const correctCount = answers.filter((a) => a.isCorrect).length;
    if (correctCount === 0) answers[0].isCorrect = true;
    if (correctCount > 1) answers[1].isCorrect = false;
    return answers;
  }

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

/**
 * Normalize AI-produced CATEGORISE content. Stable ids are assigned and the
 * category assignment of each item is preserved; if the model produced no items
 * or categories (or an invalid mapping), returns null so the caller falls back
 * to a multi-select question.
 */
function normalizeCategoriseData(
  raw: AIQuestion["categoriseData"]
): CategoriseData | null {
  if (!raw || !Array.isArray(raw.categories) || !Array.isArray(raw.items)) {
    return null;
  }
  const categories: CategoriseCategory[] = (raw.categories as AICategoriseCategory[])
    .filter((c) => c && typeof c.label === "string" && c.label.trim())
    .map((c) => ({ id: c.id?.trim() || newLocalId("cat"), label: c.label.trim() }));
  if (categories.length < 2) return null;

  const categoryIds = new Set(categories.map((c) => c.id));
  const items: CategoriseItem[] = (raw.items as AICategoriseItem[])
    .filter((i) => i && typeof i.label === "string" && i.label.trim() && i.categoryId)
    .map((i) => ({
      id: i.id?.trim() || newLocalId("item"),
      label: i.label.trim(),
      categoryId: i.categoryId!.trim(),
    }))
    .filter((i) => categoryIds.has(i.categoryId));
  if (items.length < 2) return null;

  // Stable ids: re-map any AI-supplied ids to our own to guarantee uniqueness.
  const catIdMap = new Map<string, string>();
  categories.forEach((c, idx) => {
    const stableId = `cat_${idx + 1}`;
    catIdMap.set(c.id, stableId);
    c.id = stableId;
  });
  items.forEach((i) => {
    i.categoryId = catIdMap.get(i.categoryId) || i.categoryId;
  });
  items.forEach((i, idx) => {
    i.id = `item_${idx + 1}`;
  });

  const data: CategoriseData = { categories, items };
  return validateCategoriseData(data).valid ? data : null;
}

/**
 * Normalize AI-produced MATCHING content. Stable ids are assigned and the
 * left/right pairing is preserved; returns null if invalid so the caller falls
 * back to a multi-select question.
 */
function normalizeMatchingData(raw: AIQuestion["matchingData"]): MatchingData | null {
  if (!raw || !Array.isArray(raw.pairs)) return null;
  const pairs: MatchingPair[] = (raw.pairs as AIMatchingPair[])
    .filter(
      (p) =>
        p &&
        typeof p.leftLabel === "string" &&
        p.leftLabel.trim() &&
        typeof p.rightLabel === "string" &&
        p.rightLabel.trim()
    )
    .map((p, idx) => ({
      leftId: `left_${idx + 1}`,
      leftLabel: p.leftLabel.trim(),
      rightId: `right_${idx + 1}`,
      rightLabel: p.rightLabel.trim(),
    }));
  if (pairs.length < 2) return null;

  const data: MatchingData = { pairs };
  return validateMatchingData(data).valid ? data : null;
}

function normalizeQuestion(
  question: AIQuestion,
  allowed: AiQuestionTypeOption[]
): NormalizedQuestion {
  let questionType = normalizeQuestionType(question.questionType, allowed);
  let answers = normalizeAnswers(question.answers, questionType);
  let categoriseData: CategoriseData | null = null;
  let matchingData: MatchingData | null = null;

  // Normalize structured content for the extended types; if the model produced
  // invalid structured content, coerce back to MULTI_SELECT so the question is
  // still usable rather than dropped.
  if (questionType === "CATEGORISE") {
    categoriseData = normalizeCategoriseData(question.categoriseData);
    if (!categoriseData) {
      questionType = "MULTI_SELECT";
      answers = normalizeAnswers(question.answers, questionType);
    }
  } else if (questionType === "MATCHING") {
    matchingData = normalizeMatchingData(question.matchingData);
    if (!matchingData) {
      questionType = "MULTI_SELECT";
      answers = normalizeAnswers(question.answers, questionType);
    }
  }

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
    categoriseData,
    matchingData,
  };
}



function collectQuestionsFromSections(
  sections: AISection[] | undefined,
  fallbackQuestions: AIQuestion[],
  desiredQuestionCount: number,
  sectionLimit: number,
  topic: string,
  allowed: AiQuestionTypeOption[]
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
      normalized.push(normalizeQuestion(question, allowed));
      playableCount += 1;
    }
  }

  // Use any remaining top-level questions to reach the desired count
  const combinedFallback = [...fallbackQuestions, ...extraSectionQuestions];
  for (const question of combinedFallback) {
    if (playableCount >= desiredQuestionCount || normalized.length >= totalSlots) {
      break;
    }
    normalized.push(normalizeQuestion(question, allowed));
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
      normalizeQuestion(
        {
          questionText: `Review this ${topic} question before using live`,
          questionType: "MULTI_SELECT",
          answers: [
            { answerText: "Likely correct", isCorrect: true },
            { answerText: "Probably incorrect", isCorrect: false },
          ],
          hint: "Confirm correctness before using live",
          hostNotes: "AI could not supply enough unique questions.",
          timeLimit: 30,
          points: 100,
        },
        allowed
      )
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

  // Resolve the question types the AI is allowed to produce. The provider uses
  // this to bias its prompt; the normalizer uses it to coerce disallowed types.
  const allowedTypes =
    options.allowedQuestionTypes && options.allowedQuestionTypes.length > 0
      ? options.allowedQuestionTypes
      : DEFAULT_ALLOWED_TYPES;

  // Load Unsplash access key if configured
  const unsplashSetting = await prisma.setting.findUnique({
    where: { key: "unsplash_api_key" },
  });
  const unsplashAccessKey = unsplashSetting?.value || null;

  // Generate quiz content using the provider
  const aiResponse = await provider.generateQuiz({ ...options, allowedQuestionTypes: allowedTypes });

  // Normalize and enrich the AI response
  const normalizedQuestions = await addImagesToContent(
    collectQuestionsFromSections(
      aiResponse.sections,
      aiResponse.questions || [],
      questionCount,
      sectionCount,
      topic,
      allowedTypes
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
  const resolvedSourceLanguage = resolveSourceLanguage(options.sourceLanguage);

  const quiz = await prisma.quiz.create({
    data: {
      title: quizTitle,
      description: quizDescription,
      aiGenerated: true,
      sourceLanguage: resolvedSourceLanguage,
      questions: {
        create: normalizedQuestions.map((question, index) => {
          const isStructured =
            question.questionType === "CATEGORISE" ||
            question.questionType === "MATCHING";
          return {
            questionText: question.questionText,
            imageUrl: question.imageUrl,
            hostNotes: question.hostNotes,
            questionType: question.questionType,
            timeLimit: question.timeLimit,
            points: question.points,
            orderIndex: index,
            hint: question.hint,
            categoriseData: question.categoriseData
              ? JSON.stringify(question.categoriseData)
              : null,
            matchingData: question.matchingData
              ? JSON.stringify(question.matchingData)
              : null,
            answers:
              question.questionType === "SECTION" || isStructured
                ? undefined
                : {
                    create: question.answers.map((answer, answerIndex) => ({
                      answerText: answer.answerText,
                      imageUrl: answer.imageUrl,
                      isCorrect: answer.isCorrect,
                      orderIndex: answerIndex,
                    })),
                  },
          };
        }),
      },
    },
  });

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    questionCount: playableQuestions.length,
  };
}
