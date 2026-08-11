/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import type { AIProvider, QuizGenerationOptions, AIQuizResponse } from "@/lib/ai-provider";

// Test the AI Provider interface and types
// These tests verify the contract and structure

describe("AI Provider Abstraction - Interface Tests", () => {
  describe("getSelectedProviderType", () => {
    it("returns openai as the default provider", async () => {
      const { getSelectedProviderType } = await import("@/lib/ai-provider");
      const type = await getSelectedProviderType();
      expect(type).toBe("openai");
    });
  });

  describe("createAIProvider", () => {
    it("creates OpenAI-compatible provider for 'openai'", async () => {
      const { createAIProvider } = await import("@/lib/ai-provider");
      const provider = await createAIProvider("openai");
      expect(provider).toBeDefined();
      expect(provider.name).toBe("openai");
    });

    it("creates OpenAI-compatible provider for 'freellmapi'", async () => {
      const { createAIProvider } = await import("@/lib/ai-provider");
      const provider = await createAIProvider("freellmapi");
      expect(provider).toBeDefined();
      expect(provider.name).toBe("freellmapi");
    });

    it("creates OpenAI-compatible provider for 'openrouter'", async () => {
      const { createAIProvider } = await import("@/lib/ai-provider");
      const provider = await createAIProvider("openrouter");
      expect(provider).toBeDefined();
      expect(provider.name).toBe("openrouter");
    });

    it("creates OpenAI-compatible provider for 'ollama'", async () => {
      const { createAIProvider } = await import("@/lib/ai-provider");
      const provider = await createAIProvider("ollama");
      expect(provider).toBeDefined();
      expect(provider.name).toBe("ollama");
    });

    it("creates OpenAI-compatible provider for 'lmstudio'", async () => {
      const { createAIProvider } = await import("@/lib/ai-provider");
      const provider = await createAIProvider("lmstudio");
      expect(provider).toBeDefined();
      expect(provider.name).toBe("lmstudio");
    });
  });

  describe("getConfiguredProvider", () => {
    it("returns a configured provider", async () => {
      const { getConfiguredProvider } = await import("@/lib/ai-provider");
      const provider = await getConfiguredProvider();
      expect(provider).toBeDefined();
    });

    it("provider exposes isAvailable method", async () => {
      const { getConfiguredProvider } = await import("@/lib/ai-provider");
      const provider = await getConfiguredProvider();
      expect(typeof provider.isAvailable).toBe("function");
    });

    it("provider exposes generateQuiz method", async () => {
      const { getConfiguredProvider } = await import("@/lib/ai-provider");
      const provider = await getConfiguredProvider();
      expect(typeof provider.generateQuiz).toBe("function");
    });
  });

  describe("isAIGenerationAvailable", () => {
    it("returns a boolean", async () => {
      const { isAIGenerationAvailable } = await import("@/lib/ai-provider");
      const available = await isAIGenerationAvailable();
      expect(typeof available).toBe("boolean");
    });
  });
});

describe("OpenAICompatibleProvider", () => {
  describe("fromPreset", () => {
    it("creates provider from 'openai' preset", async () => {
      const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
      const provider = await OpenAICompatibleProvider.fromPreset("openai");
      expect(provider.name).toBe("openai");
    });

    it("creates provider from 'freellmapi' preset", async () => {
      const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
      const provider = await OpenAICompatibleProvider.fromPreset("freellmapi");
      expect(provider.name).toBe("freellmapi");
    });

    it("creates provider from 'openrouter' preset", async () => {
      const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
      const provider = await OpenAICompatibleProvider.fromPreset("openrouter");
      expect(provider.name).toBe("openrouter");
    });

    it("creates provider from 'ollama' preset", async () => {
      const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
      const provider = await OpenAICompatibleProvider.fromPreset("ollama");
      expect(provider.name).toBe("ollama");
    });

    it("creates provider from 'lmstudio' preset", async () => {
      const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
      const provider = await OpenAICompatibleProvider.fromPreset("lmstudio");
      expect(provider.name).toBe("lmstudio");
    });

    it("throws for unknown preset", async () => {
      const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
      await expect(OpenAICompatibleProvider.fromPreset("unknown" as any)).rejects.toThrow(
        "Unknown AI provider preset"
      );
    });
  });

  describe("preset configurations", () => {
    it("openai preset has correct baseURL", async () => {
      const { PRESET_PROVIDERS } = await import("@/lib/providers/openai-compatible-provider");
      expect(PRESET_PROVIDERS.openai.baseURL).toBe("https://api.openai.com/v1");
      expect(PRESET_PROVIDERS.openai.defaultModel).toBe("gpt-4o");
    });

    it("freellmapi preset has correct baseURL", async () => {
      const { PRESET_PROVIDERS } = await import("@/lib/providers/openai-compatible-provider");
      expect(PRESET_PROVIDERS.freellmapi.baseURL).toContain("localhost");
      expect(PRESET_PROVIDERS.freellmapi.defaultModel).toBe("auto");
    });

    it("openrouter preset has extra headers", async () => {
      const { PRESET_PROVIDERS } = await import("@/lib/providers/openai-compatible-provider");
      expect(PRESET_PROVIDERS.openrouter.extraHeaders).toBeDefined();
      expect(PRESET_PROVIDERS.openrouter.extraHeaders?.["HTTP-Referer"]).toBeDefined();
    });
  });
});

