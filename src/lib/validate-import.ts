/**
 * Quiz Import Validation
 * Validates imported quiz structure and constraints
 */

import { SupportedLanguages } from "@/types";
import { ExportedQuiz } from "@/types/export";
import {
  validateCategoriseData,
  validateMatchingData,
  type CategoriseData,
  type MatchingData,
} from "@/lib/question-types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateQuizStructure(data: unknown): ValidationResult {
  // Type guard
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Quiz data must be an object" };
  }

  const quiz = data as Partial<ExportedQuiz>;

  // Version metadata
  const version = quiz.exportVersion ?? "1.0";
  if (version !== "1.0" && version !== "1.1" && version !== "1.2") {
    return { valid: false, error: `Unsupported export version: ${version}` };
  }

  if (!quiz.exportedAt || typeof quiz.exportedAt !== "string") {
    return { valid: false, error: "Quiz exportedAt timestamp is required" };
  }

  if (Number.isNaN(Date.parse(quiz.exportedAt))) {
    return { valid: false, error: "Quiz exportedAt must be a valid timestamp" };
  }

  // Required fields
  if (!quiz.title || typeof quiz.title !== "string" || quiz.title.trim() === "") {
    return { valid: false, error: "Quiz title is required" };
  }

  if (quiz.title.length > 200) {
    return { valid: false, error: "Quiz title is too long (max 200 characters)" };
  }

  if (quiz.description !== null && quiz.description !== undefined) {
    if (typeof quiz.description !== "string") {
      return { valid: false, error: "Quiz description must be a string" };
    }
    if (quiz.description.length > 1000) {
      return { valid: false, error: "Quiz description is too long (max 1000 characters)" };
    }
  }

  // Theme validation
  if (quiz.theme !== null && quiz.theme !== undefined) {
    if (typeof quiz.theme !== "string") {
      return { valid: false, error: "Quiz theme must be a JSON string or null" };
    }

    // Try to parse theme JSON
    if (quiz.theme) {
      try {
        JSON.parse(quiz.theme);
      } catch {
        return { valid: false, error: "Quiz theme is not valid JSON" };
      }
    }
  }

  // Auto-admit flag
  if (quiz.autoAdmit !== undefined && typeof quiz.autoAdmit !== "boolean") {
    return { valid: false, error: "autoAdmit must be a boolean" };
  }

  // Power-ups (allow legacy top-level counts)
  const powerUps = quiz.powerUps ?? {
    hintCount: (quiz as any).hintCount,
    copyAnswerCount: (quiz as any).copyAnswerCount,
    doublePointsCount: (quiz as any).doublePointsCount,
  };

  if (powerUps && typeof powerUps !== "object") {
    return { valid: false, error: "powerUps must be an object" };
  }

  if (powerUps) {
    const powerUpFields: Array<[string, unknown]> = [
      ["hintCount", powerUps.hintCount],
      ["copyAnswerCount", powerUps.copyAnswerCount],
      ["doublePointsCount", powerUps.doublePointsCount],
    ];

    for (const [field, value] of powerUpFields) {
      if (value === undefined) continue;
      if (typeof value !== "number" || value < 0 || value > 10) {
        return {
          valid: false,
          error: `Power-up ${field} must be a number between 0 and 10`,
        };
      }
    }
  }

  // Questions validation
  if (!Array.isArray(quiz.questions)) {
    return { valid: false, error: "Questions must be an array" };
  }

  if (quiz.questions.length === 0) {
    return { valid: false, error: "Quiz must have at least one question" };
  }

  if (quiz.questions.length > 200) {
    return { valid: false, error: "Too many questions (max 200)" };
  }

  // Validate each question
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const result = validateQuestion(q, i);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

