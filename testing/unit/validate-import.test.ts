/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { validateQuizStructure } from "@/lib/validate-import";

const baseQuiz = {
  exportVersion: "1.0",
  exportedAt: new Date().toISOString(),
  title: "Sample Quiz",
  description: "desc",
  questions: [
    {
      questionText: "Q1",
      questionType: "SINGLE_SELECT",
      timeLimit: 30,
      points: 100,
      orderIndex: 0,
      answers: [
        { id: "a1", answerText: "A1", isCorrect: true, orderIndex: 0 },
        { id: "a2", answerText: "A2", isCorrect: false, orderIndex: 1 },
      ],
    },
  ],
};

describe("validateQuizStructure", () => {
  it("accepts a minimal valid quiz", () => {
    const result = validateQuizStructure(baseQuiz);
    expect(result.valid).toBe(true);
  });

  it("rejects unsupported versions", () => {
    const result = validateQuizStructure({ ...baseQuiz, exportVersion: "9.9" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported export version");
  });

  it("rejects invalid question type", () => {
    const bad = {
      ...baseQuiz,
      questions: [{ ...baseQuiz.questions[0], questionType: "BAD" }],
    };
    const result = validateQuizStructure(bad);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid question type");
  });

  it("accepts a TRUE_FALSE question with exactly two answers", () => {
    const tf = {
      ...baseQuiz,
      questions: [
        {
          questionText: "The sky is blue",
          questionType: "TRUE_FALSE",
          timeLimit: 20,
          points: 100,
          orderIndex: 0,
          answers: [
            { id: "t", answerText: "True", isCorrect: true, orderIndex: 0 },
            { id: "f", answerText: "False", isCorrect: false, orderIndex: 1 },
          ],
        },
      ],
    };
    const result = validateQuizStructure(tf);
    expect(result.valid).toBe(true);
  });

  it("rejects TRUE_FALSE with wrong answer count", () => {
    const tf = {
      ...baseQuiz,
      questions: [
        {
          questionText: "TF",
          questionType: "TRUE_FALSE",
          timeLimit: 20,
          points: 100,
          orderIndex: 0,
          answers: [
            { id: "t", answerText: "True", isCorrect: true, orderIndex: 0 },
          ],
        },
      ],
    };
    const result = validateQuizStructure(tf);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("TRUE_FALSE must have exactly 2 answers");
  });

  it("accepts a CATEGORISE question with valid categoriseData", () => {
    const cat = {
      ...baseQuiz,
      questions: [
        {
          questionText: "Sort the items",
          questionType: "CATEGORISE",
          timeLimit: 45,
          points: 100,
          orderIndex: 0,
          answers: [],
          categoriseData: {
            categories: [
              { id: "c1", label: "Animals" },
              { id: "c2", label: "Vehicles" },
            ],
            items: [
              { id: "i1", label: "Dog", categoryId: "c1" },
              { id: "i2", label: "Car", categoryId: "c2" },
            ],
          },
        },
      ],
    };
    const result = validateQuizStructure(cat);
    expect(result.valid).toBe(true);
  });

  it("rejects CATEGORISE without categoriseData", () => {
    const cat = {
      ...baseQuiz,
      questions: [
        {
          questionText: "Sort",
          questionType: "CATEGORISE",
          timeLimit: 45,
          points: 100,
          orderIndex: 0,
          answers: [],
        },
      ],
    };
    const result = validateQuizStructure(cat);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("CATEGORISE requires categoriseData");
  });

  it("accepts a MATCHING question with valid matchingData", () => {
    const match = {
      ...baseQuiz,
      questions: [
        {
          questionText: "Match capitals",
          questionType: "MATCHING",
          timeLimit: 45,
          points: 100,
          orderIndex: 0,
          answers: [],
          matchingData: {
            pairs: [
              { leftId: "l1", leftLabel: "France", rightId: "r1", rightLabel: "Paris" },
              { leftId: "l2", leftLabel: "Japan", rightId: "r2", rightLabel: "Tokyo" },
            ],
          },
        },
      ],
    };
    const result = validateQuizStructure(match);
    expect(result.valid).toBe(true);
  });

  it("rejects MATCHING with invalid matchingData", () => {
    const match = {
      ...baseQuiz,
      questions: [
        {
          questionText: "Match",
          questionType: "MATCHING",
          timeLimit: 45,
          points: 100,
          orderIndex: 0,
          answers: [],
          matchingData: { pairs: [{ leftId: "l1", leftLabel: "A", rightId: "r1", rightLabel: "B" }] },
        },
      ],
    };
    const result = validateQuizStructure(match);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("At least 2 pairs");
  });
});
