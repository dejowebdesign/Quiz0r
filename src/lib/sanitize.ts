/**
 * Input Sanitization
 * Sanitizes text inputs to prevent XSS and data corruption
 */

import {
  ExportedQuiz,
  type ExportedCategoriseData,
  type ExportedMatchingData,
} from "@/types/export";

export function sanitizeQuizData(quiz: ExportedQuiz): ExportedQuiz {
  const powerUps = quiz.powerUps ?? {
    hintCount: (quiz as any).hintCount,
    copyAnswerCount: (quiz as any).copyAnswerCount,
    doublePointsCount: (quiz as any).doublePointsCount,
  };

  return {
    ...quiz,
    exportVersion: quiz.exportVersion ?? "1.0",
    title: sanitizeText(quiz.title),
    description: quiz.description ? sanitizeText(quiz.description) : null,
    autoAdmit: quiz.autoAdmit ?? true,
    powerUps: {
      hintCount: sanitizeCount(powerUps.hintCount),
      copyAnswerCount: sanitizeCount(powerUps.copyAnswerCount),
      doublePointsCount: sanitizeCount(powerUps.doublePointsCount),
    },
    questions: quiz.questions.map(q => ({
      ...q,
      questionText: sanitizeText(q.questionText),
      hostNotes: q.hostNotes ? sanitizeText(q.hostNotes) : null,
      hint: q.hint ? sanitizeText(q.hint) : null,
      easterEggEnabled: q.easterEggEnabled ?? false,
      easterEggButtonText: q.easterEggButtonText ? sanitizeText(q.easterEggButtonText) : null,
      easterEggUrl: q.easterEggUrl ? sanitizeText(q.easterEggUrl) : null,
      easterEggDisablesScoring: q.easterEggDisablesScoring ?? false,
      categoriseData: q.categoriseData ? sanitizeCategoriseData(q.categoriseData) : null,
      matchingData: q.matchingData ? sanitizeMatchingData(q.matchingData) : null,
      translations: q.translations?.map(t => ({
        ...t,
        languageCode: typeof t.languageCode === "string" ? t.languageCode.trim() : "",
        questionText: sanitizeText(t.questionText),
        hostNotes: t.hostNotes ? sanitizeText(t.hostNotes) : null,
        hint: t.hint ? sanitizeText(t.hint) : null,
        easterEggButtonText: t.easterEggButtonText ? sanitizeText(t.easterEggButtonText) : null,
      })) ?? [],
      contentTranslations: q.contentTranslations?.map(t => ({
        languageCode: typeof t.languageCode === "string" ? t.languageCode.trim() : "",
        // contentData is a JSON string of translated labels; sanitize the
        // embedded label strings while preserving structure.
        contentData: sanitizeContentDataString(t.contentData),
      })) ?? [],
      answers: q.answers.map(a => ({
        ...a,
        answerText: sanitizeText(a.answerText),
        translations: a.translations?.map(t => ({
          ...t,
          languageCode: typeof t.languageCode === "string" ? t.languageCode.trim() : "",
          answerText: sanitizeText(t.answerText),
        })) ?? [],
      })),
    })),
  };
}

function sanitizeText(text: string): string {
  return text
    .trim()
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize whitespace (collapse multiple spaces)
    .replace(/\s+/g, " ")
    // Trim to reasonable length
    .substring(0, 2000);
}

function sanitizeCount(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(10, Math.max(0, Math.round(value)));
}

// Sanitize the structured-content label strings for CATEGORISE/MATCHING.
// Structure and ids are preserved; only label text is cleaned.
function sanitizeCategoriseData(data: ExportedCategoriseData): ExportedCategoriseData {
  return {
    categories: (data.categories || []).map((c) => ({
      id: typeof c.id === "string" ? c.id : "",
      label: typeof c.label === "string" ? sanitizeText(c.label) : "",
    })),
    items: (data.items || []).map((i) => ({
      id: typeof i.id === "string" ? i.id : "",
      label: typeof i.label === "string" ? sanitizeText(i.label) : "",
      categoryId: typeof i.categoryId === "string" ? i.categoryId : "",
    })),
  };
}

function sanitizeMatchingData(data: ExportedMatchingData): ExportedMatchingData {
  return {
    pairs: (data.pairs || []).map((p) => ({
      leftId: typeof p.leftId === "string" ? p.leftId : "",
      leftLabel: typeof p.leftLabel === "string" ? sanitizeText(p.leftLabel) : "",
      rightId: typeof p.rightId === "string" ? p.rightId : "",
      rightLabel: typeof p.rightLabel === "string" ? sanitizeText(p.rightLabel) : "",
    })),
  };
}

// Sanitize a contentData JSON string (translated structured content) by
// sanitizing every label field it contains; non-label structure is preserved.
function sanitizeContentDataString(contentData: string): string {
  if (typeof contentData !== "string") return "{}";
  try {
    const parsed = JSON.parse(contentData);
    const cleaned: Record<string, unknown> = {};
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.categories)) {
        cleaned.categories = parsed.categories.map((c: { id?: unknown; label?: unknown }) => ({
          id: typeof c.id === "string" ? c.id : "",
          label: typeof c.label === "string" ? sanitizeText(c.label) : "",
        }));
      }
      if (Array.isArray(parsed.items)) {
        cleaned.items = parsed.items.map((i: { id?: unknown; label?: unknown; categoryId?: unknown }) => ({
          id: typeof i.id === "string" ? i.id : "",
          label: typeof i.label === "string" ? sanitizeText(i.label) : "",
          categoryId: typeof i.categoryId === "string" ? i.categoryId : "",
        }));
      }
      if (Array.isArray(parsed.pairs)) {
        cleaned.pairs = parsed.pairs.map((p: { leftId?: unknown; leftLabel?: unknown; rightId?: unknown; rightLabel?: unknown }) => ({
          leftId: typeof p.leftId === "string" ? p.leftId : "",
          leftLabel: typeof p.leftLabel === "string" ? sanitizeText(p.leftLabel) : "",
          rightId: typeof p.rightId === "string" ? p.rightId : "",
          rightLabel: typeof p.rightLabel === "string" ? sanitizeText(p.rightLabel) : "",
        }));
      }
    }
    return JSON.stringify(cleaned);
  } catch {
    return "{}";
  }
}
