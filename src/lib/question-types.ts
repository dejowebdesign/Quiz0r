/**
 * Extended question-type content models and helpers.
 *
 * The structured content for CATEGORISE and MATCHING questions is stored as
 * JSON in the Question.categoriseData / Question.matchingData columns. These
 * types describe that JSON shape and provide pure validation/scoring helpers
 * so the server can evaluate answers trustworthily without frontend logic.
 */

import type { QuestionType } from "@/types";

export const ExtendedQuestionType = {
  TRUE_FALSE: "TRUE_FALSE",
  CATEGORISE: "CATEGORISE",
  MATCHING: "MATCHING",
} as const;

/** Question types the AI quiz generator may be asked to produce. */
export const AiQuestionTypeOption = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  TRUE_FALSE: "TRUE_FALSE",
  CATEGORISE: "CATEGORISE",
  MATCHING: "MATCHING",
} as const;

export type AiQuestionTypeOption =
  (typeof AiQuestionTypeOption)[keyof typeof AiQuestionTypeOption];

/** All selectable AI question-type options, order-stable for the UI. */
export const AI_QUESTION_TYPE_OPTIONS: AiQuestionTypeOption[] = [
  AiQuestionTypeOption.MULTIPLE_CHOICE,
  AiQuestionTypeOption.TRUE_FALSE,
  AiQuestionTypeOption.CATEGORISE,
  AiQuestionTypeOption.MATCHING,
];

// ---------------------------------------------------------------------------
// CATEGORISE
// ---------------------------------------------------------------------------

export interface CategoriseCategory {
  id: string;
  label: string;
}

export interface CategoriseItem {
  id: string;
  label: string;
  categoryId: string; // correct category for this item
}

export interface CategoriseData {
  categories: CategoriseCategory[];
  items: CategoriseItem[];
}

/** A player's assignment for one item: itemId -> categoryId. */
export type CategoriseAssignment = { itemId: string; categoryId: string };

// ---------------------------------------------------------------------------
// MATCHING
// ---------------------------------------------------------------------------

export interface MatchingPair {
  leftId: string;
  leftLabel: string;
  rightId: string;
  rightLabel: string;
}

export interface MatchingData {
  pairs: MatchingPair[];
}

/** A player's match: leftId -> rightId. */
export type MatchingAssignment = { leftId: string; rightId: string };

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

export interface StructuredContentValidation {
  valid: boolean;
  error?: string;
}

export function parseCategoriseData(raw: string | CategoriseData | null | undefined): CategoriseData | null {
  if (!raw) return null;
  // Accept an already-parsed object (the server/typed layer may pass objects).
  if (typeof raw === "object") {
    if (
      Array.isArray((raw as CategoriseData).categories) &&
      Array.isArray((raw as CategoriseData).items)
    ) {
      return raw as CategoriseData;
    }
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.categories) &&
      Array.isArray(parsed.items)
    ) {
      return parsed as CategoriseData;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseMatchingData(raw: string | MatchingData | null | undefined): MatchingData | null {
  if (!raw) return null;
  if (typeof raw === "object") {
    if (Array.isArray((raw as MatchingData).pairs)) {
      return raw as MatchingData;
    }
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.pairs)) {
      return parsed as MatchingData;
    }
  } catch {
    return null;
  }
  return null;
}

export function validateCategoriseData(data: CategoriseData): StructuredContentValidation {
  if (!Array.isArray(data.categories) || data.categories.length < 2) {
    return { valid: false, error: "At least 2 categories are required" };
  }
  if (!Array.isArray(data.items) || data.items.length < 2) {
    return { valid: false, error: "At least 2 items are required" };
  }
  const categoryIds = new Set(data.categories.map((c) => c.id));
  for (const cat of data.categories) {
    if (!cat.id || typeof cat.label !== "string" || !cat.label.trim()) {
      return { valid: false, error: "Each category needs an id and a label" };
    }
  }
  for (const item of data.items) {
    if (!item.id || typeof item.label !== "string" || !item.label.trim()) {
      return { valid: false, error: "Each item needs an id and a label" };
    }
    if (!categoryIds.has(item.categoryId)) {
      return { valid: false, error: "Each item must reference an existing category" };
    }
  }
  return { valid: true };
}

