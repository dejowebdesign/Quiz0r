/**
 * Export/Import Type Definitions
 * Defines the structure of exported quiz data
 */

export type ExportVersion = "1.0" | "1.1" | "1.2";

export interface ExportedPowerUps {
  hintCount: number;
  copyAnswerCount: number;
  doublePointsCount: number;
}

export interface ExportedQuestionTranslation {
  languageCode: string;
  questionText: string;
  hostNotes: string | null;
  hint: string | null;
  easterEggButtonText: string | null;
}

export interface ExportedAnswerTranslation {
  languageCode: string;
  answerText: string;
}

export interface ExportedQuiz {
  exportVersion: ExportVersion;
  exportedAt: string; // ISO timestamp
  title: string;
  description: string | null;
  theme: string | null; // JSON string of QuizTheme
  autoAdmit?: boolean; // Optional for legacy exports
  powerUps?: ExportedPowerUps; // Optional for legacy exports
  sourceLanguage?: string | null; // Base/source language of the quiz content (optional for legacy imports)
  questions: ExportedQuestion[];
}

export interface ExportedQuestion {
  questionText: string;
  imageRef: string | null; // Path in ZIP: e.g., "images/q_0.jpg"
  hostNotes: string | null;
  questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "TRUE_FALSE" | "CATEGORISE" | "MATCHING" | "SECTION";
  timeLimit: number;
  points: number;
  orderIndex: number;
  hint?: string | null;
  easterEggEnabled?: boolean;
  easterEggButtonText?: string | null;
  easterEggUrl?: string | null;
  easterEggDisablesScoring?: boolean;
  translations?: ExportedQuestionTranslation[];
  answers: ExportedAnswer[];
  // Structured content for the extended question types (1.2+); null/omitted otherwise.
  categoriseData?: ExportedCategoriseData | null;
  matchingData?: ExportedMatchingData | null;
  // Translated structured content keyed by language code (1.2+).
  contentTranslations?: ExportedContentTranslation[];
}

export interface ExportedAnswer {
  answerText: string;
  imageRef: string | null; // Path in ZIP: e.g., "images/a_0_2.jpg"
  isCorrect: boolean;
  orderIndex: number;
  translations?: ExportedAnswerTranslation[];
}

// Structured content (mirrors of the runtime types, kept self-contained for export).

export interface ExportedCategoriseCategory {
  id: string;
  label: string;
}

export interface ExportedCategoriseItem {
  id: string;
  label: string;
  categoryId: string;
}

export interface ExportedCategoriseData {
  categories: ExportedCategoriseCategory[];
  items: ExportedCategoriseItem[];
}

export interface ExportedMatchingPair {
  leftId: string;
  leftLabel: string;
  rightId: string;
  rightLabel: string;
}

export interface ExportedMatchingData {
  pairs: ExportedMatchingPair[];
}

export interface ExportedContentTranslation {
  languageCode: string;
  contentData: string; // JSON string of translated structured content
}
