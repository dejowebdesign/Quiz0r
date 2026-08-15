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
import {
  AIProvider,
  QuizGenerationOptions,
  AIQuizResponse,
  TestConnectionResult,
  GenerateTextOptions,
} from "@/lib/ai-provider";
import {
  PROVIDER_PRESETS,
  apiKeySettingKey,
  baseUrlSettingKey,
  modelSettingKey,
  extraHeadersSettingKey,
  type AIProviderType,
} from "@/lib/ai-provider-config";

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
 * Registry of preset provider configurations.
 *
 * Derived from the shared PROVIDER_PRESETS metadata so that UI defaults and
 * runtime defaults cannot drift apart. OpenRouter carries its preset
 * HTTP-Referer / X-Title headers.
 */
export const PRESET_PROVIDERS: Record<string, OpenAICompatibleConfig> =
  Object.fromEntries(
    Object.entries(PROVIDER_PRESETS).map(([key, meta]) => [
      key,
      {
        name: key,
        baseURL: meta.baseURL,
        defaultModel: meta.defaultModel || undefined,
        extraHeaders: meta.presetExtraHeaders,
      },
    ])
  ) as Record<string, OpenAICompatibleConfig>;

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

    const providerType = presetName as AIProviderType;
    const meta = PROVIDER_PRESETS[providerType];

    // API key: OpenAI reuses the shared openai_api_key setting so that theme
    // generation, translation, and congratulations keep working. Other
    // providers use their own ai_{name}_api_key setting.
    const apiKey = await this.getSetting(apiKeySettingKey(providerType));

    // Model override (falls back to the preset default).
    const modelOverride = await this.getSetting(modelSettingKey(providerType));

    // Base URL override for providers that support it (everything except
    // OpenAI, whose endpoint is fixed). Falls back to the preset default.
    let baseURL = preset.baseURL;
    if (meta.supportsBaseUrlOverride) {
      const override = await this.getSetting(baseUrlSettingKey(providerType));
      if (override) baseURL = override;
    }

    // Extra headers: merge preset headers with any admin-configured override.
    // For OpenRouter, the preset HTTP-Referer / X-Title headers are applied
    // automatically unless an explicit override is stored.
    let extraHeaders = preset.extraHeaders;
    if (meta.supportsExtraHeaders) {
      const headersKey = extraHeadersSettingKey(providerType);
      if (headersKey) {
        const raw = await this.getSetting(headersKey);
        if (raw) {
          try {
            extraHeaders = { ...(preset.extraHeaders || {}), ...JSON.parse(raw) };
          } catch {
            // Ignore invalid JSON, keep preset headers
          }
        }
      }
    }

    return new OpenAICompatibleProvider({
      ...preset,
      baseURL,
      apiKey: apiKey || preset.apiKey,
      defaultModel: modelOverride || preset.defaultModel,
      extraHeaders,
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
    // For custom providers, require a base URL. An API key is optional.
    if (this.name === "custom") {
      return !!this.config.baseURL;
    }

    // Presets that don't need API keys (local servers) are considered
    // available as long as a base URL is configured.
    const noAuthPresets = ["ollama", "lmstudio"];
    if (noAuthPresets.includes(this.name)) {
      return true;
    }

    // For other presets (openai, freellmapi, openrouter), require an API key.
    // OpenAI reads the shared openai_api_key setting; others read their own.
    const apiKey = await OpenAICompatibleProvider.getSetting(
      apiKeySettingKey(this.name as AIProviderType)
    );
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
    const setting = await OpenAICompatibleProvider.getSetting(
      modelSettingKey(this.name as AIProviderType)
    );
    return setting || this.config.defaultModel || "auto";
  }

  /**
   * Test the connection to this provider without generating content.
   *
   * Lists models via the OpenAI-compatible /models endpoint. Never logs or
   * returns the API key. Returns a simple success/failure with a sanitized
   * message and the model that would be used.
   */
  async testConnection(): Promise<TestConnectionResult> {
    const client = this.getClient();
    const model = await this.getModel();
    try {
      const list = await client.models.list();
      const modelIds: string[] = [];
      for await (const m of list) {
        if (m.id) modelIds.push(m.id);
      }
      return {
        success: true,
        message: "Connection successful",
        model,
        availableModels: modelIds.slice(0, 50),
      };
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Unable to reach the provider";
      // Strip anything that looks like a key or bearer token from the message.
      const sanitized = raw
        .replace(/Bearer [^\s]+/gi, "Bearer ***")
        .replace(/(sk-[A-Za-z0-9_-]{6,})[^\s]*/g, "***")
        .replace(/api[_-]?key[^\s]*/gi, "***");
      return {
        success: false,
        message: `Connection failed: ${sanitized}`,
        model,
      };
    }
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
   * Generate plain text (or JSON) via chat.completions using this provider's
   * configured client, model, base URL, and API key. Shared by translation,
   * theme, and congratulatory-message features so they honor the selected
   * provider (FreeLLMAPI, OpenRouter, Ollama, ...) instead of a hardcoded
   * OpenAI client.
   *
   * Never logs credentials. The optional timeout uses an AbortController.
   */
  async generateText(options: GenerateTextOptions): Promise<string> {
    const client = this.getClient();
    const model = await this.getModel();

    const abortController = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(
        () => abortController.abort(),
        options.timeoutMs
      );
    }

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          temperature: options.temperature ?? 0.7,
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt },
          ],
          ...(options.jsonMode
            ? { response_format: { type: "json_object" as const } }
            : {}),
        },
        { signal: abortController.signal }
      );

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error(`No response from ${this.name}`);
      }
      return responseText;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
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

    // Describe which question types the model is allowed to produce, and the
    // JSON shape each extended type expects.
    const allowed = options.allowedQuestionTypes && options.allowedQuestionTypes.length > 0
      ? options.allowedQuestionTypes
      : ["MULTIPLE_CHOICE"];
    const typeDescriptions: string[] = [];
    if (allowed.includes("MULTIPLE_CHOICE")) {
      typeDescriptions.push(
        "SINGLE_SELECT (one correct answer) and MULTI_SELECT (2+ correct answers where it makes sense)"
      );
    }
    if (allowed.includes("TRUE_FALSE")) {
      typeDescriptions.push(
        'TRUE_FALSE (exactly two answers "True"/"False", one marked isCorrect=true)'
      );
    }
    if (allowed.includes("CATEGORISE")) {
      typeDescriptions.push(
        'CATEGORISE (a categoriseData object: categories[] {id,label} and items[] {id,label,categoryId}; '
        + "each item's categoryId names its correct category)"
      );
    }
    if (allowed.includes("MATCHING")) {
      typeDescriptions.push(
        "MATCHING (a matchingData object: pairs[] {leftId,leftLabel,rightId,rightLabel}; "
        + "each pair's leftId/rightId is the correct match)"
      );
    }
    const typeLine = typeDescriptions.length > 0
      ? `- Use a varied mix of: ${typeDescriptions.join("; ")}.`
      : "- Use SINGLE_SELECT and MULTI_SELECT questions.";

    const structuredShape = `
When a question is CATEGORISE or MATCHING, omit the answers array and instead provide the matching structured object. Examples:
CATEGORISE:
{
  "questionText": "Sort these animals into Mammals or Reptiles",
  "questionType": "CATEGORISE",
  "categoriseData": {
    "categories": [
      { "id": "cat_mammals", "label": "Mammals" },
      { "id": "cat_reptiles", "label": "Reptiles" }
    ],
    "items": [
      { "id": "item_dog", "label": "Dog", "categoryId": "cat_mammals" },
      { "id": "item_snake", "label": "Snake", "categoryId": "cat_reptiles" }
    ]
  }
}
MATCHING:
{
  "questionText": "Match each capital to its country",
  "questionType": "MATCHING",
  "matchingData": {
    "pairs": [
      { "leftId": "left_paris", "leftLabel": "Paris", "rightId": "right_france", "rightLabel": "France" },
      { "leftId": "left_tokyo", "leftLabel": "Tokyo", "rightId": "right_japan", "rightLabel": "Japan" }
    ]
  }
}`;

    return `You are an experienced quiz master. Create a fully-written trivia quiz.

Quiz requirements:
- Theme: ${safeTopic}
- Difficulty: ${options.difficulty || "medium"}
- Total playable questions: ${targetQuestionCount} (do NOT count section headers)
- Number of sections/groups: ${sectionCount} (each must have a short title/description and at least one question)
- Use engaging, concise wording suitable for a live host to read aloud.
${typeLine}
- Always provide: questionText, hint, hostNotes, answers (answerText + isCorrect flag), timeLimit (seconds between 15-90), and points (50-200) for each playable question — except CATEGORISE/MATCHING questions, which use structured data instead of answers.
- Provide helpful imageUrl values using reliable, license-friendly links (e.g., images.unsplash.com). Aim for every section AND at least half of the questions to include an image where it fits.
- Keep everything in the appropriate language and avoid markdown/code fences.
- Answer-option questions must always include at least one correct and one incorrect option with clear wording.
- For CATEGORISE use at least 2 categories and 2 items; for MATCHING use at least 2 pairs.
${structuredShape}

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
