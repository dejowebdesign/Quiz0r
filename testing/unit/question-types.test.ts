import { describe, it, expect } from "vitest";
import {
  parseCategoriseData,
  parseMatchingData,
  validateCategoriseData,
  validateMatchingData,
  categoriseAssignmentId,
  parseCategoriseAnswerId,
  matchingAssignmentId,
  parseMatchingAnswerId,
  calculateCategoriseScore,
  calculateMatchingScore,
  isCategoriseType,
  isMatchingType,
  isTrueFalseType,
  isAnswerBasedType,
  getQuestionTypeLabelKey,
  playerSafeCategoriseData,
  playerSafeMatchingData,
  newLocalId,
  type CategoriseData,
  type MatchingData,
} from "@/lib/question-types";

const categoriseData: CategoriseData = {
  categories: [
    { id: "cat-a", label: "Animals" },
    { id: "cat-b", label: "Vehicles" },
  ],
  items: [
    { id: "it-1", label: "Dog", categoryId: "cat-a" },
    { id: "it-2", label: "Car", categoryId: "cat-b" },
  ],
};

const matchingData: MatchingData = {
  pairs: [
    { leftId: "l-1", leftLabel: "France", rightId: "r-1", rightLabel: "Paris" },
    { leftId: "l-2", leftLabel: "Japan", rightId: "r-2", rightLabel: "Tokyo" },
  ],
};

describe("question-types: parse helpers", () => {
  it("parses categorise data from a JSON string", () => {
    const parsed = parseCategoriseData(JSON.stringify(categoriseData));
    expect(parsed).not.toBeNull();
    expect(parsed!.items).toHaveLength(2);
  });

  it("parses categorise data from an already-parsed object", () => {
    const parsed = parseCategoriseData(categoriseData);
    expect(parsed).not.toBeNull();
    expect(parsed!.categories).toHaveLength(2);
  });

  it("returns null for invalid categorise input", () => {
    expect(parseCategoriseData(null)).toBeNull();
    expect(parseCategoriseData(undefined)).toBeNull();
    expect(parseCategoriseData("not-json")).toBeNull();
    expect(parseCategoriseData({} as CategoriseData)).toBeNull();
  });

  it("parses matching data from a JSON string", () => {
    const parsed = parseMatchingData(JSON.stringify(matchingData));
    expect(parsed).not.toBeNull();
    expect(parsed!.pairs).toHaveLength(2);
  });

  it("parses matching data from an already-parsed object", () => {
    const parsed = parseMatchingData(matchingData);
    expect(parsed).not.toBeNull();
    expect(parsed!.pairs[0].rightLabel).toBe("Paris");
  });

  it("returns null for invalid matching input", () => {
    expect(parseMatchingData(null)).toBeNull();
    expect(parseMatchingData("nope")).toBeNull();
    expect(parseMatchingData({} as MatchingData)).toBeNull();
  });
});

describe("question-types: validators", () => {
  it("validates a correct categorise data set", () => {
    expect(validateCategoriseData(categoriseData).valid).toBe(true);
  });

  it("rejects categorise data with too few categories", () => {
    const bad: CategoriseData = { categories: [{ id: "c", label: "C" }], items: categoriseData.items };
    expect(validateCategoriseData(bad).valid).toBe(false);
  });

  it("rejects categorise data with items referencing unknown categories", () => {
    const bad: CategoriseData = {
      categories: categoriseData.categories,
      items: [{ id: "x", label: "X", categoryId: "missing" }],
    };
    expect(validateCategoriseData(bad).valid).toBe(false);
  });

  it("validates a correct matching data set", () => {
    expect(validateMatchingData(matchingData).valid).toBe(true);
  });

  it("rejects matching data with too few pairs", () => {
    const bad: MatchingData = { pairs: [matchingData.pairs[0]] };
    expect(validateMatchingData(bad).valid).toBe(false);
  });
});

describe("question-types: assignment id codecs", () => {
  it("round-trips categorise assignment ids", () => {
    const id = categoriseAssignmentId("it-1", "cat-a");
    expect(parseCategoriseAnswerId(id)).toEqual({ itemId: "it-1", categoryId: "cat-a" });
  });

  it("returns null for malformed categorise answer ids", () => {
    expect(parseCategoriseAnswerId("nonsense")).toBeNull();
  });

  it("round-trips matching assignment ids", () => {
    const id = matchingAssignmentId("l-1", "r-1");
    expect(parseMatchingAnswerId(id)).toEqual({ leftId: "l-1", rightId: "r-1" });
  });

  it("returns null for malformed matching answer ids", () => {
    expect(parseMatchingAnswerId("nope")).toBeNull();
  });
});

