import { SupportedLanguages, type LanguageCode } from "@/types";

/**
 * Historical base language assumed for quizzes that predate the explicit
 * `sourceLanguage` field. All such quizzes were authored under the assumption
 * that English is the base language, so this is a safe backward-compatible
 * fallback.
 */
export const DEFAULT_SOURCE_LANGUAGE: LanguageCode = "en";

/**
 * Resolve the effective source language of a quiz.
 *
 * Quizzes created before the `sourceLanguage` column existed have a null value.
 * For those we fall back to the historical base language (English). Callers
 * that mutate a quiz should persist the resolved value so the guess becomes
 * explicit over time.
 *
 * Note: automatic language detection (e.g. via an AI provider) is intentionally
 * not performed here — it would require an external call and a configured
 * provider. The deterministic historical fallback is preferred for reliability.
 */
export function resolveSourceLanguage(sourceLanguage: string | null | undefined): LanguageCode {
  if (sourceLanguage && sourceLanguage in SupportedLanguages) {
    return sourceLanguage as LanguageCode;
  }
  return DEFAULT_SOURCE_LANGUAGE;
}

/**
 * Validate that the given code is a supported language code.
 */
export function isValidLanguageCode(code: string | null | undefined): code is LanguageCode {
  return !!code && code in SupportedLanguages;
}
