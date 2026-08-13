"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { SupportedLanguages, type LanguageCode } from "@/types";
import enLocale from "@/lib/locales/en.json";
import esLocale from "@/lib/locales/es.json";
import frLocale from "@/lib/locales/fr.json";
import deLocale from "@/lib/locales/de.json";
import heLocale from "@/lib/locales/he.json";
import jaLocale from "@/lib/locales/ja.json";
import zhCNLocale from "@/lib/locales/zh-CN.json";
import arLocale from "@/lib/locales/ar.json";
import ptLocale from "@/lib/locales/pt.json";
import ruLocale from "@/lib/locales/ru.json";
import itLocale from "@/lib/locales/it.json";
import srLatnLocale from "@/lib/locales/sr-Latn.json";
import srCyrlLocale from "@/lib/locales/sr-Cyrl.json";

// Supported application UI locales. Derived from the single source of truth
// (`SupportedLanguages` in src/types/index.ts) so the code/flag/nativeName list
// is never duplicated. The quiz-content language list and the UI-locale list
// remain logically independent — they just share the same underlying codes.
export const AppSupportedLocales = Object.fromEntries(
  Object.entries(SupportedLanguages).map(([key, value]) => [
    key,
    { code: value.code, name: value.nativeName, flag: value.flag },
  ])
) as Record<LanguageCode, { code: string; name: string; flag: string }>;

export type AppLocale = LanguageCode;

// All available locales - English is the master/fallback
const locales: Record<AppLocale, Record<string, unknown>> = {
  en: enLocale,
  es: esLocale,
  fr: frLocale,
  de: deLocale,
  he: heLocale,
  ja: jaLocale,
  "zh-CN": zhCNLocale,
  ar: arLocale,
  pt: ptLocale,
  ru: ruLocale,
  it: itLocale,
  "sr-Latn": srLatnLocale,
  "sr-Cyrl": srCyrlLocale,
};

// Master locale for fallback
const MASTER_LOCALE: AppLocale = "en";

// Locales rendered right-to-left
const RTL_LOCALES: AppLocale[] = ["he", "ar"];

function isRtl(loc: AppLocale): boolean {
  return RTL_LOCALES.includes(loc);
}

// localStorage key for persisting locale
const LOCALE_STORAGE_KEY = "quiz0r-locale";

// Default locale
const DEFAULT_LOCALE: AppLocale = "en";

interface I18nContextType {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLocales: typeof AppSupportedLocales;
  htmlLang: string;
  dir: "ltr" | "rtl";
  isRtl: boolean;
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

  // Keep <html lang> and <html dir> in sync with the active locale.
  // dir="rtl" is applied for Hebrew and Arabic; everything else is "ltr".
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  // Sync changes to localStorage
  const setLocale = useCallback((newLocale: AppLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
  }, []);

  // Translation function - English is the master fallback
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const currentLocale = locales[locale];
      const value = getNestedValue(currentLocale, key);

      let result: string;
      if (value !== undefined) {
        result = value;
      } else {
        // Fallback to master locale (English) for any missing translation
        const masterLocaleData = locales[MASTER_LOCALE];
        const fallback = getNestedValue(masterLocaleData, key);
        result = fallback !== undefined ? fallback : key;
      }

      // Interpolate {param} placeholders
      if (params) {
        result = result.replace(/\{(\w+)\}/g, (_, name: string) =>
          name in params ? String(params[name]) : `{${name}}`
        );
      }
      return result;
    },
    [locale]
  );

  // HTML lang attribute value
  const htmlLang = locale;
  const rtl = isRtl(locale);
  const dir: "ltr" | "rtl" = rtl ? "rtl" : "ltr";

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        availableLocales: AppSupportedLocales,
        htmlLang,
        dir,
        isRtl: rtl,
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