describe("Question Structure Compatibility", () => {
  it("AIQuizResponse matches interface", () => {
    const mockResponse: AIQuizResponse = {
      title: "Test Quiz",
      description: "A test quiz",
      sections: [
        {
          title: "Section 1",
          description: "First section",
          questions: [
            {
              questionText: "What is 2+2?",
              questionType: "SINGLE_SELECT",
              answers: [
                { answerText: "3", isCorrect: false },
                { answerText: "4", isCorrect: true },
              ],
            },
            {
              questionText: "Which are colors?",
              questionType: "MULTI_SELECT",
              answers: [
                { answerText: "Red", isCorrect: true },
                { answerText: "Blue", isCorrect: true },
                { answerText: "Stone", isCorrect: false },
              ],
            },
          ],
        },
      ],
      questions: [],
    };

    expect(mockResponse.title).toBeDefined();
    expect(Array.isArray(mockResponse.sections)).toBe(true);
    expect(Array.isArray(mockResponse.questions)).toBe(true);

    const section = mockResponse.sections![0];
    const singleSelect = section.questions![0];
    expect(singleSelect.questionType).toBe("SINGLE_SELECT");
    expect(singleSelect.answers!.filter((a) => a.isCorrect).length).toBe(1);

    const multiSelect = section.questions![1];
    expect(multiSelect.questionType).toBe("MULTI_SELECT");
    expect(multiSelect.answers!.filter((a) => a.isCorrect).length).toBeGreaterThan(1);
  });

  it("German language structure is valid", () => {
    const germanResponse: AIQuizResponse = {
      title: "Deutsch Quiz",
      sections: [
        {
          title: "Abschnitt 1",
          questions: [
            {
              questionText: "Was ist 2+2?",
              questionType: "SINGLE_SELECT",
              answers: [
                { answerText: "3", isCorrect: false },
                { answerText: "4", isCorrect: true },
              ],
            },
          ],
        },
      ],
    };

    expect(germanResponse.title).toContain("Deutsch");
    expect(germanResponse.sections![0].title).toContain("Abschnitt");
    expect(germanResponse.sections![0].questions![0].questionText).toContain("Was ist");
  });

  it("Serbian language structure is valid", () => {
    const serbianResponse: AIQuizResponse = {
      title: "Kviz na srpskom",
      sections: [
        {
          title: "Odeljak 1",
          questions: [
            {
              questionText: "Koliko je 2+2?",
              questionType: "SINGLE_SELECT",
              answers: [
                { answerText: "3", isCorrect: false },
                { answerText: "4", isCorrect: true },
              ],
            },
          ],
        },
      ],
    };

    expect(serbianResponse.title).toContain("srpskom");
    expect(serbianResponse.sections![0].title).toContain("Odeljak");
    expect(serbianResponse.sections![0].questions![0].questionText).toContain("Koliko je");
  });
});

describe("AI Types and Interfaces", () => {
  it("AIProvider interface has required properties", () => {
    const mockProvider: AIProvider = {
      name: "test",
      isAvailable: async () => true,
      generateQuiz: async () => ({ title: "", questions: [] }),
    };

    expect(mockProvider.name).toBe("test");
    expect(typeof mockProvider.isAvailable).toBe("function");
    expect(typeof mockProvider.generateQuiz).toBe("function");
  });

  it("QuizGenerationOptions has required fields", () => {
    const options: QuizGenerationOptions = {
      topic: "Test Topic",
      difficulty: "medium",
      questionCount: 10,
      sectionCount: 2,
    };

    expect(options.topic).toBeDefined();
    expect(options.difficulty).toBeDefined();
    expect(options.questionCount).toBeDefined();
    expect(options.sectionCount).toBeDefined();
  });

  it("Normalized question types are correct", () => {
    type QuestionType = "SINGLE_SELECT" | "MULTI_SELECT" | "SECTION";
    const single: QuestionType = "SINGLE_SELECT";
    const multi: QuestionType = "MULTI_SELECT";
    const section: QuestionType = "SECTION";

    expect(single).toBe("SINGLE_SELECT");
    expect(multi).toBe("MULTI_SELECT");
    expect(section).toBe("SECTION");
  });
});

describe("Provider Integration", () => {
  it("generateQuizWithAI function exists", async () => {
    const { generateQuizWithAI } = await import("@/lib/openai-quiz-generator");
    expect(typeof generateQuizWithAI).toBe("function");
  });
});

describe("VALID_PROVIDER_TYPES constant", () => {
  it("contains all supported providers", async () => {
    const { VALID_PROVIDER_TYPES } = await import("@/lib/ai-provider");
    expect(VALID_PROVIDER_TYPES).toContain("openai");
    expect(VALID_PROVIDER_TYPES).toContain("freellmapi");
    expect(VALID_PROVIDER_TYPES).toContain("openrouter");
    expect(VALID_PROVIDER_TYPES).toContain("ollama");
    expect(VALID_PROVIDER_TYPES).toContain("lmstudio");
    expect(VALID_PROVIDER_TYPES).toContain("custom");
  });
});