function validateQuestion(q: unknown, index: number): ValidationResult {
  if (!q || typeof q !== "object") {
    return { valid: false, error: `Question ${index + 1} is invalid` };
  }

  const question = q as any;

  // Required fields
  if (!question.questionText || typeof question.questionText !== "string") {
    return { valid: false, error: `Question ${index + 1}: questionText is required` };
  }

  if (question.questionText.length > 500) {
    return { valid: false, error: `Question ${index + 1}: text is too long (max 500 characters)` };
  }

  if (question.imageRef !== null && question.imageRef !== undefined && typeof question.imageRef !== "string") {
    return { valid: false, error: `Question ${index + 1}: imageRef must be a string or null` };
  }

  if (question.hostNotes !== null && question.hostNotes !== undefined) {
    if (typeof question.hostNotes !== "string") {
      return { valid: false, error: `Question ${index + 1}: hostNotes must be a string` };
    }
    if (question.hostNotes.length > 1000) {
      return { valid: false, error: `Question ${index + 1}: hostNotes is too long (max 1000 characters)` };
    }
  }

  // Question type
  const validTypes = ["SINGLE_SELECT", "MULTI_SELECT", "TRUE_FALSE", "CATEGORISE", "MATCHING", "SECTION"];
  if (!validTypes.includes(question.questionType)) {
    return { valid: false, error: `Question ${index + 1}: invalid question type (must be SINGLE_SELECT, MULTI_SELECT, TRUE_FALSE, CATEGORISE, MATCHING, or SECTION)` };
  }

  // Time limit
  if (typeof question.timeLimit !== "number" || question.timeLimit < 0 || question.timeLimit > 300) {
    return { valid: false, error: `Question ${index + 1}: invalid time limit (must be 0-300 seconds)` };
  }

  // Points
  if (typeof question.points !== "number" || question.points < 0 || question.points > 10000) {
    return { valid: false, error: `Question ${index + 1}: invalid points value (must be 0-10000)` };
  }

  // Hint
  if (question.hint !== null && question.hint !== undefined) {
    if (typeof question.hint !== "string") {
      return { valid: false, error: `Question ${index + 1}: hint must be a string` };
    }
    if (question.hint.length > 500) {
      return { valid: false, error: `Question ${index + 1}: hint is too long (max 500 characters)` };
    }
  }

  // Easter egg configuration
  if (question.easterEggEnabled !== undefined && typeof question.easterEggEnabled !== "boolean") {
    return { valid: false, error: `Question ${index + 1}: easterEggEnabled must be a boolean` };
  }

  if (question.easterEggButtonText !== null && question.easterEggButtonText !== undefined) {
    if (typeof question.easterEggButtonText !== "string") {
      return { valid: false, error: `Question ${index + 1}: easterEggButtonText must be a string` };
    }
    if (question.easterEggButtonText.length > 200) {
      return { valid: false, error: `Question ${index + 1}: easterEggButtonText is too long (max 200 characters)` };
    }
  }

  if (question.easterEggUrl !== null && question.easterEggUrl !== undefined) {
    if (typeof question.easterEggUrl !== "string") {
      return { valid: false, error: `Question ${index + 1}: easterEggUrl must be a string` };
    }
    if (!/^https?:\/\/.+/i.test(question.easterEggUrl)) {
      return { valid: false, error: `Question ${index + 1}: easterEggUrl must start with http or https` };
    }
    if (question.easterEggUrl.length > 500) {
      return { valid: false, error: `Question ${index + 1}: easterEggUrl is too long (max 500 characters)` };
    }
  }

  if (question.easterEggDisablesScoring !== undefined && typeof question.easterEggDisablesScoring !== "boolean") {
    return { valid: false, error: `Question ${index + 1}: easterEggDisablesScoring must be a boolean` };
  }

  if (question.easterEggEnabled) {
    if (!question.easterEggButtonText) {
      return { valid: false, error: `Question ${index + 1}: easterEggButtonText is required when easterEggEnabled is true` };
    }
    if (!question.easterEggUrl) {
      return { valid: false, error: `Question ${index + 1}: easterEggUrl is required when easterEggEnabled is true` };
    }
  }

  // Order index
  if (typeof question.orderIndex !== "number" || question.orderIndex < 0) {
    return { valid: false, error: `Question ${index + 1}: invalid order index` };
  }

  // Answers
  if (!Array.isArray(question.answers)) {
    return { valid: false, error: `Question ${index + 1}: answers must be an array` };
  }

  const isAnswerType =
    question.questionType === "SINGLE_SELECT" ||
    question.questionType === "MULTI_SELECT" ||
    question.questionType === "TRUE_FALSE";
  const isStructuredType =
    question.questionType === "CATEGORISE" || question.questionType === "MATCHING";

  // Structured-content validation for the extended types.
  if (question.questionType === "CATEGORISE") {
    if (!question.categoriseData || typeof question.categoriseData !== "object") {
      return { valid: false, error: `Question ${index + 1}: CATEGORISE requires categoriseData` };
    }
    const result = validateCategoriseData(question.categoriseData as CategoriseData);
    if (!result.valid) {
      return { valid: false, error: `Question ${index + 1}: ${result.error}` };
    }
    if (question.answers.length > 0) {
      return { valid: false, error: `Question ${index + 1}: CATEGORISE questions should not have answers` };
    }
  } else if (question.questionType === "MATCHING") {
    if (!question.matchingData || typeof question.matchingData !== "object") {
      return { valid: false, error: `Question ${index + 1}: MATCHING requires matchingData` };
    }
    const result = validateMatchingData(question.matchingData as MatchingData);
    if (!result.valid) {
      return { valid: false, error: `Question ${index + 1}: ${result.error}` };
    }
    if (question.answers.length > 0) {
      return { valid: false, error: `Question ${index + 1}: MATCHING questions should not have answers` };
    }
  }

  // Answer-option questions (SINGLE/MULTI/TRUE_FALSE) require answers; sections
  // and structured types do not.
  if (isAnswerType) {
    // TRUE/FALSE has its own exact-count rule that supersedes the generic minimum.
    if (question.questionType === "TRUE_FALSE") {
      const correctCount = question.answers.filter((a: any) => a.isCorrect === true).length;
      if (question.answers.length !== 2 || correctCount !== 1) {
        return { valid: false, error: `Question ${index + 1}: TRUE_FALSE must have exactly 2 answers with one correct` };
      }
    } else {
      if (question.answers.length < 2) {
        return { valid: false, error: `Question ${index + 1}: must have at least 2 answers` };
      }

      if (question.answers.length > 6) {
        return { valid: false, error: `Question ${index + 1}: too many answers (max 6)` };
      }

      // Check at least one correct answer
      const hasCorrect = question.answers.some((a: any) => a.isCorrect === true);
      if (!hasCorrect) {
        return { valid: false, error: `Question ${index + 1}: must have at least one correct answer` };
      }
    }

    // Validate each answer
    for (let j = 0; j < question.answers.length; j++) {
      const a = question.answers[j];

      if (!a || typeof a !== "object") {
        return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: invalid` };
      }

      if (!a.answerText || typeof a.answerText !== "string") {
        return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: text is required` };
      }

      if (a.answerText.length > 200) {
        return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: text is too long (max 200 characters)` };
      }

      if (a.imageRef !== null && a.imageRef !== undefined && typeof a.imageRef !== "string") {
        return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: imageRef must be a string or null` };
      }

      if (typeof a.isCorrect !== "boolean") {
        return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: isCorrect must be boolean` };
      }

      if (typeof a.orderIndex !== "number" || a.orderIndex < 0) {
        return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: invalid order index` };
      }

      if (a.translations !== undefined) {
        if (!Array.isArray(a.translations)) {
          return { valid: false, error: `Question ${index + 1}, Answer ${j + 1}: translations must be an array` };
        }

        for (let k = 0; k < a.translations.length; k++) {
          const result = validateAnswerTranslation(a.translations[k], index, j, k);
          if (!result.valid) {
            return result;
          }
        }
      }
    }
  } else if (question.questionType === "SECTION") {
    // Sections should have zero answers
    if (question.answers.length > 0) {
      return { valid: false, error: `Question ${index + 1}: SECTION questions should not have answers` };
    }
  }

  // Validate structured-content translations (contentTranslations) for the
  // extended types: each entry is { languageCode, contentData (JSON string) }.
  if (isStructuredType && question.contentTranslations !== undefined) {
    if (!Array.isArray(question.contentTranslations)) {
      return { valid: false, error: `Question ${index + 1}: contentTranslations must be an array` };
    }
    for (let j = 0; j < question.contentTranslations.length; j++) {
      const ct = question.contentTranslations[j];
      if (!ct || typeof ct !== "object") {
        return { valid: false, error: `Question ${index + 1}, contentTranslation ${j + 1}: invalid` };
      }
      if (!ct.languageCode || typeof ct.languageCode !== "string") {
        return { valid: false, error: `Question ${index + 1}, contentTranslation ${j + 1}: languageCode is required` };
      }
      if (typeof ct.contentData !== "string") {
        return { valid: false, error: `Question ${index + 1}, contentTranslation ${j + 1}: contentData must be a JSON string` };
      }
      try {
        JSON.parse(ct.contentData);
      } catch {
        return { valid: false, error: `Question ${index + 1}, contentTranslation ${j + 1}: contentData is not valid JSON` };
      }
    }
  }

  if (question.translations !== undefined) {
    if (!Array.isArray(question.translations)) {
      return { valid: false, error: `Question ${index + 1}: translations must be an array` };
    }

    if (question.translations.length > 50) {
      return { valid: false, error: `Question ${index + 1}: too many translations (max 50)` };
    }

    for (let j = 0; j < question.translations.length; j++) {
      const result = validateQuestionTranslation(question.translations[j], index, j);
      if (!result.valid) {
        return result;
      }
    }
  }

  return { valid: true };
}