export function validateMatchingData(data: MatchingData): StructuredContentValidation {
  if (!Array.isArray(data.pairs) || data.pairs.length < 2) {
    return { valid: false, error: "At least 2 pairs are required" };
  }
  const leftIds = new Set<string>();
  const rightIds = new Set<string>();
  for (const pair of data.pairs) {
    if (!pair.leftId || !pair.rightId) {
      return { valid: false, error: "Each pair needs leftId and rightId" };
    }
    if (leftIds.has(pair.leftId)) {
      return { valid: false, error: "Duplicate left side in matching pairs" };
    }
    if (rightIds.has(pair.rightId)) {
      return { valid: false, error: "Duplicate right side in matching pairs" };
    }
    leftIds.add(pair.leftId);
    rightIds.add(pair.rightId);
    if (typeof pair.leftLabel !== "string" || !pair.leftLabel.trim()) {
      return { valid: false, error: "Each pair needs a left label" };
    }
    if (typeof pair.rightLabel !== "string" || !pair.rightLabel.trim()) {
      return { valid: false, error: "Each pair needs a right label" };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Answer payload (player submissions) — encoded as answerId strings so the
// existing player:answer socket contract (answerIds: string[]) and the
// PlayerAnswer.selectedAnswerIds JSON column keep working unchanged.
// ---------------------------------------------------------------------------

/** Encode a categorise assignment as a stable answer-id token. */
export function categoriseAssignmentId(itemId: string, categoryId: string): string {
  return `${itemId}:${categoryId}`;
}

export function parseCategoriseAnswerId(id: string): CategoriseAssignment | null {
  const parts = id.split(":");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { itemId: parts[0], categoryId: parts.slice(1).join(":") };
  }
  return null;
}

/** Encode a matching assignment as a stable answer-id token. */
export function matchingAssignmentId(leftId: string, rightId: string): string {
  return `${leftId}:${rightId}`;
}

export function parseMatchingAnswerId(id: string): MatchingAssignment | null {
  const parts = id.split(":");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { leftId: parts[0], rightId: parts.slice(1).join(":") };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Server-side scoring helpers (partial credit + speed bonus)
// ---------------------------------------------------------------------------

/**
 * Score for a CATEGORISE question.
 * correctnessRatio = correctItems / totalItems; 0 if none correct.
 * Score = round(basePoints * correctnessRatio * (1 + speedMultiplier)).
 */
export function calculateCategoriseScore(
  basePoints: number,
  timeLimitMs: number,
  timeTakenMs: number,
  assignments: CategoriseAssignment[],
  data: CategoriseData
): { points: number; isCorrect: boolean; correctCount: number; total: number } {
  const total = data.items.length;
  if (total === 0) return { points: 0, isCorrect: false, correctCount: 0, total: 0 };

  const correctMap = new Map(data.items.map((i) => [i.id, i.categoryId]));
  let correctCount = 0;
  for (const a of assignments) {
    if (correctMap.get(a.itemId) === a.categoryId) correctCount += 1;
  }

  const correctnessRatio = total > 0 ? correctCount / total : 0;
  const speedRatio = 1 - timeTakenMs / timeLimitMs;
  const speedMultiplier = Math.max(0, speedRatio * 0.5);

  const points = correctnessRatio > 0
    ? Math.round(basePoints * correctnessRatio * (1 + speedMultiplier))
    : 0;

  return {
    points,
    isCorrect: correctCount === total,
    correctCount,
    total,
  };
}

/**
 * Score for a MATCHING question.
 * correctnessRatio = correctPairs / totalPairs; 0 if none correct.
 * Score = round(basePoints * correctnessRatio * (1 + speedMultiplier)).
 */
export function calculateMatchingScore(
  basePoints: number,
  timeLimitMs: number,
  timeTakenMs: number,
  assignments: MatchingAssignment[],
  data: MatchingData
): { points: number; isCorrect: boolean; correctCount: number; total: number } {
  const total = data.pairs.length;
  if (total === 0) return { points: 0, isCorrect: false, correctCount: 0, total: 0 };

  const correctMap = new Map(data.pairs.map((p) => [p.leftId, p.rightId]));
  let correctCount = 0;
  for (const a of assignments) {
    if (correctMap.get(a.leftId) === a.rightId) correctCount += 1;
  }

  const correctnessRatio = total > 0 ? correctCount / total : 0;
  const speedRatio = 1 - timeTakenMs / timeLimitMs;
  const speedMultiplier = Math.max(0, speedRatio * 0.5);

  const points = correctnessRatio > 0
    ? Math.round(basePoints * correctnessRatio * (1 + speedMultiplier))
    : 0;

  return {
    points,
    isCorrect: correctCount === total,
    correctCount,
    total,
  };
}

/** Whether a question type uses the structured-content JSON fields. */
export function isCategoriseType(type: string | QuestionType): boolean {
  return type === ExtendedQuestionType.CATEGORISE;
}

export function isMatchingType(type: string | QuestionType): boolean {
  return type === ExtendedQuestionType.MATCHING;
}

export function isTrueFalseType(type: string | QuestionType): boolean {
  return type === ExtendedQuestionType.TRUE_FALSE;
}

/** Whether the type is answer-based through the Answer[] model (vs structured). */
export function isAnswerBasedType(type: string | QuestionType): boolean {
  return (
    type === "SINGLE_SELECT" ||
    type === "MULTI_SELECT" ||
    type === ExtendedQuestionType.TRUE_FALSE
  );
}

/**
 * Maps a question type to the existing host.* i18n key that labels it in the
 * UI (e.g. the QuestionCard type badge). Returns the fallback key
 * "singleSelect" for any unrecognised type so the label is always defined.
 */
const QUESTION_TYPE_LABEL_KEY: Record<string, string> = {
  SINGLE_SELECT: "singleSelect",
  MULTI_SELECT: "multiSelect",
  TRUE_FALSE: "trueFalse",
  CATEGORISE: "categorise",
  MATCHING: "matching",
};

export function getQuestionTypeLabelKey(type: string | QuestionType): string {
  return QUESTION_TYPE_LABEL_KEY[type] ?? QUESTION_TYPE_LABEL_KEY.SINGLE_SELECT;
}

/**
 * Produce a player-safe copy of CATEGORISE content: items keep their id/label
 * but the correct categoryId is stripped so the answer cannot be read from the
 * socket payload. Categories are returned in original order.
 */
export function playerSafeCategoriseData(data: CategoriseData): CategoriseData {
  return {
    categories: data.categories.map((c) => ({ id: c.id, label: c.label })),
    items: data.items.map((i) => ({ id: i.id, label: i.label, categoryId: "" })),
  };
}

/**
 * Produce a player-safe copy of MATCHING content. Each pair keeps its left
 * id/label but the right side is a SHUFFLED permutation of all rights, so the
 * left->right link encoded in the payload is random rather than the answer
 * key. The player references rightIds from the (shuffled) right column.
 */
export function playerSafeMatchingData(data: MatchingData): MatchingData {
  const rights = data.pairs.map((p) => ({
    rightId: p.rightId,
    rightLabel: p.rightLabel,
  }));
  // Fisher-Yates shuffle so the right column order differs from the answer key.
  for (let i = rights.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rights[i], rights[j]] = [rights[j], rights[i]];
  }
  return {
    pairs: data.pairs.map((p, idx) => ({
      leftId: p.leftId,
      leftLabel: p.leftLabel,
      rightId: rights[idx]?.rightId ?? p.rightId,
      rightLabel: rights[idx]?.rightLabel ?? p.rightLabel,
    })),
  };
}

/** Stable prefix used to namespace generated ids for new questions. */
export function newLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
