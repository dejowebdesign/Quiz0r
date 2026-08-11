/**
 * AI Provider Abstraction Layer
 * 
 * This module defines the interface for AI providers that can generate quiz content.
 * The abstraction allows Quiz0r to support multiple AI backends while maintaining
 * a consistent API and output format.
 * 
 * Supported providers:
 * - openai: OpenAI's API (https://api.openai.com/v1)
 * - freellmapi: FreeLLMAPI proxy (http://localhost:8080/v1)
 * - openrouter: OpenRouter (https://openrouter.ai/api/v1)
 * - ollama: Ollama local server (http://localhost:11434/v1)
 * - lmstudio: LM Studio local server (http://localhost:1234/v1)
 * - custom: User-defined OpenAI-compatible endpoint
 */

import { prisma } from "@/lib/db";
import type { AIProviderType } from "@/lib/ai-provider-config";
export { AIProviderType };

/**
 * Quiz generation options passed to AI providers
 */
export interface QuizGenerationOptions {
  topic: string;
  difficulty: string;
  questionCount: number;
  sectionCount: number;
  additionalNotes?: string;
}

/**
 * Normalized answer format used throughout Quiz0r
 */
export interface NormalizedAnswer {
  answerText: string;
  isCorrect: boolean;
  imageUrl: string | null;
}

/**
 * Normalized question format used throughout Quiz0r
 */
export interface NormalizedQuestion {
  questionText: string;
  questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "SECTION";
  hint: string | null;
  hostNotes: string | null;
  imageUrl: string | null;
  timeLimit: number;
  points: number;
  answers: NormalizedAnswer[];
}

/**
 * Raw AI response from a provider before normalization
 */
export interface AIQuizResponse {
  title?: string;
  description?: string | null;
  sections?: AISection[];
  questions?: AIQuestion[];
}

/**
 * Raw AI question format from provider response
 */
export interface AIQuestion {
  questionText?: string;
  questionType?: string;
  hint?: string | null;
  hostNotes?: string | null;
  imageUrl?: string | null;
  timeLimit?: number;
  points?: number;
  answers?: AIAnswer[];
}

/**
 * Raw AI answer format from provider response
 */
export interface AIAnswer {
  answerText: string;
  isCorrect?: boolean;
  imageUrl?: string | null;
}

/**
 * Raw AI section format from provider response
 */
export interface AISection {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  questions?: AIQuestion[];
}

/**
 * AI Provider interface
 * All AI providers must implement this interface
 */
export interface AIProvider {
  /**
   * Provider name identifier
   */
  readonly name: string;

  /**
   * Check if the provider is configured and available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate quiz content using the AI provider
   * @param options - Quiz generation options
   * @returns Raw AI response that will be normalized by Quiz0r
   */
  generateQuiz(options: QuizGenerationOptions): Promise<AIQuizResponse>;

  /**
   * Test the connection to this provider without generating content.
   * Executes server-side, never exposes credentials.
   */
  testConnection(): Promise<TestConnectionResult>;
}

/**
 * Result of a Test Connection request. Never contains secrets.
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  model: string;
  /** Models reported by the provider, when available. */
  availableModels?: string[];
}

/**
 * Result from generating a quiz
 */
export interface QuizGenerationResult {
  quizId: string;
  quizTitle: string;
  questionCount: number;
}

/**
 * Valid provider types for the factory
 */
export const VALID_PROVIDER_TYPES: AIProviderType[] = [
  "openai",
  "freellmapi",
  "openrouter",
  "ollama",
  "lmstudio",
  "custom",
];

/**
 * Get the selected AI provider type from settings
 * Defaults to "openai" if not configured
 */
export async function getSelectedProviderType(): Promise<AIProviderType> {
  const setting = await prisma.setting.findUnique({
    where: { key: "ai_provider" },
  });

  // Default to openai if not configured
  if (!setting?.value) {
    return "openai";
  }

  // Validate the configured provider
  if (VALID_PROVIDER_TYPES.includes(setting.value as AIProviderType)) {
    return setting.value as AIProviderType;
  }

  // Fall back to openai for invalid values
  return "openai";
}

/**
 * Create an AI provider instance based on the selected type
 * @param providerType - The type of provider to create
 * @returns An instance of the requested AI provider
 */
export async function createAIProvider(providerType: AIProviderType): Promise<AIProvider> {
  const { OpenAICompatibleProvider } = await import("@/lib/providers/openai-compatible-provider");
  return OpenAICompatibleProvider.fromPreset(providerType);
}

/**
 * Get the currently configured AI provider
 * Reads from settings and creates the appropriate provider instance
 */
export async function getConfiguredProvider(): Promise<AIProvider> {
  const providerType = await getSelectedProviderType();
  return createAIProvider(providerType);
}

/**
 * Check if AI generation is available (at least one provider is configured)
 */
export async function isAIGenerationAvailable(): Promise<boolean> {
  try {
    const provider = await getConfiguredProvider();
    return await provider.isAvailable();
  } catch {
    return false;
  }
}