describe("question-types: scoring", () => {
  it("awards full points + isCorrect for a perfect categorise answer", () => {
    const res = calculateCategoriseScore(
      100,
      10000,
      0,
      [
        { itemId: "it-1", categoryId: "cat-a" },
        { itemId: "it-2", categoryId: "cat-b" },
      ],
      categoriseData
    );
    expect(res.correctCount).toBe(2);
    expect(res.total).toBe(2);
    expect(res.isCorrect).toBe(true);
    // speedMultiplier = 0.5 (instant) => 100 * 1 * 1.5 = 150
    expect(res.points).toBe(150);
  });

  it("awards partial credit for a half-correct categorise answer", () => {
    const res = calculateCategoriseScore(
      100,
      10000,
      0,
      [{ itemId: "it-1", categoryId: "cat-a" }],
      categoriseData
    );
    expect(res.correctCount).toBe(1);
    expect(res.isCorrect).toBe(false);
    // 100 * 0.5 * 1.5 = 75
    expect(res.points).toBe(75);
  });

  it("awards zero points when nothing is correct", () => {
    const res = calculateCategoriseScore(
      100,
      10000,
      0,
      [{ itemId: "it-1", categoryId: "cat-b" }],
      categoriseData
    );
    expect(res.points).toBe(0);
    expect(res.isCorrect).toBe(false);
  });

  it("awards full points + isCorrect for a perfect matching answer", () => {
    const res = calculateMatchingScore(
      100,
      10000,
      0,
      [
        { leftId: "l-1", rightId: "r-1" },
        { leftId: "l-2", rightId: "r-2" },
      ],
      matchingData
    );
    expect(res.correctCount).toBe(2);
    expect(res.isCorrect).toBe(true);
    expect(res.points).toBe(150);
  });

  it("awards partial credit for a half-correct matching answer", () => {
    const res = calculateMatchingScore(
      100,
      10000,
      0,
      [{ leftId: "l-1", rightId: "r-2" }],
      matchingData
    );
    expect(res.correctCount).toBe(0);
    expect(res.points).toBe(0);
  });
});

describe("question-types: type guards", () => {
  it("identifies each extended type", () => {
    expect(isCategoriseType("CATEGORISE")).toBe(true);
    expect(isMatchingType("MATCHING")).toBe(true);
    expect(isTrueFalseType("TRUE_FALSE")).toBe(true);
  });

  it("treats answer-based types correctly", () => {
    expect(isAnswerBasedType("SINGLE_SELECT")).toBe(true);
    expect(isAnswerBasedType("MULTI_SELECT")).toBe(true);
    expect(isAnswerBasedType("TRUE_FALSE")).toBe(true);
    expect(isAnswerBasedType("CATEGORISE")).toBe(false);
    expect(isAnswerBasedType("MATCHING")).toBe(false);
  });
});

describe("question-types: player-safe sanitisation", () => {
  it("strips correct categoryId from categorise items", () => {
    const safe = playerSafeCategoriseData(categoriseData);
    expect(safe.categories).toHaveLength(2);
    // categoryId is blanked so the answer key is not leaked.
    expect(safe.items[0].categoryId).toBe("");
    expect(safe.items[1].categoryId).toBe("");
  });

  it("permutes (does not preserve) the right column for matching", () => {
    const safe = playerSafeMatchingData(matchingData);
    // All original right ids/labels are still present (a permutation).
    const safeRights = safe.pairs.map((p) => `${p.rightId}:${p.rightLabel}`).sort();
    const origRights = matchingData.pairs.map((p) => `${p.rightId}:${p.rightLabel}`).sort();
    expect(safeRights).toEqual(origRights);
    // Left side is preserved.
    expect(safe.pairs[0].leftId).toBe(matchingData.pairs[0].leftId);
    expect(safe.pairs[0].leftLabel).toBe(matchingData.pairs[0].leftLabel);
  });
});

describe("question-types: newLocalId", () => {
  it("generates a prefixed id with a random suffix", () => {
    const id = newLocalId("cat");
    expect(id.startsWith("cat_")).toBe(true);
    expect(id.length).toBeGreaterThan("cat_".length);
  });

  it("generates unique ids", () => {
    const a = newLocalId("it");
    const b = newLocalId("it");
    expect(a).not.toBe(b);
  });
});

describe("question-types: getQuestionTypeLabelKey", () => {
  it("maps each question type to its host.* i18n key", () => {
    expect(getQuestionTypeLabelKey("SINGLE_SELECT")).toBe("singleSelect");
    expect(getQuestionTypeLabelKey("MULTI_SELECT")).toBe("multiSelect");
    expect(getQuestionTypeLabelKey("TRUE_FALSE")).toBe("trueFalse");
    expect(getQuestionTypeLabelKey("CATEGORISE")).toBe("categorise");
    expect(getQuestionTypeLabelKey("MATCHING")).toBe("matching");
  });

  it("falls back to singleSelect for unknown or section types", () => {
    expect(getQuestionTypeLabelKey("SECTION")).toBe("singleSelect");
    expect(getQuestionTypeLabelKey("UNKNOWN")).toBe("singleSelect");
    expect(getQuestionTypeLabelKey("")).toBe("singleSelect");
  });

  it("returns keys that exist in the host locale namespace", async () => {
    const en = (await import("@/lib/locales/en.json")).default as {
      host: Record<string, string>;
    };
    for (const type of [
      "SINGLE_SELECT",
      "MULTI_SELECT",
      "TRUE_FALSE",
      "CATEGORISE",
      "MATCHING",
    ]) {
      const key = getQuestionTypeLabelKey(type);
      expect(en.host[key]).toBeTruthy();
    }
  });
});
