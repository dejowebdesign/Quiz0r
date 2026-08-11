/**
 * Shared AI provider configuration metadata.
 *
 * Client-safe (no Prisma / Node imports) so the Admin UI can render the
 * provider list and per-provider fields from a single source of truth, while
 * the server-side OpenAICompatibleProvider derives its presets from the same
 * data. This avoids duplicating provider definitions in the frontend.
 */

export type AIProviderType =
  | "openai"
  | "freellmapi"
  | "openrouter"
  | "ollama"
  | "lmstudio"
  | "custom";

/** All supported provider types, in display order. */
export const PROVIDER_ORDER: AIProviderType[] = [
  "openai",
  "freellmapi",
  "openrouter",
  "ollama",
  "lmstudio",
  "custom",
];

/**
 * Static metadata for each provider preset. The server's PRESET_PROVIDERS
 * (baseURL / defaultModel / extraHeaders) is derived from this so that the
 * UI defaults and the runtime defaults can never drift apart.
 */
export interface ProviderPresetMeta {
  /** Human-readable label shown in the UI dropdown. */
  label: string;
  /** Short description shown under the dropdown. */
  description: string;
  /** Default base URL (OpenAI-compatible /v1 endpoint). */
  baseURL: string;
  /** Default model id. */
  defaultModel: string;
  /** Whether an API key is required to use this provider. */
  apiKeyRequired: boolean;
  /** Whether the admin may override the base URL. OpenAI's endpoint is fixed. */
  supportsBaseUrlOverride: boolean;
  /** Whether extra HTTP headers can be configured (OpenRouter / Custom). */
  supportsExtraHeaders: boolean;
  /** Preset extra headers applied when supportsExtraHeaders is true and no override is set. */
  presetExtraHeaders?: Record<string, string>;
}

export const PROVIDER_PRESETS: Record<AIProviderType, ProviderPresetMeta> = {
  openai: {
    label: "OpenAI",
    description: "OpenAI GPT-4o via the official API.",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    apiKeyRequired: true,
    supportsBaseUrlOverride: false,
    supportsExtraHeaders: false,
  },
  freellmapi: {
    label: "FreeLLMAPI",
    description: "Self-hosted FreeLLMAPI proxy (OpenAI-compatible).",
    baseURL: "http://umbrel.local:3001/v1",
    defaultModel: "auto",
    apiKeyRequired: true,
    supportsBaseUrlOverride: true,
    supportsExtraHeaders: false,
  },
  openrouter: {
    label: "OpenRouter",
    description: "OpenRouter aggregator (OpenAI-compatible).",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "auto",
    apiKeyRequired: true,
    supportsBaseUrlOverride: true,
    supportsExtraHeaders: true,
    presetExtraHeaders: {
      "HTTP-Referer": "https://quiz0r.app",
      "X-Title": "Quiz0r",
    },
  },
  ollama: {
    label: "Ollama",
    description: "Local Ollama server (OpenAI-compatible).",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    apiKeyRequired: false,
    supportsBaseUrlOverride: true,
    supportsExtraHeaders: false,
  },
  lmstudio: {
    label: "LM Studio",
    description: "Local LM Studio server (OpenAI-compatible).",
    baseURL: "http://localhost:1234/v1",
    defaultModel: "local-model",
    apiKeyRequired: false,
    supportsBaseUrlOverride: true,
    supportsExtraHeaders: false,
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    description: "Any OpenAI-compatible endpoint you configure manually.",
    baseURL: "",
    defaultModel: "",
    apiKeyRequired: false,
    supportsBaseUrlOverride: true,
    supportsExtraHeaders: true,
  },
};

/**
 * Setting key helpers. Centralized so the UI, API routes, and provider all
 * agree on key names. The OpenAI provider reuses the pre-existing
 * `openai_api_key` setting (shared with theme/translate/congratulations
 * generation) so existing OpenAI functionality keeps working.
 */
export function apiKeySettingKey(provider: AIProviderType): string {
  return provider === "openai" ? "openai_api_key" : `ai_${provider}_api_key`;
}

export function baseUrlSettingKey(provider: AIProviderType): string {
  return provider === "openai" ? "" : `ai_${provider}_base_url`;
}

export function modelSettingKey(provider: AIProviderType): string {
  return provider === "custom" ? "ai_custom_model" : `ai_${provider}_model`;
}

export function extraHeadersSettingKey(provider: AIProviderType): string {
  // Only OpenRouter (override) and Custom support configured extra headers.
  if (provider === "openrouter") return "ai_openrouter_extra_headers";
  if (provider === "custom") return "ai_custom_extra_headers";
  return "";
}
