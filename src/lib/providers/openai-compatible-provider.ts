/**
 * OpenAI-Compatible AI Provider
 * 
 * A generic provider that works with any OpenAI-compatible API endpoint.
 * Supports:
 * - OpenAI
 * - FreeLLMAPI
 * - OpenRouter
 * - Ollama
 * - LM Studio
 * - Any other OpenAI-compatible API
 * 
 * Configuration is loaded from database settings or preset configurations.
 */

import OpenAI from "openai";
import { prisma } from "@/lib/db";
import type {
  AIProvider,
  QuizGenerationOptions,
  AIQuizResponse,
} from "@/lib/ai-provider";

/**
 * Configuration for OpenAI-compatible providers
 */
export interface OpenAICompatibleConfig {
  /** Provider name for identification and error messages */
  name: string;
  /** Base URL for the API (e.g., https://api.openai.com/v1) */
  baseURL: string;
  /** Optional: API key if required by the provider */
  apiKey?: string;
  /** Optional: Default model to use */
  defaultModel?: string;
  /** Optional: Extra headers (e.g., for OpenRouter's HTTP-Referer) */
  extraHeaders?: Record<string, string>;
  /** Optional: Custom settings prefix for this provider */
  settingsPrefix?: string;
}

/**
 * Registry of preset provider configurations
 */