function validateQuestionTranslation(
  t: any,
  questionIndex: number,
  translationIndex: number
): ValidationResult {
  if (!t || typeof t !== "object") {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: invalid` };
  }

  if (!t.languageCode || typeof t.languageCode !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: languageCode is required` };
  }

  if (!(t.languageCode in SupportedLanguages)) {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: unsupported language` };
  }

  if (!t.questionText || typeof t.questionText !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: questionText is required` };
  }

  if (t.questionText.length > 500) {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: questionText is too long (max 500 characters)` };
  }

  if (t.hostNotes !== null && t.hostNotes !== undefined && typeof t.hostNotes !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: hostNotes must be a string` };
  }

  if (t.hint !== null && t.hint !== undefined && typeof t.hint !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: hint must be a string` };
  }

  if (t.easterEggButtonText !== null && t.easterEggButtonText !== undefined && typeof t.easterEggButtonText !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Translation ${translationIndex + 1}: easterEggButtonText must be a string` };
  }

  return { valid: true };
}

function validateAnswerTranslation(
  t: any,
  questionIndex: number,
  answerIndex: number,
  translationIndex: number
): ValidationResult {
  if (!t || typeof t !== "object") {
    return { valid: false, error: `Question ${questionIndex + 1}, Answer ${answerIndex + 1}, Translation ${translationIndex + 1}: invalid` };
  }

  if (!t.languageCode || typeof t.languageCode !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Answer ${answerIndex + 1}, Translation ${translationIndex + 1}: languageCode is required` };
  }

  if (!(t.languageCode in SupportedLanguages)) {
    return { valid: false, error: `Question ${questionIndex + 1}, Answer ${answerIndex + 1}, Translation ${translationIndex + 1}: unsupported language` };
  }

  if (!t.answerText || typeof t.answerText !== "string") {
    return { valid: false, error: `Question ${questionIndex + 1}, Answer ${answerIndex + 1}, Translation ${translationIndex + 1}: answerText is required` };
  }

  if (t.answerText.length > 200) {
    return { valid: false, error: `Question ${questionIndex + 1}, Answer ${answerIndex + 1}, Translation ${translationIndex + 1}: answerText is too long (max 200 characters)` };
  }

  return { valid: true };
}
