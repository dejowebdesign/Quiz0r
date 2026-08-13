"use client";

import { useI18n } from "@/contexts/I18nContext";

// Re-export the types for convenience
export type { AppLocale } from "@/contexts/I18nContext";
export { AppSupportedLocales } from "@/contexts/I18nContext";

/**
 * Hook for accessing the translation function and locale context.
 * Must be used within an I18nProvider.
 */
export function useTranslation() {
  const { locale, setLocale, t, availableLocales, dir, isRtl } = useI18n();

  return {
    locale,
    setLocale,
    t,
    availableLocales,
    dir,
    isRtl,
  };
}