export const PRESET_PROVIDERS: Record<string, OpenAICompatibleConfig> = {
  openai: {
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  freellmapi: {
    name: "freellmapi",
    baseURL: "http://localhost:8080/v1",
    defaultModel: "auto",
  },
  openrouter: {
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "auto",
    extraHeaders: {
      "HTTP-Referer": "https://quiz0r.app",
      "X-Title": "Quiz0r",
    },
  },
  ollama: {
    name: "ollama",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
  },
  lmstudio: {
    name: "lmstudio",
    baseURL: "http://localhost:1234/v1",
    defaultModel: "local-model",
  },
};

/**
 * OpenAICompatibleProvider
 * 
 * A generic provider that implements AIProvider for any OpenAI-compatible API.
 * Loads configuration from database settings or uses preset configurations.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  private config: OpenAICompatibleConfig;

  /**
   * Create a new OpenAI-compatible provider
   * @param config - Provider configuration
   */
  constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.config = config;
  }

  /**
   * Create a provider from a preset or custom configuration
   * @param presetName - Name of preset ("openai", "freellmapi", etc.) or "custom"
   */
  static async fromPreset(presetName: string): Promise<OpenAICompatibleProvider> {
    if (presetName === "custom") {
      // Load custom configuration from settings
      const baseURL = await this.getSetting("ai_custom_base_url");
      const apiKey = await this.getSetting("ai_custom_api_key");
      const model = await this.getSetting("ai_custom_model");
      const extraHeadersRaw = await this.getSetting("ai_custom_extra_headers");
      
      let extraHeaders: Record<string, string> | undefined;
      if (extraHeadersRaw) {
        try {
          extraHeaders = JSON.parse(extraHeadersRaw);
        } catch {
          // Ignore invalid JSON
        }
      }

      if (!baseURL) {
        throw new Error("Custom AI provider base URL not configured");
      }

      return new OpenAICompatibleProvider({
        name: "custom",
        baseURL,
        apiKey: apiKey || undefined,
        defaultModel: model || undefined,
        extraHeaders,
      });
    }

    // Load from preset
    const preset = PRESET_PROVIDERS[presetName];
    if (!preset) {
      throw new Error(`Unknown AI provider preset: ${presetName}`);
    }

    // Load API key from settings if the preset requires one
    const apiKeySetting = await this.getSetting(`ai_${presetName}_api_key`);
    const modelSetting = await this.getSetting(`ai_${presetName}_model`);

    return new OpenAICompatibleProvider({
      ...preset,
      apiKey: apiKeySetting || preset.apiKey,
      defaultModel: modelSetting || preset.defaultModel,
    });
  }

  /**
   * Get a setting value from the database
   */
  private static async getSetting(key: string): Promise<string | null> {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });
    return setting?.value || null;
  }

  /**
   * Check if this provider is configured and available
   */
  async isAvailable(): Promise<boolean> {
    // For custom providers, require both URL and key
    if (this.name === "custom") {
      const hasURL = !!this.config.baseURL;
      const hasKey = !!this.config.apiKey;
      return hasURL && hasKey;
    }

    // For presets, check if API key is configured
    const apiKey = await OpenAICompatibleProvider.getSetting(
      `ai_${this.name}_api_key`
    );
    
    // Presets that don't need API keys (local servers)
    const noAuthPresets = ["ollama", "lmstudio"];
    if (noAuthPresets.includes(this.name)) {
      return true; // Assume available if it's a local server
    }

    return !!apiKey;
  }

  /**
   * Get the OpenAI-compatible client instance
   */
  private getClient(): OpenAI {
    return new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey || "not-required",
      ...(this.config.extraHeaders && {
        defaultHeaders: this.config.extraHeaders,
      }),
    });
  }

  /**
   * Get the model to use for generation
   */
  private async getModel(): Promise<string> {
    // Try to get from settings first
    const settingKey = this.name === "custom" 
      ? "ai_custom_model" 
      : `ai_${this.name}_model`;
    
    const setting = await OpenAICompatibleProvider.getSetting(settingKey);
    return setting || this.config.defaultModel || "auto";
  }

  /**
   * Generate quiz content using this provider
   */
  async generateQuiz(options: QuizGenerationOptions): Promise<AIQuizResponse> {
    const client = this.getClient();
    const model = await this.getModel();
    const prompt = this.buildPrompt(options);

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You generate structured quiz JSON for a trivia game. Always respond with strict JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error(`No response from ${this.name}`);
    }

    try {
      const parsed = JSON.parse(responseText) as AIQuizResponse;
      return parsed;
    } catch (err) {
      console.error(`Failed to parse ${this.name} response:`, err);
      throw new Error("Failed to parse AI response");
    }
  }

  /**
   * Build the prompt for quiz generation
   */
  private buildPrompt(options: QuizGenerationOptions): string {
    const safeTopic = options.topic.trim() || "General Knowledge";
    const notes = options.additionalNotes?.trim();
    const sectionCount = Math.max(0, options.sectionCount);
    const targetQuestionCount = Math.min(Math.max(options.questionCount, 3), 25);

    return `You are an experienced quiz master. Create a fully-written trivia quiz.

Quiz requirements:
- Theme: ${safeTopic}
- Difficulty: ${options.difficulty || "medium"}
- Total playable questions: ${targetQuestionCount} (do NOT count section headers)
- Number of sections/groups: ${sectionCount} (each must have a short title/description and at least one question)
- Use engaging, concise wording suitable for a live host to read aloud.
- Include a mix of SINGLE_SELECT (one correct answer) and MULTI_SELECT (2+ correct answers where it makes sense).
- Always provide: questionText, hint, hostNotes, answers (answerText + isCorrect flag), timeLimit (seconds between 15-90), and points (50-200) for each playable question.
- Provide helpful imageUrl values using reliable, license-friendly links (e.g., images.unsplash.com). Aim for every section AND at least half of the questions to include an image where it fits.
- Keep everything in the appropriate language and avoid markdown/code fences.
- Answers must always include at least one correct and one incorrect option with clear wording.

${notes ? `Extra guidance from the host: ${notes}` : "No extra host guidance provided."}

Return JSON ONLY with this exact shape:
{
  "title": "Quiz title",
  "description": "Short description",
  "sections": [
    {
      "title": "Section title",
      "description": "What this section covers",
      "imageUrl": "optional image",
      "questions": [ /* questions for this section */ ]
    }
  ],
  "questions": [ /* additional questions not tied to a section (optional) */ ]
}

Remember: keep to the requested counts and do not add explanations.`;
  }
}
