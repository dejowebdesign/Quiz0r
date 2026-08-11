"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import enLocale from "@/lib/locales/en.json";
import deLocale from "@/lib/locales/de.json";
import srLocale from "@/lib/locales/sr.json";

// Supported application locales (separate from quiz content languages)
export const AppSupportedLocales = {
  en: { code: "en" as const, name: "English", flag: "🇬🇧" },
  de: { code: "de" as const, name: "Deutsch", flag: "🇩🇪" },
  sr: { code: "sr" as const, name: "Srpski", flag: "🇷🇸" },
} as const;

export type AppLocale = keyof typeof AppSupportedLocales;

// All available locales - English is the master/fallback
const locales: Record<AppLocale, Record<string, unknown>> = {
  en: enLocale,
  de: deLocale,
  sr: srLocale,
};

// Master locale for fallback
const MASTER_LOCALE: AppLocale = "en";

// localStorage key for persisting locale
const LOCALE_STORAGE_KEY = "quiz0r-locale";

// Default locale
const DEFAULT_LOCALE: AppLocale = "en";

interface I18nContextType {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string) => string;
  availableLocales: typeof AppSupportedLocales;
  htmlLang: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Helper to get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  // On mount, read the initial value from localStorage
  useEffect(() => {
    setMounted(true);
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale | null;
    if (storedLocale && storedLocale in AppSupportedLocales) {
      setLocaleState(storedLocale);
    }
  }, []);

  // Sync changes to localStorage
  const setLocale = useCallback((newLocale: AppLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
  }, []);

  // Translation function - English is the master fallback
  const t = useCallback(
    (key: string): string => {
      const currentLocale = locales[locale];
      const value = getNestedValue(currentLocale, key);

      if (value !== undefined) {
        return value;
      }

      // Fallback to master locale (English) for any missing translation
      const masterLocaleData = locales[MASTER_LOCALE];
      const fallback = getNestedValue(masterLocaleData, key);

      if (fallback !== undefined) {
        return fallback;
      }

      // Return the key itself as last resort
      return key;
    },
    [locale]
  );

  // HTML lang attribute value
  const htmlLang = locale;

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        availableLocales: AppSupportedLocales,
        htmlLang,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
