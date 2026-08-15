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
import type { AiQuestionTypeOption } from "@/lib/question-types";
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
  /** Language the generated quiz content should be authored in. */
  sourceLanguage?: string;
  /**
   * Which question types the AI may produce. Defaults to single/multi-select
   * when omitted. The provider uses this to bias the prompt and the normalizer
   * uses it to coerce any disallowed types back to a permitted one.
   */
  allowedQuestionTypes?: AiQuestionTypeOption[];
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
  questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "TRUE_FALSE" | "CATEGORISE" | "MATCHING" | "SECTION";
  hint: string | null;
  hostNotes: string | null;
  imageUrl: string | null;
  timeLimit: number;
  points: number;
  answers: NormalizedAnswer[];
  // Structured content for the extended types (null otherwise).
  categoriseData?: import("@/lib/question-types").CategoriseData | null;
  matchingData?: import("@/lib/question-types").MatchingData | null;
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
  // Structured content for the extended types (raw provider shape).
  categoriseData?: {
    categories?: AICategoriseCategory[];
    items?: AICategoriseItem[];
  } | null;
  matchingData?: {
    pairs?: AIMatchingPair[];
  } | null;
}

/**
 * Raw AI answer format from provider response
 */
export interface AIAnswer {
  answerText: string;
  isCorrect?: boolean;
  imageUrl?: string | null;
}

/** Raw AI category/item for CATEGORISE questions. */
export interface AICategoriseCategory {
  id?: string;
  label: string;
}
export interface AICategoriseItem {
  id?: string;
  label: string;
  categoryId?: string;
}

/** Raw AI matching pair. */
export interface AIMatchingPair {
  leftId?: string;
  leftLabel: string;
  rightId?: string;
  rightLabel: string;
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
 * Options for a generic text generation call.
 *
 * This is the shared entry point for all non-quiz text AI features
 * (translation, theme JSON, congratulatory messages, ...). It is intentionally
 * a thin wrapper around chat.completions so any OpenAI-compatible provider
 * (FreeLLMAPI, OpenRouter, Ollama, LM Studio, custom) can serve it.
 */
export interface GenerateTextOptions {
  /** System prompt guiding the model's behavior. */
  systemPrompt: string;
  /** User prompt with the actual request content. */
  userPrompt: string;
  /** When true, request JSON output via response_format json_object. */
  jsonMode?: boolean;
  /** Sampling temperature. Defaults to 0.7 when omitted. */
  temperature?: number;
  /** Abort after this many ms. Defaults to no timeout (0). */
  timeoutMs?: number;
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
   * Generate plain text (or JSON) via chat.completions. Used by all
   * text-based AI features so they run through the configured provider
   * (FreeLLMAPI, OpenRouter, Ollama, ...) instead of a hardcoded OpenAI client.
   * @returns The raw text content from the model's first choice.
   */
  generateText(options: GenerateTextOptions): Promise<string>;

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
