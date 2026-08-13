/**
 * Export/Import Type Definitions
 * Defines the structure of exported quiz data
 */

export type ExportVersion = "1.0" | "1.1";

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
  questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "SECTION";
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
}

export interface ExportedAnswer {
  answerText: string;
  imageRef: string | null; // Path in ZIP: e.g., "images/a_0_2.jpg"
  isCorrect: boolean;
  orderIndex: number;
  translations?: ExportedAnswerTranslation[];
}
